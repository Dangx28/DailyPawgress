// ── app.js  (index.html) ──

/* ─── AUTH GUARD ─── */
const currentUser = localStorage.getItem("dp_loggedIn");
if (!currentUser) window.location.href = "login.html";

document.getElementById("nav-username").textContent = "👤 " + currentUser;

function handleLogout() {
  localStorage.removeItem("dp_loggedIn");
  window.location.href = "login.html";
}

/* ─── PAGE SWITCHING ─── */
const pages = ["home", "study", "todo", "calendar", "sticky"];

function showPage(name) {
  pages.forEach((p) => {
    const el = document.getElementById("page-" + p);
    if (el) el.style.display = p === name ? "block" : "none";
  });
  window.scrollTo(0, 0);
  if (name === "calendar") renderCalendar();
  if (name === "study") renderSessionLog();
  if (name === "todo") renderTodos();
  if (name === "sticky") renderStickies();
  // close mobile nav
  document.getElementById("bar").checked = false;
}

function navTo(name) {
  if (pomRunning && name !== "study") {
    pendingNavTarget = name;
    document.getElementById("popup-leave").style.display = "flex";
    return;
  }
  showPage(name);
}

function scrollTo(id) {
  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 50);
}

/* ─── SAVE NAME HELPER ─── */
function saveName(inputId, msgId) {
  const val = document.getElementById(inputId).value.trim();
  const msg = document.getElementById(msgId);
  if (!val) {
    msg.textContent = "Please enter a name.";
    return;
  }
  localStorage.setItem("dp_" + inputId, val);
  msg.textContent = '✓ Saved as "' + val + '"!';
  setTimeout(() => (msg.textContent = ""), 3000);
}

// Restore saved names
["char-name", "pet-name"].forEach((id) => {
  const saved = localStorage.getItem("dp_" + id);
  const el = document.getElementById(id);
  if (saved && el) el.value = saved;
});

/* ═══════════════════════════════════════
   STUDY SESSIONS – POMODORO
═══════════════════════════════════════ */
const pomDurations = { work: 25 * 60, short: 5 * 60, long: 15 * 60 };
let pomMode = "work";
let pomSeconds = pomDurations.work;
let pomInterval = null;
let pomRunning = false;

function setMode(mode) {
  if (pomRunning) resetTimer();
  pomMode = mode;
  pomSeconds = pomDurations[mode];
  updateDisplay();
  document
    .querySelectorAll(".pom-mode")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById("mode-" + mode).classList.add("active");
}

function updateDisplay() {
  const m = String(Math.floor(pomSeconds / 60)).padStart(2, "0");
  const s = String(pomSeconds % 60).padStart(2, "0");
  document.getElementById("pom-display").textContent = m + ":" + s;
}

function toggleTimer() {
  const btn = document.getElementById("pom-btn");
  if (pomRunning) {
    clearInterval(pomInterval);
    pomRunning = false;
    btn.innerHTML = '<i class="fas fa-play"></i> Resume';
    if (pomMode === "work") startPauseCountdown();
  } else {
    closePausePopup(); // cancel penalty if they resumed in time
    pomRunning = true;
    btn.innerHTML = '<i class="fas fa-pause"></i> Pause';
    pomInterval = setInterval(() => {
      pomSeconds--;
      updateDisplay();
      if (pomSeconds <= 0) {
        clearInterval(pomInterval);
        pomRunning = false;
        btn.innerHTML = '<i class="fas fa-play"></i> Start';
        if (pomMode === "work") gainStreak();
        logSession();
        alert("⏰ Time's up! Great work!");
      }
    }, 1000);
  }
}

function resetTimer() {
  if (
    pomMode === "work" &&
    pomSeconds < pomDurations[pomMode] &&
    pomSeconds > 0
  ) {
    loseHeart("You abandoned your Pomodoro session by resetting!");
  }
  clearInterval(pomInterval);
  pomInterval = null;
  closePausePopup();
  pomRunning = false;
  pomSeconds = pomDurations[pomMode];
  updateDisplay();
  document.getElementById("pom-btn").innerHTML =
    '<i class="fas fa-play"></i> Start';
}

