// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";


// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCFrLqXRt1MbSLuZhbr8DIlkmnJAEMu4IE",
  authDomain: "ishara-app-73a98.firebaseapp.com",
  projectId: "ishara-app-73a98",
  storageBucket: "ishara-app-73a98.firebasestorage.app",
  messagingSenderId: "904878479574",
  appId: "1:904878479574:web:3c31f16eee5f33716cd177",
  measurementId: "G-4PM0GH0V9G"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export { app };

