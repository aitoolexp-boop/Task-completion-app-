// GoalSync — app.js
// Phase 4: Real task CRUD (Firestore), task completion, token balance,
// and the today's-progress dashboard.

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
  deleteDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp,
  enableIndexedDbPersistence
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

// Enable offline persistence (Phase 7 groundwork — harmless to enable now)
enableIndexedDbPersistence(db).catch((err) => {
  console.warn("Offline persistence not enabled:", err.code);
});

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
const homeDashboard = document.getElementById("home-dashboard");
const choiceOwnBtn = document.getElementById("choice-own");
const choiceReferredBtn = document.getElementById("choice-referred");
const referredBack = document.getElementById("referred-back");
const referralInput = document.getElementById("referral-input");
const referralSubmit = document.getElementById("referral-submit");
const referralError = document.getElementById("referral-error");
const dashboardRedoBtn = document.getElementById("dashboard-redo");
const myReferralCodeEl = document.getElementById("my-referral-code");

// --- DOM references: dashboard / tasks ---
const statTasks = document.getElementById("stat-tasks");
const statTokens = document.getElementById("stat-tokens");
const statPercent = document.getElementById("stat-percent");
const progressBarFill = document.getElementById("progress-bar-fill");
const taskListEl = document.getElementById("task-list");
const taskEmptyState = document.getElementById("task-empty-state");
const addTaskFab = document.getElementById("add-task-fab");

// --- DOM references: task form modal ---
const taskModal = document.getElementById("task-modal");
const taskModalTitle = document.getElementById("task-modal-title");
const taskNameInput = document.getElementById("task-name");
const taskDescInput = document.getElementById("task-description");
const taskStartInput = document.getElementById("task-start");
const taskEndInput = document.getElementById("task-end");
const taskRepeatInput = document.getElementById("task-repeat");
const taskCategoryInput = document.getElementById("task-category");
const taskPriorityInput = document.getElementById("task-priority");
const taskTokensInput = document.getElementById("task-tokens");
const taskRequiredInput = document.getElementById("task-required");
const taskFormError = document.getElementById("task-form-error");
const taskCancelBtn = document.getElementById("task-cancel");
const taskSaveBtn = document.getElementById("task-save");
const taskDeleteBtn = document.getElementById("task-delete");

// --- Redo setup modal ---
const redoModal = document.getElementById("redo-modal");
const redoCancel = document.getElementById("redo-cancel");
const redoConfirm = document.getElementById("redo-confirm");

// --- DOM references: Phase 6 (scoreboard, friends, friend dashboard) ---
const scoreboardListEl = document.getElementById("scoreboard-list");
const scoreboardEmpty = document.getElementById("scoreboard-empty");
const friendListEl = document.getElementById("friend-list");
const friendListEmpty = document.getElementById("friend-list-empty");
const friendDashboardScreen = document.getElementById("friend-dashboard-screen");
const friendDashboardBack = document.getElementById("friend-dashboard-back");
const fdYouPhoto = document.getElementById("fd-you-photo");
const fdYouTokens = document.getElementById("fd-you-tokens");
const fdFriendPhoto = document.getElementById("fd-friend-photo");
const fdFriendName = document.getElementById("fd-friend-name");
const fdFriendTokens = document.getElementById("fd-friend-tokens");
const fdYouCompleted = document.getElementById("fd-you-completed");
const fdFriendCompleted = document.getElementById("fd-friend-completed");
const fdYouToday = document.getElementById("fd-you-today");
const fdFriendToday = document.getElementById("fd-friend-today");
const fdYouPercent = document.getElementById("fd-you-percent");
const fdFriendPercent = document.getElementById("fd-friend-percent");
const fdYouStreak = document.getElementById("fd-you-streak");
const fdFriendStreak = document.getElementById("fd-friend-streak");
const friendRemoveBtn = document.getElementById("friend-remove-btn");
const removeFriendModal = document.getElementById("remove-friend-modal");
const removeFriendCancel = document.getElementById("remove-friend-cancel");
const removeFriendConfirm = document.getElementById("remove-friend-confirm");

