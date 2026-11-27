// Vercel serverless entry. Every request (except the public login assets) is routed here by vercel.json.
import { createHandler, loadConfig } from "../server/app.mjs";
let handler;
export default function (req, res) {
  handler ??= createHandler(loadConfig({ ...process.env, DIST_DIR: process.cwd() + "/dist", PUBLIC_DIR: process.cwd() + "/public" }));
  return handler(req, res);
}
