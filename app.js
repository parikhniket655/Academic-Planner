const SafeStorage = {
  memoryStore: {},
  getItem(key) {
    try {
      return window["local" + "Storage"].getItem(key);
    } catch (e) {
      return this.memoryStore[key] || null;
    }
  },
  setItem(key, value) {
    try {
      window["local" + "Storage"].setItem(key, value);
    } catch (e) {
      this.memoryStore[key] = String(value);
    }
  },
  removeItem(key) {
    try {
      window["local" + "Storage"].removeItem(key);
    } catch (e) {
      delete this.memoryStore[key];
    }
  },
  clear() {
    try {
      window["local" + "Storage"].clear();
    } catch (e) {
      this.memoryStore = {};
    }
  }
};
const storage = SafeStorage;

// Cache Buster & Service Worker Reset for 2.9 Release
try {
  const isStorageWorking = (() => {
    try {
      const testKey = "__storage_test_key__";
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  })();

  const storedVer = parseFloat(window.localStorage.getItem("iimr_app_version") || "0");
  if (isStorageWorking && storedVer < 2.9) {
    window.localStorage.clear();
    window.localStorage.setItem("iimr_app_version", "2.9");
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
          registration.unregister();
        }
      });
    }
    
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    
    setTimeout(() => {
      window.location.reload();
    }, 150);
  }
} catch (e) {
  console.warn("Storage check failed. SW cache reset bypassed:", e);
}

/* ==========================================================================
   IIMR ACADEMIC TRACKER - CORE LOGIC
   ========================================================================== */

// Hardcoded Configurations & Backend API Credentials
const TIMETABLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbzKMkHRtxKEWhyybW6CLdlfAHIS0ICimLE4g4-n5Oa_ipo3tG22NEjRMZlvcIxNBB_K/exec";
const SUPABASE_URL = "https://frnyuuywkteqiyinlrmp.supabase.co";  // Paste your Supabase project URL here (e.g. "https://xxxx.supabase.co")
const SUPABASE_KEY = "sb_publishable_dfysjA_5CU1AmweExgrmiA_FD0AS34o";  // Paste your Supabase Anon/Public Key here

// Term Configuration
const TERM_START_DATE = new Date("2026-06-12"); // Academic Term Start Date

// Mock Subject Names
const COURSE_NAMES = {
  "BA": "Business Analytics",
  "AIDMD": "AI-Driven Marketing Decision Making",
  "GBS": "Global Business Simulation",
  "B2B": "B2B Marketing",
  "CW": "Communication Workshop",
  "CV": "Corporate Valuation",
  "IBS": "International Business Strategies",
  "PFM": "Python for Managers",
  "DBM": "Database Management",
  "AIDMD Sec-A": "AI-Driven Marketing Sec A",
  "BA Sec-A": "Business Analytics Sec A",
  "BA Sec-B": "Business Analytics Sec B",
  "CV Sec-A": "Corporate Valuation Sec A",
  "CV Sec-B": "Corporate Valuation Sec B",
  "GBS Sec-B": "Global Business Simulation Sec B",
  "CW Sec-B": "Communication Workshop Sec B"
};

// Course Credit Weights (matches 6.5 credits for 9 scheduled courses in screenshot)
const COURSE_CREDITS = {
  "BA": 1.0,
  "BA Sec-A": 1.0,
  "BA Sec-B": 1.0,
  "AIDMD": 1.0,
  "GBS": 1.0,
  "GBS Sec-B": 1.0,
  "B2B": 1.0,
  "CW": 0.5,
  "CW Sec-B": 0.5,
  "CV": 1.0,
  "CV Sec-A": 1.0,
  "CV Sec-B": 1.0,
  "IBS": 1.0,
  "PFM": 1.0,
  "DBM": 1.0
};

// Course Total Scheduled Sessions count in syllabus
const COURSE_TOTAL_SESSIONS = {
  "BA": 15,
  "BA Sec-A": 15,
  "BA Sec-B": 15,
  "AIDMD": 15,
  "GBS": 15,
  "GBS Sec-B": 15,
  "B2B": 15,
  "CW": 8,
  "CW Sec-B": 8,
  "CV": 20,
  "CV Sec-A": 20,
  "CV Sec-B": 20,
  "IBS": 20,
  "PFM": 15,
  "DBM": 15
};

function normalizeCourseId(id) {
  if (!id) return "";
  return id.replace(/[\s\-]/g, '').toUpperCase();
}

function isStudentEnrolled(studentCourses, courseId) {
  if (!studentCourses || !courseId) return false;
  const normId = normalizeCourseId(courseId);
  
  for (let uCourse of studentCourses) {
    const normUser = normalizeCourseId(uCourse);
    if (normUser === normId) return true;
    
    // E.g. timetable is "BA", user is "BA SEC-A" (combined classes support)
    const baseCodes = ["CW", "GBS", "BA", "CV", "AIDMD", "B2B", "IBS", "PFM", "DBM"];
    if (normUser.startsWith(normId) && baseCodes.includes(normId)) {
      return true;
    }
    // E.g. timetable is "BA SEC-A", user is "BA"
    if (normId.startsWith(normUser) && baseCodes.includes(normUser)) {
      return true;
    }
  }
  return false;
}

// Mock Student Database Defaults
const DEFAULT_STUDENT_DB = {
  "ipm04niketp@iimrohtak.ac.in": {
    name: "Niket Parikh",
    courses: [
      "AIDMD",
      "B2B",
      "BA Sec-A",
      "CV Sec-A",
      "IBS",
      "PFM",
      "GBS Sec-B",
      "CW Sec-B"
    ]
  },
  "ipm04palaky@iimrohtak.ac.in": {
    name: "Palak Yadav",
    courses: [
      "AIDMD",
      "B2B",
      "BA Sec-B",
      "CV Sec-B",
      "IBS",
      "PFM",
      "GBS Sec-B",
      "CW Sec-B"
    ]
  }
};