let currentUid = null;
let currentUserProfile = null;
let tasksUnsubscribe = null;
let currentTasks = [];
let editingTaskId = null;
let viewingFriendUid = null;

function showScreen(screen) {
  [loginScreen, loadingScreen, appShell, friendDashboardScreen].forEach((s) => s.classList.add("hidden"));
  screen.classList.remove("hidden");
}

function showHomeSubView(view) {
  [homeChoice, homeReferredEntry, homeDashboard].forEach((v) =>
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
    renderScoreboard();
  } else if (tabName === "friends") {
    tabFriends.classList.remove("hidden");
    renderFriendsList();
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
  currentUserProfile = profile;
  renderHomeForProfile(profile);
}

function renderHomeForProfile(profile) {
  if (profile.startMethod === "own" || profile.startMethod === "referred") {
    showHomeSubView(homeDashboard);
    statTokens.textContent = "…"; // the token ledger listener fills this in
    startTaskListener();
  } else {
    showHomeSubView(homeChoice);
  }
}

// --- Choice: Make Your Own ---
choiceOwnBtn.addEventListener("click", async () => {
  if (!currentUid) return;
  await updateDoc(doc(db, "users", currentUid), { startMethod: "own" });
  showHomeSubView(homeDashboard);
  startTaskListener();
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

    showHomeSubView(homeDashboard);
    startTaskListener();
  } catch (err) {
    console.error("Referral code error:", err);
    referralError.textContent = "Something went wrong. Please try again.";
  }

  referralSubmit.disabled = false;
  referralSubmit.textContent = "Submit";
});

// ============================================================
// TASK MANAGEMENT (Phase 4, updated for the token ledger — see
// firestore.rules). Completion is no longer a permanent true/false
// on the task itself — it's a per-day ledger entry under
// users/{uid}/tokenEvents/{taskId_dayNumber}. This is what lets a
// repeating (daily) task be completed fresh each day, and it's what
// makes the token balance provably tied to real completions.
// ============================================================

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// Must match the server's day-number logic in firestore.rules
// (int(request.time.toMillis() / 86400000)) so a completion made
// "today" on the client is accepted as "today" by the rules.
function todayDayNumber() {
  return Math.floor(Date.now() / 86400000);
}

// A task is "active today" if today falls within its start/end range
// (inclusive). If no end date, it's active from start date onward.
function isTaskActiveToday(task) {
  const today = todayStr();
  if (task.startDate && today < task.startDate) return false;
  if (task.endDate && today > task.endDate) return false;
  return true;
}

let completedTodaySet = new Set();     // taskIds completed today (from ledger)
let currentTokenBalance = 0;           // all-time sum from ledger
let tokenEventsUnsubscribe = null;

function startTaskListener() {
  if (tasksUnsubscribe) tasksUnsubscribe();
  const q = query(collection(db, "tasks"), where("ownerUid", "==", currentUid));
  tasksUnsubscribe = onSnapshot(
    q,
    (snap) => {
      currentTasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderTaskList();
    },
    (err) => console.error("Task listener error:", err)
  );

  if (tokenEventsUnsubscribe) tokenEventsUnsubscribe();
  const eventsRef = collection(db, "users", currentUid, "tokenEvents");
  tokenEventsUnsubscribe = onSnapshot(
    eventsRef,
    (snap) => {
      const today = todayDayNumber();
      let total = 0;
      const todaySet = new Set();
      snap.docs.forEach((d) => {
        const data = d.data();
        total += data.tokens || 0;
        if (data.dayNumber === today) todaySet.add(data.taskId);
      });
      currentTokenBalance = total;
      completedTodaySet = todaySet;
      statTokens.textContent = currentTokenBalance;
      renderTaskList();
    },
    (err) => console.error("Token ledger listener error:", err)
  );
}

