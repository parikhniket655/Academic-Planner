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
  if (isStorageWorking && storedVer < 3.2) {
    const activeUser = window.localStorage.getItem("iimr_active_user");
    const studentDb = window.localStorage.getItem("iimr_student_db");
    
    window.localStorage.clear();
    
    if (activeUser) window.localStorage.setItem("iimr_active_user", activeUser);
    if (studentDb) window.localStorage.setItem("iimr_student_db", studentDb);
    window.localStorage.setItem("iimr_app_version", "3.2");
    
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
  "GBS Sec-A": 1.0,
  "GBS Sec-B": 1.0,
  "GBS Sec-C": 1.0,
  "GBS Sec-D": 1.0,
  "B2B": 1.0,
  "CW": 0.0,
  "CW Sec-A": 0.0,
  "CW Sec-B": 0.0,
  "CW Sec-C": 0.0,
  "CW Sec-D": 0.0,
  "CV": 1.0,
  "CV Sec-A": 1.0,
  "CV Sec-B": 1.0,
  "IBS": 1.0,
  "PFM": 0.5,
  "DBM": 1.0,
  "FM": 0.75,
  "FSA": 1.0,
  "GFMG": 0.5,
  "IMDM": 1.0
};

// Course Total Scheduled Sessions count in syllabus
const COURSE_TOTAL_SESSIONS = {
  "BA": 20,
  "BA Sec-A": 20,
  "BA Sec-B": 20,
  "AIDMD": 20,
  "GBS": 20,
  "GBS Sec-A": 20,
  "GBS Sec-B": 20,
  "GBS Sec-C": 20,
  "GBS Sec-D": 20,
  "B2B": 20,
  "CW": 7,
  "CW Sec-A": 7,
  "CW Sec-B": 7,
  "CW Sec-C": 7,
  "CW Sec-D": 7,
  "CV": 20,
  "CV Sec-A": 20,
  "CV Sec-B": 20,
  "IBS": 20,
  "PFM": 10,
  "DBM": 20,
  "FM": 14,
  "FSA": 20,
  "GFMG": 10,
  "IMDM": 20
};

function getCourseCredits(courseId) {
  if (!courseId) return 1.0;
  if (COURSE_CREDITS[courseId] !== undefined) {
    return COURSE_CREDITS[courseId];
  }
  const base = courseId.split(' ')[0];
  if (COURSE_CREDITS[base] !== undefined) {
    return COURSE_CREDITS[base];
  }
  return 1.0;
}

function getCourseTotalSessions(courseId, fallbackVal) {
  if (!courseId) return fallbackVal || 20;
  if (COURSE_TOTAL_SESSIONS[courseId] !== undefined) {
    return COURSE_TOTAL_SESSIONS[courseId];
  }
  const base = courseId.split(' ')[0];
  if (COURSE_TOTAL_SESSIONS[base] !== undefined) {
    return COURSE_TOTAL_SESSIONS[base];
  }
  return fallbackVal || 20;
}

function getInstructorName(instructorStr) {
  if (!instructorStr) return 'Professor';
  if (instructorStr.includes('|')) {
    return instructorStr.split('|')[0];
  }
  return instructorStr;
}

function getSessionNum(session, fallbackIdx) {
  if (session && session.instructor && session.instructor.includes('|')) {
    const parts = session.instructor.split('|');
    const num = parseInt(parts[1]);
    if (!isNaN(num)) return num;
  }
  return fallbackIdx;
}

function normalizeCourseId(id) {
  if (!id) return "";
  return id.replace(/[\s\-]/g, '').toUpperCase();
}

function normalizeSlot(slot) {
  if (!slot) return "";
  return slot.replace(/[\s\u00A0\-]/g, '');
}