// Default Timetable Mapping (Spans late June to late July 2026 to match stats & dates in screenshots)
const DEFAULT_TIMETABLE = [
  // CW Sec-B (Communication Workshop) Sessions
  { dateKey: "2026-06-28", day: "Sunday", slot: "17:40 - 18:55", courseId: "CW Sec-B", subject: "Communication Workshop", room: "LR 07", instructor: "Ms. Xenia Rao" },
  { dateKey: "2026-07-03", day: "Friday", slot: "10:20 - 11:35", courseId: "CW Sec-B", subject: "Communication Workshop", room: "LR 07", instructor: "Ms. Xenia Rao" },
  { dateKey: "2026-07-17", day: "Friday", slot: "10:20 - 11:35", courseId: "CW Sec-B", subject: "Communication Workshop", room: "LR 07", instructor: "Ms. Xenia Rao" },
  { dateKey: "2026-07-18", day: "Saturday", slot: "11:55 - 13:10", courseId: "CW Sec-B", subject: "Communication Workshop", room: "LR 07", instructor: "Ms. Xenia Rao" },
  { dateKey: "2026-07-25", day: "Saturday", slot: "10:20 - 11:35", courseId: "CW Sec-B", subject: "Communication Workshop", room: "LR 07", instructor: "Ms. Xenia Rao" },
  { dateKey: "2026-07-31", day: "Friday", slot: "10:20 - 11:35", courseId: "CW Sec-B", subject: "Communication Workshop", room: "LR 07", instructor: "Ms. Xenia Rao" },

  // CV Sec-A (Corporate Valuation) Sessions
  { dateKey: "2026-06-29", day: "Monday", slot: "22:25 - 23:40", courseId: "CV Sec-A", subject: "Corporate Valuation", room: "LR 02", instructor: "Dr. Somya Arora" },
  { dateKey: "2026-07-03", day: "Friday", slot: "16:05 - 17:20", courseId: "CV Sec-A", subject: "Corporate Valuation", room: "LR 02", instructor: "Dr. Somya Arora" },
  { dateKey: "2026-07-06", day: "Monday", slot: "22:25 - 23:40", courseId: "CV Sec-A", subject: "Corporate Valuation", room: "LR 02", instructor: "Dr. Somya Arora" },
  { dateKey: "2026-07-10", day: "Friday", slot: "16:05 - 17:20", courseId: "CV Sec-A", subject: "Corporate Valuation", room: "LR 02", instructor: "Dr. Somya Arora" },
  { dateKey: "2026-07-13", day: "Monday", slot: "22:25 - 23:40", courseId: "CV Sec-A", subject: "Corporate Valuation", room: "LR 02", instructor: "Dr. Somya Arora" },
  { dateKey: "2026-07-17", day: "Friday", slot: "16:05 - 17:20", courseId: "CV Sec-A", subject: "Corporate Valuation", room: "LR 02", instructor: "Dr. Somya Arora" },
  { dateKey: "2026-07-20", day: "Monday", slot: "22:25 - 23:40", courseId: "CV Sec-A", subject: "Corporate Valuation", room: "LR 02", instructor: "Dr. Somya Arora" },
  { dateKey: "2026-07-24", day: "Friday", slot: "16:05 - 17:20", courseId: "CV Sec-A", subject: "Corporate Valuation", room: "LR 02", instructor: "Dr. Somya Arora" },

  // CV Sec-B (Corporate Valuation) Sessions
  { dateKey: "2026-06-29", day: "Monday", slot: "22:25 - 23:40", courseId: "CV Sec-B", subject: "Corporate Valuation", room: "LR 02", instructor: "Dr. Somya Arora" },
  { dateKey: "2026-07-03", day: "Friday", slot: "16:05 - 17:20", courseId: "CV Sec-B", subject: "Corporate Valuation", room: "LR 02", instructor: "Dr. Somya Arora" },
  { dateKey: "2026-07-06", day: "Monday", slot: "22:25 - 23:40", courseId: "CV Sec-B", subject: "Corporate Valuation", room: "LR 02", instructor: "Dr. Somya Arora" },
  { dateKey: "2026-07-10", day: "Friday", slot: "16:05 - 17:20", courseId: "CV Sec-B", subject: "Corporate Valuation", room: "LR 02", instructor: "Dr. Somya Arora" },
  { dateKey: "2026-07-13", day: "Monday", slot: "22:25 - 23:40", courseId: "CV Sec-B", subject: "Corporate Valuation", room: "LR 02", instructor: "Dr. Somya Arora" },
  { dateKey: "2026-07-17", day: "Friday", slot: "16:05 - 17:20", courseId: "CV Sec-B", subject: "Corporate Valuation", room: "LR 02", instructor: "Dr. Somya Arora" },

  // BA Sec-A (Business Analytics) Sessions
  { dateKey: "2026-06-29", day: "Monday", slot: "19:15 - 20:30", courseId: "BA Sec-A", subject: "Business Analytics", room: "LR 02", instructor: "Prof. Praveen Ranjan Srivastava" },
  { dateKey: "2026-07-06", day: "Monday", slot: "19:15 - 20:30", courseId: "BA Sec-A", subject: "Business Analytics", room: "LR 02", instructor: "Prof. Praveen Ranjan Srivastava" },
  { dateKey: "2026-07-13", day: "Monday", slot: "19:15 - 20:30", courseId: "BA Sec-A", subject: "Business Analytics", room: "LR 02", instructor: "Prof. Praveen Ranjan Srivastava" },
  { dateKey: "2026-07-20", day: "Monday", slot: "19:15 - 20:30", courseId: "BA Sec-A", subject: "Business Analytics", room: "LR 02", instructor: "Prof. Praveen Ranjan Srivastava" },
  { dateKey: "2026-07-27", day: "Monday", slot: "19:15 - 20:30", courseId: "BA Sec-A", subject: "Business Analytics", room: "LR 02", instructor: "Prof. Praveen Ranjan Srivastava" },

  // BA Sec-B (Business Analytics) Sessions
  { dateKey: "2026-06-29", day: "Monday", slot: "19:15 - 20:30", courseId: "BA Sec-B", subject: "Business Analytics", room: "LR 02", instructor: "Prof. Praveen Ranjan Srivastava" },
  { dateKey: "2026-07-06", day: "Monday", slot: "19:15 - 20:30", courseId: "BA Sec-B", subject: "Business Analytics", room: "LR 02", instructor: "Prof. Praveen Ranjan Srivastava" },
  { dateKey: "2026-07-13", day: "Monday", slot: "19:15 - 20:30", courseId: "BA Sec-B", subject: "Business Analytics", room: "LR 02", instructor: "Prof. Praveen Ranjan Srivastava" },

  // AIDMD (AI-Driven Marketing) Sessions
  { dateKey: "2026-06-29", day: "Monday", slot: "20:50 - 22:05", courseId: "AIDMD", subject: "AI-Driven Marketing...", room: "LR 07", instructor: "Dr. Ankit Kesharwani" },
  { dateKey: "2026-07-06", day: "Monday", slot: "20:50 - 22:05", courseId: "AIDMD", subject: "AI-Driven Marketing...", room: "LR 07", instructor: "Dr. Ankit Kesharwani" },
  { dateKey: "2026-07-13", day: "Monday", slot: "20:50 - 22:05", courseId: "AIDMD", subject: "AI-Driven Marketing...", room: "LR 07", instructor: "Dr. Ankit Kesharwani" },
  { dateKey: "2026-07-20", day: "Monday", slot: "20:50 - 22:05", courseId: "AIDMD", subject: "AI-Driven Marketing...", room: "LR 07", instructor: "Dr. Ankit Kesharwani" },
  { dateKey: "2026-07-27", day: "Monday", slot: "20:50 - 22:05", courseId: "AIDMD", subject: "AI-Driven Marketing...", room: "LR 07", instructor: "Dr. Ankit Kesharwani" },
  { dateKey: "2026-07-28", day: "Tuesday", slot: "20:50 - 22:05", courseId: "AIDMD", subject: "AI-Driven Marketing...", room: "LR 07", instructor: "Dr. Ankit Kesharwani" },
  { dateKey: "2026-07-29", day: "Wednesday", slot: "20:50 - 22:05", courseId: "AIDMD", subject: "AI-Driven Marketing...", room: "LR 07", instructor: "Dr. Ankit Kesharwani" },

  // IBS (International Business) Sessions
  { dateKey: "2026-06-30", day: "Tuesday", slot: "14:30 - 15:45", courseId: "IBS", subject: "International Business", room: "LR 07", instructor: "Dr. Pranav Dharmani" },
  { dateKey: "2026-07-07", day: "Tuesday", slot: "14:30 - 15:45", courseId: "IBS", subject: "International Business", room: "LR 07", instructor: "Dr. Pranav Dharmani" },
  { dateKey: "2026-07-14", day: "Tuesday", slot: "14:30 - 15:45", courseId: "IBS", subject: "International Business", room: "LR 07", instructor: "Dr. Pranav Dharmani" },
  { dateKey: "2026-07-21", day: "Tuesday", slot: "14:30 - 15:45", courseId: "IBS", subject: "International Business", room: "LR 07", instructor: "Dr. Pranav Dharmani" },
  { dateKey: "2026-07-28", day: "Tuesday", slot: "14:30 - 15:45", courseId: "IBS", subject: "International Business", room: "LR 07", instructor: "Dr. Pranav Dharmani" },
  { dateKey: "2026-07-29", day: "Wednesday", slot: "14:30 - 15:45", courseId: "IBS", subject: "International Business", room: "LR 07", instructor: "Dr. Pranav Dharmani" },
  { dateKey: "2026-07-30", day: "Thursday", slot: "14:30 - 15:45", courseId: "IBS", subject: "International Business", room: "LR 07", instructor: "Dr. Pranav Dharmani" },

  // GBS Sec-B (Global Business Simulation) Sessions
  { dateKey: "2026-06-30", day: "Tuesday", slot: "17:40 - 18:55", courseId: "GBS Sec-B", subject: "Global Business Simulation", room: "LR 07", instructor: "Dr. Pranav Dharmani" },
  { dateKey: "2026-07-07", day: "Tuesday", slot: "17:40 - 18:55", courseId: "GBS Sec-B", subject: "Global Business Simulation", room: "LR 07", instructor: "Dr. Pranav Dharmani" },
  { dateKey: "2026-07-14", day: "Tuesday", slot: "17:40 - 18:55", courseId: "GBS Sec-B", subject: "Global Business Simulation", room: "LR 07", instructor: "Dr. Pranav Dharmani" },
  { dateKey: "2026-07-21", day: "Tuesday", slot: "17:40 - 18:55", courseId: "GBS Sec-B", subject: "Global Business Simulation", room: "LR 07", instructor: "Dr. Pranav Dharmani" },
  { dateKey: "2026-07-28", day: "Tuesday", slot: "17:40 - 18:55", courseId: "GBS Sec-B", subject: "Global Business Simulation", room: "LR 07", instructor: "Dr. Pranav Dharmani" },
  { dateKey: "2026-07-29", day: "Wednesday", slot: "17:40 - 18:55", courseId: "GBS Sec-B", subject: "Global Business Simulation", room: "LR 07", instructor: "Dr. Pranav Dharmani" },
  { dateKey: "2026-07-30", day: "Thursday", slot: "17:40 - 18:55", courseId: "GBS Sec-B", subject: "Global Business Simulation", room: "LR 07", instructor: "Dr. Pranav Dharmani" },

  // B2B (B2B Marketing) Sessions
  { dateKey: "2026-07-02", day: "Thursday", slot: "16:05 - 17:20", courseId: "B2B", subject: "B2B Marketing", room: "LR 07", instructor: "Dr. Mihir Kushwah" },
  { dateKey: "2026-07-04", day: "Saturday", slot: "14:30 - 15:45", courseId: "B2B", subject: "B2B Marketing", room: "LR 07", instructor: "Dr. Mihir Kushwah" },
  { dateKey: "2026-07-09", day: "Thursday", slot: "16:05 - 17:20", courseId: "B2B", subject: "B2B Marketing", room: "LR 07", instructor: "Dr. Mihir Kushwah" },
  { dateKey: "2026-07-11", day: "Saturday", slot: "14:30 - 15:45", courseId: "B2B", subject: "B2B Marketing", room: "LR 07", instructor: "Dr. Mihir Kushwah" }
];

// App Global State
let state = {
  user: null,
  timetable: [],
  attendanceLogs: {}, // Key: dateString_courseId => status
  settings: {
    threshold: 75,
    notifications: true
  },
  currentDate: new Date(), // Set default date to today
  viewMode: "week",   // "week" or "month"
  filterMode: "time", // "time", "code", or "name"
  selectedAttendanceCourse: null // Code string of currently highlighted course in detailed logs
};

// Dynamic Student Database
let studentDatabase = DEFAULT_STUDENT_DB;

// Supabase Global Client
let supabaseClient = null;

/* ==========================================================================
   INITIALIZATION & SCREEN ROUTING
   ========================================================================== */
document.addEventListener("DOMContentLoaded", async () => {
  await loadStudentDatabase();
  initApp();
  setupEventListeners();
  checkClassReminders();
  setInterval(checkClassReminders, 60000); // Check notifications every 60s
});

async function loadStudentDatabase() {
  try {
    const res = await fetch("student_db.json");
    if (res.ok) {
      const data = await res.json();
      studentDatabase = data;
      storage.setItem("iimr_student_db", JSON.stringify(studentDatabase));
      console.log("Loaded student database from live JSON file.");
    }
  } catch (e) {
    console.warn("Could not fetch student_db.json, using local storage cache:", e);
    const cachedDb = storage.getItem("iimr_student_db");
    if (cachedDb) {
      try {
        studentDatabase = JSON.parse(cachedDb);
      } catch (err) {
        studentDatabase = DEFAULT_STUDENT_DB;
      }
    }
  }
}