function stopTaskListeners() {
  if (tasksUnsubscribe) { tasksUnsubscribe(); tasksUnsubscribe = null; }
  if (tokenEventsUnsubscribe) { tokenEventsUnsubscribe(); tokenEventsUnsubscribe = null; }
}

function renderTaskList() {
  const todaysTasks = currentTasks.filter(isTaskActiveToday);

  taskListEl.querySelectorAll(".task-row").forEach((el) => el.remove());

  if (todaysTasks.length === 0) {
    taskEmptyState.classList.remove("hidden");
  } else {
    taskEmptyState.classList.add("hidden");
    todaysTasks
      .sort((a, b) => {
        const aDone = completedTodaySet.has(a.id);
        const bDone = completedTodaySet.has(b.id);
        return aDone === bDone ? 0 : aDone ? 1 : -1;
      })
      .forEach((task) => taskListEl.appendChild(buildTaskRow(task)));
  }

  updateProgressStats(todaysTasks);
}

function buildTaskRow(task) {
  const doneToday = completedTodaySet.has(task.id);

  const row = document.createElement("div");
  row.className = "task-row" + (doneToday ? " completed" : "");

  const checkbox = document.createElement("button");
  checkbox.className = "task-checkbox" + (doneToday ? " checked" : "");
  checkbox.innerHTML = doneToday ? "✓" : "";
  checkbox.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleTaskComplete(task);
  });

  const info = document.createElement("div");
  info.className = "task-info";
  info.innerHTML = `
    <div class="task-name">${escapeHtml(task.name)}</div>
    <div class="task-meta">
      ${task.category ? `<span class="task-tag">${escapeHtml(task.category)}</span>` : ""}
      <span class="task-tag priority-${task.priority}">${task.priority}</span>
      ${task.required ? `<span class="task-tag">Required</span>` : `<span class="task-tag">Optional</span>`}
    </div>
  `;
  info.addEventListener("click", () => openTaskModal(task));

  const tokens = document.createElement("div");
  tokens.className = "task-tokens";
  tokens.textContent = `+${task.tokens || 0}`;

  row.appendChild(checkbox);
  row.appendChild(info);
  row.appendChild(tokens);
  return row;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

async function toggleTaskComplete(task) {
  const dayNum = todayDayNumber();
  const eventId = `${task.id}_${dayNum}`;
  const eventRef = doc(db, "users", currentUid, "tokenEvents", eventId);
  const alreadyDoneToday = completedTodaySet.has(task.id);

  try {
    if (alreadyDoneToday) {
      // Un-complete: remove today's ledger entry. This is the only
      // way tokens go down — deleting a real, previously-earned event.
      await deleteDoc(eventRef);
    } else {
      // Complete: create today's ledger entry. The security rules
      // verify the task exists, belongs to you, the token amount
      // matches the task's configured reward, and the date is today —
      // and since the doc ID is deterministic (taskId_dayNumber),
      // trying to "complete" the same task twice today is impossible;
      // the second attempt just fails as a duplicate.
      await setDoc(eventRef, {
        taskId: task.id,
        dayNumber: dayNum,
        tokens: task.tokens || 0,
        createdAt: serverTimestamp()
      });
    }
    // Best-effort UI cache on the task itself (not the source of truth —
    // the ledger above is). Fine if this fails; ledger listener will
    // still update the real state.
    updateDoc(doc(db, "tasks", task.id), {
      completedAt: alreadyDoneToday ? null : serverTimestamp()
    }).catch(() => {});
  } catch (err) {
    console.error("Toggle complete failed:", err);
    alert("Couldn't update this task. Please check your connection and try again.");
  }
}

function updateProgressStats(todaysTasks) {
  const total = todaysTasks.length;
  const done = todaysTasks.filter((t) => completedTodaySet.has(t.id)).length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  statTasks.textContent = `${done}/${total}`;
  statPercent.textContent = `${percent}%`;
  progressBarFill.style.width = `${percent}%`;
}

