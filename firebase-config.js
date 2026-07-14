// firebase-config.js
// Firebase configuration is loaded from window.env (populated by loadEnv.js)
// To use this app, fill in your actual values in the .env file.

const firebaseConfig = {
  apiKey:            (window.env && window.env.FIREBASE_API_KEY)            || "YOUR_API_KEY",
  authDomain:        (window.env && window.env.FIREBASE_AUTH_DOMAIN)        || "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         (window.env && window.env.FIREBASE_PROJECT_ID)         || "YOUR_PROJECT_ID",
  storageBucket:     (window.env && window.env.FIREBASE_STORAGE_BUCKET)     || "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: (window.env && window.env.FIREBASE_MESSAGING_SENDER_ID)|| "YOUR_MESSAGING_SENDER_ID",
  appId:             (window.env && window.env.FIREBASE_APP_ID)             || "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence for Firestore
db.enablePersistence()
  .catch(function(err) {
    if (err.code === 'failed-precondition') {
      console.warn('[Firebase] Multiple tabs open – persistence only active in one tab.');
    } else if (err.code === 'unimplemented') {
      console.warn('[Firebase] Persistence is not supported in this browser.');
    }
  });