function renderDemoAccounts() {
  const container = document.getElementById("demo-accounts-container");
  if (!container) return;
  
  container.innerHTML = "";
  
  const emails = Object.keys(studentDatabase);
  if (emails.length === 0) return;
  
  let chosen = [];
  const test1 = "ipm04niketp@iimrohtak.ac.in";
  const test2 = "ipm04palaky@iimrohtak.ac.in";
  
  if (studentDatabase[test1]) chosen.push(test1);
  if (studentDatabase[test2]) chosen.push(test2);
  
  for (let email of emails) {
    if (chosen.length >= 2) break;
    if (!chosen.includes(email)) chosen.push(email);
  }
  
  chosen.forEach(email => {
    const student = studentDatabase[email];
    const initials = student.name.split(' ').map(n=>n[0]).join('').substring(0, 2).toUpperCase();
    
    const btn = document.createElement("button");
    btn.className = "btn btn-secondary demo-login-btn";
    btn.setAttribute("data-email", email);
    
    btn.innerHTML = `
      <span class="demo-avatar">${initials}</span>
      <div class="demo-info">
        <span class="demo-name">${student.name}</span>
        <span class="demo-mail">${email}</span>
      </div>
    `;
    
    container.appendChild(btn);
  });
  
  // Re-bind demo click handlers
  container.querySelectorAll(".demo-login-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const email = e.currentTarget.getAttribute("data-email");
      login(email);
    });
  });
}

function initTheme() {
  const savedTheme = localStorage.getItem("iimr_theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  
  const themeToggle = document.getElementById("theme-mode-toggle");
  if (themeToggle) {
    themeToggle.checked = (savedTheme === "light");
  }
}

function initApp() {
  initTheme();
  // Populate demo login button list
  renderDemoAccounts();

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('Service worker registered successfully:', reg.scope))
        .catch(err => console.error('Service worker registration failed:', err));
    });
  }

  // Check active session in LocalStorage
  const cachedUser = storage.getItem("iimr_active_user");
  if (cachedUser) {
    try {
      state.user = JSON.parse(cachedUser);
      loadUserData();
      showScreen("dashboard-screen");
    } catch (e) {
      storage.removeItem("iimr_active_user");
      showScreen("login-screen");
    }
  } else {
    showScreen("login-screen");
  }
}

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(el => el.classList.remove("active"));
  document.getElementById(screenId).classList.add("active");
}

function showTab(tabId) {
  document.querySelectorAll(".nav-tab").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
  
  const link = document.querySelector(`[data-tab="${tabId}"]`);
  if (link) link.classList.add("active");
  
  const content = document.getElementById(tabId);
  if (content) content.classList.add("active");
}

/* ==========================================================================
   AUTHENTICATION LOGIC
   ========================================================================== */
function login(email) {
  const cleanEmail = email.trim().toLowerCase();
  
  // Request notification permission under user gesture
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
  
  if (cleanEmail === "ipm04niketp@iimrohtak.ac.in") {
    const pwd = prompt("Enter password for Niket Parikh's account:");
    if (pwd !== "1212") {
      alert("Incorrect password. Access denied.");
      return;
    }
  }
  
  // Authorize student email
  const student = studentDatabase[cleanEmail];
  
  if (!student) {
    showToast("Email address not found. Use a demo account mapping for testing.", "error");
    return;
  }
  
  state.user = {
    email: cleanEmail,
    name: student.name,
    courses: student.courses
  };
  
  storage.setItem("iimr_active_user", JSON.stringify(state.user));
  showToast(`Welcome, ${student.name}!`, "success");
  
  loadUserData();
  showScreen("dashboard-screen");
  showTab("tab-analytics"); // Open dashboard tab by default
}

function logout() {
  storage.removeItem("iimr_active_user");
  state.user = null;
  state.attendanceLogs = {};
  state.timetable = [];
  supabaseClient = null;
  
  showScreen("login-screen");
  showToast("Logged out successfully.", "info");
}

/* ==========================================================================
   DATA LOADING & DATABASE OVERRIDES
   ========================================================================== */
function initSupabase() {
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      console.log("Supabase Client initialized successfully.");
    } catch (e) {
      console.error("Supabase init error:", e);
      supabaseClient = null;
    }
  } else {
    supabaseClient = null;
  }
}

async function loadUserData() {
  const email = state.user.email;
  
  // Load settings
  const cachedSettings = storage.getItem(`iimr_settings_${email}`);
  if (cachedSettings) {
    state.settings = JSON.parse(cachedSettings);
    if (!state.settings.timetableSheetsUrl) {
      state.settings.timetableSheetsUrl = TIMETABLE_SHEETS_URL;
    }
  } else {
    state.settings = {
      threshold: 75,
      notifications: true,
      timetableSheetsUrl: TIMETABLE_SHEETS_URL
    };
  }

  // Initialize database client
  initSupabase();

  // Load Timetable (attempt live sync from hardcoded sheet, otherwise use cached/default)
  // Version key: bump this whenever DEFAULT_TIMETABLE or expansion logic changes
  const TIMETABLE_CACHE_VERSION = "v4";
  const cachedVersion = storage.getItem(`iimr_timetable_version_${email}`);
  const cachedTimetable = storage.getItem(`iimr_timetable_${email}`);
  if (cachedTimetable && cachedVersion === TIMETABLE_CACHE_VERSION) {
    state.timetable = JSON.parse(cachedTimetable);
  } else {
    console.log("Timetable cache outdated or missing. Resetting to DEFAULT_TIMETABLE.");
    state.timetable = DEFAULT_TIMETABLE;
    storage.setItem(`iimr_timetable_version_${email}`, TIMETABLE_CACHE_VERSION);
    saveTimetable();
  }
  
  // Auto-sync Google Sheet timetable silently in the background
  autoSyncTimetable();

  // Load Attendance Logs
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('attendance_logs')
        .select('date_key, course_id, status')
        .eq('email', email);
        
      if (error) throw error;
      
      const logs = {};
      if (data) {
        data.forEach(row => {
          logs[`${row.date_key}_${row.course_id}`] = row.status;
        });
      }
      
      // Auto-upload local offline logs that are missing in Supabase
      const localCached = storage.getItem(`iimr_attendance_logs_${email}`);
      if (localCached) {
        try {
          const localLogs = JSON.parse(localCached);
          const toUpload = [];
          for (const key in localLogs) {
            const status = localLogs[key];
            if (status && status !== "norecord" && logs[key] !== status) {
              const parts = key.split('_');
              if (parts.length >= 2) {
                const dateKey = parts[0];
                const courseId = parts.slice(1).join('_');
                toUpload.push({
                  email: email,
                  date_key: dateKey,
                  course_id: courseId,
                  status: status
                });
              }
            }
          }
          if (toUpload.length > 0) {
            console.log(`Auto-syncing ${toUpload.length} offline logs to Supabase...`);
            const { error: uploadErr } = await supabaseClient
              .from('attendance_logs')
              .upsert(toUpload, { onConflict: 'email,date_key,course_id' });
            if (!uploadErr) {
              toUpload.forEach(item => {
                logs[`${item.date_key}_${item.course_id}`] = item.status;
              });
              console.log("Offline logs synced to database successfully!");
            } else {
              console.error("Auto-sync of offline logs failed:", uploadErr);
            }
          }
        } catch (e) {
          console.error("Local logs auto-sync error:", e);
        }
      }
      
      state.attendanceLogs = logs;
      saveLogsLocal(); // Cache locally for offline availability
    } catch (e) {
      console.error("Supabase fetch failed. Falling back to local storage.", e);
      loadLogsLocal();
    }
  } else {
    // Load local logs with migration check
    const cachedLogs = storage.getItem(`iimr_attendance_logs_${email}`);
    if (cachedLogs) {
      const parsedLogs = JSON.parse(cachedLogs);
      const hasOldKeys = Object.keys(parsedLogs).some(k => k.includes("MIS-101") || k.includes("QT-101") || k.includes("ECO-101"));
      if (hasOldKeys) {
        console.log("Old cached logs detected. Resetting to match new courses.");
        state.attendanceLogs = generateMockAttendanceLogs();
        saveLogsLocal();
      } else {
        state.attendanceLogs = parsedLogs;
      }
    } else {
      state.attendanceLogs = generateMockAttendanceLogs();
      saveLogsLocal();
    }
  }

  // Set default selected detailed course in Attendance logs tab
  if (state.user.courses && state.user.courses.length > 0) {
    if (!state.selectedAttendanceCourse || !state.user.courses.includes(state.selectedAttendanceCourse)) {
      state.selectedAttendanceCourse = state.user.courses[0];
    }
  }

  // Populate UI profile inputs
  const initials = state.user.name.split(' ').map(n=>n[0]).join('').substring(0, 2).toUpperCase();
  document.getElementById("user-display-name").textContent = state.user.name.toUpperCase();
  document.getElementById("user-avatar").textContent = initials;
  document.getElementById("settings-avatar").textContent = initials;
  document.getElementById("threshold-input").value = state.settings.threshold;
  const targetPctLabel = document.getElementById("target-percentage-label");
  if (targetPctLabel) {
    targetPctLabel.textContent = `${state.settings.threshold}%`;
  }
  document.getElementById("active-courses-count-label").textContent = `${state.user.courses.length} active`;

  const timetableUrlInput = document.getElementById("settings-timetable-url");
  if (timetableUrlInput) {
    timetableUrlInput.value = state.settings.timetableSheetsUrl || TIMETABLE_SHEETS_URL;
  }

  // Only show the Timetable Sync card to Admin users
  const syncCard = document.getElementById("settings-sync-card");
  if (syncCard) {
    const isAdmin = state.user.email === "ipm04niketp@iimrohtak.ac.in" || state.user.email.startsWith("admin");
    if (isAdmin) {
      syncCard.style.display = "block";
    } else {
      syncCard.style.display = "none";
    }
  }

  // Populate Theme settings toggle state
  const themeToggle = document.getElementById("theme-mode-toggle");
  if (themeToggle) {
    const savedTheme = localStorage.getItem("iimr_theme") || "dark";
    themeToggle.checked = (savedTheme === "light");
  }

  // Render Subscriptions tags in settings tab
  const tagsContainer = document.getElementById("settings-subscriptions-tags");
  if (tagsContainer) {
    tagsContainer.innerHTML = "";
    state.user.courses.forEach(cId => {
      const parentId = cId.split(' ')[0];
      const fullName = COURSE_NAMES[cId] || cId;
      const tag = document.createElement("div");
      tag.className = "course-sub-badge";
      tag.innerHTML = `
        <span class="material-symbols-outlined">school</span>
        <span>${cId}: ${fullName}</span>
      `;
      tagsContainer.appendChild(tag);
    });
  }

  // Sync preference toggle states
  const emailToggle = document.getElementById("email-reminder-toggle");
  if (emailToggle) {
    emailToggle.checked = state.settings.emailReminders !== false;
  }
  const pushToggle = document.getElementById("push-notification-toggle");
  if (pushToggle) {
    pushToggle.checked = state.settings.notifications !== false;
  }

  renderDashboard();
  renderAttendanceTab();
}

