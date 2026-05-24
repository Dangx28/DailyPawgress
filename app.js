import { auth, db } from "./firebase-init.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser = null;

// binabantayan lagi nito if logged in ba yung user or nah!
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  currentUser = user;
  await loadUserData();
  document.getElementById("nav-username").textContent =
    "👤 " + (_profile.charName || user.email);
  gainStreak();
  updateNavBadge();
  checkStreakExpiry();
  showPage("home");
  updateDisplay();
  checkDeadlines();
  setInterval(checkDeadlines, 60 * 1000);
  restoreDashboard();
  if (selectedChar !== null) highlightChar(selectedChar);
  if (selectedPet !== null) highlightPet(selectedPet);
});

// ── LOGOUT ──
async function handleLogout() {
  await signOut(auth);
  window.location.href = "login.html";
}

// ── FIRESTORE HELPERS ──
// Instead of localStorage keys, all data lives under:
// users/{uid}/profile    — hearts, streak, lastStudy, selectedChar, selectedPet, charName, petName
// users/{uid}/todos      — collection of todo docs
// users/{uid}/sessions   — collection of session docs
// users/{uid}/events     — collection of calendar event docs
// users/{uid}/stickies   — collection of sticky note docs

let _profile = {};
let _todos = [];
let _sessions = [];
let _events = {};
let _stickies = [];

async function loadUserData() {
  const uid = currentUser.uid;

  // Profile
  const profileSnap = await getDoc(doc(db, "users", uid, "data", "profile"));
  _profile = profileSnap.exists()
    ? profileSnap.data()
    : {
        hearts: MAX_HEARTS,
        streak: 0,
        lastStudy: null,
        selectedChar: null,
        selectedPet: null,
        charName: "",
        petName: "",
      };
  if (_profile.selectedChar !== null && _profile.selectedChar !== undefined)
    selectedChar = _profile.selectedChar;
  if (_profile.selectedPet !== null && _profile.selectedPet !== undefined)
    selectedPet = _profile.selectedPet;

  // Todos
  const todosSnap = await getDocs(collection(db, "users", uid, "todos"));
  _todos = todosSnap.docs.map((d) => ({ ...d.data(), _docId: d.id }));

  // Sessions
  const sessionsSnap = await getDocs(collection(db, "users", uid, "sessions"));
  _sessions = sessionsSnap.docs
    .map((d) => d.data())
    .sort((a, b) => b.ts - a.ts);

  // Events
  const eventsSnap = await getDocs(collection(db, "users", uid, "events"));
  _events = {};
  eventsSnap.docs.forEach((d) => {
    const data = d.data();
    if (!_events[data.date]) _events[data.date] = [];
    _events[data.date].push({ ...data, _docId: d.id });
  });

  // Stickies
  const stickiesSnap = await getDocs(collection(db, "users", uid, "stickies"));
  _stickies = stickiesSnap.docs
    .map((d) => ({ ...d.data(), _docId: d.id }))
    .sort((a, b) => a.id - b.id);
}

async function saveProfile(updates) {
  _profile = { ..._profile, ...updates };
  await setDoc(doc(db, "users", currentUser.uid, "data", "profile"), _profile);
}

// ── PAGE SWITCHING ──
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
  document.getElementById("bar").checked = false;
}

function navTo(name) {
  if (pomRunning && name !== "study") {
    pendingNavTarget = name;
    updatePopupPets(); // ← add this here
    document.getElementById("popup-leave").style.display = "flex";
    return;
  }
  showPage(name);
}

// ── HEARTS & STREAK ──
const MAX_HEARTS = 3;

function getHearts() {
  return _profile.hearts ?? MAX_HEARTS;
}
function getStreak() {
  return _profile.streak ?? 0;
}
function getLastStudyDate() {
  return _profile.lastStudy ?? null;
}

function saveHearts(n) {
  const val = Math.max(0, Math.min(MAX_HEARTS, n));
  saveProfile({ hearts: val });
}
function saveStreak(n) {
  saveProfile({ streak: Math.max(0, n) });
}
function saveLastStudyDate() {
  saveProfile({ lastStudy: new Date().toDateString() });
}

function renderHearts(n) {
  const count = typeof n === "number" ? n : getHearts();
  return "❤️".repeat(count) + "🖤".repeat(Math.max(0, MAX_HEARTS - count));
}

function updateNavBadge() {
  document.getElementById("nav-streak").textContent = "🔥 " + getStreak();
  document.getElementById("nav-hearts").textContent = renderHearts();
}