function deduplicateTimetable(list) {
  if (!list || !Array.isArray(list)) return [];
  const seen = new Set();
  return list.filter(item => {
    const key = `${item.dateKey}_${normalizeCourseId(item.courseId)}_${normalizeSlot(item.slot)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
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
      "BA Sec-A",
      "DBM",
      "PCM",
      "PS",
      "SCM Sec-A",
      "TA",
      "GBS Sec-B",
      "CW Sec-B"
    ]
  },
  "pgp16hidayrajsinhc@iimrohtak.ac.in": {
    name: "Hidayrajsinh Chauhan",
    courses: [
      "BA Sec-A",
      "CV Sec-A",
      "FM",
      "FSA",
      "GFMG",
      "MFIS",
      "PWMP",
      "GBS Sec-D",
      "CW Sec-D"
    ]
  },

  "ipm04adityabs@iimrohtak.ac.in": {
    name: "Aditya Brijgopal Sarda",
    courses: [
      "BA Sec-A",
      "CV Sec-A",
      "FM",
      "FSA",
      "GFMG",
      "MFIS",
      "PWMP",
      "GBS Sec-A",
      "CW Sec-A"
    ]
  },
  "ipm04prithivit@iimrohtak.ac.in": {
    name: "Prithivi Tejeshwar",
    courses: [
      "BA Sec-B",
      "CV Sec-B",
      "FSA",
      "IBS",
      "MFIS",
      "GBS Sec-C",
      "CW Sec-C"
    ]
  },
  "pgp16tanishthav@iimrohtak.ac.in": {
    name: "Tanishtha Verma",
    courses: [
      "AIDMD",
      "B2B",
      "BA Sec-B",
      "DBM",
      "PCM",
      "PFM",
      "GBS Sec-D",
      "CW Sec-D"
    ]
  },
  "pgp16akshita@iimrohtak.ac.in": {
    name: "Akshita",
    courses: [
      "B2B",
      "BA Sec-A",
      "Ind4.0",
      "PCM",
      "SCM Sec-A",
      "SHRM",
      "GBS Sec-A",
      "CW Sec-A"
    ]
  },
  "ipm04mridulu@iimrohtak.ac.in": {
    name: "Mridul Upadhyay",
    courses: [
      "B2B",
      "BA Sec-A",
      "CV Sec-A",
      "IBS",
      "SCM Sec-A",
      "GBS Sec-A",
      "CW Sec-A"
    ]
  },
  "pgp16divyanshid@iimrohtak.ac.in": {
    name: "Divyanshi Dongre",
    courses: [
      "CB Sec-A",
      "DBM",
      "MBPET",
      "PCM",
      "PS",
      "SHRM",
      "GBS Sec-B",
      "CW Sec-B"
    ]
  }
};

// Default Timetable Mapping (Spans late June to late July 2026 to match stats & dates in screenshots)
const EXAMS_TIMETABLE = [
  // 24th August, 2026 (Monday)
  { dateKey: "2026-08-24", day: "Monday", slot: "10:20 - 12:20", courseId: "MBPET", subject: "EXAM: Managing Business Processes with Emerging Technologies (MBPET)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-08-24", day: "Monday", slot: "14:30 - 16:30", courseId: "CV", subject: "EXAM: Corporate Valuation (CV)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-08-24", day: "Monday", slot: "14:30 - 16:30", courseId: "PM", subject: "EXAM: Project Management (PM)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-08-24", day: "Monday", slot: "14:30 - 16:30", courseId: "PCM", subject: "EXAM: Performance and Compensation Management (PCM)", room: "Exam Hall", instructor: "EXAM" },

  // 25th August, 2026 (Tuesday)
  { dateKey: "2026-08-25", day: "Tuesday", slot: "10:20 - 12:20", courseId: "AIDMD", subject: "EXAM: AI-Driven Marketing Decision Making (AIDMD)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-08-25", day: "Tuesday", slot: "14:30 - 16:30", courseId: "SCM", subject: "EXAM: Supply Chain Management (SCM)", room: "Exam Hall", instructor: "EXAM" },

  // 27th August, 2026 (Thursday)
  { dateKey: "2026-08-27", day: "Thursday", slot: "10:20 - 12:20", courseId: "FADT", subject: "EXAM: Fundamentals and Applications of Design Thinking (FADT)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-08-27", day: "Thursday", slot: "10:20 - 12:20", courseId: "IBS", subject: "EXAM: International Business Strategies (IBS)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-08-27", day: "Thursday", slot: "14:30 - 16:30", courseId: "BA", subject: "EXAM: Business Analytics (BA)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-08-27", day: "Thursday", slot: "14:30 - 16:30", courseId: "BGRI", subject: "EXAM: Business–Government Relations in India (BGRI)", room: "Exam Hall", instructor: "EXAM" },

  // 28th August, 2026 (Friday)
  { dateKey: "2026-08-28", day: "Friday", slot: "10:20 - 12:20", courseId: "FM", subject: "EXAM: Financial Modelling (FM)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-08-28", day: "Friday", slot: "14:30 - 16:30", courseId: "GBS", subject: "EXAM: Global Business Simulation (GBS)", room: "Exam Hall", instructor: "EXAM" },

  // 29th August, 2026 (Saturday)
  { dateKey: "2026-08-29", day: "Saturday", slot: "10:20 - 12:20", courseId: "TA", subject: "EXAM: Talent Acquisition (TA)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-08-29", day: "Saturday", slot: "14:30 - 16:30", courseId: "PS", subject: "EXAM: Pricing Strategies (PS)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-08-29", day: "Saturday", slot: "14:30 - 16:30", courseId: "FSA", subject: "EXAM: Financial Statement Analysis (FSA)", room: "Exam Hall", instructor: "EXAM" },

  // 31st August, 2026 (Monday)
  { dateKey: "2026-08-31", day: "Monday", slot: "10:20 - 12:20", courseId: "MS", subject: "EXAM: Managing Sustainability (MS)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-08-31", day: "Monday", slot: "14:30 - 16:30", courseId: "PWMP", subject: "EXAM: Playing to Win Market and Power (PWMP)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-08-31", day: "Monday", slot: "14:30 - 16:30", courseId: "SHRM", subject: "EXAM: Strategic Human Resource Management (SHRM)", room: "Exam Hall", instructor: "EXAM" },

  // 1st September, 2026 (Tuesday)
  { dateKey: "2026-09-01", day: "Tuesday", slot: "10:20 - 12:20", courseId: "IMDM", subject: "EXAM: Insurance and Managerial Decision Making (IMDM)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-09-01", day: "Tuesday", slot: "14:30 - 16:30", courseId: "SDM", subject: "EXAM: Sales and Distribution Management (SDM)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-09-01", day: "Tuesday", slot: "14:30 - 16:30", courseId: "IAPM", subject: "EXAM: Investment Analysis & Portfolio Management (IAPM)", room: "Exam Hall", instructor: "EXAM" },

  // 2nd September, 2026 (Wednesday)
  { dateKey: "2026-09-02", day: "Wednesday", slot: "10:20 - 12:20", courseId: "PFM", subject: "EXAM: Python for Managers (PFM)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-09-02", day: "Wednesday", slot: "14:30 - 16:30", courseId: "B2B", subject: "EXAM: B2B Marketing (B2B)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-09-02", day: "Wednesday", slot: "14:30 - 16:30", courseId: "CB", subject: "EXAM: Consumer Behaviour (CB)", room: "Exam Hall", instructor: "EXAM" },

  // 3rd September, 2026 (Thursday)
  { dateKey: "2026-09-03", day: "Thursday", slot: "10:20 - 12:20", courseId: "SC", subject: "EXAM: Strategic Consulting (SC)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-09-03", day: "Thursday", slot: "14:30 - 16:30", courseId: "L&D", subject: "EXAM: Learning and Development (L&D)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-09-03", day: "Thursday", slot: "14:30 - 16:30", courseId: "MFIS", subject: "EXAM: Management of Financial Institutions and Services (MFIS)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-09-03", day: "Thursday", slot: "14:30 - 16:30", courseId: "DBM", subject: "EXAM: Digital Business Models (DBM)", room: "Exam Hall", instructor: "EXAM" }
];

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

// Wazir Group Access List
const WAZIR_MEMBERS = [
  "ipm04niketp@iimrohtak.ac.in",
  "pgp16hidayrajsinhc@iimrohtak.ac.in",
  "ipm04adityabs@iimrohtak.ac.in",
  "ipm04prithivit@iimrohtak.ac.in",
  "pgp16tanishthav@iimrohtak.ac.in",
  "pgp16akshita@iimrohtak.ac.in",
  "ipm04mridulu@iimrohtak.ac.in",
  "pgp16divyanshid@iimrohtak.ac.in",
  "ipm04rainaa@iimrohtak.ac.in"
];

const WAZIR_NAMES = {
  "ipm04niketp@iimrohtak.ac.in": "Niket",
  "pgp16hidayrajsinhc@iimrohtak.ac.in": "Hidayrajsinh",
  "ipm04adityabs@iimrohtak.ac.in": "Aditya",
  "ipm04prithivit@iimrohtak.ac.in": "Prithivi",
  "pgp16tanishthav@iimrohtak.ac.in": "Tanishtha",
  "pgp16akshita@iimrohtak.ac.in": "Akshita",
  "ipm04mridulu@iimrohtak.ac.in": "Mridul",
  "pgp16divyanshid@iimrohtak.ac.in": "Divyanshi",
  "ipm04rainaa@iimrohtak.ac.in": "Arjun"
};

const MESS_MENU_URL = "./mess_menu.csv";

// App Global State
let state = {
  user: null,
  timetable: [],
  attendanceLogs: {}, // Key: dateString_courseId => status
  wazirMeetings: {},  // Key: dateString_slot => meeting details
  wazirCompareEmails: [], // Selected emails for schedule comparison
  messMenu: {},       // Key: Day -> Meal Type -> Array of { category, items }
  settings: {
    threshold: 75,
    notifications: true
  },
  currentDate: new Date(), // Set default date to today
  wazirCurrentDate: new Date(), // Date reference for Wazir tab
  viewMode: "week",   // "week" or "month"
  wazirViewMode: "week", // Wazir calendar mode
  messViewMode: "today", // "today" or "week"
  messSelectedDay: "",  // Selected day for Mess Menu (e.g. "Monday"). Will auto-init to current weekday.
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

  if (tabId === "tab-wazir") {
    renderWazirCanvas();
  }
  if (tabId === "tab-mess") {
    if (Object.keys(state.messMenu).length === 0) {
      const cachedRaw = localStorage.getItem("iimr_mess_menu_raw");
      if (cachedRaw) {
        try {
          state.messMenu = parseMessMenuCsv(cachedRaw);
        } catch (e) {}
      }
    }
    renderMessMenu();
    syncMessMenu().then(() => renderMessMenu());
  }
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
  const TIMETABLE_CACHE_VERSION = "v6";
  const cachedVersion = storage.getItem(`iimr_timetable_version_${email}`);
  const cachedTimetable = storage.getItem(`iimr_timetable_${email}`);
  if (cachedTimetable && cachedVersion === TIMETABLE_CACHE_VERSION) {
    state.timetable = deduplicateTimetable([...JSON.parse(cachedTimetable), ...EXAMS_TIMETABLE]);
  } else {
    console.log("Timetable cache outdated or missing. Resetting to DEFAULT_TIMETABLE.");
    state.timetable = deduplicateTimetable([...DEFAULT_TIMETABLE, ...EXAMS_TIMETABLE]);
    storage.setItem(`iimr_timetable_version_${email}`, TIMETABLE_CACHE_VERSION);
    saveTimetable();
  }
  
  // Auto-sync Google Sheet timetable silently in the background
  autoSyncTimetable();

  // Ask for notification permission on first tap if push notifications are enabled
  document.body.addEventListener('click', function askPermissionOnGesture() {
    if (state.settings.notifications && "Notification" in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log("Notification permission response:", permission);
        if (permission === 'granted') {
          showToast("Notification permission granted!", "success");
        }
      });
    }
    document.body.removeEventListener('click', askPermissionOnGesture);
  }, { once: true });

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

  // Handle Wazir tab authorization
  const wazirTabBtn = document.getElementById("nav-tab-wazir");
  if (wazirTabBtn) {
    const isWazirMember = WAZIR_MEMBERS.includes(state.user.email);
    if (isWazirMember) {
      wazirTabBtn.style.display = "flex";
      initWazirMembersSelector();
      loadWazirMeetings().then(() => {
        // Redraw canvas if active
        const link = document.querySelector('[data-tab="tab-wazir"]');
        if (link && link.classList.contains("active")) {
          renderWazirCanvas();
        }
      });
    } else {
      wazirTabBtn.style.display = "none";
    }
  }

  // Preload Mess Menu cache in the background on startup
  syncMessMenu().then(() => {
    const link = document.querySelector('[data-tab="tab-mess"]');
    if (link && link.classList.contains("active")) {
      renderMessMenu();
    }
  });

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

function getCourseCategoryClass(courseId, instructor) {
  if (instructor === "EXAM") return "cat-exam";
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

  // Find all scheduled lectures of this course in the term (excluding exams)
  const courseSessions = state.timetable.filter(s => s.courseId === courseId && s.instructor !== "EXAM");
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
    if (c.instructor === "EXAM") return false;
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
      const crWeight = getCourseCredits(lecture.courseId);
      
      // Calculate session index of today's lecture
      const courseSessions = state.timetable.filter(s => s.courseId === lecture.courseId);
      courseSessions.sort((a,b) => a.dateKey.localeCompare(b.dateKey));
      const todaySessionIdx = courseSessions.findIndex(s => s.dateKey === todayStr);
      const todaySessionObj = courseSessions[todaySessionIdx];
      const todayIdx = todaySessionObj ? getSessionNum(todaySessionObj, todaySessionIdx + 1) : (todaySessionIdx + 1);
      const totalCount = getCourseTotalSessions(lecture.courseId, courseSessions.length);

      const item = document.createElement("div");
      const categoryClass = getCourseCategoryClass(lecture.courseId, lecture.instructor);
      
      if (lecture.instructor === "EXAM") {
        item.className = `dash-sched-item ${categoryClass} exam-card`;
        item.style.cursor = "default";
        item.innerHTML = `
          <div class="dash-sched-time">${lecture.slot}</div>
          <div class="dash-sched-info">
            <span class="dash-sched-subj" style="font-weight: bold; color: #ef4444;">${lecture.subject}</span>
            <span class="dash-sched-meta">${lecture.room}</span>
          </div>
          <div class="dash-sched-right">
            <span class="dash-sched-cr" style="background: #ef4444; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; letter-spacing: 0.5px;">EXAM</span>
          </div>
        `;
      } else {
        item.className = `dash-sched-item ${categoryClass}`;
        item.innerHTML = `
          <div class="dash-sched-time">${lecture.slot}</div>
          <div class="dash-sched-info">
            <span class="dash-sched-subj">${lecture.subject}</span>
            <span class="dash-sched-meta">${lecture.room} · ${getInstructorName(lecture.instructor)}</span>
          </div>
          <div class="dash-sched-right">
            <span class="dash-sched-cr">${crWeight % 1 === 0 ? crWeight.toFixed(0) : crWeight.toString()}cr</span>
            <span class="dash-sched-ratio">${todayIdx}/${totalCount}</span>
          </div>
        `;
        
        item.addEventListener("click", () => {
          openEditStatusModal(lecture.courseId, todayStr);
        });
      }

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
    const credits = getCourseCredits(courseId);

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
    const formattedCredits = credits % 1 === 0 ? credits.toFixed(0) : credits.toString();
    const creditStr = credits > 0 ? `${formattedCredits} credit${credits !== 1 ? 's' : ''}` : "Non-credit";

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

  // 4. Render Upcoming Exams List
  const examsContainer = document.getElementById("dashboard-exams-list");
  if (examsContainer) {
    const todayStrVal = formatDateKey(getActualToday());
    const myExams = EXAMS_TIMETABLE.filter(s => {
      const isEnrolled = isStudentEnrolled(state.user.courses, s.courseId);
      return isEnrolled && s.dateKey >= todayStrVal;
    });
    myExams.sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    if (myExams.length === 0) {
      examsContainer.className = "deadlines-empty";
      examsContainer.innerHTML = `
        <span class="material-symbols-outlined calendar-icon" style="color: #ef4444;">event_upcoming</span>
        <p class="empty-title">No upcoming exams</p>
      `;
    } else {
      examsContainer.className = "dashboard-exams-list-container";
      examsContainer.innerHTML = "";
      myExams.forEach(exam => {
        const item = document.createElement("div");
        item.className = "dashboard-exam-row-item";
        
        // Format date e.g. "24 Aug"
        const dateParts = exam.dateKey.split('-');
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const formattedDate = `${parseInt(dateParts[2])} ${monthNames[parseInt(dateParts[1]) - 1]}`;
        
        item.innerHTML = `
          <div class="exam-date-badge">
            <span class="badge-day">${formattedDate}</span>
          </div>
          <div class="exam-details-info">
            <span class="exam-subject-name">${exam.subject.replace("EXAM: ", "")}</span>
            <span class="exam-meta-text">${exam.slot} · ${exam.room}</span>
          </div>
        `;
        examsContainer.appendChild(item);
      });
    }
  }

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
  
  sessions = state.timetable.filter(s => isStudentEnrolled([currentCourse], s.courseId) && s.instructor !== "EXAM");
  instructor = sessions.length > 0 ? getInstructorName(sessions[0].instructor) : "Professor";
  upcomingCount = sessions.filter(s => s.dateKey > todayStr).length;
  totalSyllabus = getCourseTotalSessions(currentCourse, sessions.length);
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

    const sessionNum = getSessionNum(session, idx + 1);

    tr.innerHTML = `
      <td>${statusHTML}</td>
      <td style="font-weight: 500;">${dateFormatted}</td>
      <td>${session.room}</td>
      <td style="font-weight: bold;">${sessionNum}</td>
      <td>${session.slot}</td>
      <td>${getInstructorName(session.instructor)}</td>
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
        const categoryClass = getCourseCategoryClass(lecture.courseId, lecture.instructor);

        if (lecture.instructor === "EXAM") {
          card.className = `lecture-card ${categoryClass} exam-card`;
          card.innerHTML = `
            <div class="lecture-time">${lecture.slot}</div>
            <div class="lecture-title" style="font-weight: bold; color: #ef4444;">${lecture.subject}</div>
            <div class="lecture-meta-row">
              <div class="lecture-meta-item">
                <span class="material-symbols-outlined" style="font-size: 11px;">badge</span>
                <span>${lecture.courseId}</span>
              </div>
              <div class="lecture-meta-item">
                <span class="material-symbols-outlined" style="font-size: 11px;">meeting_room</span>
                <span>Room: ${lecture.room}</span>
              </div>
            </div>
          `;
        } else {
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
                     <span>${getInstructorName(lecture.instructor)}</span>
                   </div>` 
                : ''
              }
            </div>
          `;
        }
        body.appendChild(card);
      });
    }
  });

  // Calculate week stats and credits
  let weekCredits = 0;
  uniqueCoursesThisWeek.forEach(cId => {
    weekCredits += getCourseCredits(cId);
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
        const catClass = getCourseCategoryClass(lecture.courseId, lecture.instructor);
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
    weekCredits += getCourseCredits(cId);
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

  // Sync selected attendance course to the edited one
  if (courseId) {
    state.selectedAttendanceCourse = courseId;
  }

  // Optimistic UI Update: Render all views immediately so changes reflect instantly on any active tab!
  try {
    renderDashboard();
    renderAttendanceTab();
    renderTimetableCanvas();
  } catch (renderErr) {
    console.error("Optimistic render failed:", renderErr);
  }

  // Perform Supabase write in the background (non-blocking)
  if (supabaseClient) {
    (async () => {
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
    })();
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

  // Logout Buttons
  document.getElementById("btn-logout").addEventListener("click", logout);
  const settingsLogoutBtn = document.getElementById("btn-logout-settings");
  if (settingsLogoutBtn) {
    settingsLogoutBtn.addEventListener("click", logout);
  }

  // Tab Switch Routing
  document.querySelectorAll(".nav-tab").forEach(tab => {
    tab.addEventListener("click", (e) => {
      const tabId = e.currentTarget.getAttribute("data-tab");
      showTab(tabId);
      if (tabId === "tab-analytics") {
        renderDashboard();
      } else if (tabId === "tab-today") {
        renderAttendanceTab();
      } else if (tabId === "tab-schedule") {
        renderTimetableCanvas();
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
    try {
      const courseId = document.getElementById("manual-course").value;
      const dateVal = document.getElementById("manual-date").value;
      const status = document.getElementById("manual-status").value;

      if (!courseId || !dateVal) {
        showToast("Please fill in all fields.", "error");
        return;
      }

      // Automatically add past session to timetable if it does not exist
      const exists = state.timetable.some(s => s.courseId === courseId && s.dateKey === dateVal);
      if (!exists && dateVal <= formatDateKey(state.currentDate)) {
        // Safe Date Parsing
        let parsedDate = new Date(dateVal);
        if (isNaN(parsedDate.getTime())) {
          const parts = dateVal.split(/[-\/]/);
          if (parts.length === 3) {
            if (parts[0].length === 4) {
              parsedDate = new Date(parts[0], parts[1] - 1, parts[2]);
            } else {
              parsedDate = new Date(parts[2], parts[1] - 1, parts[0]);
            }
          }
        }
        
        const dayName = isNaN(parsedDate.getTime()) ? "Monday" : getDayString(parsedDate);

        const newSession = {
          dateKey: dateVal,
          day: dayName,
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
      saveLogs(logKey, status, courseId, dateVal); // Non-blocking optimistic update
      
      document.getElementById("modal-log-entry").classList.remove("active");
      showToast("Status updated successfully.", "success");
    } catch (err) {
      console.error("Manual log submission error:", err);
      showToast("Log submitted.", "success");
      // Force close modal anyway to avoid freezing
      document.getElementById("modal-log-entry").classList.remove("active");
    }
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

  // Initialize Wazir specific listeners
  setupWazirEventListeners();

  // Initialize Mess specific listeners
  setupMessEventListeners();
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
  const merged = deduplicateTimetable([...liveTimetable, ...EXAMS_TIMETABLE]);
  const todayStr = formatDateKey(state.currentDate);
  
  // Keep custom logged past sessions that were manually added
  state.timetable.forEach(existingSession => {
    if (existingSession.dateKey && existingSession.dateKey < todayStr) {
      // Exclude mock sessions that are present in DEFAULT_TIMETABLE
      const isDefault = DEFAULT_TIMETABLE.some(def =>
        def.dateKey === existingSession.dateKey &&
        normalizeCourseId(def.courseId) === normalizeCourseId(existingSession.courseId) &&
        normalizeSlot(def.slot) === normalizeSlot(existingSession.slot)
      );
      if (isDefault) return;

      const exists = merged.some(s => 
        normalizeCourseId(s.courseId) === normalizeCourseId(existingSession.courseId) && 
        s.dateKey === existingSession.dateKey &&
        normalizeSlot(s.slot) === normalizeSlot(existingSession.slot)
      );
      if (!exists) {
        merged.push(existingSession);
      }
    }
  });

  return merged;
}

async function autoSyncTimetable() {
  const syncUrl = state.settings.timetableSheetsUrl || TIMETABLE_SHEETS_URL;
  let synced = false;

  // 1. Try to sync from Google Sheets Web App first (carries user's Google credentials in browser)
  if (syncUrl) {
    const isJsonApi = syncUrl.includes("/macros/s/") || syncUrl.includes("/exec");
    const fetchUrl = isJsonApi ? syncUrl : getCsvUrl(syncUrl);
    try {
      const res = await fetch(fetchUrl);
      if (res.ok) {
        let parsedTimetable = [];
        if (isJsonApi) {
          const data = await res.json();
          if (data && data.sessions) {
            parsedTimetable = data.sessions;
            console.log(`Parsed ${parsedTimetable.length} sessions from live JSON API.`);
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
          console.log("Timetable successfully synced from Google Sheets Web App.");
          synced = true;
        }
      }
    } catch (e) {
      console.warn("Failed to sync timetable from Google Sheets Web App, trying Supabase fallback:", e);
    }
  }

  // 2. Fallback to Supabase database if Google Sheets sync failed or was skipped
  if (!synced && supabaseClient) {
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
        state.timetable = mergeTimetable(parsed);
        saveTimetable();
        renderDashboard();
        if (document.getElementById("tab-today").classList.contains("active")) {
          renderAttendanceTab();
        }
        console.log("Timetable synced from Supabase fallback.");
        synced = true;
      }
    } catch (e) {
      console.warn("Failed to sync timetable from Supabase fallback:", e);
    }
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
      // Use a 2-minute range check to prevent browser timer delays from skipping notifications
      if (diffMins <= mins && diffMins >= mins - 2) {
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
  
  const options = {
    body: text,
    icon: "./app_icon.jpg",
    badge: "./app_icon.jpg",
    vibrate: [200, 100, 200]
  };

  if (Notification.permission === "granted") {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification("IIMR Academic Planner", options);
      }).catch(err => {
        new Notification("IIMR Academic Planner", options);
      });
    } else {
      new Notification("IIMR Academic Planner", options);
    }
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification("IIMR Academic Planner", options);
          });
        } else {
          new Notification("IIMR Academic Planner", options);
        }
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

/* ==========================================================================
   WAZIR HUB SPECIFIC BUSINESS LOGIC
   ========================================================================== */

async function loadWazirMeetings() {
  if (!supabaseClient) return;
  try {
    const { data, error } = await supabaseClient
      .from('wazir_meetings')
      .select('*');
    if (error) throw error;
    
    state.wazirMeetings = {};
    if (data) {
      data.forEach(row => {
        state.wazirMeetings[`${row.date_key}_${row.slot}`] = row;
      });
    }
  } catch (e) {
    console.error("Failed to load Wazir meetings:", e);
  }
}

async function bookWazirMeeting(dateKey, slot, title) {
  // Optimistically set state and render canvas instantly!
  const backup = state.wazirMeetings[`${dateKey}_${slot}`];
  state.wazirMeetings[`${dateKey}_${slot}`] = {
    date_key: dateKey,
    slot: slot,
    booked_by: state.user.email,
    title: title
  };
  renderWazirCanvas();

  if (!supabaseClient) {
    showToast("Database not connected. Local booking simulated.", "warning");
    return true;
  }
  
  // Perform Supabase upsert in background
  (async () => {
    try {
      const { error } = await supabaseClient
        .from('wazir_meetings')
        .upsert({
          date_key: dateKey,
          slot: slot,
          booked_by: state.user.email,
          title: title
        }, { onConflict: 'date_key,slot' });
        
      if (error) throw error;
      
      // Refresh local cache and redraw silently
      await loadWazirMeetings();
      renderWazirCanvas();
      showToast("Meeting booked successfully!", "success");
    } catch (e) {
      console.error("Failed to book meeting:", e);
      // Revert state if write failed
      if (backup) {
        state.wazirMeetings[`${dateKey}_${slot}`] = backup;
      } else {
        delete state.wazirMeetings[`${dateKey}_${slot}`];
      }
      renderWazirCanvas();
      showToast("Booking failed: " + e.message, "danger");
    }
  })();

  return true;
}

async function cancelWazirMeeting(dateKey, slot) {
  // Optimistically delete from state and redraw canvas instantly!
  const backup = state.wazirMeetings[`${dateKey}_${slot}`];
  delete state.wazirMeetings[`${dateKey}_${slot}`];
  renderWazirCanvas();

  if (!supabaseClient) {
    return true;
  }
  
  // Perform Supabase delete in background
  (async () => {
    try {
      const { error } = await supabaseClient
        .from('wazir_meetings')
        .delete()
        .eq('date_key', dateKey)
        .eq('slot', slot);
        
      if (error) throw error;
      
      // Refresh local cache and redraw silently
      await loadWazirMeetings();
      renderWazirCanvas();
      showToast("Meeting cancelled successfully!", "success");
    } catch (e) {
      console.error("Failed to cancel meeting:", e);
      // Revert state if delete failed
      if (backup) {
        state.wazirMeetings[`${dateKey}_${slot}`] = backup;
      }
      renderWazirCanvas();
      showToast("Cancellation failed: " + e.message, "danger");
    }
  })();

  return true;
}

function getWazirDaySchedule(dateKey, dayName) {
  const slots = [
    { slot: "08:45 - 10:00", type: "class" },
    { slot: "10:00 - 13:10", type: "placement", label: "Placement Activity Slot" },
    { slot: "13:10 - 14:30", type: "lunch", label: "Lunch Break" },
    { slot: "14:30 - 15:45", type: "class" },
    { slot: "16:05 - 17:20", type: "class" },
    { slot: "17:40 - 18:55", type: "class" },
    { slot: "19:15 - 20:30", type: "class" },
    { slot: "20:50 - 22:05", type: "class" },
    { slot: "22:25 - 23:40", type: "class" }
  ];

  // Find all scheduled lectures for this day in the database
  const dayLectures = state.timetable.filter(s => s.dateKey === dateKey);

  const result = [];
  
  slots.forEach(item => {
    // 1. Check if a meeting is booked in Supabase for this slot/date
    const booked = state.wazirMeetings && state.wazirMeetings[`${dateKey}_${item.slot}`];
    if (booked) {
      result.push({
        slot: item.slot,
        status: "booked",
        title: booked.title,
        bookedBy: booked.booked_by
      });
      return;
    }

    // 2. If it is a placement or lunch slot, it is always free
    if (item.type === "placement" || item.type === "lunch") {
      if (dayName === "Sunday") return;
      result.push({
        slot: item.slot,
        status: "free",
        title: item.label
      });
      return;
    }

    // 3. For standard class slots, check if any of the 8 members have a class
    let isOccupied = false;
    const slotLectures = dayLectures.filter(l => l.slot === item.slot);
    
    for (const lecture of slotLectures) {
      const compareList = (state.wazirCompareEmails && state.wazirCompareEmails.length > 0) 
        ? state.wazirCompareEmails 
        : [state.user.email];
      for (const email of compareList) {
        const student = studentDatabase[email];
        if (student && isStudentEnrolled(student.courses, lecture.courseId)) {
          isOccupied = true;
          break;
        }
      }
      if (isOccupied) break;
    }

    if (!isOccupied) {
      if (dayName === "Sunday") return;
      result.push({
        slot: item.slot,
        status: "free",
        title: "Free Slot"
      });
    }
  });

  return result;
}

function renderWazirCanvas() {
  if (state.wazirViewMode === "week") {
    document.getElementById("wazir-week-view").classList.add("active");
    document.getElementById("wazir-month-view").classList.remove("active");
    renderWazirWeekView();
  } else {
    document.getElementById("wazir-week-view").classList.remove("active");
    document.getElementById("wazir-month-view").classList.add("active");
    renderWazirMonthView();
  }
}

function renderWazirWeekView() {
  const monday = getMonday(state.wazirCurrentDate);
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDays.push(d);
  }

  const startStr = monday.toLocaleDateString('en-GB'); // DD/MM/YYYY
  document.getElementById("wazir-calendar-date-label").textContent = startStr;

  const columns = document.querySelectorAll("#wazir-week-view .week-column");
  columns.forEach((col, idx) => {
    const colDate = weekDays[idx];
    const dateKey = formatDateKey(colDate);
    const dayName = getDayString(colDate);
    
    const dateNumSpan = col.querySelector(".col-date");
    if (dateNumSpan) {
      dateNumSpan.textContent = String(colDate.getDate()).padStart(2, '0');
    }
    
    const todayStr = formatDateKey(new Date());
    if (dateKey === todayStr) {
      col.classList.add("current-day-col");
    } else {
      col.classList.remove("current-day-col");
    }

    const body = col.querySelector(".column-body");
    body.innerHTML = "";

    const schedule = getWazirDaySchedule(dateKey, dayName);
    if (schedule.length === 0) {
      const free = document.createElement("div");
      free.className = "free-card";
      free.textContent = "No Slots Available";
      body.appendChild(free);
    } else {
      schedule.forEach(item => {
        const card = document.createElement("div");
        if (item.status === "booked") {
          card.className = "lecture-card cat-b2b";
          card.innerHTML = `
            <div class="lecture-time">${item.slot}</div>
            <div class="lecture-title">${item.title}</div>
            <div class="lecture-meta-row">
              <div class="lecture-meta-item">
                <span class="material-symbols-outlined" style="font-size: 11px;">person</span>
                <span>Booked by: ${item.bookedBy.split('@')[0]}</span>
              </div>
            </div>
          `;
        } else {
          card.className = "lecture-card cat-default";
          card.innerHTML = `
            <div class="lecture-time">${item.slot}</div>
            <div class="lecture-title" style="color: var(--state-present);">${item.title}</div>
            <div class="lecture-meta-row">
              <div class="lecture-meta-item">
                <span class="material-symbols-outlined" style="font-size: 11px; color: var(--state-present);">check_circle</span>
                <span style="color: var(--state-present);">Tap to Book</span>
              </div>
            </div>
          `;
        }

        card.style.cursor = "pointer";
        card.addEventListener("click", () => {
          openWazirBookingModal(dateKey, item.slot, item.status === "booked" ? item : null);
        });

        body.appendChild(card);
      });
    }
  });
}

function renderWazirMonthView() {
  const grid = document.getElementById("wazir-month-grid-cells");
  grid.innerHTML = "";
  
  const year = state.wazirCurrentDate.getFullYear();
  const month = state.wazirCurrentDate.getMonth();
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  document.getElementById("wazir-calendar-date-label").textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1);
  let startDay = firstDay.getDay();
  startDay = startDay === 0 ? 7 : startDay;
  
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevTotalDays = new Date(year, month, 0).getDate();
  
  const cells = [];
  for (let i = startDay - 2; i >= 0; i--) {
    cells.push({
      date: new Date(year, month - 1, prevTotalDays - i),
      active: false
    });
  }
  for (let i = 1; i <= totalDays; i++) {
    cells.push({
      date: new Date(year, month, i),
      active: true
    });
  }
  const totalCells = cells.length > 35 ? 42 : 35;
  const remaining = totalCells - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push({
      date: new Date(year, month + 1, i),
      active: false
    });
  }
  
  cells.forEach(c => {
    const cellDiv = document.createElement("div");
    cellDiv.className = `month-cell ${c.active ? '' : 'inactive-month-cell'}`;
    
    const dateNum = document.createElement("span");
    dateNum.className = "month-date-number";
    dateNum.textContent = c.date.getDate();
    cellDiv.appendChild(dateNum);
    
    const cellDateKey = formatDateKey(c.date);
    const cellDayName = getDayString(c.date);
    
    const schedule = getWazirDaySchedule(cellDateKey, cellDayName);
    const freeCount = schedule.filter(s => s.status === "free").length;
    const bookedCount = schedule.filter(s => s.status === "booked").length;
    
    if (freeCount > 0 || bookedCount > 0) {
      const capsulesContainer = document.createElement("div");
      capsulesContainer.className = "month-capsules-list";
      
      if (bookedCount > 0) {
        const cap = document.createElement("div");
        cap.className = "month-capsule cat-b2b";
        cap.textContent = `${bookedCount} Mtg`;
        capsulesContainer.appendChild(cap);
      }
      
      if (freeCount > 0) {
        const cap = document.createElement("div");
        cap.className = "month-capsule cat-default";
        cap.style.background = "rgba(40, 167, 69, 0.15)";
        cap.style.color = "var(--state-present)";
        cap.style.border = "1px solid rgba(40, 167, 69, 0.3)";
        cap.textContent = `${freeCount} Free`;
        capsulesContainer.appendChild(cap);
      }
      
      cellDiv.appendChild(capsulesContainer);
    }
    
    cellDiv.style.cursor = "pointer";
    cellDiv.addEventListener("click", () => {
      state.wazirCurrentDate = c.date;
      state.wazirViewMode = "week";
      const weekBtn = document.getElementById("btn-wazir-view-week");
      const monthBtn = document.getElementById("btn-wazir-view-month");
      if (weekBtn) weekBtn.classList.add("active");
      if (monthBtn) monthBtn.classList.remove("active");
      renderWazirCanvas();
    });

    grid.appendChild(cellDiv);
  });
}

function openWazirBookingModal(dateKey, slot, bookedItem) {
  document.getElementById("wazir-book-date").value = dateKey;
  document.getElementById("wazir-book-slot").value = slot;
  
  const label = document.getElementById("wazir-booking-label-time");
  label.textContent = `${dateKey} @ ${slot}`;
  
  const titleInput = document.getElementById("wazir-book-title");
  const deleteBtn = document.getElementById("btn-wazir-delete-booking");
  
  if (bookedItem) {
    titleInput.value = bookedItem.title;
    titleInput.disabled = true;
    deleteBtn.style.display = "block";
  } else {
    titleInput.value = "Wazir Meeting";
    titleInput.disabled = false;
    deleteBtn.style.display = "none";
  }
  
  document.getElementById("modal-wazir-booking").classList.add("active");
}

/* ==========================================================================
   MESS MENU SPECIFIC BUSINESS LOGIC
   ========================================================================== */
function parseMessMenuCsv(csvText) {
  const lines = csvText.split(/\r?\n/);
  const menu = {};
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const cells = parseCsvLine(line);
    if (cells.length < 4 || !cells[0] || cells[0] === "Day") continue;
    
    // Normalize Day (e.g. "monday" -> "Monday")
    let rawDay = cells[0].trim().toLowerCase();
    if (!rawDay) continue;
    const day = rawDay.charAt(0).toUpperCase() + rawDay.slice(1);

    // Normalize Meal Type (e.g. "BREAKFAST" -> "Breakfast")
    let rawMealType = cells[1].trim().toLowerCase();
    const mealType = rawMealType.charAt(0).toUpperCase() + rawMealType.slice(1);

    const category = cells[2].trim();
    const items = cells.slice(3).map(x => x.trim()).filter(x => x !== "").join(", ");
    
    if (!menu[day]) menu[day] = {};
    if (!menu[day][mealType]) menu[day][mealType] = [];
    menu[day][mealType].push({ category, items });
  }
  return menu;
}

async function syncMessMenu(force = false) {
  // Clear old cached mess menus from before we used local CSV (v52 and above)
  const MESS_MENU_VERSION = "v52_1";
  const cachedVersion = localStorage.getItem("iimr_mess_menu_version");
  if (cachedVersion !== MESS_MENU_VERSION) {
    localStorage.removeItem("iimr_mess_menu_raw");
    localStorage.setItem("iimr_mess_menu_version", MESS_MENU_VERSION);
    state.messMenu = {};
    force = true;
  }

  // 1. Try loading from cache first if state is empty
  if (Object.keys(state.messMenu).length === 0) {
    const cachedRaw = localStorage.getItem("iimr_mess_menu_raw");
    if (cachedRaw) {
      try {
        state.messMenu = parseMessMenuCsv(cachedRaw);
      } catch (e) {
        console.error("Failed to parse cached mess menu:", e);
      }
    }
  }

  // 2. Fetch live menu from Google Sheets if forced or cache is empty
  const isCacheEmpty = Object.keys(state.messMenu).length === 0;
  if (force || isCacheEmpty) {
    const syncIcon = document.getElementById("mess-sync-icon");
    if (syncIcon) syncIcon.classList.add("spin-animation"); // visual feedback
    
    try {
      const response = await fetch(MESS_MENU_URL);
      if (!response.ok) throw new Error("HTTP error " + response.status);
      
      const csvText = await response.text();
      if (csvText && csvText.trim().length > 0) {
        state.messMenu = parseMessMenuCsv(csvText);
        localStorage.setItem("iimr_mess_menu_raw", csvText);
        
        // Show success notification if manual sync was requested
        if (force) {
          showToast("Mess menu synced successfully!", "success");
        }
      }
    } catch (e) {
      console.error("Failed to fetch mess menu from Google Sheets:", e);
      if (force) {
        showToast("Sync failed: using offline menu data.", "danger");
      }
    } finally {
      if (syncIcon) syncIcon.classList.remove("spin-animation");
    }
  }

  // Auto-initialize selected day if empty
  if (!state.messSelectedDay) {
    const dayString = getDayString(new Date()); // e.g. "Sunday"
    state.messSelectedDay = state.messMenu[dayString] ? dayString : "Monday";
  }
}

function renderMessMenu() {
  const canvas = document.getElementById("mess-canvas");
  if (!canvas) return;

  canvas.innerHTML = "";

  // 1. Determine target day
  let targetDay = "";
  if (state.messViewMode === "today") {
    targetDay = getDayString(new Date());
    const selectorRow = document.getElementById("mess-weekly-selector-row");
    if (selectorRow) selectorRow.style.display = "none";
    
    const subtitle = document.querySelector("#tab-mess .tab-subtitle");
    if (subtitle) subtitle.textContent = `Dining menu for today (${targetDay})`;
  } else {
    // Weekly view
    const selectorRow = document.getElementById("mess-weekly-selector-row");
    if (selectorRow) selectorRow.style.display = "flex";
    
    if (!state.messSelectedDay) {
      state.messSelectedDay = getDayString(new Date());
    }
    targetDay = state.messSelectedDay;
    
    const subtitle = document.querySelector("#tab-mess .tab-subtitle");
    if (subtitle) subtitle.textContent = `Dining menu for ${targetDay}`;

    // Highlight correct day pill
    document.querySelectorAll("#mess-days-pills-list .member-pill").forEach(pill => {
      if (pill.getAttribute("data-day") === targetDay) {
        pill.classList.add("active");
      } else {
        pill.classList.remove("active");
      }
    });
  }

  // 2. Fetch target day's meals
  const dayMenu = state.messMenu[targetDay] || {};
  const mealTypes = [
    { name: "Breakfast", time: "8 - 9 AM", icon: "breakfast_dining", css: "meal-breakfast" },
    { name: "Lunch", time: "1 - 2 PM", icon: "soup_kitchen", css: "meal-lunch" },
    { name: "Snacks", time: "5 - 6 PM", icon: "local_cafe", css: "meal-snacks" },
    { name: "Dinner", time: "8 - 9:30 PM", icon: "dinner_dining", css: "meal-dinner" }
  ];

  let hasAnyMeals = false;

  mealTypes.forEach(meal => {
    const categories = dayMenu[meal.name] || [];
    if (categories.length === 0) return; // skip if no categories listed for this meal on this day

    hasAnyMeals = true;

    const card = document.createElement("div");
    card.className = `meal-card ${meal.css}`;

    // Header row
    const header = document.createElement("div");
    header.className = "meal-header-row";

    header.innerHTML = `
      <div class="meal-title-block">
        <span class="material-symbols-outlined meal-icon" style="color: var(--text-primary);">${meal.icon}</span>
        <span class="meal-type-title">${meal.name}</span>
      </div>
      <span class="meal-time">${meal.time}</span>
    `;
    card.appendChild(header);

    // Body container
    const body = document.createElement("div");
    body.className = "meal-body";

    categories.forEach(cat => {
      const block = document.createElement("div");
      block.className = "meal-category-block";
      block.innerHTML = `
        <span class="meal-category-name">${cat.category}</span>
        <span class="meal-category-items">${cat.items}</span>
      `;
      body.appendChild(block);
    });

    card.appendChild(body);
    canvas.appendChild(card);
  });

  if (!hasAnyMeals) {
    const emptyCard = document.createElement("div");
    emptyCard.className = "free-card";
    emptyCard.style.gridColumn = "1 / -1";
    emptyCard.style.textAlign = "center";
    emptyCard.textContent = "No mess menu records found for this day.";
    canvas.appendChild(emptyCard);
  }
}

function setupMessEventListeners() {
  const todayBtn = document.getElementById("btn-mess-view-today");
  const weekBtn = document.getElementById("btn-mess-view-week");
  
  if (todayBtn) {
    todayBtn.addEventListener("click", () => {
      state.messViewMode = "today";
      todayBtn.classList.add("active");
      if (weekBtn) weekBtn.classList.remove("active");
      renderMessMenu();
    });
  }
  
  if (weekBtn) {
    weekBtn.addEventListener("click", () => {
      state.messViewMode = "week";
      weekBtn.classList.add("active");
      if (todayBtn) todayBtn.classList.remove("active");
      renderMessMenu();
    });
  }

  const syncBtn = document.getElementById("btn-mess-sync");
  if (syncBtn) {
    syncBtn.addEventListener("click", () => {
      syncMessMenu(true).then(() => {
        renderMessMenu();
      });
    });
  }

  document.querySelectorAll("#mess-days-pills-list .member-pill").forEach(pill => {
    pill.addEventListener("click", (e) => {
      const day = e.currentTarget.getAttribute("data-day");
      if (day) {
        state.messSelectedDay = day;
        renderMessMenu();
      }
    });
  });
}

function initWazirMembersSelector() {
  const container = document.getElementById("wazir-members-list");
  if (!container) return;

  container.innerHTML = "";

  // Initialize selected comparison list with logged-in user if empty
  if (!state.wazirCompareEmails || state.wazirCompareEmails.length === 0 || !state.wazirCompareEmails.includes(state.user.email)) {
    state.wazirCompareEmails = [state.user.email];
  }

  // Render the pills:
  // Current user's pill first, followed by other members
  const orderedMembers = [
    state.user.email,
    ...WAZIR_MEMBERS.filter(email => email !== state.user.email)
  ];

  orderedMembers.forEach(email => {
    const isSelf = email === state.user.email;
    const isActive = state.wazirCompareEmails.includes(email);
    const name = WAZIR_NAMES[email] || email.split('@')[0];

    const pill = document.createElement("div");
    pill.className = `member-pill${isSelf ? " active self-pill" : (isActive ? " active" : "")}`;
    pill.setAttribute("data-email", email);

    pill.innerHTML = `
      <span class="material-symbols-outlined" style="font-size: 14px;">
        ${isSelf ? "lock" : "person"}
      </span>
      <span>${name}${isSelf ? " (Me)" : ""}</span>
    `;

    if (!isSelf) {
      pill.addEventListener("click", () => {
        const index = state.wazirCompareEmails.indexOf(email);
        if (index > -1) {
          state.wazirCompareEmails.splice(index, 1);
          pill.classList.remove("active");
        } else {
          state.wazirCompareEmails.push(email);
          pill.classList.add("active");
        }
        renderWazirCanvas();
      });
    }

    container.appendChild(pill);
  });

  // Highlight/toggle active styles on Select Buttons based on current state.wazirCompareEmails
  const wazirsList = [
    "ipm04niketp@iimrohtak.ac.in",
    "pgp16hidayrajsinhc@iimrohtak.ac.in",
    "ipm04adityabs@iimrohtak.ac.in",
    "ipm04prithivit@iimrohtak.ac.in",
    "pgp16tanishthav@iimrohtak.ac.in",
    "pgp16akshita@iimrohtak.ac.in",
    "ipm04mridulu@iimrohtak.ac.in",
    "pgp16divyanshid@iimrohtak.ac.in"
  ];
  const allWazirsSelected = wazirsList.every(email => state.wazirCompareEmails.includes(email));
  const onlyWazirsSelected = allWazirsSelected && !state.wazirCompareEmails.includes("ipm04rainaa@iimrohtak.ac.in");
  const all9Selected = WAZIR_MEMBERS.every(email => state.wazirCompareEmails.includes(email));

  const selectWazirsBtn = document.getElementById("btn-select-all-wazirs");
  if (selectWazirsBtn) {
    if (onlyWazirsSelected || (allWazirsSelected && !all9Selected)) {
      selectWazirsBtn.classList.add("active");
    } else {
      selectWazirsBtn.classList.remove("active");
    }
  }

  const selectAllBtn = document.getElementById("btn-select-all-9");
  if (selectAllBtn) {
    if (all9Selected) {
      selectAllBtn.classList.add("active");
    } else {
      selectAllBtn.classList.remove("active");
    }
  }
}

function setupWazirEventListeners() {
  const weekBtn = document.getElementById("btn-wazir-view-week");
  const monthBtn = document.getElementById("btn-wazir-view-month");
  
  if (weekBtn) {
    weekBtn.addEventListener("click", () => {
      state.wazirViewMode = "week";
      weekBtn.classList.add("active");
      monthBtn.classList.remove("active");
      renderWazirCanvas();
    });
  }
  
  if (monthBtn) {
    monthBtn.addEventListener("click", () => {
      state.wazirViewMode = "month";
      monthBtn.classList.add("active");
      weekBtn.classList.remove("active");
      renderWazirCanvas();
    });
  }

  const prevBtn = document.getElementById("btn-wazir-date-prev");
  const nextBtn = document.getElementById("btn-wazir-date-next");
  
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (state.wazirViewMode === "week") {
        state.wazirCurrentDate.setDate(state.wazirCurrentDate.getDate() - 7);
      } else {
        state.wazirCurrentDate.setMonth(state.wazirCurrentDate.getMonth() - 1);
      }
      document.getElementById("wazir-calendar-date-input").value = formatDateKey(state.wazirCurrentDate);
      renderWazirCanvas();
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (state.wazirViewMode === "week") {
        state.wazirCurrentDate.setDate(state.wazirCurrentDate.getDate() + 7);
      } else {
        state.wazirCurrentDate.setMonth(state.wazirCurrentDate.getMonth() + 1);
      }
      document.getElementById("wazir-calendar-date-input").value = formatDateKey(state.wazirCurrentDate);
      renderWazirCanvas();
    });
  }

  const dateInput = document.getElementById("wazir-calendar-date-input");
  if (dateInput) {
    dateInput.addEventListener("change", (e) => {
      const val = e.target.value;
      if (val) {
        state.wazirCurrentDate = new Date(val);
        renderWazirCanvas();
      }
    });
  }

  const closeModalBtn = document.getElementById("btn-close-wazir-modal");
  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", () => {
      document.getElementById("modal-wazir-booking").classList.remove("active");
    });
  }

  const form = document.getElementById("wazir-booking-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const dateKey = document.getElementById("wazir-book-date").value;
      const slot = document.getElementById("wazir-book-slot").value;
      const title = document.getElementById("wazir-book-title").value;
      
      const success = await bookWazirMeeting(dateKey, slot, title);
      if (success) {
        document.getElementById("modal-wazir-booking").classList.remove("active");
      }
    });
  }

  const deleteBtn = document.getElementById("btn-wazir-delete-booking");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      const dateKey = document.getElementById("wazir-book-date").value;
      const slot = document.getElementById("wazir-book-slot").value;
      
      const success = await cancelWazirMeeting(dateKey, slot);
      if (success) {
        document.getElementById("modal-wazir-booking").classList.remove("active");
      }
    });
  }

  const btnSelectWazirs = document.getElementById("btn-select-all-wazirs");
  if (btnSelectWazirs) {
    btnSelectWazirs.addEventListener("click", () => {
      const wazirsList = [
        "ipm04niketp@iimrohtak.ac.in",
        "pgp16hidayrajsinhc@iimrohtak.ac.in",
        "ipm04adityabs@iimrohtak.ac.in",
        "ipm04prithivit@iimrohtak.ac.in",
        "pgp16tanishthav@iimrohtak.ac.in",
        "pgp16akshita@iimrohtak.ac.in",
        "ipm04mridulu@iimrohtak.ac.in",
        "pgp16divyanshid@iimrohtak.ac.in"
      ];
      const allWazirsSelected = wazirsList.every(email => state.wazirCompareEmails.includes(email));
      const onlyWazirsSelected = allWazirsSelected && !state.wazirCompareEmails.includes("ipm04rainaa@iimrohtak.ac.in");

      if (onlyWazirsSelected || (allWazirsSelected && state.wazirCompareEmails.length === wazirsList.length)) {
        // Toggle reversal: reset to just self
        state.wazirCompareEmails = [state.user.email];
      } else {
        state.wazirCompareEmails = [...wazirsList];
      }
      initWazirMembersSelector();
      renderWazirCanvas();
    });
  }

  const btnSelectAll9 = document.getElementById("btn-select-all-9");
  if (btnSelectAll9) {
    btnSelectAll9.addEventListener("click", () => {
      const allSelected = WAZIR_MEMBERS.every(email => state.wazirCompareEmails.includes(email));
      if (allSelected) {
        // Toggle reversal: reset to just self
        state.wazirCompareEmails = [state.user.email];
      } else {
        state.wazirCompareEmails = [...WAZIR_MEMBERS];
      }
      initWazirMembersSelector();
      renderWazirCanvas();
    });
  }
}

