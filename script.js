/* ============================================================
   90-Day Discipline Tracker — script.js
   Pure vanilla JS, no frameworks, no external libraries.
   All data persisted in localStorage under one key.
   ============================================================ */

"use strict";

/* ── 1. HABIT LIST ───────────────────────────────────────────────
   Edit names, add or remove items here freely.
   The total score is always HABITS.length — never hard-coded.
   Each group: { label: String, habits: [String, …] }
   ─────────────────────────────────────────────────────────────── */
const HABIT_GROUPS = [
  {
    label: "Avoid",
    habits: [
      "No porn",
      "No sugar or junk food",
      "No mindless scrolling (max 30 min)",
      "No late-night phone (off by 9:30 PM)",
    ],
  },
  {
    label: "Morning",
    habits: [
      "Wake up 5:45 AM",
      "Morning prayer",
      "Drink 3L water",
    ],
  },
  {
    label: "Work & Exam",
    habits: [
      "Exit exam study (90 min)",
      "Web development deep work (2 hours)",
      "Outreach & Upwork proposals (1 hour)",
      "Forex learning, demo only (30 min)",
    ],
  },
  {
    label: "Growth",
    habits: [
      "Learn something new today (20 min)",
      "English practice: movie / speaking / podcast (30 min)",
      "Read 15 pages",
    ],
  },
  {
    label: "Evening",
    habits: [
      "Exercise 4:30 – 5:00 PM",
      "Journal & sleep by 10 PM",
    ],
  },
];

/* Flatten all habits into one ordered array (used for index mapping) */
const HABITS = HABIT_GROUPS.flatMap((g) => g.habits);
const TOTAL  = HABITS.length; // score denominator — never hard-coded

/* ── 2. STORAGE KEY & SCHEMA ─────────────────────────────────────
   One JSON blob in localStorage:
   {
     start : "YYYY-MM-DD",          // challenge start date
     days  : { "1": [0,1,…], … },   // 0/1 per habit index, keyed by day number
     cnt   : { "1": { o:0, p:0 } }, // outreach (o) and proposals (p) per day
     notes : { "1": "text", … },    // Sunday review text keyed by week number
     inc   : 0                      // total website income in Birr
   }
   ─────────────────────────────────────────────────────────────── */
const LS_KEY = "discipline90";

/* Safe localStorage helpers ------------------------------------ */
function lsRead() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn("localStorage read error:", e);
    return null;
  }
}

function lsWrite(data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("localStorage write error:", e);
  }
}

/* Return the stored data, creating defaults if missing ---------- */
function getData() {
  const stored = lsRead();
  if (stored) return stored;
  // First run — set start date to today
  return {
    start: todayStr(),
    days:  {},
    cnt:   {},
    notes: {},
    inc:   0,
  };
}

function saveData(data) {
  lsWrite(data);
}

/* ── 3. DATE UTILITIES ───────────────────────────────────────── */

/** Return "YYYY-MM-DD" for today */
function todayStr() {
  const d = new Date();
  return fmtDate(d);
}

/** Format a Date object to "YYYY-MM-DD" */
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse "YYYY-MM-DD" to a local midnight Date */
function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Return the day number for a given date string relative to start.
 * Day 1 = start date, Day 2 = start+1, etc.
 * Returns null if before start or after day 90.
 */
function dayNumber(dateStr, startStr) {
  const date  = parseDate(dateStr);
  const start = parseDate(startStr);
  const diff  = Math.round((date - start) / 86400000); // ms → days
  if (diff < 0 || diff >= 90) return null;
  return diff + 1; // 1-indexed
}

/** Return "YYYY-MM-DD" for day N (1-indexed) from start */
function dateOfDay(n, startStr) {
  const start = parseDate(startStr);
  const d = new Date(start);
  d.setDate(d.getDate() + n - 1);
  return fmtDate(d);
}