function logSession() {
  const label =
    pomMode === "work"
      ? "Work session (25 min)"
      : pomMode === "short"
        ? "Short break (5 min)"
        : "Long break (15 min)";
  const log = JSON.parse(
    localStorage.getItem("dp_sessions_" + currentUser) || "[]",
  );
  log.unshift({ label, time: new Date().toLocaleString() });
  localStorage.setItem("dp_sessions_" + currentUser, JSON.stringify(log));
  renderSessionLog();
}

function renderSessionLog() {
  const log = JSON.parse(
    localStorage.getItem("dp_sessions_" + currentUser) || "[]",
  );
  const ul = document.getElementById("session-log");
  if (!ul) return;
  if (log.length === 0) {
    ul.innerHTML =
      '<li class="empty-state">No sessions yet. Start your first Pomodoro!</li>';
    return;
  }
  ul.innerHTML = log
    .map(
      (s) =>
        `<li><span>${s.label}</span><span style="color:rgba(58,32,16,0.4);font-size:12px">${s.time}</span></li>`,
    )
    .join("");
}

/* ═══════════════════════════════════════
   TO-DO LIST
═══════════════════════════════════════ */
function getTodos() {
  return JSON.parse(localStorage.getItem("dp_todos_" + currentUser) || "[]");
}
function saveTodos(todos) {
  localStorage.setItem("dp_todos_" + currentUser, JSON.stringify(todos));
}

function addTodo() {
  const input = document.getElementById("todo-input");
  const deadline = document.getElementById("todo-deadline");
  const text = input.value.trim();
  if (!text) return;
  const todos = getTodos();
  todos.push({
    text,
    done: false,
    id: Date.now(),
    deadline: deadline.value || null,
    penalised: false,
  });
  saveTodos(todos);
  input.value = "";
  deadline.value = "";
  renderTodos();
}

function toggleTodo(id) {
  const todos = getTodos().map((t) =>
    t.id === id ? { ...t, done: !t.done } : t,
  );
  saveTodos(todos);
  renderTodos();
}

function deleteTodo(id) {
  saveTodos(getTodos().filter((t) => t.id !== id));
  renderTodos();
}

function renderTodos() {
  const todos = getTodos();
  const ul = document.getElementById("todo-list");
  if (!ul) return;
  if (todos.length === 0) {
    ul.innerHTML =
      '<li class="empty-state">No tasks yet. Add your first one above!</li>';
    return;
  }
  ul.innerHTML = todos
    .map(
      (t) => `
    <li class="${t.done ? "done" : ""}">
      <button class="todo-check ${t.done ? "checked" : ""}" onclick="toggleTodo(${t.id})">
        ${t.done ? '<i class="fas fa-check" style="font-size:10px"></i>' : ""}
      </button>
      <span>${t.text}</span>
      <button class="todo-del" onclick="deleteTodo(${t.id})"><i class="fas fa-times"></i></button>
    </li>
  `,
    )
    .join("");
}

/* ═══════════════════════════════════════
   CALENDAR
═══════════════════════════════════════ */
let calDate = new Date();
let calSelected = null;

function getEvents() {
  const saved = JSON.parse(
    localStorage.getItem("dp_events_" + currentUser) || "{}",
  );

  // Merge in todo deadlines
  const todos = getTodos();
  todos.forEach((t) => {
    if (!t.deadline) return;
    const key = t.deadline.slice(0, 10); // "YYYY-MM-DD"
    if (!saved[key]) saved[key] = [];
    // Only add if not already present (avoid duplicates on re-render)
    const alreadyThere = saved[key].some((e) => e.todoId === t.id);
    if (!alreadyThere) {
      saved[key].push({
        text: "📋 " + t.text,
        id: "todo-" + t.id,
        todoId: t.id,
        readOnly: true,
      });
    }
  });

  return saved;
}

