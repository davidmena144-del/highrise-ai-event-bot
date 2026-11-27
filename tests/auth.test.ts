import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
// @ts-ignore - plain ESM server module without types
import { createApp, hashPassword, loadConfig, verifyPassword } from "../server/app.mjs";

const PASS = "correct horse battery staple";
let server: any, base = "";
let tmp = "";

function env(over: Record<string, string> = {}) {
  return { APP_USERNAME: "david", APP_PASSWORD_HASH: hashPassword(PASS), SESSION_SECRET: "x".repeat(40),
    DIST_DIR: path.join(tmp, "dist"), PUBLIC_DIR: path.resolve("public"), INSECURE_COOKIES: "1", MAX_FAILURES: "3", ...over };
}
async function login(user: string, pw: string) {
  return fetch(base + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: user, password: pw }) });
}

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hb-"));
  fs.mkdirSync(path.join(tmp, "dist/assets"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "dist/index.html"), "<html>SECRET-APP</html>");
  fs.writeFileSync(path.join(tmp, "dist/assets/a.js"), "console.log('app')");
  fs.writeFileSync(path.join(tmp, "outside.txt"), "outside");
  server = createApp(loadConfig(env()));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

describe("login and access control", () => {
  it("refuses to start without secrets configured", () => {
    expect(() => loadConfig({})).toThrow(/APP_PASSWORD_HASH/);
    expect(() => loadConfig(env({ SESSION_SECRET: "short" }))).toThrow(/SESSION_SECRET/);
  });
  it("hashes passwords with scrypt and verifies them", () => {
    const h = hashPassword("abc");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(h).not.toContain("abc");
    expect(verifyPassword("abc", h)).toBe(true);
    expect(verifyPassword("abd", h)).toBe(false);
  });
  it("redirects anonymous page requests to /login and serves no app content", async () => {
    const r = await fetch(base + "/", { redirect: "manual" });
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("/login");
    expect(await r.text()).not.toContain("SECRET-APP");
  });
  it("blocks anonymous access to app assets and API", async () => {
    expect((await fetch(base + "/assets/a.js", { redirect: "manual" })).status).toBe(302);
    expect((await fetch(base + "/api/session")).status).toBe(401);
  });
  it("serves the login page publicly, in Arabic RTL, without app code", async () => {
    const r = await fetch(base + "/login");
    const t = await r.text();
    expect(r.status).toBe(200);
    expect(t).toContain('dir="rtl"');
    expect(t).not.toContain("SECRET-APP");
  });
  it("rejects wrong password and wrong username", async () => {
    expect((await login("david", "nope")).status).toBe(401);
    expect((await login("eve", PASS)).status).toBe(401);
  });
  it("rejects forged and tampered cookies", async () => {
    for (const c of ["hb_session=abc.def", "hb_session=", "hb_session=eyJ1IjoiZGF2aWQiLCJleHAiOjk5OTk5OTk5OTk5OTl9.AAAA"]) {
      expect((await fetch(base + "/", { headers: { cookie: c }, redirect: "manual" })).status).toBe(302);
    }
  });
  it("logs in, sets a hardened cookie, serves the app, then logout revokes the session", async () => {
    const r = await login("david", PASS);
    expect(r.status).toBe(200);
    const setCookie = r.headers.get("set-cookie")!;
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Strict/);
    const cookie = setCookie.split(";")[0];
    const app = await fetch(base + "/", { headers: { cookie } });
    expect(app.status).toBe(200);
    expect(await app.text()).toContain("SECRET-APP");
    expect(app.headers.get("x-frame-options")).toBe("DENY");
    expect(app.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect((await fetch(base + "/api/session", { headers: { cookie } })).status).toBe(200);
    await fetch(base + "/api/logout", { method: "POST", headers: { cookie } });
    expect((await fetch(base + "/", { headers: { cookie }, redirect: "manual" })).status).toBe(302);
  });
  it("marks cookies Secure by default (production)", async () => {
    const s = createApp(loadConfig(env({ INSECURE_COOKIES: "0" })));
    await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
    const b = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
    const r = await fetch(b + "/api/login", { method: "POST", body: JSON.stringify({ username: "david", password: PASS }) });
    expect(r.headers.get("set-cookie")).toMatch(/Secure/);
    s.close();
  });
  it("does not allow path traversal", async () => {
    const cookie = (await login("david", PASS)).headers.get("set-cookie")!.split(";")[0];
    const r = await fetch(base + "/..%2foutside.txt", { headers: { cookie } });
    expect(await r.text()).not.toContain("outside");
  });
  it("locks out after repeated failures", async () => {
    const s = createApp(loadConfig(env()));
    await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
    const b = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
    const bad = () => fetch(b + "/api/login", { method: "POST", body: JSON.stringify({ username: "david", password: "bad" }) });
    for (let i = 0; i < 3; i++) await bad();
    expect((await bad()).status).toBe(429);
    const good = await fetch(b + "/api/login", { method: "POST", body: JSON.stringify({ username: "david", password: PASS }) });
    expect(good.status).toBe(429);
    s.close();
  });
});