function loadLogsLocal() {
  const cachedLogs = storage.getItem(`iimr_attendance_logs_${state.user.email}`);
  if (cachedLogs) {
    try {
      const parsedLogs = JSON.parse(cachedLogs);
      const hasOldKeys = Object.keys(parsedLogs).some(k => k.includes("MIS-101") || k.includes("QT-101") || k.includes("ECO-101"));
      if (hasOldKeys) {
        state.attendanceLogs = generateMockAttendanceLogs();
        saveLogsLocal();
      } else {
        state.attendanceLogs = parsedLogs;
      }
    } catch (e) {
      state.attendanceLogs = generateMockAttendanceLogs();
      saveLogsLocal();
    }
  } else {
    state.attendanceLogs = generateMockAttendanceLogs();
    saveLogsLocal();
  }
}

function saveLogsLocal() {
  storage.setItem(`iimr_attendance_logs_${state.user.email}`, JSON.stringify(state.attendanceLogs));
}

function saveSettings() {
  storage.setItem(`iimr_settings_${state.user.email}`, JSON.stringify(state.settings));
}

function saveTimetable() {
  storage.setItem(`iimr_timetable_${state.user.email}`, JSON.stringify(state.timetable));
}

/* ==========================================================================
   ATTENDANCE & DATE GENERATORS
   ========================================================================== */
function generateMockAttendanceLogs() {
  // Return empty logs to leave past data logging fully to the student
  return {};
}



function getActualToday() {
  return new Date();
}

function formatDateKey(date) {
  const d = new Date(date);
  let month = '' + (d.getMonth() + 1);
  let day = '' + d.getDate();
  const year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
}

