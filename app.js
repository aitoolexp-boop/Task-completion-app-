// GoalSync — app.js
// Phase 1: PWA shell only. Registers the service worker so the app
// is installable and loads offline. Google Sign-In gets wired up in Phase 2.

const statusNote = document.getElementById("status-note");
const googleBtn = document.getElementById("google-btn");

// Register the service worker (enables installability + offline shell)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {
        statusNote.textContent = "App ready. Google Sign-In arrives in Phase 2.";
      })
      .catch((err) => {
        statusNote.textContent = "Setup issue — service worker failed.";
        console.error("SW registration failed:", err);
      });
  });
} else {
  statusNote.textContent = "This browser doesn't support installable apps.";
}

// Placeholder — real Google Sign-In logic gets added in Phase 2
googleBtn.addEventListener("click", () => {
  alert("Google Sign-In will be connected in Phase 2. This screen just confirms the app shell works.");
});