// --- Task form: open for add or edit ---
function openTaskModal(task) {
  editingTaskId = task ? task.id : null;
  taskFormError.textContent = "";

  if (task) {
    taskModalTitle.textContent = "Edit Task";
    taskNameInput.value = task.name || "";
    taskDescInput.value = task.description || "";
    taskStartInput.value = task.startDate || "";
    taskEndInput.value = task.endDate || "";
    taskRepeatInput.value = task.repeat || "none";
    taskCategoryInput.value = task.category || "";
    taskPriorityInput.value = task.priority || "medium";
    taskTokensInput.value = task.tokens || 0;
    taskRequiredInput.checked = task.required !== false;
    taskDeleteBtn.classList.remove("hidden");
  } else {
    taskModalTitle.textContent = "Add Task";
    taskNameInput.value = "";
    taskDescInput.value = "";
    taskStartInput.value = todayStr();
    taskEndInput.value = "";
    taskRepeatInput.value = "none";
    taskCategoryInput.value = "";
    taskPriorityInput.value = "medium";
    taskTokensInput.value = 10;
    taskRequiredInput.checked = true;
    taskDeleteBtn.classList.add("hidden");
  }

  taskModal.classList.remove("hidden");
}

addTaskFab.addEventListener("click", () => openTaskModal(null));

taskCancelBtn.addEventListener("click", () => {
  taskModal.classList.add("hidden");
});

taskModal.addEventListener("click", (e) => {
  if (e.target === taskModal) taskModal.classList.add("hidden");
});

taskSaveBtn.addEventListener("click", async () => {
  const name = taskNameInput.value.trim();
  if (!name) {
    taskFormError.textContent = "Task name is required.";
    return;
  }
  const startDate = taskStartInput.value;
  const endDate = taskEndInput.value;
  if (startDate && endDate && endDate < startDate) {
    taskFormError.textContent = "End date can't be before start date.";
    return;
  }

  const tokensValue = parseInt(taskTokensInput.value, 10) || 0;
  if (tokensValue < 0) {
    taskFormError.textContent = "Token reward can't be negative.";
    return;
  }

  const taskData = {
    ownerUid: currentUid,
    name,
    description: taskDescInput.value.trim(),
    startDate: startDate || todayStr(),
    endDate: endDate || null,
    repeat: taskRepeatInput.value,
    category: taskCategoryInput.value.trim(),
    priority: taskPriorityInput.value,
    tokens: tokensValue,
    required: taskRequiredInput.checked
  };

  taskSaveBtn.disabled = true;
  taskSaveBtn.textContent = "Saving…";

  try {
    if (editingTaskId) {
      await updateDoc(doc(db, "tasks", editingTaskId), taskData);
    } else {
      await addDoc(collection(db, "tasks"), {
        ...taskData,
        completed: false,
        completedAt: null,
        createdAt: serverTimestamp()
      });
    }
    taskModal.classList.add("hidden");
  } catch (err) {
    console.error("Task save failed:", err);
    taskFormError.textContent = "Something went wrong saving this task.";
  }

  taskSaveBtn.disabled = false;
  taskSaveBtn.textContent = "Save";
});

taskDeleteBtn.addEventListener("click", async () => {
  if (!editingTaskId) return;
  try {
    await deleteDoc(doc(db, "tasks", editingTaskId));
    taskModal.classList.add("hidden");
  } catch (err) {
    console.error("Task delete failed:", err);
    taskFormError.textContent = "Couldn't delete this task. Try again.";
  }
});

// --- Redo setup (available from Home even after setup) ---
let pendingRedo = false;

