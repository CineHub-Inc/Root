// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAH2jhJPj-pbGRqDbRMJXljguEiYR2C9qk",
  authDomain: "cinehub-151125.firebaseapp.com",
  projectId: "cinehub-151125",
  storageBucket: "cinehub-151125.firebasestorage.app",
  messagingSenderId: "928617913826",
  appId: "1:928617913826:web:6e128a213adc32b9812dbb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
