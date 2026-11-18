import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ensureStorageSchema } from '@core/utils/storage';
import { installChunkErrorRecovery } from '@core/utils/chunkReload';

// After a new deploy, old lazy-loaded chunks are gone. Reload once to pick up
// the new build instead of showing "Failed to fetch dynamically imported module".
installChunkErrorRecovery();

// Wipe legacy persisted blobs from previous schema versions on the very first
// load after a deploy. Runs synchronously before React mounts so no component
// can ever read stale state from a bumped schema version.
ensureStorageSchema();

// Prevent pinch-to-zoom on iOS devices.
document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
});

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
