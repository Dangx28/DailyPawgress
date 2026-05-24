// 1. Use standard URLs so the browser can easily download or cache the Firebase code
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA0DVFoWcr61YjHMMxmaTivEhkd-GiDX9o",
  authDomain: "dailypawgress.firebaseapp.com",
  projectId: "dailypawgress",
  storageBucket: "dailypawgress.firebasestorage.app",
  messagingSenderId: "823227535242",
  appId: "1:823227535242:web:f1da1bf50405d1591bc273",
  measurementId: "G-WHQ1BY3Y89",
};

// 2. Initialize your services globally
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// 3. Smart Routing: Only route data to the local emulator if running locally
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
  console.log("Development environment detected. Routing traffic to local emulators...");
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "localhost", 8080);
} else {
  console.log("Production environment detected. Using live Google Cloud database.");
}