/** Human-readable short date e.g. "Mon, Oct 10" */
function friendlyDate(dateStr) {
  const d = parseDate(dateStr);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month:   "short",
    day:     "numeric",
  });
}

/* ── 4. SCORE & STATS HELPERS ────────────────────────────────── */

/** Get the 0/1 array for a day number (returns zeroed array if none) */
function getDayChecks(data, n) {
  return Array.isArray(data.days[n]) ? data.days[n] : new Array(TOTAL).fill(0);
}

/** Sum checked habits for a day */
function scoreForDay(data, n) {
  return getDayChecks(data, n).reduce((a, b) => a + b, 0);
}

/**
 * Streak: consecutive days ending today (or yesterday if today is unscored)
 * where score >= 8.
 */
function calcStreak(data, startStr) {
  const todayNum = dayNumber(todayStr(), startStr);
  if (todayNum === null) return 0;

  // Start checking from today; if today has no entries yet, start from yesterday
  let cursor = todayNum;
  const todayScore = scoreForDay(data, cursor);
  if (todayScore === 0 && cursor > 1) cursor--;

  let streak = 0;
  while (cursor >= 1) {
    if (scoreForDay(data, cursor) >= 8) {
      streak++;
      cursor--;
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Average score across all passed days (days 1 up to min(today, 90)).
 * Returns "0/TOTAL" string if no days passed.
 */
function calcAvg(data, startStr) {
  const todayNum = dayNumber(todayStr(), startStr);
  if (!todayNum || todayNum < 1) return `0/${TOTAL}`;
  const passed = Math.min(todayNum, 90);
  let total = 0;
  for (let i = 1; i <= passed; i++) total += scoreForDay(data, i);
  const avg = (total / passed).toFixed(1);
  return `${avg}/${TOTAL}`;
}

/** Count days with score >= 13 */
function calcGreatDays(data, startStr) {
  const todayNum = dayNumber(todayStr(), startStr);
  if (!todayNum) return 0;
  let count = 0;
  for (let i = 1; i <= Math.min(todayNum, 90); i++) {
    if (scoreForDay(data, i) >= 13) count++;
  }
  return count;
}

/* ── 5. APPLICATION STATE ────────────────────────────────────── */
const state = {
  data:        getData(),   // the whole data blob
  viewDay:     1,           // which day is shown in Today tab
  viewWeek:    1,           // which week is shown in Review tab
};

/* Initialise viewDay to today's day number (or 1 if outside range) */
function initViewDay() {
  const n = dayNumber(todayStr(), state.data.start);
  state.viewDay = n !== null ? n : 1;
}

/* ── 6. DOM REFERENCES ───────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

const els = {
  dayLabel:       $("dayLabel"),
  // Stat cards
  statStreak:     $("statStreak"),
  statAvg:        $("statAvg"),
  statGreat:      $("statGreat"),
  // Day navigator
  btnPrevDay:     $("btnPrevDay"),
  btnNextDay:     $("btnNextDay"),
  navDayTitle:    $("navDayTitle"),
  navDayScore:    $("navDayScore"),
  // Progress
  progressBar:    $("progressBar"),
  progressFill:   $("progressFill"),
  progressMsg:    $("progressMsg"),
  // Habits
  habitGroups:    $("habitGroups"),
  // Numbers
  inputOutreach:  $("inputOutreach"),
  inputProposals: $("inputProposals"),
  // Grid tab
  dayGrid:        $("dayGrid"),
  totalOutreach:  $("totalOutreach"),
  totalProposals: $("totalProposals"),
  inputIncome:    $("inputIncome"),
  // Review tab
  btnPrevWeek:    $("btnPrevWeek"),
  btnNextWeek:    $("btnNextWeek"),
  navWeekTitle:   $("navWeekTitle"),
  navWeekAvg:     $("navWeekAvg"),
  weekReview:     $("weekReview"),
  inputStartDate: $("inputStartDate"),
  btnReset:       $("btnReset"),
};

/* ── 7. RENDER FUNCTIONS ─────────────────────────────────────── */

/** Update the header subtitle */
function renderHeader() {
  const { data } = state;
  const todayDate = todayStr();
  const start = parseDate(data.start);
  const today = parseDate(todayDate);
  const diff  = Math.round((today - start) / 86400000);

  if (diff < 0) {
    els.dayLabel.textContent = `Starts on ${friendlyDate(data.start)}`;
  } else if (diff >= 90) {
    els.dayLabel.textContent = "Challenge complete 🎉";
  } else {
    els.dayLabel.textContent = `Day ${diff + 1} of 90`;
  }
}

/** Render stat cards */
function renderStats() {
  const { data } = state;
  els.statStreak.textContent = calcStreak(data, data.start);
  els.statAvg.textContent    = calcAvg(data, data.start);
  els.statGreat.textContent  = calcGreatDays(data, data.start);
}

/** Render the day navigator + progress bar + habits for state.viewDay */
function renderToday() {
  const { data, viewDay } = state;
  const checks = getDayChecks(data, viewDay);
  const score  = checks.reduce((a, b) => a + b, 0);
  const dateStr = dateOfDay(viewDay, data.start);
  const todayNum = dayNumber(todayStr(), data.start);

  /* Day navigator */
  els.navDayTitle.textContent = `Day ${viewDay} — ${friendlyDate(dateStr)}`;
  els.navDayScore.textContent = `${score} / ${TOTAL}`;
  els.btnPrevDay.disabled = viewDay <= 1;
  els.btnNextDay.disabled = viewDay >= Math.min(todayNum || 1, 90);

  /* Progress bar */
  const pct = Math.round((score / TOTAL) * 100);
  els.progressFill.style.width = `${pct}%`;
  els.progressBar.setAttribute("aria-valuenow", score);

  /* Progress message */
  let msg = "", cls = "";
  if (score >= 13) {
    msg = "Great day. Keep it. 💪";   cls = "msg-great";
  } else if (score >= 8) {
    msg = "Good. Push for 13+. 🔼";  cls = "msg-good";
  } else {
    msg = "Do the minimum version — never miss twice. ⚠️"; cls = "msg-low";
  }
  els.progressMsg.textContent = msg;
  els.progressMsg.className   = `progress-msg ${cls}`;

  /* Habit groups */
  renderHabitGroups(checks);

  /* Today numbers */
  const cnt = data.cnt[viewDay] || { o: 0, p: 0 };
  els.inputOutreach.value  = cnt.o || "";
  els.inputProposals.value = cnt.p || "";
}

/** Build (or rebuild) the habit group cards */
function renderHabitGroups(checks) {
  const frag = document.createDocumentFragment();
  let habitIndex = 0;

  HABIT_GROUPS.forEach((group) => {
    const section = document.createElement("div");
    section.className = "habit-group";

    const header = document.createElement("div");
    header.className = "habit-group-header";
    header.textContent = group.label;
    section.appendChild(header);

    group.habits.forEach((name) => {
      const idx     = habitIndex++;
      const checked = checks[idx] === 1;

      const row = document.createElement("label");
      row.className  = `habit-item${checked ? " checked" : ""}`;
      row.setAttribute("data-habit-index", idx);

      const cb = document.createElement("input");
      cb.type      = "checkbox";
      cb.className = "habit-checkbox";
      cb.checked   = checked;
      cb.setAttribute("aria-label", name);

      const lbl = document.createElement("span");
      lbl.className   = "habit-label";
      lbl.textContent = name;

      row.appendChild(cb);
      row.appendChild(lbl);
      section.appendChild(row);
    });

    frag.appendChild(section);
  });

  els.habitGroups.innerHTML = "";
  els.habitGroups.appendChild(frag);
}

/** Render the 90-day grid */
function renderGrid() {
  const { data } = state;
  const todayNum = dayNumber(todayStr(), data.start);
  const frag = document.createDocumentFragment();

  for (let n = 1; n <= 90; n++) {
    const cell = document.createElement("div");
    cell.className  = "grid-cell";
    cell.textContent = n;
    cell.setAttribute("data-day", n);
    cell.setAttribute("role", "button");
    cell.setAttribute("tabindex", "0");
    cell.setAttribute("aria-label", `Day ${n}`);

    /* Colour logic */
    if (todayNum !== null && n < todayNum) {
      // Past day
      const s = scoreForDay(data, n);
      if (s >= 13)     cell.classList.add("green");
      else if (s >= 8) cell.classList.add("amber");
      else             cell.classList.add("red");
    } else if (todayNum !== null && n === todayNum) {
      // Today — colour by current score
      const s = scoreForDay(data, n);
      if (s >= 13)     cell.classList.add("green");
      else if (s >= 8) cell.classList.add("amber");
      else if (s > 0)  cell.classList.add("red");
      else             cell.classList.add("neutral");
      cell.classList.add("today");
    } else {
      // Future
      cell.classList.add("neutral");
    }

    frag.appendChild(cell);
  }

  els.dayGrid.innerHTML = "";
  els.dayGrid.appendChild(frag);

  /* Totals */
  let totalO = 0, totalP = 0;
  Object.values(data.cnt).forEach((c) => {
    totalO += Number(c.o) || 0;
    totalP += Number(c.p) || 0;
  });
  els.totalOutreach.textContent  = totalO;
  els.totalProposals.textContent = totalP;
  els.inputIncome.value = data.inc || "";
}

/** Render the review screen for state.viewWeek */
function renderReview() {
  const { data, viewWeek } = state;
  const todayNum = dayNumber(todayStr(), data.start);
  const maxWeek  = todayNum ? Math.ceil(Math.min(todayNum, 90) / 7) : 13;

  /* Week navigator */
  els.navWeekTitle.textContent = `Week ${viewWeek}`;
  els.btnPrevWeek.disabled = viewWeek <= 1;
  els.btnNextWeek.disabled = viewWeek >= 13;

  /* Week average */
  const startDay = (viewWeek - 1) * 7 + 1;
  const endDay   = Math.min(startDay + 6, 90);
  let total = 0, count = 0;
  for (let d = startDay; d <= endDay; d++) {
    if (todayNum && d <= todayNum) {
      total += scoreForDay(data, d);
      count++;
    }
  }
  els.navWeekAvg.textContent = count
    ? `Avg: ${(total / count).toFixed(1)} / ${TOTAL}`
    : "Avg: —";

  /* Review textarea */
  els.weekReview.value = data.notes[viewWeek] || "";

  /* Start date input */
  els.inputStartDate.value = data.start;
}

/** Master render — call this to refresh everything */
function renderAll() {
  renderHeader();
  renderStats();
  renderToday();
  renderGrid();
  renderReview();
}

/* ── 8. TAB SWITCHING ────────────────────────────────────────── */
const TAB_IDS = { today: "screen-today", grid: "screen-grid", review: "screen-review" };

function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    const active = btn.dataset.tab === tabName;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active);
  });

  Object.entries(TAB_IDS).forEach(([key, screenId]) => {
    const screen = document.getElementById(screenId);
    if (key === tabName) {
      screen.classList.add("active");
      screen.removeAttribute("hidden");
    } else {
      screen.classList.remove("active");
      screen.setAttribute("hidden", "");
    }
  });
}

