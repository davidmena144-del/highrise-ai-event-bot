// Usage: npm run hash-password   (prompts; the password is never stored, only its scrypt hash is printed)
import readline from "node:readline";
import crypto from "node:crypto";
import { hashPassword } from "../server/app.mjs";
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question("Choose a password (min 12 chars): ", (pw) => {
  rl.close();
  if (pw.length < 12) { console.error("Too short."); process.exit(1); }
  console.log("\nAPP_PASSWORD_HASH=" + hashPassword(pw));
  console.log("SESSION_SECRET=" + crypto.randomBytes(32).toString("hex"));
});
