// GoalSync — app.js
// Phase 3: Firestore user profiles, referral codes, onboarding choice,
// and the Home / Scoreboard / Friends bottom nav.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  browserLocalPersistence,
  setPersistence
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

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
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- DOM references: top-level screens ---
const loginScreen = document.getElementById("login-screen");
const loadingScreen = document.getElementById("loading-screen");
const appShell = document.getElementById("app-shell");
const loadingText = document.getElementById("loading-text");
const statusNote = document.getElementById("status-note");
const googleBtn = document.getElementById("google-btn");
const logoutBtn = document.getElementById("logout-btn");
const logoutModal = document.getElementById("logout-modal");
const logoutCancel = document.getElementById("logout-cancel");
const logoutConfirm = document.getElementById("logout-confirm");
const userName = document.getElementById("user-name");
const userPhoto = document.getElementById("user-photo");

// --- DOM references: tabs ---
const tabHome = document.getElementById("tab-home");
const tabScoreboard = document.getElementById("tab-scoreboard");
const tabFriends = document.getElementById("tab-friends");
const navBtns = document.querySelectorAll(".nav-btn");

// --- DOM references: home sub-views ---
const homeChoice = document.getElementById("home-choice");
const homeReferredEntry = document.getElementById("home-referred-entry");
const homeOwnPlaceholder = document.getElementById("home-own-placeholder");
const homeConnectedPlaceholder = document.getElementById("home-connected-placeholder");
const choiceOwnBtn = document.getElementById("choice-own");
const choiceReferredBtn = document.getElementById("choice-referred");
const referredBack = document.getElementById("referred-back");
const referralInput = document.getElementById("referral-input");
const referralSubmit = document.getElementById("referral-submit");
const referralError = document.getElementById("referral-error");
const connectedFriendName = document.getElementById("connected-friend-name");
const ownRedoBtn = document.getElementById("own-redo");
const connectedRedoBtn = document.getElementById("connected-redo");
const myReferralCodeEl = document.getElementById("my-referral-code");

// --- Redo setup modal ---
const redoModal = document.getElementById("redo-modal");
const redoCancel = document.getElementById("redo-cancel");
const redoConfirm = document.getElementById("redo-confirm");

let currentUid = null;

function showScreen(screen) {
  [loginScreen, loadingScreen, appShell].forEach((s) => s.classList.add("hidden"));
  screen.classList.remove("hidden");
}

function showHomeSubView(view) {
  [homeChoice, homeReferredEntry, homeOwnPlaceholder, homeConnectedPlaceholder].forEach((v) =>
    v.classList.add("hidden")
  );
  view.classList.remove("hidden");
}

function switchTab(tabName) {
  [tabHome, tabScoreboard, tabFriends].forEach((t) => t.classList.add("hidden"));
  navBtns.forEach((b) => b.classList.remove("active"));

  if (tabName === "home") {
    tabHome.classList.remove("hidden");
  } else if (tabName === "scoreboard") {
    tabScoreboard.classList.remove("hidden");
  } else if (tabName === "friends") {
    tabFriends.classList.remove("hidden");
  }

  document.querySelector(`.nav-btn[data-tab="${tabName}"]`).classList.add("active");
}

navBtns.forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// --- Register service worker ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("SW registration failed:", err);
    });
  });
}

setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("Persistence setup failed:", err);
});

// --- Google Sign-In ---
googleBtn.addEventListener("click", () => {
  statusNote.textContent = "Opening Google sign-in…";
  googleBtn.disabled = true;

  signInWithPopup(auth, provider).catch((err) => {
    console.error("Popup sign-in error:", err);
    statusNote.textContent = "Sign-in error: " + err.code + " — " + err.message;
    googleBtn.disabled = false;
  });
});