/* ── 9. EVENT HANDLERS ───────────────────────────────────────── */

/* Tab bar — event delegation on the nav element */
document.querySelector(".tab-bar").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;
  switchTab(btn.dataset.tab);
});

/* Day navigator buttons */
els.btnPrevDay.addEventListener("click", () => {
  if (state.viewDay > 1) {
    state.viewDay--;
    renderToday();
    renderStats();
  }
});

els.btnNextDay.addEventListener("click", () => {
  const todayNum = dayNumber(todayStr(), state.data.start) || 1;
  if (state.viewDay < Math.min(todayNum, 90)) {
    state.viewDay++;
    renderToday();
    renderStats();
  }
});

/* Habit checkboxes — event delegation on the habit groups container */
els.habitGroups.addEventListener("change", (e) => {
  const cb = e.target;
  if (!cb.classList.contains("habit-checkbox")) return;

  const row = cb.closest(".habit-item");
  if (!row) return;
  const idx = Number(row.getAttribute("data-habit-index"));
  const { data, viewDay } = state;

  // Ensure the day array exists
  if (!Array.isArray(data.days[viewDay])) {
    data.days[viewDay] = new Array(TOTAL).fill(0);
  }
  data.days[viewDay][idx] = cb.checked ? 1 : 0;

  // Update visual state of the row
  row.classList.toggle("checked", cb.checked);

  saveData(data);
  renderToday();  // refresh score / progress bar
  renderStats();
  renderGrid();   // keep grid in sync
});

