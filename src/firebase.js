// Import Firebase core
import { initializeApp } from "firebase/app";

// Import Firebase services
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCGfwnmBp42vs14tjZRvGbgSkmhld7TJ34",
  authDomain: "orbitxos.firebaseapp.com",
  projectId: "orbitxos",
  storageBucket: "orbitxos.firebasestorage.app",
  messagingSenderId: "942867891308",
  appId: "1:942867891308:web:b3b6cd9c6b160d26570449",
  measurementId: "G-KC08M785RJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Analytics (optional)
const analytics = getAnalytics(app);

// Authentication
export const auth = getAuth(app);

// Google Login Provider
export const googleProvider = new GoogleAuthProvider();