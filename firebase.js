import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA0DVFoWcr61YjHMMxmaTivEhkd-GiDX9o",
  authDomain: "dailypawgress.firebaseapp.com",
  projectId: "dailypawgress",
  storageBucket: "dailypawgress.firebasestorage.app",
  messagingSenderId: "823227535242",
  appId: "1:823227535242:web:f1da1bf50405d1591bc273",
  measurementId: "G-WHQ1BY3Y89",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize Firestore with local caching enabled so it doesn't panic offline
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

// FORCE EMULATORS CONTEXT IMMEDIATELY
connectAuthEmulator(auth, "http://localhost:9099");
connectFirestoreEmulator(db, "localhost", 8080);

export { app, auth, db };