/* Today numbers inputs */
function saveCnt() {
  const { data, viewDay } = state;
  if (!data.cnt[viewDay]) data.cnt[viewDay] = { o: 0, p: 0 };
  data.cnt[viewDay].o = Number(els.inputOutreach.value)  || 0;
  data.cnt[viewDay].p = Number(els.inputProposals.value) || 0;
  saveData(data);
  renderGrid(); // refresh totals
}
els.inputOutreach.addEventListener("input",  saveCnt);
els.inputProposals.addEventListener("input", saveCnt);

/* Grid cell tap — navigate to that day in the Today tab */
els.dayGrid.addEventListener("click", (e) => {
  const cell = e.target.closest(".grid-cell");
  if (!cell) return;
  const n = Number(cell.getAttribute("data-day"));
  const todayNum = dayNumber(todayStr(), state.data.start);
  // Only allow navigating to days that have passed or are today
  if (todayNum !== null && n <= todayNum) {
    state.viewDay = n;
    renderToday();
    renderStats();
    switchTab("today");
  }
});

/* Keyboard support for grid cells */
els.dayGrid.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  e.preventDefault();
  const cell = e.target.closest(".grid-cell");
  if (cell) cell.click();
});

/* Income input */
els.inputIncome.addEventListener("input", () => {
  state.data.inc = Number(els.inputIncome.value) || 0;
  saveData(state.data);
});