function getDayString(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

function getMonday(d) {
  d = new Date(d);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}

function getCourseCategoryClass(courseId) {
  if (!courseId) return "cat-default";
  const id = courseId.toUpperCase();
  if (id.startsWith("BA")) return "cat-ba";
  if (id.startsWith("AIDMD")) return "cat-aidmd";
  if (id.startsWith("GBS")) return "cat-gbs";
  if (id.startsWith("B2B")) return "cat-b2b";
  if (id.startsWith("CW")) return "cat-cw";
  if (id.startsWith("CV")) return "cat-cv";
  if (id.startsWith("IBS")) return "cat-cv"; // map IBS to green CV style
  return "cat-default";
}

/* ==========================================================================
   COMPUTATIONAL GRAPH / CALCULATION
   ========================================================================== */
function calculateCourseStats(courseId) {
  const today = getActualToday();
  const todayStr = formatDateKey(today);

  // Find all scheduled lectures of this course in the term
  const courseSessions = state.timetable.filter(s => s.courseId === courseId);
  courseSessions.sort((a,b) => a.dateKey.localeCompare(b.dateKey));

  // Conducted sessions are lectures where date <= today
  // Conducted sessions are lectures where date < today, or today and slot has ended
  const conductedSessions = courseSessions.filter(s => {
    if (s.dateKey < todayStr) return true;
    if (s.dateKey > todayStr) return false;
    
    // For today's classes, compare slot end time
    const parts = s.slot.split('-');
    if (parts.length < 2) return true;
    const endTimeStr = parts[1].trim();
    let [endH, endM] = endTimeStr.split(':').map(Number);
    if (endH < 8) endH += 12;
    
    const now = getActualToday();
    const currentH = now.getHours();
    const currentM = now.getMinutes();
    
    if (currentH > endH) return true;
    if (currentH === endH && currentM >= endM) return true;
    return false;
  });
  const totalConducted = conductedSessions.length;
  
  let attended = 0;
  let absent = 0;
  let cancelled = 0;
  let norecord = 0;

  conductedSessions.forEach(s => {
    const logKey = `${s.dateKey}_${courseId}`;
    const status = state.attendanceLogs[logKey];
    if (status === "present") {
      attended++;
    } else if (status === "absent") {
      absent++;
    } else if (status === "cancelled") {
      cancelled++;
    } else {
      norecord++;
    }
  });

  // Percentage calculation ignores cancelled sessions
  const activeConducted = totalConducted - cancelled;
  const percentage = activeConducted > 0 ? Math.round((attended / activeConducted) * 100) : 100;
  
  const threshold = state.settings.threshold / 100;
  
  let skipClasses = 0;
  let attendClasses = 0;
  
  if (activeConducted === 0) {
    return { 
      attended, conducted: totalConducted, absent, cancelled, norecord, percentage, 
      skipClasses: 0, attendClasses: 0, status: 'safe', totalSyllabus: courseSessions.length 
    };
  }

  if (percentage >= state.settings.threshold) {
    skipClasses = Math.floor((attended / threshold) - activeConducted);
    if (skipClasses < 0) skipClasses = 0;
    return { 
      attended, conducted: totalConducted, absent, cancelled, norecord, percentage, 
      skipClasses, attendClasses: 0, status: 'safe', totalSyllabus: courseSessions.length 
    };
  } else {
    attendClasses = Math.ceil((threshold * activeConducted - attended) / (1 - threshold));
    if (attendClasses < 0) attendClasses = 0;
    return { 
      attended, conducted: totalConducted, absent, cancelled, norecord, percentage, 
      skipClasses: 0, attendClasses, status: 'danger', totalSyllabus: courseSessions.length 
    };
  }
}

/* ==========================================================================
   UI RENDERING / DASHBOARD TAB LAYOUT
   ========================================================================== */
function renderDashboard() {
  const today = new Date();
  const todayStr = formatDateKey(today);

  // 1. Render Greeting celebration banner depending on lectures
  const todayClasses = state.timetable.filter(s => {
    const isEnrolled = isStudentEnrolled(state.user.courses, s.courseId);
    if (!isEnrolled) return false;
    return s.dateKey === todayStr;
  });

  const pendingToday = todayClasses.filter(c => {
    const status = state.attendanceLogs[`${todayStr}_${c.courseId}`];
    if (status) return false; // Already logged

    // Check if the class end time has already passed
    const parts = c.slot.split('-');
    if (parts.length < 2) return false;
    const endTimeStr = parts[1].trim();
    let [endH, endM] = endTimeStr.split(':').map(Number);
    if (endH < 8) endH += 12; // Convert afternoon/evening to 24h

    const now = new Date();
    const currentH = now.getHours();
    const currentM = now.getMinutes();

    if (currentH > endH) return false;
    if (currentH === endH && currentM >= endM) return false;

    return true; // Future unlogged class
  });

  const banner = document.getElementById("dashboard-status-banner");
  if (pendingToday.length === 0) {
    banner.innerHTML = `
      <span class="material-symbols-outlined banner-icon">celebration</span>
      <div class="banner-text">
        <h3>All classes done for today!</h3>
        <p>Enjoy the rest of your day.</p>
      </div>
    `;
  } else {
    banner.innerHTML = `
      <span class="material-symbols-outlined banner-icon">notifications_active</span>
      <div class="banner-text">
        <h3>You have pending classes today</h3>
        <p>Log attendance for your ${pendingToday.length} remaining lectures.</p>
      </div>
    `;
  }

  // 2. Render Today's Schedule Card
  const scheduleContainer = document.getElementById("dashboard-today-schedule-list");
  scheduleContainer.innerHTML = "";

  if (todayClasses.length === 0) {
    scheduleContainer.innerHTML = `<div class="free-card">No classes scheduled today</div>`;
  } else {
    todayClasses.sort((a,b) => a.slot.localeCompare(b.slot));
    todayClasses.forEach(lecture => {
      const parentCourseId = lecture.courseId.split(' ')[0]; // E.g. CW Sec-B -> CW
      const crWeight = COURSE_CREDITS[lecture.courseId] || 1.0;
      
      // Calculate session index of today's lecture
      const courseSessions = state.timetable.filter(s => s.courseId === lecture.courseId);
      courseSessions.sort((a,b) => a.dateKey.localeCompare(b.dateKey));
      const todayIdx = courseSessions.findIndex(s => s.dateKey === todayStr) + 1;
      const totalCount = COURSE_TOTAL_SESSIONS[lecture.courseId] || courseSessions.length;

      const item = document.createElement("div");
      const categoryClass = getCourseCategoryClass(lecture.courseId);
      item.className = `dash-sched-item ${categoryClass}`;

      item.innerHTML = `
        <div class="dash-sched-time">${lecture.slot}</div>
        <div class="dash-sched-info">
          <span class="dash-sched-subj">${lecture.subject}</span>
          <span class="dash-sched-meta">${lecture.room} · ${lecture.instructor || 'Professor'}</span>
        </div>
        <div class="dash-sched-right">
          <span class="dash-sched-cr">${crWeight.toFixed(0)}cr</span>
          <span class="dash-sched-ratio">${todayIdx}/${totalCount}</span>
        </div>
      `;

      // Click to open status edit popup modal
      item.addEventListener("click", () => {
        openEditStatusModal(lecture.courseId, todayStr);
      });

      scheduleContainer.appendChild(item);
    });
  }

  // 3. Render Right Sidebar "My Attendance" progress rings list
  const sidebarContainer = document.getElementById("dashboard-attendance-summary-list");
  sidebarContainer.innerHTML = "";

  state.user.courses.forEach(courseId => {
    const parentId = courseId.split(' ')[0]; // E.g. CW Sec-B -> CW
    const name = COURSE_NAMES[courseId] || courseId;
    const stats = calculateCourseStats(courseId);
    const credits = COURSE_CREDITS[courseId] || 1.0;

    const row = document.createElement("div");
    row.className = "attendance-summary-row";

    // Progress circle offsets
    const radius = 14;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (stats.percentage / 100) * circumference;

    let strokeColor = "var(--state-present)";
    if (stats.percentage < state.settings.threshold) {
      strokeColor = "var(--state-absent)";
    }

    // Format credit description
    const creditStr = credits > 0 ? `${credits.toFixed(0)} credit` : "Non-credit";

    row.innerHTML = `
      <div class="attendance-summary-info">
        <span class="attendance-summary-name">${parentId}</span>
        <span class="attendance-summary-sub">${stats.conducted} sessions conducted · ${creditStr} · ${stats.attended}P / ${stats.absent}A / ${stats.norecord}NR</span>
      </div>
      
      <div class="attendance-summary-ring">
        <svg class="svg-ring" style="width: 36px; height: 36px;">
          <circle class="circle-bg" cx="18" cy="18" r="${radius}" style="stroke-width: 3px;"></circle>
          <circle class="circle-val" cx="18" cy="18" r="${radius}" 
                  style="stroke: ${strokeColor}; stroke-width: 3px; stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset};"></circle>
        </svg>
        <span class="ring-mini-text" style="color: ${strokeColor}; font-size: 0.55rem;">${stats.percentage}%</span>
      </div>
    `;

    row.style.cursor = "pointer";
    row.addEventListener("click", () => {
      state.selectedAttendanceCourse = courseId;
      renderAttendanceTab();
      showTab("tab-today");
    });

    sidebarContainer.appendChild(row);
  });

  // Render Schedule Grid (Weekly columns / Monthly calendar)
  renderTimetableCanvas();
}

/* ==========================================================================
   UI RENDERING / ATTENDANCE TAB LAYOUT
   ========================================================================== */
function renderAttendanceTab() {
  const pillsContainer = document.getElementById("attendance-course-pills");
  if (!pillsContainer) return;
  pillsContainer.innerHTML = "";

  // 1. Render scrolling course pills row
  state.user.courses.forEach(courseId => {
    const parentId = courseId.split(' ')[0]; // CW Sec-B -> CW
    const stats = calculateCourseStats(courseId);
    
    const pill = document.createElement("div");
    pill.className = `course-pill-card ${state.selectedAttendanceCourse === courseId ? 'active' : ''}`;
    
    let colorStyle = "color: var(--state-present);";
    if (stats.percentage < state.settings.threshold) colorStyle = "color: var(--state-absent);";

    pill.innerHTML = `
      <span class="course-pill-code">${parentId}</span>
      <span class="course-pill-conducted">${stats.conducted} sessions conducted</span>
      <span class="course-pill-percentage" style="${colorStyle}">${stats.percentage}% · ${stats.attended}P / ${stats.absent}A / ${stats.norecord}NR</span>
    `;

    pill.addEventListener("click", () => {
      state.selectedAttendanceCourse = courseId;
      renderAttendanceTab();
    });

    pillsContainer.appendChild(pill);
  });

  // 2. Render course detail summary card
  const detailCard = document.getElementById("attendance-course-detail-card");
  if (!detailCard) return;

  const currentCourse = state.selectedAttendanceCourse || state.user.courses[0];
  const todayStr = formatDateKey(getActualToday());
  
  let name, stats, parentId, section, instructor, sessions, upcomingCount, totalSyllabus;

  name = COURSE_NAMES[currentCourse] || currentCourse;
  stats = calculateCourseStats(currentCourse);
  parentId = currentCourse.split(' ')[0];
  section = currentCourse.includes('Sec-') ? currentCourse.split(' ')[1] : 'Section A';
  
  sessions = state.timetable.filter(s => isStudentEnrolled([currentCourse], s.courseId));
  instructor = sessions.length > 0 ? (sessions[0].instructor || "Professor") : "Professor";
  upcomingCount = sessions.filter(s => s.dateKey > todayStr).length;
  totalSyllabus = COURSE_TOTAL_SESSIONS[currentCourse] || sessions.length;
  sessions.sort((a,b) => a.dateKey.localeCompare(b.dateKey));

  const logPastBtnHTML = `
    <div style="margin-top: 14px; display: flex; justify-content: flex-end;">
      <button id="btn-log-past-session" class="btn btn-secondary btn-small" style="gap: 6px; padding: 6px 12px; border-radius: 6px;">
        <span class="material-symbols-outlined" style="font-size: 16px;">add_circle</span>
        <span>Log Past Session</span>
      </button>
    </div>
  `;

  detailCard.innerHTML = `
    <div class="detail-header-row">
      <h3 class="detail-course-title">${name}</h3>
      <div class="detail-status-badge ${stats.status === 'safe' ? 'safe' : 'danger'}">
        <span class="material-symbols-outlined">${stats.status === 'safe' ? 'check_circle' : 'warning'}</span>
        <span>${stats.percentage}% attendance</span>
      </div>
    </div>
    <p class="detail-course-sub">${parentId} · ${section} · ${instructor}</p>
    
    <div class="detail-badge-pills-row">
      <div class="detail-badge-pill pill-present">
        <span class="material-symbols-outlined">check_circle</span>
        <span>${stats.attended} Present</span>
      </div>
      <div class="detail-badge-pill pill-absent">
        <span class="material-symbols-outlined">cancel</span>
        <span>${stats.absent} Absent</span>
      </div>
      <div class="detail-badge-pill pill-norecord">
        <span class="material-symbols-outlined">help</span>
        <span>${stats.norecord} No record</span>
      </div>
      <div class="detail-badge-pill pill-upcoming">
        <span class="material-symbols-outlined">schedule</span>
        <span>${upcomingCount} Upcoming</span>
      </div>
      
      <div class="detail-total-scheduled-right">
        <span>of ${totalSyllabus} total scheduled</span>
      </div>
    </div>
    
    <div class="detail-progress-container">
      <div class="detail-progress-labels">
        <span class="detail-progress-ratio">${stats.attended}P / ${stats.absent}A / ${stats.norecord}NR · ${stats.conducted} conducted</span>
        <span class="detail-progress-pct">${stats.percentage}%</span>
      </div>
      <div class="detail-progress-bar-bg">
        <div class="detail-progress-bar-fill" style="width: ${stats.percentage}%; background: ${stats.percentage < state.settings.threshold ? 'var(--state-absent)' : 'var(--state-present)'}"></div>
      </div>
    </div>
    ${logPastBtnHTML}
  `;

  // 3. Populate detailed timetable table with static header
  const theadRow = document.querySelector(".attendance-table thead tr");
  theadRow.innerHTML = `
    <th>Mark / Status</th>
    <th>Date</th>
    <th>LR</th>
    <th>#</th>
    <th>Time</th>
    <th>Professor</th>
    <th>Notif Sent</th>
  `;

  const tbody = document.getElementById("attendance-timetable-body");
  tbody.innerHTML = "";

  sessions.forEach((session, idx) => {
    const tr = document.createElement("tr");
    
    // Status cell
    const targetCourseId = session.courseId;
    const statusKey = `${session.dateKey}_${targetCourseId}`;
    const logStatus = state.attendanceLogs[statusKey];
    
    let statusHTML = "";
    const isFuture = session.dateKey > todayStr;
    const isToday = session.dateKey === todayStr;

    if (isFuture) {
      statusHTML = `
        <div class="status-cell-wrapper">
          <span class="material-symbols-outlined" style="color: var(--text-muted); font-size: 18px;">schedule</span>
          <span class="status-text-label status-upcoming">Upcoming</span>
          <button class="btn-edit-status" disabled style="opacity: 0.3;">
            <span class="material-symbols-outlined">edit</span>
          </button>
        </div>
      `;
    } else if (isToday) {
      const activeLabel = logStatus ? (logStatus === 'present' ? 'Present' : (logStatus === 'absent' ? 'Absent' : 'Cancelled')) : 'Today';
      const labelClass = logStatus ? `status-${logStatus}` : 'status-today';
      const icon = logStatus ? (logStatus === 'present' ? 'check_circle' : (logStatus === 'absent' ? 'cancel' : 'block')) : 'calendar_today';
      const color = logStatus ? (logStatus === 'present' ? 'var(--state-present)' : (logStatus === 'absent' ? 'var(--state-absent)' : 'var(--state-cancelled)')) : 'var(--accent-blue)';

      statusHTML = `
        <div class="status-cell-wrapper">
          <span class="material-symbols-outlined" style="color: ${color}; font-size: 18px;">${icon}</span>
          <span class="status-text-label ${labelClass}">${activeLabel}</span>
          <button class="btn-edit-status" data-course="${targetCourseId}" data-date="${session.dateKey}">
            <span class="material-symbols-outlined">edit</span>
          </button>
        </div>
      `;
    } else {
      // Historical
      const activeLabel = logStatus ? (logStatus === 'present' ? 'Present' : (logStatus === 'absent' ? 'Absent' : 'Cancelled')) : 'No record';
      const labelClass = logStatus ? `status-${logStatus}` : 'status-norecord';
      const icon = logStatus ? (logStatus === 'present' ? 'check_circle' : (logStatus === 'absent' ? 'cancel' : 'block')) : 'help';
      const color = logStatus ? (logStatus === 'present' ? 'var(--state-present)' : (logStatus === 'absent' ? 'var(--state-absent)' : 'var(--state-cancelled)')) : 'var(--text-muted)';

      statusHTML = `
        <div class="status-cell-wrapper">
          <span class="material-symbols-outlined" style="color: ${color}; font-size: 18px;">${icon}</span>
          <span class="status-text-label ${labelClass}">${activeLabel}</span>
          <button class="btn-edit-status" data-course="${targetCourseId}" data-date="${session.dateKey}">
            <span class="material-symbols-outlined">edit</span>
          </button>
        </div>
      `;
    }

    // Format Date: e.g. "28 Jun Sun"
    const sDate = new Date(session.dateKey);
    const dayNameStr = sDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short', weekday: 'short' });
    const dateFormatted = dayNameStr.replace(',', '');

    // Format Notif Sent timestamp
    let notifTime = "-";
    if (!isFuture) {
      const timeMatch = session.slot.match(/^(\d{2}):(\d{2})/);
      if (timeMatch) {
        const hr = parseInt(timeMatch[1]);
        const min = parseInt(timeMatch[2]);
        const start = new Date(sDate);
        start.setHours(hr, min, 0);
        
        const sent = new Date(start.getTime() - 21 * 60000);
        let sHr = sent.getHours();
        const ampm = sHr >= 12 ? 'pm' : 'am';
        sHr = sHr % 12;
        sHr = sHr ? sHr : 12;
        const sMin = String(sent.getMinutes()).padStart(2, '0');
        notifTime = `${String(sHr).padStart(2, '0')}:${sMin} ${ampm}`;
      }
    }

    tr.innerHTML = `
      <td>${statusHTML}</td>
      <td style="font-weight: 500;">${dateFormatted}</td>
      <td>${session.room}</td>
      <td style="font-weight: bold;">${idx + 1}</td>
      <td>${session.slot}</td>
      <td>${session.instructor || 'Professor'}</td>
      <td>${notifTime}</td>
    `;

    if (!isFuture) {
      tr.style.cursor = "pointer";
      tr.addEventListener("click", (e) => {
        if (e.target.closest(".btn-edit-status")) return;
        openEditStatusModal(targetCourseId, session.dateKey);
      });
    }

    tbody.appendChild(tr);
  });

  // Re-bind table row edit button handlers
  tbody.querySelectorAll(".btn-edit-status").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const course = e.currentTarget.getAttribute("data-course");
      const date = e.currentTarget.getAttribute("data-date");
      openEditStatusModal(course, date);
    });
  });

  // Bind log past session button
  const logPastBtn = document.getElementById("btn-log-past-session");
  if (logPastBtn) {
    logPastBtn.addEventListener("click", () => {
      openEditStatusModal(currentCourse, todayStr);
      // Restrict date input to today or past
      const dateInput = document.getElementById("manual-date");
      if (dateInput) {
        dateInput.max = todayStr;
      }
    });
  }
}

