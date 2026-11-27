import { createApp, loadConfig } from "./app.mjs";
const cfg = loadConfig();
const port = Number(process.env.PORT || 8080);
createApp(cfg).listen(port, "0.0.0.0", () => console.log(`Highrise AI Event Bot listening on ${port}`));