function saveEvents(ev) {
  localStorage.setItem("dp_events_" + currentUser, JSON.stringify(ev));
}

function changeMonth(dir) {
  calDate = new Date(calDate.getFullYear(), calDate.getMonth() + dir, 1);
  renderCalendar();
}

function renderCalendar() {
  const grid = document.getElementById("cal-grid");
  if (!grid) return;

  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const today = new Date();
  const events = getEvents();

  document.getElementById("cal-title").textContent = calDate.toLocaleString(
    "default",
    { month: "long", year: "numeric" },
  );

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let html = days.map((d) => `<div class="cal-day-label">${d}</div>`).join("");

  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++)
    html += '<div class="cal-day empty"></div>';

  for (let d = 1; d <= totalDays; d++) {
    const key =
      year +
      "-" +
      String(month + 1).padStart(2, "0") +
      "-" +
      String(d).padStart(2, "0");
    const isToday =
      d === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear();
    const isSel = calSelected === key;
    const hasEv = events[key] && events[key].length > 0;
    html += `<div class="cal-day ${isToday ? "today" : ""} ${isSel ? "selected" : ""} ${hasEv ? "has-event" : ""}"
                  onclick="selectDay('${key}')">${d}</div>`;
  }

  grid.innerHTML = html;
}