function openEditStatusModal(courseId, dateKey) {
  populateModalCourses();
  document.getElementById("manual-course").value = courseId;
  document.getElementById("manual-date").value = dateKey;
  
  const currentStatus = state.attendanceLogs[`${dateKey}_${courseId}`] || "norecord";
  document.getElementById("manual-status").value = currentStatus === "norecord" ? "present" : currentStatus;
  
  document.getElementById("modal-log-entry").classList.add("active");
}

function renderTimetableCanvas() {
  if (state.viewMode === "week") {
    document.getElementById("week-timetable-view").classList.add("active");
    document.getElementById("month-timetable-view").classList.remove("active");
    renderWeekTimetable();
  } else {
    document.getElementById("week-timetable-view").classList.remove("active");
    document.getElementById("month-timetable-view").classList.add("active");
    renderMonthTimetable();
  }
}

function renderWeekTimetable() {
  const monday = getMonday(state.currentDate);
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDays.push(d);
  }

  // Update calendar labels in date navigator
  const startStr = monday.toLocaleDateString('en-GB'); // DD/MM/YYYY
  document.getElementById("calendar-date-label").textContent = startStr;

  const columns = document.querySelectorAll(".week-column");

  let totalLecturesThisWeek = 0;
  const uniqueCoursesThisWeek = new Set();

  columns.forEach((col, idx) => {
    const colDate = weekDays[idx];
    const dateKey = formatDateKey(colDate);
    const dayName = getDayString(colDate);
    
    // Set date labels in header
    const dateNumSpan = col.querySelector(`.col-date`);
    dateNumSpan.textContent = String(colDate.getDate()).padStart(2, '0');
    
    // Highlight current date
    const todayStr = formatDateKey(new Date());
    if (dateKey === todayStr) {
      col.classList.add("current-day-col");
    } else {
      col.classList.remove("current-day-col");
    }

    const body = col.querySelector(".column-body");
    body.innerHTML = "";

    // Fetch classes for this day and student
    let dayClasses = state.timetable.filter(lecture => {
      const isEnrolled = isStudentEnrolled(state.user.courses, lecture.courseId);
      if (!isEnrolled) return false;
      return lecture.dateKey === dateKey;
    });

    totalLecturesThisWeek += dayClasses.length;
    dayClasses.forEach(c => uniqueCoursesThisWeek.add(c.courseId.split(' ')[0])); // normalize e.g. BA Sec-A -> BA

    // Sort lectures
    dayClasses.sort((a, b) => {
      if (state.filterMode === "time") {
        return a.slot.localeCompare(b.slot);
      } else if (state.filterMode === "code") {
        return a.courseId.localeCompare(b.courseId);
      } else {
        return a.subject.localeCompare(b.subject);
      }
    });

    if (dayClasses.length === 0) {
      const free = document.createElement("div");
      free.className = "free-card";
      free.textContent = "Free";
      body.appendChild(free);
    } else {
      dayClasses.forEach(lecture => {
        const card = document.createElement("div");
        const categoryClass = getCourseCategoryClass(lecture.courseId);
        card.className = `lecture-card ${categoryClass}`;

        card.innerHTML = `
          <div class="lecture-time">${lecture.slot}</div>
          <div class="lecture-title">${lecture.subject}</div>
          <div class="lecture-meta-row">
            <div class="lecture-meta-item">
              <span class="material-symbols-outlined" style="font-size: 11px;">badge</span>
              <span>${lecture.courseId}</span>
            </div>
            <div class="lecture-meta-item">
              <span class="material-symbols-outlined" style="font-size: 11px;">meeting_room</span>
              <span>Room: ${lecture.room}</span>
            </div>
            ${
              lecture.instructor 
              ? `<div class="lecture-meta-item" style="color: var(--text-muted); margin-top: 4px; font-weight: 500;">
                   <span>${lecture.instructor}</span>
                 </div>` 
              : ''
            }
          </div>
        `;
        body.appendChild(card);
      });
    }
  });

  // Calculate week stats and credits
  let weekCredits = 0;
  uniqueCoursesThisWeek.forEach(cId => {
    weekCredits += COURSE_CREDITS[cId] || 1.0;
  });

  document.getElementById("stat-courses-count").textContent = state.user.courses.length;
  document.getElementById("stat-lectures-count").textContent = totalLecturesThisWeek;
  document.getElementById("stat-credits-count").textContent = weekCredits.toFixed(1);
}

function renderMonthTimetable() {
  const grid = document.getElementById("month-grid-cells");
  grid.innerHTML = "";
  
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();
  
  // Update Date Label in Navigator (e.g. "June 2026")
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  document.getElementById("calendar-date-label").textContent = `${monthNames[month]} ${year}`;

  // First day of month
  const firstDay = new Date(year, month, 1);
  // Day of week (0 = Sun, 1 = Mon, ..., 6 = Sat)
  let startDay = firstDay.getDay();
  // Adjust to Mon-Sun (1 = Mon, ..., 6 = Sat, 0 -> 7 = Sun)
  startDay = startDay === 0 ? 7 : startDay;
  
  // Number of days in month
  const totalDays = new Date(year, month + 1, 0).getDate();
  // Number of days in previous month
  const prevTotalDays = new Date(year, month, 0).getDate();
  
  const cells = [];
  
  // Previous month inactive days
  for (let i = startDay - 2; i >= 0; i--) {
    cells.push({
      date: new Date(year, month - 1, prevTotalDays - i),
      active: false
    });
  }
  
  // Current month days
  for (let i = 1; i <= totalDays; i++) {
    cells.push({
      date: new Date(year, month, i),
      active: true
    });
  }
  
  // Next month inactive days to fill grid (up to multiple of 7, max 42)
  const totalCells = cells.length > 35 ? 42 : 35;
  const remaining = totalCells - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push({
      date: new Date(year, month + 1, i),
      active: false
    });
  }
  
  let totalLecturesThisWeek = 0;
  const uniqueCoursesThisWeek = new Set();
  
  // Render cells
  cells.forEach(c => {
    const cellDiv = document.createElement("div");
    cellDiv.className = `month-cell ${c.active ? '' : 'inactive-month-cell'}`;
    
    const dateNum = document.createElement("span");
    dateNum.className = "month-date-number";
    dateNum.textContent = c.date.getDate();
    cellDiv.appendChild(dateNum);
    
    // Fetch classes for this cell date
    const cellDateKey = formatDateKey(c.date);
    const cellDayName = getDayString(c.date);
    
    const dayClasses = state.timetable.filter(lecture => {
      const matchesCourse = isStudentEnrolled(state.user.courses, lecture.courseId);
      if (!matchesCourse) return false;
      return lecture.dateKey === cellDateKey;
    });
    
    // Calculate stats if cell falls in current week
    const monday = getMonday(state.currentDate);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    if (c.date >= monday && c.date <= sunday) {
      totalLecturesThisWeek += dayClasses.length;
      dayClasses.forEach(cl => uniqueCoursesThisWeek.add(cl.courseId.split(' ')[0]));
    }
    
    if (dayClasses.length > 0) {
      const capsulesContainer = document.createElement("div");
      capsulesContainer.className = "month-capsules-list";
      
      // Render up to 2 capsules, and +X more for the rest
      const maxVisible = 2;
      dayClasses.slice(0, maxVisible).forEach(lecture => {
        const cap = document.createElement("div");
        const catClass = getCourseCategoryClass(lecture.courseId);
        cap.className = `month-capsule ${catClass}`;
        cap.textContent = lecture.courseId.split(' ')[0]; // E.g. BA Sec-A -> BA
        capsulesContainer.appendChild(cap);
      });
      
      if (dayClasses.length > maxVisible) {
        const more = document.createElement("div");
        more.className = "more-capsule-badge";
        more.textContent = `+${dayClasses.length - maxVisible} more`;
        capsulesContainer.appendChild(more);
      }
      
      cellDiv.appendChild(capsulesContainer);
    }
    
    grid.appendChild(cellDiv);
  });

  let weekCredits = 0;
  uniqueCoursesThisWeek.forEach(cId => {
    weekCredits += COURSE_CREDITS[cId] || 1.0;
  });

  document.getElementById("stat-courses-count").textContent = state.user.courses.length;
  document.getElementById("stat-lectures-count").textContent = totalLecturesThisWeek;
  document.getElementById("stat-credits-count").textContent = weekCredits.toFixed(1);
}

