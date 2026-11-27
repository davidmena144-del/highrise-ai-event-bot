// Vercel serves everything in outputDirectory publicly. Put ONLY the login assets there;
// the app bundle (dist/) is bundled into the function and served after login.
import fs from "node:fs";
fs.rmSync("static", { recursive: true, force: true });
fs.cpSync("public", "static", { recursive: true });
fs.rmSync("static/login.html"); // served by the function at /login
console.log("static/:", fs.readdirSync("static").join(", "));
