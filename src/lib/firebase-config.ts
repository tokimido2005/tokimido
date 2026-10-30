/** Public Firebase web config for Rabotaem.md (safe to ship to the client). */
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBL5adQ7l19NL-p9sBuIIPflf0xwQOT0jM",
  authDomain: "rabotaem-79c83.firebaseapp.com",
  projectId: "rabotaem-79c83",
  storageBucket: "rabotaem-79c83.firebasestorage.app",
  messagingSenderId: "763180806225",
  appId: "1:763180806225:web:ece668a30b8727f0c78870",
  measurementId: "G-0901ZGPNE9",
} as const;

/** Web Push certificate (public) from Firebase Console → Cloud Messaging. */
export const FIREBASE_VAPID_KEY =
  "BPyUgJBqEXs8yeBzlWbtE960jO3b8uxDVYBF1IwtANd5H_5RMBUhlA1U2XW4wQPX9P4_nEdDmJWmC4_M50yxByM";

export const FCM_SW_PATH = "/firebase-messaging-sw.js";
export const FCM_SW_SCOPE = "/firebase-cloud-messaging-push-scope";
