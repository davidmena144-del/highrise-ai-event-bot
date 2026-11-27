import { describe, expect, it } from "vitest";
import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");
const login = fs.readFileSync("public/login.html", "utf8");
const manifest = JSON.parse(fs.readFileSync("public/manifest.webmanifest", "utf8"));

describe("mobile / PWA readiness", () => {
  it("app and login pages are RTL Arabic with a mobile viewport", () => {
    for (const h of [html, login]) {
      expect(h).toContain('lang="ar"');
      expect(h).toContain('dir="rtl"');
      expect(h).toContain("width=device-width");
      expect(h).toContain("noindex");
    }
  });
  it("has an installable manifest with icons that exist", () => {
    expect(manifest.display).toBe("standalone");
    expect(manifest.dir).toBe("rtl");
    expect(manifest.start_url).toBe("/");
    const sizes = manifest.icons.map((i: any) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    for (const i of manifest.icons) expect(fs.existsSync("public" + i.src)).toBe(true);
  });
  it("service worker caches nothing", () => {
    const sw = fs.readFileSync("public/sw.js", "utf8");
    expect(sw).not.toMatch(/caches\.|cache\.put|addAll/);
  });
  it("ships no secrets in client code or public files", () => {
    for (const f of ["public/login.js", "public/login.html", "public/sw.js", "src/ui/App.tsx", "src/ui/controller.ts"]) {
      expect(fs.readFileSync(f, "utf8")).not.toMatch(/SESSION_SECRET|APP_PASSWORD|scrypt\$/);
    }
  });
});