function loseHeart(reason) {
  let hearts = getHearts() - 1;
  saveHearts(hearts);
  updateNavBadge();

  document.getElementById("neglect-icon").textContent =
    hearts <= 1 ? "💔" : "😢";
  document.getElementById("neglect-title").textContent =
    hearts === 0 ? "Out of hearts!" : "You lost a heart!";
  document.getElementById("neglect-msg").textContent = reason;
  document.getElementById("neglect-hearts").textContent = renderHearts(hearts);
  document.getElementById("popup-neglect").style.display = "flex";

  const dashHearts = document.getElementById("dash-hearts");
  if (dashHearts) dashHearts.textContent = renderHearts(hearts);

  refreshPetMood();
  updatePopupPets();

  if (hearts <= 0) {
    setTimeout(() => {
      document.getElementById("popup-neglect").style.display = "none";
      resetStreak();
    }, 2000);
  }
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
  updatePopupPets();
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

function checkStreakExpiry() {
  const lastStudy = getLastStudyDate();
  if (!lastStudy) return;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const lastStudyDate = new Date(lastStudy);
  lastStudyDate.setHours(0, 0, 0, 0);
  if (lastStudyDate < yesterday) {
    saveStreak(0);
    updateNavBadge();
    const dashStreak = document.getElementById("dash-streak");
    if (dashStreak) dashStreak.textContent = "0";
  }
}

// ── PET MOOD ──
function getPetMood() {
  const hearts = getHearts();
  if (hearts >= 3)
    return {
      text: "😊 HEHEHEHEHEH! HELLO!!!!",
      suffix: "_happy",
      popupMsg: "HEHEHEHEHHH!! thank uu for twaking cware of mee!! :3",
    };
  if (hearts === 2)
    return {
      text: "😠 Human! Do something! >:(",
      suffix: "_angry",
      popupMsg:
        "GRRRR!! YOU'RE NEGLECTING YOUR STUDIES!! I'm so... forget about it >:(",
    };
  return {
    text: "😢 Please take better care of me!",
    suffix: "_sad",
    popupMsg: "WAAAAAA!! You're making me cry, do something human!",
  };
}

function getPetMoodImg(baseImg) {
  return baseImg.replace(".png", getPetMood().suffix + ".png");
}

function refreshPetMood() {
  const sp = _profile.selectedPet;
  if (sp === null || sp === undefined) return;
  const petImgs = [
    "images/dog.png",
    "images/cat.png",
    "images/capy.png",
    "images/rabbit.png",
  ];
  const mood = getPetMood();
  document.getElementById("dash-big-icon").innerHTML =
    `<img src="${getPetMoodImg(petImgs[sp])}" style="width:100px;height:100px;object-fit:contain;">`;
  document.getElementById("dash-pet-mood").textContent = mood.text;
}

// ── SETUP ──
let selectedChar = null;
let selectedPet = null;

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

async function completeSetup() {
  const charName = document.getElementById("char-name").value.trim();
  const petName = document.getElementById("pet-name").value.trim();
  console.log("charName input:", charName);
  console.log("petName input:", petName);
  console.log("selectedChar:", selectedChar);
  console.log("selectedPet:", selectedPet);
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

  await saveProfile({ selectedChar, selectedPet, charName, petName });
  document.getElementById("nav-username").textContent = "👤 " + charName;

  populateDashboard(selectedChar, selectedPet, charName, petName);

  document.getElementById("home-hero").style.display = "none";
  document.getElementById("dashboard").style.display = "block";
  closeCustomize();

  window.scrollTo({ top: 0, behavior: "smooth" });
  msg.textContent = "✅ Setup complete! Welcome, " + charName + "!";
  setTimeout(() => (msg.textContent = ""), 4000);
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
    `<img src="${getPetMoodImg(petImgs[petIdx])}" style="width:100px;height:100px;object-fit:contain;">`;
  document.getElementById("dash-pet-name").textContent = petName;
  document.getElementById("dash-pet-mood").textContent = getPetMood().text;
  document.getElementById("dash-char-icon").innerHTML =
    `<img src="${charImgs[charIdx]}" style="width:38px;height:38px;object-fit:contain;">`;
  document.getElementById("dash-char-name-display").textContent = charName;
  document.getElementById("dash-streak").textContent = getStreak();
  document.getElementById("dash-hearts").textContent = renderHearts();
  document.getElementById("dash-sessions").textContent = _sessions.filter(
    (s) =>
      s.time && new Date(s.time).toDateString() === new Date().toDateString(),
  ).length;
  document.getElementById("dash-tasks").textContent = _todos.filter(
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

function restoreDashboard() {
  const { selectedChar: sc, selectedPet: sp, charName, petName } = _profile;
  if (sc === null || sc === undefined || !charName || !petName) return;
  populateDashboard(sc, sp, charName, petName);
  document.getElementById("home-hero").style.display = "none";
  document.getElementById("dashboard").style.display = "block";
  closeCustomize();
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

// ── POMODORO ──
let pomDurations = { work: 25 * 60, short: 5 * 60, long: 15 * 60 };
let pomMode = "work";
let pomSeconds = pomDurations.work;
let pomInterval = null;
let pomRunning = false;
let heartGivenForSession = false;

function setMode(mode) {
  if (pomRunning) resetTimer(true);
  pomMode = mode;
  pomSeconds = pomDurations[mode];
  updateDisplay();
  document
    .querySelectorAll(".pom-mode")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById("mode-" + mode).classList.add("active");
}

function updateDisplay() {
  // nirereset yung timer pabalik sa dati
  const m = String(Math.floor(pomSeconds / 60)).padStart(2, "0");
  const s = String(pomSeconds % 60).padStart(2, "0");
  document.getElementById("pom-display").textContent = m + ":" + s;
}

function startPomInterval() {
  clearInterval(pomInterval);
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
      pomSeconds = pomDurations[pomMode];
      updateDisplay();
      btn.innerHTML = '<i class="fas fa-play"></i> Start';
      heartGivenForSession = false;

      console.log("Timer finished, pomMode is:", pomMode);
      if (pomMode === "work") {
        gainStreak();
        gainHeart();
      }

      logSession();
      updatePopupPets();
      document.getElementById("popup-complete").style.display = "flex";
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
    closePausePopup();
    startPomInterval();
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

function toggleCustomTimer() {
  const panel = document.getElementById("pom-custom");
  panel.style.display = panel.style.display === "none" ? "block" : "none";
}

function applyCustomTimer() {
  const work = parseInt(document.getElementById("custom-work").value) || 25;
  const short = parseInt(document.getElementById("custom-short").value) || 5;
  const long = parseInt(document.getElementById("custom-long").value) || 15;
  pomDurations.work = Math.min(60, Math.max(1, work)) * 60;
  pomDurations.short = Math.min(30, Math.max(1, short)) * 60;
  pomDurations.long = Math.min(60, Math.max(1, long)) * 60;
  document.getElementById("mode-work").textContent = `Work (${work} min)`;
  document.getElementById("mode-short").textContent =
    `Short Break (${short} min)`;
  document.getElementById("mode-long").textContent = `Long Break (${long} min)`;
  resetTimer(true);
  pomSeconds = pomDurations[pomMode];
  updateDisplay();
  document.getElementById("pom-custom").style.display = "none";
}

// ── PAUSE PENALTY ──
const PAUSE_LIMIT = 5 * 60;
let pauseSeconds = PAUSE_LIMIT;
let pauseInterval = null;

function startPauseCountdown() {
  pauseSeconds = PAUSE_LIMIT;
  updatePauseDisplay();
  updatePopupPets();
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

function closePausePopup() {
  clearInterval(pauseInterval);
  pauseInterval = null;
  document.getElementById("popup-pause").style.display = "none";
  if (!pomRunning) startPomInterval();
}

// ── LEAVE PENALTY ──
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

// ── SESSION LOG ──
async function logSession() {
  const label =
    pomMode === "work"
      ? "Work session (25 min)"
      : pomMode === "short"
        ? "Short break (5 min)"
        : "Long break (15 min)";
  const entry = { label, time: new Date().toLocaleString(), ts: Date.now() };
  _sessions.unshift(entry);
  await addDoc(collection(db, "users", currentUser.uid, "sessions"), entry);
  renderSessionLog();
}

function renderSessionLog() {
  const ul = document.getElementById("session-log");
  if (!ul) return;
  if (_sessions.length === 0) {
    ul.innerHTML =
      '<li class="empty-state">No sessions yet. Start your first Pomodoro!</li>';
    return;
  }
  ul.innerHTML = _sessions
    .map(
      (s) =>
        `<li><span>${s.label}</span><span style="color:rgba(58,32,16,0.4);font-size:12px">${s.time}</span></li>`,
    )
    .join("");
}

function openEditTimer() {
  if (pomRunning) return; // can't edit while running
  const m = Math.floor(pomSeconds / 60);
  const s = pomSeconds % 60;
  document.getElementById("pom-edit-min").value = m;
  document.getElementById("pom-edit-sec").value = s;
  document.getElementById("pom-display").style.display = "none";
  document.getElementById("pom-edit").style.display = "flex";
  document.getElementById("pom-edit-btn").style.display = "none";
}

function cancelEditTimer() {
  document.getElementById("pom-display").style.display = "block";
  document.getElementById("pom-edit").style.display = "none";
  document.getElementById("pom-edit-btn").style.display = "block";
}

function applyEditTimer() {
  const m = parseInt(document.getElementById("pom-edit-min").value) || 0;
  const s = parseInt(document.getElementById("pom-edit-sec").value) || 0;
  const total = m * 60 + s;
  if (total <= 0) return;
  pomSeconds = total;
  updateDisplay();
  cancelEditTimer();
}

// ── TO-DO ──
function getTodos() {
  return _todos;
}
async function saveTodoToFirestore(todo) {
  const ref = await addDoc(
    collection(db, "users", currentUser.uid, "todos"),
    todo,
  );
  return ref.id;
}

async function addTodo() {
  const input = document.getElementById("todo-input");
  const deadline = document.getElementById("todo-deadline");
  const text = input.value.trim();
  if (!text) return;
  const todo = {
    text,
    done: false,
    id: Date.now(),
    deadline: deadline.value || null,
    penalised: false,
  };
  const docId = await saveTodoToFirestore(todo);
  _todos.push({ ...todo, _docId: docId });
  input.value = "";
  deadline.value = "";
  renderTodos();
}

async function toggleTodo(id) {
  const todo = _todos.find((t) => t.id === id);
  if (!todo) return;
  const wasCompleted = todo.done;
  todo.done = !todo.done;

  const updates = { done: todo.done };

  if (!wasCompleted && todo.done && !todo.heartGiven) {
    gainHeart();
    todo.heartGiven = true;
    updates.heartGiven = true;
  }

  await updateDoc(
    doc(db, "users", currentUser.uid, "todos", todo._docId),
    updates,
  );
  renderTodos();
}

async function deleteTodo(id) {
  const todo = _todos.find((t) => t.id === id);
  if (!todo) return;
  await deleteDoc(doc(db, "users", currentUser.uid, "todos", todo._docId));
  _todos = _todos.filter((t) => t.id !== id);
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
      <span class="todo-text">${t.text}</span>
      ${
        t.deadline
          ? `<span class="todo-deadline-badge ${new Date(t.deadline) < new Date() && !t.done ? "overdue" : ""}">
        📅 ${new Date(t.deadline).toLocaleString()}</span>`
          : ""
      }
      <button class="todo-del" onclick="deleteTodo(${t.id})"><i class="fas fa-times"></i></button>
    </li>
  `,
    )
    .join("");
}

// ── CALENDAR ──
let calDate = new Date();
let calSelected = null;

function getEvents() {
  const merged = JSON.parse(JSON.stringify(_events));
  _todos.forEach((t) => {
    if (!t.deadline) return;
    const key = t.deadline.slice(0, 10);
    if (!merged[key]) merged[key] = [];
    const alreadyThere = merged[key].some((e) => e.todoId === t.id);
    if (!alreadyThere)
      merged[key].push({
        text: "📋 " + t.text,
        id: "todo-" + t.id,
        todoId: t.id,
        readOnly: true,
      });
  });
  return merged;
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

async function addCalEvent() {
  if (!calSelected) return;
  const input = document.getElementById("cal-event-input");
  const text = input.value.trim();
  if (!text) return;
  const event = { text, id: Date.now(), date: calSelected };
  const ref = await addDoc(
    collection(db, "users", currentUser.uid, "events"),
    event,
  );
  if (!_events[calSelected]) _events[calSelected] = [];
  _events[calSelected].push({ ...event, _docId: ref.id });
  input.value = "";
  renderCalEvents(calSelected);
  renderCalendar();
}

async function deleteCalEvent(key, id) {
  const evArr = _events[key] || [];
  const ev = evArr.find((e) => e.id === id);
  if (ev && ev._docId) {
    await deleteDoc(doc(db, "users", currentUser.uid, "events", ev._docId));
  }
  if (_events[key]) _events[key] = _events[key].filter((e) => e.id !== id);
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
      ${
        !e.readOnly
          ? `<button class="todo-del" onclick="deleteCalEvent('${key}', ${e.id})">
        <i class="fas fa-times"></i></button>`
          : ""
      }
    </li>
  `,
    )
    .join("");
}

// ── STICKY NOTES ──
let stickyColor = "#fff9c4";

function setStickyColor(color, btn) {
  stickyColor = color;
  document
    .querySelectorAll(".color-dot")
    .forEach((d) =>
      d.classList.toggle("active-color", d.style.background === color),
    );
}

async function addSticky() {
  const sticky = {
    id: Date.now(),
    color: stickyColor,
    text: "",
    date: new Date().toLocaleDateString(),
  };
  const ref = await addDoc(
    collection(db, "users", currentUser.uid, "stickies"),
    sticky,
  );
  _stickies.push({ ...sticky, _docId: ref.id });
  renderStickies();
}

async function deleteSticky(id) {
  const sticky = _stickies.find((s) => s.id === id);
  if (sticky?._docId)
    await deleteDoc(
      doc(db, "users", currentUser.uid, "stickies", sticky._docId),
    );
  _stickies = _stickies.filter((s) => s.id !== id);
  renderStickies();
}

async function updateStickyText(id, text) {
  const sticky = _stickies.find((s) => s.id === id);
  if (!sticky) return;
  sticky.text = text;
  if (sticky._docId)
    await updateDoc(
      doc(db, "users", currentUser.uid, "stickies", sticky._docId),
      { text },
    );
}

function renderStickies() {
  const board = document.getElementById("sticky-board");
  if (!board) return;
  if (_stickies.length === 0) {
    board.innerHTML =
      '<p class="empty-state">No notes yet. Click "New Note" to start!</p>';
    return;
  }
  board.innerHTML = _stickies
    .map(
      (s) => `
    <div class="sticky-note" style="background:${s.color}">
      <button class="sticky-del" onclick="deleteSticky(${s.id})"><i class="fas fa-times"></i></button>
      <textarea placeholder="Write your note..." oninput="updateStickyText(${s.id}, this.value)">${s.text}</textarea>
      <div class="sticky-date">${s.date}</div>
    </div>
  `,
    )
    .join("");
}

// ── DEADLINE CHECKER ──
async function checkDeadlines() {
  const now = new Date();
  let changed = false;
  for (const t of _todos) {
    if (!t.done && t.deadline && !t.penalised && new Date(t.deadline) < now) {
      loseHeart('"' + t.text + '" deadline was missed!');
      t.penalised = true;
      changed = true;
      if (t._docId)
        await updateDoc(doc(db, "users", currentUser.uid, "todos", t._docId), {
          penalised: true,
        });
    }
  }
  if (changed) renderTodos();
}

// regain hearts

function gainHeart() {
  const hearts = getHearts();
  if (hearts >= MAX_HEARTS) return;
  saveHearts(hearts + 1);
  updateNavBadge();

  const dashHearts = document.getElementById("dash-hearts");
  if (dashHearts) dashHearts.textContent = renderHearts();
  refreshPetMood();
}

// popup pet adder

function getPopupPetImg() {
  const sp = _profile.selectedPet;
  if (sp === null || sp === undefined) return "";
  const petImgs = [
    "images/dog.png",
    "images/cat.png",
    "images/capy.png",
    "images/rabbit.png",
  ];
  return `<img src="${getPetMoodImg(petImgs[sp])}" style="width:150px;height:150px;object-fit:contain;">`;
}

function updatePopupPets() {
  const img = getPopupPetImg();
  const mood = getPetMood();
  const petIds = [
    "popup-pet-pause",
    "popup-pet-neglect",
    "popup-pet-reset",
    "popup-pet-leave",
    "popup-pet-complete",
  ];
  const msgIds = [
    "popup-mood-pause",
    "popup-mood-neglect",
    "popup-mood-reset",
    "popup-mood-leave",
    "popup-mood-complete",
  ];

  petIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = img;
  });

  msgIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = mood.popupMsg;
  });
}

// ── Expose functions to HTML ──
window.handleLogout = handleLogout;
window.showPage = showPage;
window.navTo = navTo;
window.selectChar = selectChar;
window.selectPet = selectPet;
window.completeSetup = completeSetup;
window.openCustomize = openCustomize;
window.closeCustomize = closeCustomize;
window.toggleTimer = toggleTimer;
window.resetTimer = resetTimer;
window.setMode = setMode;
window.toggleCustomTimer = toggleCustomTimer;
window.applyCustomTimer = applyCustomTimer;
window.closePausePopup = closePausePopup;
window.confirmLeave = confirmLeave;
window.cancelLeave = cancelLeave;
window.addTodo = addTodo;
window.toggleTodo = toggleTodo;
window.deleteTodo = deleteTodo;
window.changeMonth = changeMonth;
window.selectDay = selectDay;
window.addCalEvent = addCalEvent;
window.deleteCalEvent = deleteCalEvent;
window.addSticky = addSticky;
window.deleteSticky = deleteSticky;
window.updateStickyText = updateStickyText;
window.setStickyColor = setStickyColor;
window.openEditTimer = openEditTimer;
window.cancelEditTimer = cancelEditTimer;
window.applyEditTimer = applyEditTimer;
