import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// iOS and mobile optimizations
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

if (isIOS || isMobile) {
  // Fix viewport for iOS
  const viewport = document.querySelector('meta[name=viewport]');
  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, shrink-to-fit=no');
  }
  
  // Prevent zoom on input focus for iOS
  document.addEventListener('touchstart', function() {}, {passive: true});
  
  // Fix iOS Safari bottom bar issues
  const setViewportHeight = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };
  
  setViewportHeight();
  window.addEventListener('resize', setViewportHeight);
  window.addEventListener('orientationchange', () => {
    setTimeout(setViewportHeight, 100);
  });
}

// Prevent default touch behaviors that might interfere
document.addEventListener('touchmove', function(e) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
    return; // Allow scrolling in input fields
  }
}, {passive: false});

createRoot(document.getElementById("root")!).render(<App />);
