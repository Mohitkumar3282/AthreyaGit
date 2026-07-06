import { getFirebaseAdminApp } from '../app/config/firebaseAdmin.js';

try {
    const app = getFirebaseAdminApp();
    if (app) {
        console.log("Firebase Admin successfully initialized!");
    } else {
        console.log("Firebase Admin initialization skipped (null returned).");
    }
} catch (error) {
    console.error("Firebase Admin initialization threw an error:", error);
}
