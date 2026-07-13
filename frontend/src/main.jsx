// Intercept fetch
const originalFetch = window.fetch;
window.fetch = async function(resource, init) {
  const url = typeof resource === 'string' ? resource : (resource?.url || '');
  if (url.includes('/cart/add')) {
    console.log("INTERCEPTED_REQUEST_PAYLOAD:", init?.body);
    try {
      const response = await originalFetch.apply(this, arguments);
      const clone = response.clone();
      const text = await clone.text();
      console.log("INTERCEPTED_RESPONSE_BODY:", text);
      return response;
    } catch (err) {
      console.error("INTERCEPTED_ERROR:", err);
      throw err;
    }
  }
  return originalFetch.apply(this, arguments);
};

// Intercept XMLHttpRequest
const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method, url, ...args) {
  this._url = url;
  this._method = method;
  return originalOpen.apply(this, [method, url, ...args]);
};

XMLHttpRequest.prototype.send = function(body, ...args) {
  if (this._url && this._url.includes('/cart/add')) {
    console.log("INTERCEPTED_REQUEST_PAYLOAD:", body);
    this.addEventListener('readystatechange', () => {
      if (this.readyState === 4) {
        console.log("INTERCEPTED_RESPONSE_BODY:", this.responseText);
      }
    });
  }
  return originalSend.apply(this, [body, ...args]);
};

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ensureStorageSchema } from '@core/utils/storage';

// Wipe legacy persisted blobs from previous schema versions on the very first
// load after a deploy. Runs synchronously before React mounts so no component
// can ever read stale state from a bumped schema version.
ensureStorageSchema();

// Prevent pinch-to-zoom on iOS devices
document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
});

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
