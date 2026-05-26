import { auth } from './firebase-init.js';
import { createUserWithEmailAndPassword,
         signInWithEmailAndPassword, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Make auth available to app.js
window.auth = auth;

// Auth guard — only redirect if confirmed logged in
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "index.html";
});

// ── Expose functions to HTML ──
window.switchTab = function (tab) {
  document.getElementById("form-login").style.display =
    tab === "login" ? "block" : "none";
  document.getElementById("form-signup").style.display =
    tab === "signup" ? "block" : "none";
  document
    .getElementById("tab-login")
    .classList.toggle("active", tab === "login");
  document
    .getElementById("tab-signup")
    .classList.toggle("active", tab === "signup");
  document.getElementById("login-error").textContent = "";
  document.getElementById("signup-error").textContent = "";
};

window.handleLogin = async function () {
  const email = document.getElementById("login-user").value.trim();
  const pass = document.getElementById("login-pass").value;
  const err = document.getElementById("login-error");

  if (!email || !pass) {
    err.textContent = "Please fill in all fields.";
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    window.location.href = "index.html";
  } catch (e) {
    if (e.code === "auth/user-not-found")
      err.textContent = "Account not found.";
    else if (e.code === "auth/wrong-password")
      err.textContent = "Incorrect password.";
    else if (e.code === "auth/invalid-email")
      err.textContent = "Invalid email address.";
    else if (e.code === "auth/invalid-credential")
      err.textContent = "Invalid email or password.";
    else err.textContent = "Login failed: " + e.message;
  }
};

window.handleSignup = async function () {
  const email = document.getElementById("signup-user").value.trim();
  const pass = document.getElementById("signup-pass").value;
  const confirm = document.getElementById("signup-confirm").value;
  const err = document.getElementById("signup-error");

  if (!email || !pass || !confirm) {
    err.textContent = "Please fill in all fields.";
    return;
  }
  if (pass !== confirm) {
    err.textContent = "Passwords do not match.";
    return;
  }
  if (pass.length < 6) {
    err.textContent = "Password must be at least 6 characters.";
    return;
  }

  try {
    await createUserWithEmailAndPassword(auth, email, pass);
    window.location.href = "index.html";
  } catch (e) {
    if (e.code === "auth/email-already-in-use")
      err.textContent = "Email already taken.";
    else if (e.code === "auth/invalid-email")
      err.textContent = "Invalid email address.";
    else if (e.code === "auth/weak-password")
      err.textContent = "Password is too weak.";
    else err.textContent = "Signup failed: " + e.message;
  }
};

window.switchTab    = switchTab;
window.handleLogin  = handleLogin;
window.handleSignup = handleSignup;