// --- Referral code generator ---
function generateReferralCode(displayName) {
  const firstName = (displayName || "USER").split(" ")[0].toUpperCase().replace(/[^A-Z]/g, "") || "USER";
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${firstName}-${randomNum}`;
}

async function generateUniqueReferralCode(displayName) {
  for (let i = 0; i < 5; i++) {
    const code = generateReferralCode(displayName);
    const q = query(collection(db, "users"), where("referralCode", "==", code));
    const snap = await getDocs(q);
    if (snap.empty) return code;
  }
  // fallback: timestamp-based, virtually guaranteed unique
  return generateReferralCode(displayName) + "-" + Date.now().toString().slice(-4);
}

// --- Load or create the user's Firestore profile, then render Home ---
async function loadUserProfile(user) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  let profile;
  if (snap.exists()) {
    profile = snap.data();
  } else {
    const referralCode = await generateUniqueReferralCode(user.displayName);
    profile = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || "",
      photoURL: user.photoURL || "",
      referralCode,
      startMethod: null,
      referredBy: null,
      createdAt: serverTimestamp()
    };
    await setDoc(userRef, profile);
  }

  myReferralCodeEl.textContent = profile.referralCode || "—";
  renderHomeForProfile(profile);
}

function renderHomeForProfile(profile) {
  if (profile.startMethod === "own") {
    showHomeSubView(homeOwnPlaceholder);
  } else if (profile.startMethod === "referred") {
    connectedFriendName.textContent = profile.referredByName || "your friend";
    showHomeSubView(homeConnectedPlaceholder);
  } else {
    showHomeSubView(homeChoice);
  }
}

// --- Choice: Make Your Own ---
choiceOwnBtn.addEventListener("click", async () => {
  if (!currentUid) return;
  await updateDoc(doc(db, "users", currentUid), { startMethod: "own" });
  showHomeSubView(homeOwnPlaceholder);
});

// --- Choice: Referred by a Friend ---
choiceReferredBtn.addEventListener("click", () => {
  referralError.textContent = "";
  referralInput.value = "";
  showHomeSubView(homeReferredEntry);
});

referredBack.addEventListener("click", () => {
  showHomeSubView(homeChoice);
});

referralSubmit.addEventListener("click", async () => {
  const code = referralInput.value.trim().toUpperCase();
  referralError.textContent = "";

  if (!code) {
    referralError.textContent = "Please enter a code.";
    return;
  }
  if (!currentUid) return;

  referralSubmit.disabled = true;
  referralSubmit.textContent = "Checking…";

  try {
    const q = query(collection(db, "users"), where("referralCode", "==", code));
    const snap = await getDocs(q);

    if (snap.empty) {
      referralError.textContent = "That code doesn't match any account. Please check and try again.";
      referralSubmit.disabled = false;
      referralSubmit.textContent = "Submit";
      return;
    }

    const friendDoc = snap.docs[0];
    const friendUid = friendDoc.id;
    const friendData = friendDoc.data();

    if (friendUid === currentUid) {
      referralError.textContent = "That's your own code — enter a friend's code instead.";
      referralSubmit.disabled = false;
      referralSubmit.textContent = "Submit";
      return;
    }

    // Link the accounts: update this user, and notify the friend
    await updateDoc(doc(db, "users", currentUid), {
      startMethod: "referred",
      referredBy: friendUid,
      referredByName: friendData.displayName || "a friend"
    });

    // Add each other to a simple "friends" array on both profiles
    await updateDoc(doc(db, "users", currentUid), {
      friends: [friendUid]
    });
    const friendRef = doc(db, "users", friendUid);
    const friendSnap = await getDoc(friendRef);
    const existingFriends = (friendSnap.data().friends) || [];
    if (!existingFriends.includes(currentUid)) {
      await updateDoc(friendRef, { friends: [...existingFriends, currentUid] });
    }

    connectedFriendName.textContent = friendData.displayName || "your friend";
    showHomeSubView(homeConnectedPlaceholder);
  } catch (err) {
    console.error("Referral code error:", err);
    referralError.textContent = "Something went wrong. Please try again.";
  }

  referralSubmit.disabled = false;
  referralSubmit.textContent = "Submit";
});

// --- Redo setup (available from Home even after setup) ---
let pendingRedo = false;

ownRedoBtn.addEventListener("click", () => {
  pendingRedo = true;
  redoModal.classList.remove("hidden");
});
connectedRedoBtn.addEventListener("click", () => {
  pendingRedo = true;
  redoModal.classList.remove("hidden");
});

redoCancel.addEventListener("click", () => {
  redoModal.classList.add("hidden");
  pendingRedo = false;
});

redoConfirm.addEventListener("click", async () => {
  redoModal.classList.add("hidden");
  if (!pendingRedo || !currentUid) return;
  await updateDoc(doc(db, "users", currentUid), {
    startMethod: null,
    referredBy: null,
    referredByName: null
  });
  showHomeSubView(homeChoice);
  pendingRedo = false;
});

redoModal.addEventListener("click", (e) => {
  if (e.target === redoModal) {
    redoModal.classList.add("hidden");
    pendingRedo = false;
  }
});

// --- Central auth state listener ---
showScreen(loadingScreen);
loadingText.textContent = "Checking your session…";

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUid = user.uid;
    userName.textContent = user.displayName || "there";
    userPhoto.src = user.photoURL || "/icon-192.png";

    showScreen(loadingScreen);
    loadingText.textContent = "Preparing your goals…";

    try {
      await loadUserProfile(user);
      switchTab("home");
      showScreen(appShell);
    } catch (err) {
      console.error("Profile load error:", err);
      loadingText.textContent = "Something went wrong loading your profile.";
    }
  } else {
    currentUid = null;
    showScreen(loginScreen);
    googleBtn.disabled = false;
  }
});

// --- Logout flow with confirmation ---
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

logoutModal.addEventListener("click", (e) => {
  if (e.target === logoutModal) {
    logoutModal.classList.add("hidden");
  }
});
    
