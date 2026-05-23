import { initializeApp }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA0DVFoWcr61YjHMMxmaTivEhkd-GiDX9o",
  authDomain: "dailypawgress.firebaseapp.com",
  projectId: "dailypawgress",
  storageBucket: "dailypawgress.firebasestorage.app",
  messagingSenderId: "823227535242",
  appId: "1:823227535242:web:f1da1bf50405d1591bc273",
  measurementId: "G-WHQ1BY3Y89"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);