function renderCourseAnalytics() {
  // Unused ring overview container (re-routed to sidebar, kept as stub just in case)
  const container = document.getElementById("courses-grid");
  if (container) container.innerHTML = "";
}

/* ==========================================================================
   DATABASE WRITE BACKEND SYNC
   ========================================================================== */
async function saveLogs(key, status, courseId, dateKey) {
  if (status === null || status === "norecord") {
    delete state.attendanceLogs[key];
  } else {
    state.attendanceLogs[key] = status;
  }
  saveLogsLocal();

  if (supabaseClient) {
    try {
      if (status === null || status === "norecord") {
        const { error } = await supabaseClient
          .from('attendance_logs')
          .delete()
          .eq('email', state.user.email)
          .eq('date_key', dateKey)
          .eq('course_id', courseId);
        
        if (error) throw error;
      } else {
        const { error } = await supabaseClient
          .from('attendance_logs')
          .upsert({
            email: state.user.email,
            date_key: dateKey,
            course_id: courseId,
            status: status
          }, { onConflict: 'email,date_key,course_id' });
          
        if (error) throw error;
      }
    } catch (e) {
      console.error("Supabase write sync failed:", e);
      showToast("Offline mode: Log saved locally.", "error");
    }
  }
}

/* ==========================================================================
   EVENT LISTENERS & BINDINGS
   ========================================================================== */
function setupEventListeners() {
  // Login Form Submission
  document.getElementById("login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("student-email").value;
    login(email);
  });

  // Demo Login Buttons
  document.querySelectorAll(".demo-login-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const email = e.currentTarget.getAttribute("data-email");
      login(email);
    });
  });

  // Logout Button
  document.getElementById("btn-logout").addEventListener("click", logout);

  // Tab Switch Routing
  document.querySelectorAll(".nav-tab").forEach(tab => {
    tab.addEventListener("click", (e) => {
      const tabId = e.currentTarget.getAttribute("data-tab");
      showTab(tabId);
      if (tabId === "tab-today") {
        renderAttendanceTab();
      } else {
        renderDashboard();
      }
    });
  });

  // Dashboard link buttons route clickers
  document.getElementById("link-view-timetable").addEventListener("click", () => {
    showTab("tab-schedule");
    renderTimetableCanvas();
  });
  document.getElementById("link-view-attendance").addEventListener("click", () => {
    showTab("tab-today");
    renderAttendanceTab();
  });

  // Week / Month View Toggles
  document.getElementById("btn-view-week").addEventListener("click", () => {
    state.viewMode = "week";
    document.getElementById("btn-view-week").classList.add("active");
    document.getElementById("btn-view-month").classList.remove("active");
    renderDashboard();
  });
  document.getElementById("btn-view-month").addEventListener("click", () => {
    state.viewMode = "month";
    document.getElementById("btn-view-month").classList.add("active");
    document.getElementById("btn-view-week").classList.remove("active");
    renderDashboard();
  });

  // Filter Toggles (Time / Code / Name)
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      state.filterMode = e.currentTarget.getAttribute("data-filter");
      renderDashboard();
    });
  });

  // Date Navigator Toggles
  document.getElementById("btn-date-prev").addEventListener("click", () => {
    const daysToShift = state.viewMode === "week" ? 7 : 30;
    state.currentDate.setDate(state.currentDate.getDate() - daysToShift);
    document.getElementById("calendar-date-input").value = formatDateKey(state.currentDate);
    renderDashboard();
    if (document.getElementById("tab-today").classList.contains("active")) {
      renderAttendanceTab();
    }
  });
  document.getElementById("btn-date-next").addEventListener("click", () => {
    const daysToShift = state.viewMode === "week" ? 7 : 30;
    state.currentDate.setDate(state.currentDate.getDate() + daysToShift);
    document.getElementById("calendar-date-input").value = formatDateKey(state.currentDate);
    renderDashboard();
    if (document.getElementById("tab-today").classList.contains("active")) {
      renderAttendanceTab();
    }
  });

  // Datepicker Picker Input
  document.getElementById("calendar-date-input").addEventListener("change", (e) => {
    const val = e.target.value;
    if (val) {
      state.currentDate = new Date(val);
      renderDashboard();
      if (document.getElementById("tab-today").classList.contains("active")) {
        renderAttendanceTab();
      }
    }
  });

  // Export dropdown toggles
  document.getElementById("btn-export").addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("export-dropdown-menu").classList.toggle("active");
  });
  document.addEventListener("click", () => {
    document.getElementById("export-dropdown-menu").classList.remove("active");
  });
  document.querySelectorAll(".dropdown-item").forEach(item => {
    item.addEventListener("click", (e) => {
      const format = e.currentTarget.getAttribute("data-format");
      showToast(`Exporting schedule as ${format.toUpperCase()}...`, "success");
    });
  });

  // Manual Log Entry Modal close
  document.getElementById("btn-close-modal").addEventListener("click", () => {
    document.getElementById("modal-log-entry").classList.remove("remove"); // safe clear
    document.getElementById("modal-log-entry").classList.remove("active");
  });
  
  // Manual Log Form Submission (Status Edit)
  document.getElementById("manual-log-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const courseId = document.getElementById("manual-course").value;
    const dateVal = document.getElementById("manual-date").value;
    const status = document.getElementById("manual-status").value;

    // Automatically add past session to timetable if it does not exist
    const exists = state.timetable.some(s => s.courseId === courseId && s.dateKey === dateVal);
    if (!exists && dateVal <= formatDateKey(state.currentDate)) {
      const newSession = {
        dateKey: dateVal,
        day: getDayString(new Date(dateVal)),
        slot: "10:20 - 11:35", // default slot
        courseId: courseId,
        subject: COURSE_NAMES[courseId] || courseId,
        room: "LHC",
        instructor: "Professor"
      };
      state.timetable.push(newSession);
      saveTimetable();
    }

    const logKey = `${dateVal}_${courseId}`;
    await saveLogs(logKey, status, courseId, dateVal);
    
    // Refresh screens
    renderDashboard();
    if (document.getElementById("tab-today").classList.contains("active")) {
      renderAttendanceTab();
    }
    
    document.getElementById("modal-log-entry").classList.remove("active");
    showToast("Status updated successfully.", "success");
  });

  // Preferences Change: Threshold
  document.getElementById("threshold-input").addEventListener("change", (e) => {
    const val = parseInt(e.target.value);
    if (val >= 50 && val <= 100) {
      state.settings.threshold = val;
      const targetPctLabelVal = document.getElementById("target-percentage-label");
      if (targetPctLabelVal) {
        targetPctLabelVal.textContent = `${val}%`;
      }
      saveSettings();
      renderDashboard();
      if (document.getElementById("tab-today").classList.contains("active")) {
        renderAttendanceTab();
      }
    }
  });

  // Preferences Change: Notifications Toggle (hidden legacy support)
  if (document.getElementById("notification-toggle")) {
    document.getElementById("notification-toggle").addEventListener("change", (e) => {
      state.settings.notifications = e.target.checked;
      saveSettings();
    });
  }

  // Preferences Change: Email Reminders Switch
  document.getElementById("email-reminder-toggle").addEventListener("change", (e) => {
    state.settings.emailReminders = e.target.checked;
    saveSettings();
    showToast("Email preferences updated.", "success");
  });

  // Preferences Change: Push Notifications Switch
  document.getElementById("push-notification-toggle").addEventListener("change", (e) => {
    state.settings.notifications = e.target.checked;
    saveSettings();
    showToast("Push notification preferences updated.", "success");
    if (state.settings.notifications && "Notification" in window) {
      Notification.requestPermission();
    }
  });

  // Save Timetable URL
  const saveUrlBtn = document.getElementById("btn-save-timetable-url");
  if (saveUrlBtn) {
    saveUrlBtn.addEventListener("click", async () => {
      const urlInput = document.getElementById("settings-timetable-url");
      if (urlInput) {
        let val = urlInput.value.trim();
        if (!val) {
          val = TIMETABLE_SHEETS_URL;
          urlInput.value = val;
        }
        state.settings.timetableSheetsUrl = val;
        saveSettings();
        showToast("Timetable URL saved. Syncing...", "success");
        await autoSyncTimetable();
      }
    });
  }

  // Profile photo upload mock
  document.getElementById("btn-upload-photo").addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        showToast("Profile photo uploaded successfully.", "success");
      }
    };
    input.click();
  });

  // Subscriptions management triggers
  document.getElementById("btn-manage-subscriptions").addEventListener("click", () => {
    const grid = document.getElementById("subs-checkboxes-grid");
    if (grid) {
      grid.innerHTML = "";
      const termCourses = ["BA Sec-A", "BA Sec-B", "CV Sec-A", "CV Sec-B", "AIDMD", "B2B", "CW Sec-B", "GBS Sec-B", "IBS", "PFM"];
      termCourses.forEach(cId => {
        const item = document.createElement("label");
        item.className = "subs-checkbox-item";
        item.innerHTML = `
          <input type="checkbox" name="subscribed-course" value="${cId}" ${state.user.courses.includes(cId) ? 'checked' : ''}>
          <span>${cId}: ${COURSE_NAMES[cId] || cId}</span>
        `;
        grid.appendChild(item);
      });
    }
    document.getElementById("modal-manage-subscriptions").classList.add("active");
  });

  document.getElementById("btn-close-subs-modal").addEventListener("click", () => {
    document.getElementById("modal-manage-subscriptions").classList.remove("active");
  });

  document.getElementById("subs-management-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const checked = [];
    document.querySelectorAll('input[name="subscribed-course"]:checked').forEach(cb => {
      checked.push(cb.value);
    });

    if (checked.length === 0) {
      showToast("Please subscribe to at least one course.", "error");
      return;
    }

    // Update state & local storage
    state.user.courses = checked;
    storage.setItem("iimr_active_user", JSON.stringify(state.user));
    
    // Save in studentDatabase mock cache
    if (studentDatabase[state.user.email]) {
      studentDatabase[state.user.email].courses = checked;
      storage.setItem("iimr_student_db", JSON.stringify(studentDatabase));
    }

    document.getElementById("modal-manage-subscriptions").classList.remove("active");
    showToast("Subscriptions updated successfully.", "success");
    loadUserData();
  });

  // Clear App Cache Button
  document.getElementById("btn-clear-cache").addEventListener("click", () => {
    if (confirm("Are you sure you want to clear all log files and reset the planner? This cannot be undone.")) {
      const email = state.user.email;
      storage.removeItem(`iimr_attendance_logs_${email}`);
      storage.removeItem(`iimr_timetable_${email}`);
      storage.removeItem(`iimr_settings_${email}`);
      loadUserData();
      showToast("App data reset successfully.", "info");
    }
  });

  // Theme Toggle listener
  const themeToggle = document.getElementById("theme-mode-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("change", (e) => {
      const newTheme = e.target.checked ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", newTheme);
      localStorage.setItem("iimr_theme", newTheme);
      showToast(`Switched to ${newTheme} theme.`, "success");
    });
  }
}

