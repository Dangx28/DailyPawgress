// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA0DVFoWcr61YjHMMxmaTivEhkd-GiDX9o",
  authDomain: "dailypawgress.firebaseapp.com",
  projectId: "dailypawgress",
  storageBucket: "dailypawgress.firebasestorage.app",
  messagingSenderId: "823227535242",
  appId: "1:823227535242:web:f1da1bf50405d1591bc273",
  measurementId: "G-WHQ1BY3Y89",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  console.log("Running locally! Connecting to Emulators...");

  // Connect to the local Auth emulator (default port is 9099)
  connectAuthEmulator(auth, "http://localhost:9099");

  // Connect to the local Firestore emulator (default port is 8080)
  connectFirestoreEmulator(db, "localhost", 8080);
}

export { auth, db };
