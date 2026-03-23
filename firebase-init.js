// firebase-init.js — ES module
// Initializes Firebase and exposes auth/db helpers on window for non-module scripts.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA89NLyrcltVeoGcm1ygIT7wFemSJgHgOk",
  authDomain: "bingobreak-1a80b.firebaseapp.com",
  projectId: "bingobreak-1a80b",
  storageBucket: "bingobreak-1a80b.firebasestorage.app",
  messagingSenderId: "610564250705",
  appId: "1:610564250705:web:8f723a7829f73d1ec82c70",
  measurementId: "G-FFVE71BKJ5",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Expose to non-module scripts via window
window.fbAuth = auth;
window.fbDb = db;
window.fbDoc = doc;
window.fbSetDoc = setDoc;
window.fbGetDoc = getDoc;
window.fbCollection = collection;
window.fbAddDoc = addDoc;
window.fbServerTimestamp = serverTimestamp;
window.fbAuthFns = { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut };

// Auth state changes — calls into cloud.js callbacks once they're defined
onAuthStateChanged(auth, (user) => {
  window.fbUser = user || null;
  if (user) {
    window.onFbSignIn?.(user);
  } else {
    window.onFbSignOut?.();
  }
});