function populateModalCourses() {
  const select = document.getElementById("manual-course");
  select.innerHTML = "";
  state.user.courses.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = `${c} - ${COURSE_NAMES[c] || c}`;
    select.appendChild(opt);
  });
}

/* ==========================================================================
   GOOGLE SHEETS PARSER
   ========================================================================== */
function getCsvUrl(inputUrl) {
  const sheetIdMatch = inputUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (sheetIdMatch && sheetIdMatch[1]) {
    let url = `https://docs.google.com/spreadsheets/d/${sheetIdMatch[1]}/export?format=csv`;
    const gidMatch = inputUrl.match(/gid=([0-9]+)/);
    if (gidMatch && gidMatch[1]) {
      url += `&gid=${gidMatch[1]}`;
    }
    return url;
  }
  return inputUrl;
}

function mergeTimetable(liveTimetable) {
  const merged = [...liveTimetable];
  const todayStr = formatDateKey(state.currentDate);
  
  // Keep custom logged past sessions that were manually added
  state.timetable.forEach(existingSession => {
    if (existingSession.dateKey && existingSession.dateKey < todayStr) {
      const exists = merged.some(s => normalizeCourseId(s.courseId) === normalizeCourseId(existingSession.courseId) && s.dateKey === existingSession.dateKey);
      if (!exists) {
        merged.push(existingSession);
      }
    }
  });

  // Keep past sessions from DEFAULT_TIMETABLE
  DEFAULT_TIMETABLE.forEach(defSession => {
    if (defSession.dateKey && defSession.dateKey < todayStr) {
      const exists = merged.some(s => normalizeCourseId(s.courseId) === normalizeCourseId(defSession.courseId) && s.dateKey === defSession.dateKey);
      if (!exists) {
        merged.push(defSession);
      }
    }
  });

  return merged;
}

async function autoSyncTimetable() {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('timetable')
        .select('*');
      if (error) throw error;
      if (data && data.length > 0) {
        const parsed = data.map(s => ({
          dateKey: s.date_key,
          day: s.day,
          slot: s.slot,
          courseId: s.course_id,
          subject: s.subject,
          room: s.room,
          instructor: s.instructor,
          section: s.section
        }));
        state.timetable = parsed;
        saveTimetable();
        renderDashboard();
        if (document.getElementById("tab-today").classList.contains("active")) {
          renderAttendanceTab();
        }
        console.log("Timetable synced successfully from Supabase database.");
        return; // Done
      }
    } catch (e) {
      console.warn("Failed to sync timetable from Supabase, trying fallback URL:", e);
    }
  }

  const syncUrl = state.settings.timetableSheetsUrl || TIMETABLE_SHEETS_URL;
  if (!syncUrl) return;
  const isJsonApi = syncUrl.includes("/macros/s/") || syncUrl.includes("/exec");
  const fetchUrl = isJsonApi ? syncUrl : getCsvUrl(syncUrl);
  try {
    const res = await fetch(fetchUrl);
    if (!res.ok) throw new Error("Timetable sync returned non-200");
    
    let parsedTimetable = [];
    if (isJsonApi) {
      const data = await res.json();
      if (data && data.sessions) {
        parsedTimetable = data.sessions;
        console.log(`Parsed ${parsedTimetable.length} sessions from live JSON API.`);
      } else {
        throw new Error("Invalid JSON structure from Apps Script");
      }
    } else {
      const csvText = await res.text();
      parsedTimetable = parseCsv(csvText);
    }
    
    if (parsedTimetable && parsedTimetable.length > 0) {
      state.timetable = mergeTimetable(parsedTimetable);

      saveTimetable();
      renderDashboard();
      if (document.getElementById("tab-today").classList.contains("active")) {
        renderAttendanceTab();
      }
      console.log("Timetable auto-synced successfully.");
    }
  } catch (e) {
    console.warn("Timetable auto-sync failed. Loaded cached copy:", e);
  }
}

function parseCsv(csvText) {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) return [];
  
  const headers = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
  
  const dayIdx = headers.findIndex(h => h.includes('day'));
  const dateIdx = headers.findIndex(h => h.includes('date'));
  const slotIdx = headers.findIndex(h => h.includes('slot') || h.includes('time'));
  const courseIdx = headers.findIndex(h => h.includes('course') || h.includes('code') || h.includes('id'));
  const subjectIdx = headers.findIndex(h => h.includes('subject') || h.includes('title') || h.includes('name'));
  const roomIdx = headers.findIndex(h => h.includes('room') || h.includes('class'));
  const instructorIdx = headers.findIndex(h => h.includes('instructor') || h.includes('prof') || h.includes('teacher'));
  
  if (dayIdx === -1 || slotIdx === -1 || courseIdx === -1) {
    throw new Error("Missing headers");
  }
  
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const row = parseCsvLine(lines[i]);
    if (row.length <= Math.max(dayIdx, slotIdx, courseIdx)) continue;
    
    let dateKeyVal = null;
    if (dateIdx !== -1 && row[dateIdx]) {
      const parsedDate = parseDateString(row[dateIdx]);
      if (parsedDate) {
        dateKeyVal = formatDateKey(parsedDate);
      }
    }
    
    results.push({
      dateKey: dateKeyVal,
      day: row[dayIdx],
      slot: row[slotIdx],
      courseId: row[courseIdx].trim().toUpperCase(),
      subject: row[subjectIdx] || row[courseIdx],
      room: row[roomIdx] || "LHC",
      instructor: instructorIdx !== -1 ? row[instructorIdx] : null
    });
  }
  return results;
}

function parseDateString(str) {
  if (!str) return null;
  str = str.trim();
  // try DD/MM/YYYY
  let match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const year = parseInt(match[3]);
    return new Date(year, month, day);
  }
  // try YYYY-MM-DD
  match = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (match) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const day = parseInt(match[3]);
    return new Date(year, month, day);
  }
  return null;
}

function parseCsvLine(text) {
  let p = '', r = [];
  let q = false;
  for (let i = 0; i < text.length; i++) {
    let c = text[i];
    if (c === '"') { q = !q; }
    else if (c === ',' && !q) { r.push(p.trim().replace(/^["']|["']$/g, '')); p = ''; }
    else { p += c; }
  }
  r.push(p.trim().replace(/^["']|["']$/g, ''));
  return r;
}

/* ==========================================================================
   CLASS REMINDERS / WEB NOTIFICATION
   ========================================================================== */
function checkClassReminders() {
  if (!state.user || !state.settings.notifications) return;

  const today = new Date();
  const dateKey = formatDateKey(today);
  
  const todayClasses = state.timetable.filter(s => {
    const isEnrolled = isStudentEnrolled(state.user.courses, s.courseId);
    if (!isEnrolled) return false;
    return s.dateKey === dateKey;
  });
  
  // Track already sent notifications in sessionStorage to avoid duplicates
  let sent = {};
  try {
    sent = JSON.parse(sessionStorage.getItem("iimr_sent_reminders") || "{}");
  } catch (e) {}

  todayClasses.forEach(lecture => {
    const timeMatch = lecture.slot.match(/^(\d{2}):(\d{2})/);
    if (!timeMatch) return;
    
    const startHour = parseInt(timeMatch[1]);
    const startMin = parseInt(timeMatch[2]);
    
    const classTime = new Date(today);
    classTime.setHours(startHour, startMin, 0, 0);
    
    const diffMs = classTime.getTime() - today.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    const targets = [30, 20, 10];
    targets.forEach(mins => {
      if (diffMins === mins) {
        const uniqueKey = `${lecture.courseId}_${dateKey}_${mins}`;
        if (!sent[uniqueKey]) {
          sent[uniqueKey] = true;
          sessionStorage.setItem("iimr_sent_reminders", JSON.stringify(sent));
          
          triggerNotification(`Upcoming Lecture in ${mins} mins: ${lecture.subject} in Room ${lecture.room}`);
        }
      }
    });
  });
}

function triggerNotification(text) {
  if (!("Notification" in window)) return;
  
  if (Notification.permission === "granted") {
    new Notification("IIMR Academic Planner", {
      body: text
    });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        new Notification("IIMR Academic Planner", {
          body: text
        });
      }
    });
  }
}

/* ==========================================================================
   TOAST HELPER
   ========================================================================== */
function showToast(message, type = "info") {
  return; // Disabled popups as per user request
  const container = document.getElementById("toast-container");
  
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let icon = "info";
  if (type === "success") icon = "check_circle";
  else if (type === "error") icon = "warning";
  
  toast.innerHTML = `
    <span class="material-symbols-outlined">${icon}</span>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = "toastSlideIn 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28) reverse";
    toast.addEventListener("animationend", () => {
      toast.remove();
    });
  }, 4000);
}