dashboardRedoBtn.addEventListener("click", () => {
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
  stopTaskListeners();
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

// ============================================================
// FRIEND DASHBOARD + SCOREBOARD (Phase 6)
// ============================================================

// Computes tokens / tasks-completed / today's-completion / streak for
// any uid, using the token ledger as the source of truth (rather than
// a "completed" field on the task itself, which can't correctly track
// a daily-repeating task across multiple days).
async function computeUserStats(uid) {
  const [tasksSnap, eventsSnap] = await Promise.all([
    getDocs(query(collection(db, "tasks"), where("ownerUid", "==", uid))),
    getDocs(collection(db, "users", uid, "tokenEvents"))
  ]);

  const tasks = tasksSnap.docs.map((d) => d.data());
  const events = eventsSnap.docs.map((d) => d.data());

  const tokens = events.reduce((sum, e) => sum + (e.tokens || 0), 0);
  const totalCompleted = events.length; // one event = one completion instance

  const today = todayDayNumber();
  const completedToday = events.filter((e) => e.dayNumber === today).length;

  const todaysTasks = tasks.filter(isTaskActiveToday);
  const percentToday = todaysTasks.length > 0
    ? Math.round((completedToday / todaysTasks.length) * 100)
    : 0;

  // Streak: count consecutive day-numbers (ending today) that have at
  // least one ledger event. Today is allowed to be "not yet done"
  // without breaking the streak — it just doesn't count until it's done.
  const eventDayNumbers = new Set(events.map((e) => e.dayNumber));
  let streak = 0;
  let cursor = today;
  while (true) {
    if (eventDayNumbers.has(cursor)) {
      streak++;
      cursor--;
    } else if (cursor === today) {
      cursor--; // skip today if not done yet
    } else {
      break;
    }
  }

  return { tokens, totalCompleted, completedToday, percentToday, streak };
}

// --- Friends list (Friends tab) ---
async function renderFriendsList() {
  const friendUids = (currentUserProfile && currentUserProfile.friends) || [];

  friendListEl.querySelectorAll(".friend-row").forEach((el) => el.remove());

  if (friendUids.length === 0) {
    friendListEmpty.classList.remove("hidden");
    return;
  }
  friendListEmpty.classList.add("hidden");

  for (const uid of friendUids) {
    try {
      const friendSnap = await getDoc(doc(db, "users", uid));
      if (!friendSnap.exists()) continue;
      const friendData = friendSnap.data();
      const friendStats = await computeUserStats(uid);

      const row = document.createElement("div");
      row.className = "friend-row";
      row.innerHTML = `
        <img class="friend-photo" src="${friendData.photoURL || "/icon-192.png"}" alt="" />
        <div class="friend-info">
          <div class="friend-name">${escapeHtml(friendData.displayName || "Friend")}</div>
          <div class="friend-sub">${friendStats.tokens} tokens</div>
        </div>
        <span class="friend-chevron">›</span>
      `;
      row.addEventListener("click", () => openFriendDashboard(uid, friendData));
      friendListEl.appendChild(row);
    } catch (err) {
      console.error("Failed to load friend:", uid, err);
    }
  }
}

// --- Friend Dashboard (comparison view) ---
async function openFriendDashboard(friendUid, friendData) {
  viewingFriendUid = friendUid;

  fdYouPhoto.src = userPhoto.src;
  fdFriendPhoto.src = friendData.photoURL || "/icon-192.png";
  fdFriendName.textContent = friendData.displayName || "Friend";

  showScreen(friendDashboardScreen);

  fdYouTokens.textContent = "…";
  fdFriendTokens.textContent = "…";
  fdYouCompleted.textContent = "…";
  fdFriendCompleted.textContent = "…";

  try {
    const [youStats, friendStats] = await Promise.all([
      computeUserStats(currentUid),
      computeUserStats(friendUid)
    ]);

    fdYouTokens.textContent = youStats.tokens;
    fdYouCompleted.textContent = youStats.totalCompleted;
    fdYouToday.textContent = youStats.completedToday;
    fdYouPercent.textContent = youStats.percentToday + "%";
    fdYouStreak.textContent = youStats.streak;

    fdFriendTokens.textContent = friendStats.tokens;
    fdFriendCompleted.textContent = friendStats.totalCompleted;
    fdFriendToday.textContent = friendStats.completedToday;
    fdFriendPercent.textContent = friendStats.percentToday + "%";
    fdFriendStreak.textContent = friendStats.streak;
  } catch (err) {
    console.error("Failed to load comparison stats:", err);
  }
}

friendDashboardBack.addEventListener("click", () => {
  viewingFriendUid = null;
  showScreen(appShell);
});

// --- Remove friend ---
friendRemoveBtn.addEventListener("click", () => {
  removeFriendModal.classList.remove("hidden");
});

removeFriendCancel.addEventListener("click", () => {
  removeFriendModal.classList.add("hidden");
});

removeFriendModal.addEventListener("click", (e) => {
  if (e.target === removeFriendModal) removeFriendModal.classList.add("hidden");
});

removeFriendConfirm.addEventListener("click", async () => {
  if (!viewingFriendUid || !currentUid) return;
  removeFriendModal.classList.add("hidden");

  try {
    const myFriends = (currentUserProfile.friends || []).filter((id) => id !== viewingFriendUid);
    await updateDoc(doc(db, "users", currentUid), { friends: myFriends });
    currentUserProfile.friends = myFriends;

    const friendRef = doc(db, "users", viewingFriendUid);
    const friendSnap = await getDoc(friendRef);
    if (friendSnap.exists()) {
      const theirFriends = (friendSnap.data().friends || []).filter((id) => id !== currentUid);
      await updateDoc(friendRef, { friends: theirFriends });
    }

    viewingFriendUid = null;
    showScreen(appShell);
    switchTab("friends");
  } catch (err) {
    console.error("Failed to remove friend:", err);
  }
});

// --- Scoreboard (self + all friends, ranked by tokens) ---
async function renderScoreboard() {
  if (!currentUid || !currentUserProfile) return;

  const friendUids = currentUserProfile.friends || [];

  scoreboardListEl.querySelectorAll(".scoreboard-row").forEach((el) => el.remove());

  if (friendUids.length === 0) {
    scoreboardEmpty.classList.remove("hidden");
    return;
  }
  scoreboardEmpty.classList.add("hidden");

  const freshYou = await getDoc(doc(db, "users", currentUid));
  const youData = freshYou.data();
  const youStats = await computeUserStats(currentUid);

  const entries = [{
    uid: currentUid,
    name: "You",
    photoURL: youData.photoURL,
    tokens: youStats.tokens,
    completed: youStats.totalCompleted,
    isYou: true
  }];

  for (const uid of friendUids) {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (!snap.exists()) continue;
      const data = snap.data();
      const stats = await computeUserStats(uid);
      entries.push({
        uid,
        name: data.displayName || "Friend",
        photoURL: data.photoURL,
        tokens: stats.tokens,
        completed: stats.totalCompleted,
        isYou: false
      });
    } catch (err) {
      console.error("Scoreboard friend load failed:", uid, err);
    }
  }

  entries.sort((a, b) => b.tokens - a.tokens);

  const medals = ["🥇", "🥈", "🥉"];
  entries.forEach((entry, i) => {
    const row = document.createElement("div");
    row.className = "scoreboard-row" + (entry.isYou ? " is-you" : "");
    const rankDisplay = medals[i] || `#${i + 1}`;
    row.innerHTML = `
      <span class="rank-badge">${rankDisplay}</span>
      <img class="scoreboard-photo" src="${entry.photoURL || "/icon-192.png"}" alt="" />
      <div class="scoreboard-info">
        <div class="scoreboard-name">${escapeHtml(entry.name)}</div>
        <div class="scoreboard-sub">${entry.completed} tasks completed</div>
      </div>
      <div class="scoreboard-tokens">${entry.tokens}</div>
    `;
    scoreboardListEl.appendChild(row);
  });
}

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
    currentUserProfile = null;
    stopTaskListeners();
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
