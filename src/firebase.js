import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app = null;
let auth = null;
let db = null;
let useMock = false;
let messagingPromise = null;

const hasValidConfig =
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.includes("YOUR_") &&
  firebaseConfig.apiKey !== "";

if (!hasValidConfig) {
  console.warn("Firebase credentials not configured. Running in Local Mock Mode.");
  useMock = true;
} else {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);

    // Auth session must survive mobile browser restarts
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn("Auth persistence setup failed:", err);
    });

    // Firestore with offline cache — keeps data available on flaky mobile networks
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache()
      });
    } catch {
      db = getFirestore(app);
    }

    // NOTE: Do NOT call getMessaging() here — it throws on many mobile browsers
    // (iOS Safari, missing service worker) and used to disable ALL of Firebase.
  } catch (error) {
    console.error("Failed to initialize Firebase, falling back to Local Mock Mode:", error);
    useMock = true;
    app = null;
    auth = null;
    db = null;
  }
}

/** Lazy-load FCM only when supported (safe on mobile). */
export async function getMessagingSafe() {
  if (useMock || !app) return null;

  if (!messagingPromise) {
    messagingPromise = (async () => {
      try {
        const { getMessaging, isSupported } = await import("firebase/messaging");
        const supported = await isSupported();
        if (!supported) return null;
        return getMessaging(app);
      } catch (err) {
        console.warn("Firebase Messaging unavailable on this device:", err);
        return null;
      }
    })();
  }

  return messagingPromise;
}

export { auth, db, useMock, firebaseConfig, app };