function selectDay(key) {
  calSelected = key;
  renderCalendar();

  const panel = document.getElementById("cal-events-panel");
  panel.style.display = "block";

  const [y, m, d] = key.split("-");
  document.getElementById("cal-selected-label").textContent = new Date(
    y,
    m - 1,
    d,
  ).toLocaleDateString("default", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  renderCalEvents(key);
}

function addCalEvent() {
  if (!calSelected) return;
  const input = document.getElementById("cal-event-input");
  const text = input.value.trim();
  if (!text) return;
  const events = getEvents();
  if (!events[calSelected]) events[calSelected] = [];
  events[calSelected].push({ text, id: Date.now() });
  saveEvents(events);
  input.value = "";
  renderCalEvents(calSelected);
  renderCalendar();
  document.getElementById("cal-selected-label").textContent = (() => {
    const [y, m, d] = calSelected.split("-");
    return new Date(y, m - 1, d).toLocaleDateString("default", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  })();
}

function deleteCalEvent(key, id) {
  const events = getEvents();
  events[key] = (events[key] || []).filter((e) => e.id !== id);
  saveEvents(events);
  renderCalEvents(key);
  renderCalendar();
}

function renderCalEvents(key) {
  const events = getEvents();
  const list = document.getElementById("cal-event-list");
  const evs = events[key] || [];
  if (evs.length === 0) {
    list.innerHTML = '<li class="empty-state">No events for this day.</li>';
    return;
  }
  list.innerHTML = evs
    .map(
      (e) => `
    <li>
      <span>${e.text}</span>
      <button class="todo-del" onclick="deleteCalEvent('${key}', ${e.id})"><i class="fas fa-times"></i></button>
    </li>
  `,
    )
    .join("");
}

/* ═══════════════════════════════════════
   STICKY NOTES
═══════════════════════════════════════ */
let stickyColor = "#fff9c4";

function setStickyColor(color) {
  stickyColor = color;
  document.querySelectorAll(".color-dot").forEach((d) => {
    d.classList.toggle("active-color", d.style.background === color);
  });
}

function getStickies() {
  return JSON.parse(localStorage.getItem("dp_stickies_" + currentUser) || "[]");
}
function saveStickies(s) {
  localStorage.setItem("dp_stickies_" + currentUser, JSON.stringify(s));
}

function addSticky() {
  const stickies = getStickies();
  stickies.push({
    id: Date.now(),
    color: stickyColor,
    text: "",
    date: new Date().toLocaleDateString(),
  });
  saveStickies(stickies);
  renderStickies();
}

function deleteSticky(id) {
  saveStickies(getStickies().filter((s) => s.id !== id));
  renderStickies();
}

function updateStickyText(id, text) {
  const stickies = getStickies().map((s) => (s.id === id ? { ...s, text } : s));
  saveStickies(stickies);
}

function renderStickies() {
  const board = document.getElementById("sticky-board");
  if (!board) return;
  const stickies = getStickies();
  const empty = document.getElementById("sticky-empty");
  if (stickies.length === 0) {
    board.innerHTML =
      '<p class="empty-state" id="sticky-empty">No notes yet. Click "New Note" to start!</p>';
    return;
  }
  board.innerHTML = stickies
    .map(
      (s) => `
    <div class="sticky-note" style="background:${s.color}">
      <button class="sticky-del" onclick="deleteSticky(${s.id})"><i class="fas fa-times"></i></button>
      <textarea placeholder="Write your note..."
        oninput="updateStickyText(${s.id}, this.value)">${s.text}</textarea>
      <div class="sticky-date">${s.date}</div>
    </div>
  `,
    )
    .join("");
}

/* ═══════════════════════════════════════
   CHARACTER & PET SELECTION
═══════════════════════════════════════ */
let selectedChar = null;
let selectedPet = null;

// Restore previous selections on load
(function restoreSetup() {
  const sc = localStorage.getItem("dp_selectedChar_" + currentUser);
  const sp = localStorage.getItem("dp_selectedPet_" + currentUser);
  if (sc !== null) selectedChar = +sc;
  if (sp !== null) selectedPet = +sp;
})();

function highlightChar(idx) {
  document
    .querySelectorAll("#char-grid .box")
    .forEach((b, i) => b.classList.toggle("selected", i === idx));
}

function highlightPet(idx) {
  document
    .querySelectorAll("#pet-grid .pbox")
    .forEach((b, i) => b.classList.toggle("selected", i === idx));
}

function selectChar(idx) {
  selectedChar = idx;
  highlightChar(idx);
}

function selectPet(idx) {
  selectedPet = idx;
  highlightPet(idx);
}

function completeSetup() {
  const charName = document.getElementById("char-name").value.trim();
  const petName = document.getElementById("pet-name").value.trim();
  const msg = document.getElementById("setup-msg");

  if (selectedChar === null) {
    msg.textContent = "⚠️ Please choose a character!";
    return;
  }
  if (selectedPet === null) {
    msg.textContent = "⚠️ Please choose a pet!";
    return;
  }
  if (!charName) {
    msg.textContent = "⚠️ Please name your character!";
    return;
  }
  if (!petName) {
    msg.textContent = "⚠️ Please name your pet!";
    return;
  }

  localStorage.setItem("dp_selectedChar_" + currentUser, selectedChar);
  localStorage.setItem("dp_selectedPet_" + currentUser, selectedPet);
  localStorage.setItem("dp_char-name", charName);
  localStorage.setItem("dp_pet-name", petName);

  // Populate & show dashboard
  populateDashboard(selectedChar, selectedPet, charName, petName);

  document.getElementById("home-hero").style.display = "none";
  document.getElementById("dashboard").style.display = "block";
  closeCustomize();

  window.scrollTo({ top: 0, behavior: "smooth" });
  msg.textContent = "✅ Setup complete! Welcome, " + charName + "!";
  setTimeout(() => (msg.textContent = ""), 4000);
}

function openCustomize() {
  document.getElementById("myCharacter").closest(".chabg").style.display =
    "block";
  document.getElementById("myVirtualPet").closest(".petsbg").style.display =
    "block";
  document
    .getElementById("myCharacter")
    .scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeCustomize() {
  document.getElementById("myCharacter").closest(".chabg").style.display =
    "none";
  document.getElementById("myVirtualPet").closest(".petsbg").style.display =
    "none";
}

/* ═══════════════════════════════════════
   HEARTS & STREAK SYSTEM
═══════════════════════════════════════ */
const MAX_HEARTS = 3;

function getHearts() {
  return parseInt(
    localStorage.getItem("dp_hearts_" + currentUser) || MAX_HEARTS,
  );
}
function saveHearts(n) {
  localStorage.setItem(
    "dp_hearts_" + currentUser,
    Math.max(0, Math.min(MAX_HEARTS, n)),
  );
}
function getStreak() {
  return parseInt(localStorage.getItem("dp_streak_" + currentUser) || "0");
}
function saveStreak(n) {
  localStorage.setItem("dp_streak_" + currentUser, Math.max(0, n));
}
function getLastStudyDate() {
  return localStorage.getItem("dp_lastStudy_" + currentUser) || null;
}
function saveLastStudyDate() {
  const today = new Date().toDateString();
  localStorage.setItem("dp_lastStudy_" + currentUser, today);
}

function loseHeart(reason) {
  let hearts = getHearts() - 1;
  saveHearts(hearts);
  updateNavBadge();

  const icon = document.getElementById("neglect-icon");
  const title = document.getElementById("neglect-title");
  const msg = document.getElementById("neglect-msg");
  const heartsEl = document.getElementById("neglect-hearts");

  icon.textContent = hearts <= 1 ? "💔" : "😢";
  title.textContent = hearts === 0 ? "Out of hearts!" : "You lost a heart!";
  msg.textContent = reason;
  heartsEl.textContent = renderHearts(hearts);

  document.getElementById("popup-neglect").style.display = "flex";

  if (hearts <= 0) {
    setTimeout(() => {
      document.getElementById("popup-neglect").style.display = "none";
      resetStreak();
    }, 2000);
  }

  // Update dashboard if visible
  const dashHearts = document.getElementById("dash-hearts");
  if (dashHearts) dashHearts.textContent = renderHearts(hearts);
  refreshPetMood();
}

function resetStreak() {
  saveStreak(0);
  saveHearts(MAX_HEARTS);
  updateNavBadge();
  document.getElementById("popup-reset").style.display = "flex";

  const dashStreak = document.getElementById("dash-streak");
  const dashHearts = document.getElementById("dash-hearts");
  if (dashStreak) dashStreak.textContent = "0";
  if (dashHearts) dashHearts.textContent = renderHearts(MAX_HEARTS);
  refreshPetMood();
}

function gainStreak() {
  const today = new Date().toDateString();
  const lastStudy = getLastStudyDate();

  if (lastStudy === today) return; // already counted today

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const wasYesterday = lastStudy === yesterday.toDateString();

  const newStreak = wasYesterday ? getStreak() + 1 : 1;
  saveStreak(newStreak);
  saveLastStudyDate();
  updateNavBadge();

  const dashStreak = document.getElementById("dash-streak");
  if (dashStreak) dashStreak.textContent = newStreak;
}

function renderHearts(n) {
  const count = typeof n === "number" ? n : getHearts();
  return "❤️".repeat(count) + "🖤".repeat(Math.max(0, MAX_HEARTS - count));
}

function updateNavBadge() {
  const streak = getStreak();
  const hearts = getHearts();
  document.getElementById("nav-streak").textContent = "🔥 " + streak;
  document.getElementById("nav-hearts").textContent = renderHearts(hearts);
}

function checkStreakExpiry() {
  const lastStudy = getLastStudyDate();
  if (!lastStudy) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const lastStudyDate = new Date(lastStudy);
  lastStudyDate.setHours(0, 0, 0, 0);
  yesterday.setHours(0, 0, 0, 0);

  if (lastStudyDate < yesterday) {
    saveStreak(0);
    updateNavBadge();
    const dashStreak = document.getElementById("dash-streak");
    if (dashStreak) dashStreak.textContent = "0";
  }
}

/* ═══════════════════════════════════════
   PAUSE PENALTY SYSTEM
═══════════════════════════════════════ */
const PAUSE_LIMIT = 5 * 60; // 5 minutes in seconds
let pauseSeconds = PAUSE_LIMIT;
let pauseInterval = null;

function startPauseCountdown() {
  pauseSeconds = PAUSE_LIMIT;
  updatePauseDisplay();
  document.getElementById("popup-pause").style.display = "flex";

  pauseInterval = setInterval(() => {
    pauseSeconds--;
    updatePauseDisplay();
    if (pauseSeconds <= 0) {
      closePausePopup();
      loseHeart("You paused your study session for too long!");
    }
  }, 1000);
}

function updatePauseDisplay() {
  const m = String(Math.floor(pauseSeconds / 60)).padStart(2, "0");
  const s = String(pauseSeconds % 60).padStart(2, "0");
  document.getElementById("pause-countdown").textContent = m + ":" + s;
}

function startPomInterval() {
  clearInterval(pomInterval); // always kill any existing interval first
  pomInterval = null;
  const btn = document.getElementById("pom-btn");
  pomRunning = true;
  btn.innerHTML = '<i class="fas fa-pause"></i> Pause';
  pomInterval = setInterval(() => {
    pomSeconds--;
    updateDisplay();
    if (pomSeconds <= 0) {
      clearInterval(pomInterval);
      pomInterval = null;
      pomRunning = false;
      btn.innerHTML = '<i class="fas fa-play"></i> Start';
      if (pomMode === "work") gainStreak();
      logSession();
      alert("⏰ Time's up! Great work!");
    }
  }, 1000);
}

function toggleTimer() {
  if (pomRunning) {
    clearInterval(pomInterval);
    pomInterval = null;
    pomRunning = false;
    document.getElementById("pom-btn").innerHTML =
      '<i class="fas fa-play"></i> Resume';
    if (pomMode === "work") startPauseCountdown();
  } else {
    closePausePopup(); // cancels pause penalty countdown
    startPomInterval(); // starts fresh single interval
  }
}

function resetTimer(silent = false) {
  if (
    !silent &&
    pomMode === "work" &&
    pomSeconds < pomDurations[pomMode] &&
    pomSeconds > 0
  ) {
    loseHeart("You abandoned your Pomodoro session by resetting!");
  }
  clearInterval(pomInterval);
  pomInterval = null;
  closePausePopup();
  pomRunning = false;
  pomSeconds = pomDurations[pomMode];
  updateDisplay();
  document.getElementById("pom-btn").innerHTML =
    '<i class="fas fa-play"></i> Start';
}

function closePausePopup() {
  clearInterval(pauseInterval);
  pauseInterval = null;
  document.getElementById("popup-pause").style.display = "none";
  if (!pomRunning) startPomInterval(); // auto-resume using the safe helper
}

/* ═══════════════════════════════════════
   LEAVE PENALTY SYSTEM
═══════════════════════════════════════ */
let pendingNavTarget = null;

function confirmLeave() {
  document.getElementById("popup-leave").style.display = "none";
  loseHeart("You abandoned your Pomodoro session!");
  resetTimer(true);
  if (pendingNavTarget) {
    showPage(pendingNavTarget);
    pendingNavTarget = null;
  }
}

function cancelLeave() {
  document.getElementById("popup-leave").style.display = "none";
  pendingNavTarget = null;
}

/* ═══════════════════════════════════════
   DEADLINE CHECKER
═══════════════════════════════════════ */
function checkDeadlines() {
  const todos = getTodos();
  const now = new Date();
  let changed = false;

  const updated = todos.map((t) => {
    if (!t.done && t.deadline && !t.penalised) {
      const due = new Date(t.deadline);
      if (due < now) {
        loseHeart('"' + t.text + '" deadline was missed!');
        changed = true;
        return { ...t, penalised: true };
      }
    }
    return t;
  });

  if (changed) {
    saveTodos(updated);
    renderTodos();
  }
}

function restoreDashboard() {
  const sc = localStorage.getItem("dp_selectedChar_" + currentUser);
  const sp = localStorage.getItem("dp_selectedPet_" + currentUser);
  const charName = localStorage.getItem("dp_char-name");
  const petName = localStorage.getItem("dp_pet-name");

  if (sc === null || sp === null || !charName || !petName) return;

  populateDashboard(+sc, +sp, charName, petName);

  document.getElementById("home-hero").style.display = "none";
  document.getElementById("dashboard").style.display = "block";
  closeCustomize();
}

function populateDashboard(charIdx, petIdx, charName, petName) {
  const charImgs = [
    "images/belle.png",
    "images/champ.png",
    "images/ryza.png",
    "images/beefy.png",
  ];
  const petImgs = [
    "images/dog.png",
    "images/cat.png",
    "images/capy.png",
    "images/rabbit.png",
  ];
  const tips = [
    "💡 A 25-min Pomodoro a day keeps the procrastination away!",
    "🌟 Complete tasks before their deadline to keep your hearts!",
    "🔥 Log in every day to keep your streak alive!",
    "🐾 Your pet gets happier the more you study!",
    "📅 Check your calendar — you might have tasks due soon!",
  ];

  document.getElementById("dash-big-icon").innerHTML =
    `<img src="${petImgs[petIdx]}" style="width:200px;height:200px;object-fit:contain;">`;
  document.getElementById("dash-pet-name").textContent = petName;
  document.getElementById("dash-pet-mood").textContent = getPetMood().text;
  document.getElementById("dash-big-icon").innerHTML =
    `<img src="${getPetMoodImg(petImgs[petIdx])}" style="width:200px;height:200px;object-fit:contain;">`;
  document.getElementById("dash-char-icon").innerHTML =
    `<img src="${charImgs[charIdx]}" style="width:100px;height:100px;object-fit:contain;">`;
  document.getElementById("dash-char-name-display").textContent = charName;
  document.getElementById("dash-streak").textContent = getStreak();
  document.getElementById("dash-hearts").textContent = renderHearts();
  document.getElementById("dash-sessions").textContent = JSON.parse(
    localStorage.getItem("dp_sessions_" + currentUser) || "[]",
  ).filter(
    (s) =>
      s.time && new Date(s.time).toDateString() === new Date().toDateString(),
  ).length;
  document.getElementById("dash-tasks").textContent = getTodos().filter(
    (t) => t.done,
  ).length;

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  document.getElementById("dash-greeting").textContent =
    greeting + ", " + charName + "! 👋";
  document.getElementById("dash-tip").textContent =
    tips[Math.floor(Math.random() * tips.length)];
}

function getPetMood() {
  const hearts = getHearts();
  if (hearts >= 3)
    return {
      text: "😊 I'm happy, you're happy, we're all happy!",
      suffix: "_happy",
    };
  if (hearts === 2)
    return {
      text: "😠 Hey! You're not taking better care of me!",
      suffix: "_angry",
    };
  return { text: "😢 I'm not okay...", suffix: "_sad" };
}

function getPetMoodImg(baseImg) {
  const suffix = getPetMood().suffix;
  // e.g. "dog.png" → "dog_happy.png"
  return baseImg.replace(".png", suffix + ".png");
}

function refreshPetMood() {
  const sp = localStorage.getItem("dp_selectedPet_" + currentUser);
  if (sp === null) return;
  const petImgs = [
    "images/dog.png",
    "images/cat.png",
    "images/capy.png",
    "images/rabbit.png",
  ];
  const mood = getPetMood();
  document.getElementById("dash-big-icon").innerHTML =
    `<img src="${getPetMoodImg(petImgs[+sp])}" style="width:100px;height:100px;object-fit:contain;">`;
  document.getElementById("dash-pet-mood").textContent = mood.text;
}

/* ─── INIT ─── */
updateNavBadge();
checkStreakExpiry(); // ← add this
showPage("home");
updateDisplay();
checkDeadlines();
setInterval(checkDeadlines, 60 * 1000);
restoreDashboard();
if (selectedChar !== null) highlightChar(selectedChar);
if (selectedPet !== null) highlightPet(selectedPet);
