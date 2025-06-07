import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Ensure this path is correct

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("找不到根元素掛載React應用程式 (Could not find root element to mount React application)");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
