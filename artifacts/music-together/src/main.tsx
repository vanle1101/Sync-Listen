import { createRoot } from "react-dom/client";
import { configureApiBaseUrl } from "@/lib/runtime-config";
import App from "./App";
import "./index.css";

configureApiBaseUrl();

createRoot(document.getElementById("root")!).render(<App />);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // ignore registration failures in unsupported contexts
    });
  });
}