/* Week navigator */
els.btnPrevWeek.addEventListener("click", () => {
  if (state.viewWeek > 1) {
    state.viewWeek--;
    renderReview();
  }
});
els.btnNextWeek.addEventListener("click", () => {
  if (state.viewWeek < 13) {
    state.viewWeek++;
    renderReview();
  }
});

/* Sunday review textarea — auto-save on input */
els.weekReview.addEventListener("input", () => {
  state.data.notes[state.viewWeek] = els.weekReview.value;
  saveData(state.data);
});

/* Start date change */
els.inputStartDate.addEventListener("change", () => {
  const newStart = els.inputStartDate.value;
  if (!newStart) return;
  state.data.start = newStart;
  saveData(state.data);
  initViewDay();
  renderAll();
});

/* Reset all data */
els.btnReset.addEventListener("click", () => {
  const confirmed = window.confirm(
    "Reset ALL data?\n\nThis will delete all habit checks, notes, and settings. This cannot be undone."
  );
  if (!confirmed) return;

  const fresh = {
    start: todayStr(),
    days:  {},
    cnt:   {},
    notes: {},
    inc:   0,
  };
  state.data    = fresh;
  state.viewDay  = 1;
  state.viewWeek = 1;
  saveData(fresh);
  renderAll();
});

/* ── 10. BOOT ────────────────────────────────────────────────── */
(function init() {
  initViewDay();
  renderAll();
  // Default to week 1 or the current week
  const todayNum = dayNumber(todayStr(), state.data.start);
  if (todayNum) state.viewWeek = Math.min(Math.ceil(todayNum / 7), 13);
  renderReview();
})();
