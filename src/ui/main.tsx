/// <reference types="vite/client" />
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if (typeof navigator !== "undefined" && "serviceWorker" in navigator && import.meta.env?.PROD) {
  navigator.serviceWorker.register("/sw.js").catch(() => undefined);
}
