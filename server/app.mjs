// Private web server: password login + session cookie in front of the built app.
// No dependencies. Secrets come only from environment variables, never from client code.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".map": "application/json",
};

// Files reachable WITHOUT login (login page + install metadata only; no app code or data).
const PUBLIC_PATHS = new Set(["/login", "/login.html", "/login.js", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/sw.js", "/robots.txt"]);

export function hashPassword(password, salt = crypto.randomBytes(16)) {
  const hash = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (!salt.length || expected.length !== 32) return false;
  const actual = crypto.scryptSync(String(password), salt, 32, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(actual, expected);
}

function b64u(buf) { return Buffer.from(buf).toString("base64url"); }

export function loadConfig(env = process.env) {
  const username = env.APP_USERNAME || "";
  const passwordHash = env.APP_PASSWORD_HASH || "";
  const sessionSecret = env.SESSION_SECRET || "";
  const problems = [];
  if (!username) problems.push("APP_USERNAME is required");
  if (!/^scrypt\$[0-9a-f]+\$[0-9a-f]{64}$/.test(passwordHash)) problems.push("APP_PASSWORD_HASH is required (run: npm run hash-password)");
  if (sessionSecret.length < 32) problems.push("SESSION_SECRET is required (at least 32 characters)");
  if (problems.length) throw new Error("Invalid configuration: " + problems.join("; "));
  return {
    username, passwordHash, sessionSecret,
    distDir: env.DIST_DIR || path.resolve("dist"),
    publicDir: env.PUBLIC_DIR || path.resolve("public"),
    sessionTtlMs: Number(env.SESSION_TTL_HOURS || 12) * 3600_000,
    secureCookie: env.INSECURE_COOKIES !== "1", // HTTPS in production; only tests/local dev turn this off
    maxFailures: Number(env.MAX_FAILURES || 5),
    lockoutMs: Number(env.LOCKOUT_MINUTES || 15) * 60_000,
  };
}

export function createHandler(cfg) {
  const failures = new Map(); // ip -> { count, until }
  const revoked = new Set();

  const sign = (data) => b64u(crypto.createHmac("sha256", cfg.sessionSecret).update(data).digest());
  function issueToken() {
    const payload = b64u(JSON.stringify({ u: cfg.username, exp: Date.now() + cfg.sessionTtlMs, id: crypto.randomBytes(8).toString("hex") }));
    return `${payload}.${sign(payload)}`;
  }
  function readToken(req) {
    const cookie = req.headers.cookie || "";
    const m = /(?:^|;\s*)hb_session=([^;]+)/.exec(cookie);
    if (!m) return null;
    const [payload, sig] = m[1].split(".");
    if (!payload || !sig) return null;
    const good = sign(payload);
    const a = Buffer.from(sig), b = Buffer.from(good);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
      const d = JSON.parse(Buffer.from(payload, "base64url").toString());
      if (d.u !== cfg.username || typeof d.exp !== "number" || d.exp < Date.now() || revoked.has(d.id)) return null;
      return d;
    } catch { return null; }
  }

  const baseHeaders = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",
    ...(cfg.secureCookie ? { "Strict-Transport-Security": "max-age=31536000" } : {}),
  };
  const cookieAttrs = () => `Path=/; HttpOnly; SameSite=Strict${cfg.secureCookie ? "; Secure" : ""}`;

  function send(res, status, body, headers = {}) {
    res.writeHead(status, { ...baseHeaders, "Cache-Control": "no-store", ...headers });
    res.end(body);
  }
  const json = (res, status, obj, headers) => send(res, status, JSON.stringify(obj), { "Content-Type": "application/json; charset=utf-8", ...headers });

  function serveFile(res, file, cache) {
    fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, "Not found", { "Content-Type": "text/plain" });
      res.writeHead(200, { ...baseHeaders, "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": cache });
      res.end(data);
    });
  }
  function safeJoin(root, urlPath) {
    const p = path.normalize(path.join(root, decodeURIComponent(urlPath)));
    return p.startsWith(root + path.sep) || p === root ? p : null;
  }

  function readBody(req, limit = 4096) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on("data", (c) => { size += c.length; if (size > limit) { reject(new Error("too large")); req.destroy(); } else chunks.push(c); });
      req.on("end", () => resolve(Buffer.concat(chunks).toString()));
      req.on("error", reject);
    });
  }

  const clientIp = (req) => (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() || req.socket.remoteAddress || "?";

  return async (req, res) => {
    try {
      const url = new URL(req.url, "http://x");
      let p = url.pathname;
      if (p === "/healthz") return json(res, 200, { ok: true });

      if (p === "/api/login" && req.method === "POST") {
        const ip = clientIp(req);
        const f = failures.get(ip);
        if (f && f.until > Date.now()) return json(res, 429, { error: "محاولات كتير. حاول بعد شوية." }, { "Retry-After": String(Math.ceil((f.until - Date.now()) / 1000)) });
        let data = {};
        try { data = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: "طلب غير صالح" }); }
        const userOk = typeof data.username === "string" && data.username.length < 200 &&
          crypto.timingSafeEqual(crypto.createHash("sha256").update(data.username).digest(), crypto.createHash("sha256").update(cfg.username).digest());
        const passOk = typeof data.password === "string" && data.password.length < 500 && verifyPassword(data.password, cfg.passwordHash);
        if (!(userOk && passOk)) {
          const expired = f && f.until > 0 && f.until <= Date.now();
          const n = (expired ? 0 : f?.count || 0) + 1;
          failures.set(ip, { count: n, until: n >= cfg.maxFailures ? Date.now() + cfg.lockoutMs : 0 });
          return json(res, 401, { error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
        }
        failures.delete(ip);
        return json(res, 200, { ok: true }, { "Set-Cookie": `hb_session=${issueToken()}; Max-Age=${Math.floor(cfg.sessionTtlMs / 1000)}; ${cookieAttrs()}` });
      }

      if (p === "/api/logout" && req.method === "POST") {
        const t = readToken(req);
        if (t) revoked.add(t.id);
        return json(res, 200, { ok: true }, { "Set-Cookie": `hb_session=; Max-Age=0; ${cookieAttrs()}` });
      }

      if (p === "/api/session") {
        return readToken(req) ? json(res, 200, { authenticated: true }) : json(res, 401, { authenticated: false });
      }

      if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");

      if (p === "/login") p = "/login.html";
      if (PUBLIC_PATHS.has(p)) {
        const f = safeJoin(cfg.publicDir, p);
        return f ? serveFile(res, f, "no-cache") : send(res, 400, "Bad request");
      }

      // Everything else requires a valid session.
      if (!readToken(req)) {
        if (p.startsWith("/api/")) return json(res, 401, { error: "unauthorized" });
        return send(res, 302, "", { Location: "/login" });
      }
      if (p === "/") p = "/index.html";
      let f = safeJoin(cfg.distDir, p);
      if (!f) return send(res, 400, "Bad request");
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(cfg.distDir, "index.html");
      return serveFile(res, f, p.startsWith("/assets/") ? "private, max-age=3600" : "no-store");
    } catch {
      return send(res, 500, "Server error", { "Content-Type": "text/plain" });
    }
  };
}

export function createApp(cfg) {
  return http.createServer(createHandler(cfg));
}
