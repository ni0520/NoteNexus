import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// iOS viewport fix
if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
  const viewport = document.querySelector('meta[name=viewport]');
  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
  }
}

createRoot(document.getElementById("root")!).render(<App />);
