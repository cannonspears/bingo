// cloud.js — regular (non-module) script
// Handles all Firestore sync and auth UI. Runs after app init;
// uses window.fb* exposed by firebase-init.js (module, runs after this file).

// ===== DEBOUNCED STATE SAVE =====

let _cloudSaveTimer = null;

function cloudSave(stateObj) {
  if (!window.fbUser) return;
  clearTimeout(_cloudSaveTimer);
  _cloudSaveTimer = setTimeout(() => _writeStateToCloud(stateObj), 2000);
}

async function _writeStateToCloud(stateObj) {
  try {
    _setSyncStatus("syncing");
    await window.fbSetDoc(
      window.fbDoc(window.fbDb, "users", window.fbUser.uid),
      { ...stateObj, _lastSaved: window.fbServerTimestamp() }
    );
    _setSyncStatus("synced");
  } catch (e) {
    console.warn("Cloud save failed:", e);
    _setSyncStatus("error");
  }
}

// ===== LOG COMPLETED TASK =====

async function cloudLogTask(task) {
  if (!window.fbUser) return;
  try {
    await window.fbAddDoc(
      window.fbCollection(window.fbDb, "users", window.fbUser.uid, "completedTasks"),
      {
        text: task.text,
        difficulty: task.difficulty,
        points: task.points,
        completedAt: window.fbServerTimestamp(),
        sessionDate: localDateString(),
      }
    );
  } catch (e) {
    console.warn("Cloud log task failed:", e);
  }
}

// ===== LOG COMPLETED BREAK ITEM =====

async function cloudLogBreakItem(item) {
  if (!window.fbUser) return;
  try {
    await window.fbAddDoc(
      window.fbCollection(window.fbDb, "users", window.fbUser.uid, "completedBreakItems"),
      {
        text: item.text,
        tab: item.tab,
        starIndex: item.starIndex,
        points: item.points,
        completedAt: window.fbServerTimestamp(),
        sessionDate: localDateString(),
      }
    );
  } catch (e) {
    console.warn("Cloud log break item failed:", e);
  }
}

// ===== APPLY CLOUD STATE =====

function _applyCloudState(cloudData) {
  if (!cloudData) return;
  const { _lastSaved, ...cleanState } = cloudData;
  // Merge into global state (defined in state.js)
  state = { ...state, ...cleanState, running: false };
  if (state.timeLeft <= 0) resetTimer(false);
  // Persist merged state locally
  localStorage.setItem("bingoBreakState2", JSON.stringify(state));
  // Re-render dynamic UI
  updateTimerUI();
  updatePomoCount();
  updateBreakCount();
  updateScoreUI();
  renderBreakGrid();
  renderWorkTaskList();
  applyDarkMode(state.darkMode);
  const toggleDark = document.getElementById("toggle-darkmode");
  if (toggleDark) toggleDark.checked = state.darkMode;
}

// ===== SYNC STATUS INDICATOR =====

function _setSyncStatus(status) {
  const el = document.getElementById("cloud-sync-status");
  if (!el) return;
  const labels = { syncing: "⟳ Saving…", synced: "✓ Synced", error: "✕ Sync error" };
  el.textContent = labels[status] ?? "";
  el.dataset.status = status;
}

// ===== AUTH CALLBACKS (called by firebase-init.js) =====

window.onFbSignIn = async function (user) {
  renderAuthUI();
  _setSyncStatus("syncing");
  try {
    const snap = await window.fbGetDoc(
      window.fbDoc(window.fbDb, "users", user.uid)
    );
    if (snap.exists()) {
      _applyCloudState(snap.data());
      _setSyncStatus("synced");
    } else {
      // First login — push current local state to cloud
      await _writeStateToCloud(state);
    }
  } catch (e) {
    console.warn("Cloud load failed:", e);
    _setSyncStatus("error");
  }
};

window.onFbSignOut = function () {
  localStorage.removeItem("bingoBreakState2");
  window.location.reload();
};

// ===== AUTH ACTIONS =====

async function cloudSignIn(email, password) {
  const { signInWithEmailAndPassword } = window.fbAuthFns;
  return signInWithEmailAndPassword(window.fbAuth, email, password);
}

async function cloudSignUp(email, password) {
  const { createUserWithEmailAndPassword } = window.fbAuthFns;
  return createUserWithEmailAndPassword(window.fbAuth, email, password);
}

function cloudSignOut() {
  const { signOut } = window.fbAuthFns;
  signOut(window.fbAuth);
}

// ===== AUTH UI =====

function renderAuthUI() {
  const container = document.getElementById("auth-ui");
  if (!container) return;
  container.innerHTML = "";

  if (window.fbUser) {
    _renderSignedInUI(container);
  } else {
    _renderSignedOutUI(container);
  }
}

function _renderSignedInUI(container) {
  const email = document.createElement("div");
  email.className = "s-cell s-cell--wide";
  email.innerHTML = `
    <div class="s-cell-label auth-email-label">${window.fbUser.email}</div>
    <div class="s-cell-control">
      <span id="cloud-sync-status" class="auth-sync-status"></span>
      <button class="action-btn" id="btn-sign-out">Sign Out</button>
    </div>`;
  container.appendChild(email);
  document.getElementById("btn-sign-out")?.addEventListener("click", cloudSignOut);
}

function _renderSignedOutUI(container) {
  const form = document.createElement("div");
  form.className = "auth-form";
  form.innerHTML = `
    <input class="auth-input" id="auth-email" type="email" placeholder="Email" autocomplete="email" />
    <input class="auth-input" id="auth-password" type="password" placeholder="Password" autocomplete="current-password" />
    <div class="auth-actions">
      <button class="action-btn" id="btn-sign-in">Sign In</button>
      <button class="action-btn" id="btn-create-account">Create Account</button>
    </div>
    <div class="auth-error" id="auth-error"></div>`;
  container.appendChild(form);

  document.getElementById("btn-sign-in")?.addEventListener("click", async () => {
    const email = document.getElementById("auth-email")?.value.trim();
    const password = document.getElementById("auth-password")?.value;
    const errEl = document.getElementById("auth-error");
    if (!email || !password) { errEl.textContent = "Enter email and password."; return; }
    try {
      errEl.textContent = "";
      document.getElementById("btn-sign-in").textContent = "Signing in…";
      await cloudSignIn(email, password);
    } catch (e) {
      errEl.textContent = _authErrorMessage(e.code);
      document.getElementById("btn-sign-in").textContent = "Sign In";
    }
  });

  document.getElementById("btn-create-account")?.addEventListener("click", async () => {
    const email = document.getElementById("auth-email")?.value.trim();
    const password = document.getElementById("auth-password")?.value;
    const errEl = document.getElementById("auth-error");
    if (!email || !password) { errEl.textContent = "Enter email and password."; return; }
    if (password.length < 6) { errEl.textContent = "Password must be at least 6 characters."; return; }
    try {
      errEl.textContent = "";
      document.getElementById("btn-create-account").textContent = "Creating…";
      await cloudSignUp(email, password);
    } catch (e) {
      errEl.textContent = _authErrorMessage(e.code);
      document.getElementById("btn-create-account").textContent = "Create Account";
    }
  });
}

function _authErrorMessage(code) {
  const messages = {
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-email": "Invalid email address.",
    "auth/email-already-in-use": "An account with that email already exists.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
  };
  return messages[code] ?? "Something went wrong. Please try again.";
}

// Render auth UI once DOM is ready (before Firebase auth state resolves)
document.addEventListener("DOMContentLoaded", () => renderAuthUI());
