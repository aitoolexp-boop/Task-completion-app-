// GoalSync — app.js
// Phase 2: Real Firebase Google Sign-In with local persistence.
// Uses REDIRECT flow (not popup) — popups are unreliable inside mobile
// browsers/PWAs and were the likely cause of the blank-screen bug.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
  browserLocalPersistence,
  setPersistence
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCyACAYgsenB3NEbI8LA1I4SrZJ26BFmW0",
  authDomain: "task-completion-app.firebaseapp.com",
  projectId: "task-completion-app",
  storageBucket: "task-completion-app.firebasestorage.app",
  messagingSenderId: "402705612411",
  appId: "1:402705612411:web:9978107930252fc7396cde"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// --- DOM references ---
const loginScreen = document.getElementById("login-screen");
const loadingScreen = document.getElementById("loading-screen");
const homeScreen = document.getElementById("home-screen");
const loadingText = document.getElementById("loading-text");
const statusNote = document.getElementById("status-note");
const googleBtn = document.getElementById("google-btn");
const logoutBtn = document.getElementById("logout-btn");
const logoutModal = document.getElementById("logout-modal");
const logoutCancel = document.getElementById("logout-cancel");
const logoutConfirm = document.getElementById("logout-confirm");
const userName = document.getElementById("user-name");
const userPhoto = document.getElementById("user-photo");

function showScreen(screen) {
  [loginScreen, loadingScreen, homeScreen].forEach((s) => s.classList.add("hidden"));
  screen.classList.remove("hidden");
}

// --- Register service worker (installability + offline shell) ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("SW registration failed:", err);
    });
  });
}

// --- Set persistence so login survives closing the app/browser ---
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("Persistence setup failed:", err);
});

// --- Google Sign-In button ---
googleBtn.addEventListener("click", () => {
  statusNote.textContent = "Redirecting to Google…";
  signInWithRedirect(auth, provider).catch((err) => {
    console.error("Sign-in redirect failed:", err);
    statusNote.textContent = "Something went wrong. Please try again.";
  });
});

// --- Handle the return trip from Google (after redirect) ---
// This resolves any pending redirect BEFORE onAuthStateChanged fires,
// so we don't flash the login screen unnecessarily.
showScreen(loadingScreen);
loadingText.textContent = "Checking your session…";

getRedirectResult(auth).catch((err) => {
  console.error("Redirect result error:", err);
  statusNote.textContent = "Sign-in didn't complete. Please try again.";
});

// --- Central auth state listener — this is the single source of truth ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    userName.textContent = user.displayName || "there";
    userPhoto.src = user.photoURL || "/icon-192.png";
    showScreen(homeScreen);
  } else {
    showScreen(loginScreen);
  }
});

// --- Logout flow with confirmation (fixes accidental-logout bug) ---
logoutBtn.addEventListener("click", () => {
  logoutModal.classList.remove("hidden");
});

logoutCancel.addEventListener("click", () => {
  logoutModal.classList.add("hidden");
});

logoutConfirm.addEventListener("click", () => {
  logoutModal.classList.add("hidden");
  showScreen(loadingScreen);
  loadingText.textContent = "Logging out…";
  signOut(auth).catch((err) => {
    console.error("Sign-out failed:", err);
  });
});

// Close modal by tapping outside the box
logoutModal.addEventListener("click", (e) => {
  if (e.target === logoutModal) {
    logoutModal.classList.add("hidden");
  }
});

