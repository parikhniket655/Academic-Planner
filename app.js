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
  if (isStorageWorking && storedVer < 6.0) {
    const activeUser = window.localStorage.getItem("iimr_active_user");
    const studentDb = window.localStorage.getItem("iimr_student_db");
    
    window.localStorage.clear();
    
    if (activeUser) window.localStorage.setItem("iimr_active_user", activeUser);
    if (studentDb) window.localStorage.setItem("iimr_student_db", studentDb);
    window.localStorage.setItem("iimr_app_version", "6.0");
    
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
const TIMETABLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbxoc845iGqxwYmyECtHppmte5RYPuhfb7e2RNn4RkLq53dSJE6R5Zkul-rs--4TkW2xLA/exec";
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
  "CW Sec-B": "Communication Workshop Sec B",

  // Term V Subjects
  "CSY": "Cyber Security",
  "IT": "Information Technology",
  "FORM": "Financial Risk Operations Management",
  "PBM": "Product & Brand Management",
  "PBM Sec-A": "Product & Brand Management Sec A",
  "PBM Sec-B": "Product & Brand Management Sec B",
  "SNAB": "Social Network Analytics for Business",
  "TQMS": "Total Quality Management & Six Sigma",
  "TQMS Sec-A": "Total Quality Management Sec A",
  "TQMS Sec-B": "Total Quality Management Sec B",
  "MSS": "Management Systems & Strategy",
  "MSS Sec-A": "Management Systems & Strategy Sec A",
  "MSS Sec-B": "Management Systems & Strategy Sec B",
  "MSS Sec-C": "Management Systems & Strategy Sec C",
  "MSS Sec-D": "Management Systems & Strategy Sec D",
  "GSEC": "Global Strategy & Emerging Companies",
  "FIS": "Financial Institutions & Services",
  "IB": "International Business",
  "SNCM": "Strategic Negotiation & Commercial Management",
  "SNCM Sec-A": "Strategic Negotiation Sec A",
  "SNCM Sec-B": "Strategic Negotiation Sec B",
  "AAB": "Advanced Accounting for Business",
  "PFWM": "Personal Finance & Wealth Management",
  "Project Course": "Project Course",
  "MBFM": "Management of Banking & Financial Markets",
  "SM": "Strategic Management",
  "MSD": "Market Structure & Dynamics",
  "NPD": "New Product Development",
  "SoM": "Service Operations Management",
  "IMC": "Integrated Marketing Communication",
  "SSM": "Services Marketing & Strategy"
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
  "IMDM": 1.0,

  // Term V Credits
  "CSY": 1.0,
  "IT": 1.0,
  "FORM": 1.0,
  "PBM": 1.0,
  "PBM Sec-A": 1.0,
  "PBM Sec-B": 1.0,
  "SNAB": 1.0,
  "TQMS": 1.0,
  "TQMS Sec-A": 1.0,
  "TQMS Sec-B": 1.0,
  "MSS": 1.0,
  "MSS Sec-A": 1.0,
  "MSS Sec-B": 1.0,
  "MSS Sec-C": 1.0,
  "MSS Sec-D": 1.0,
  "GSEC": 1.0,
  "FIS": 1.0,
  "IB": 1.0,
  "SNCM": 1.0,
  "SNCM Sec-A": 1.0,
  "SNCM Sec-B": 1.0,
  "AAB": 1.0,
  "PFWM": 1.0,
  "Project Course": 1.0,
  "MBFM": 1.0,
  "SM": 1.0,
  "MSD": 1.0,
  "NPD": 1.0,
  "SoM": 1.0,
  "IMC": 1.0,
  "SSM": 1.0
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
  "IMDM": 20,

  // Term V Total Sessions
  "CSY": 20,
  "IT": 20,
  "FORM": 20,
  "PBM": 20,
  "PBM Sec-A": 20,
  "PBM Sec-B": 20,
  "SNAB": 20,
  "TQMS": 20,
  "TQMS Sec-A": 20,
  "TQMS Sec-B": 20,
  "MSS": 20,
  "MSS Sec-A": 20,
  "MSS Sec-B": 20,
  "MSS Sec-C": 20,
  "MSS Sec-D": 20,
  "GSEC": 20,
  "FIS": 20,
  "IB": 20,
  "SNCM": 20,
  "SNCM Sec-A": 20,
  "SNCM Sec-B": 20,
  "AAB": 20,
  "PFWM": 20,
  "Project Course": 20,
  "MBFM": 20,
  "SM": 20,
  "MSD": 20,
  "NPD": 20,
  "SoM": 20,
  "IMC": 20,
  "SSM": 20
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
  
  // Sort so that late-night slots are processed last
  const sortedList = [...list].sort((a, b) => {
    const aLate = (a.slot || "").includes("22:25") || (a.slot || "").includes("23:40");
    const bLate = (b.slot || "").includes("22:25") || (b.slot || "").includes("23:40");
    if (aLate && !bLate) return 1;
    if (!aLate && bLate) return -1;
    return (a.dateKey || "").localeCompare(b.dateKey || "");
  });

  const seen = new Set();
  const seenSessionNums = new Set();
  
  const filteredSorted = sortedList.filter(item => {
    const key = `${item.dateKey}_${normalizeCourseId(item.courseId)}_${normalizeSlot(item.slot)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    
    if (item.instructor && item.instructor.includes('|') && item.instructor !== "EXAM") {
      const parts = item.instructor.split('|');
      const num = parseInt(parts[1]);
      if (!isNaN(num)) {
        const sessionKey = `${normalizeCourseId(item.courseId)}_${num}`;
        if (seenSessionNums.has(sessionKey)) {
          return false;
        }
        seenSessionNums.add(sessionKey);
      }
    }
    return true;
  });

  return filteredSorted.sort((a, b) => (a.dateKey || "").localeCompare(b.dateKey || ""));
}

function isStudentEnrolled(studentCourses, courseId) {
  if (!studentCourses || !courseId) return false;
  const normId = normalizeCourseId(courseId);
  
  for (let uCourse of studentCourses) {
    const normUser = normalizeCourseId(uCourse);
    if (normUser === normId) return true;
    
    // Check base course match (e.g. user has "PBM Sec-A" and lecture is "PBM" or vice versa)
    const baseCodes = ["CW", "GBS", "BA", "CV", "AIDMD", "B2B", "IBS", "PFM", "DBM", "MSS", "SNCM", "PBM", "TQMS", "CSY", "IT", "FORM", "SNAB", "FIS", "IB", "AAB", "PFWM", "MBFM", "SM", "MSD", "NPD", "SOM", "IMC", "SSM"];
    
    const uBase = baseCodes.find(b => normUser.startsWith(normalizeCourseId(b)));
    const lBase = baseCodes.find(b => normId.startsWith(normalizeCourseId(b)));

    if (uBase && lBase && normalizeCourseId(uBase) === normalizeCourseId(lBase)) {
      if (normUser.includes("SEC") && normId.includes("SEC")) {
        if (normUser === normId) return true;
      } else {
        return true;
      }
    }
  }
  return false;
}

function isDateKeyMatch(lecture, targetDateKey) {
  if (!lecture || !targetDateKey) return false;
  
  let lKey = String(lecture.dateKey || lecture.date_key || "").trim();
  if (lKey === targetDateKey) return true;

  // Parsed Date object check (e.g. "Sat Sep 12 2026...")
  if (lKey.length > 10 && (lKey.includes("GMT") || lKey.includes("India") || lKey.includes("202"))) {
    const pDate = new Date(lKey);
    if (!isNaN(pDate.getTime())) {
      const formattedKey = formatDateKey(pDate);
      if (formattedKey === targetDateKey) return true;
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY format matching
  const mSlash = lKey.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (mSlash) {
    const formattedKey = `${mSlash[3]}-${String(mSlash[2]).padStart(2, '0')}-${String(mSlash[1]).padStart(2, '0')}`;
    if (formattedKey === targetDateKey) return true;
  }

  return false;
}

// Mock Student Database Defaults
const DEFAULT_STUDENT_DB = {
  "ipm04niketp@iimrohtak.ac.in": {
    name: "Niket Parikh",
    courses: [
      "CSY",
      "IT",
      "FORM",
      "PBM Sec-A",
      "SNAB",
      "TQMS Sec-B",
      "MSS Sec-A"
    ]
  },
  "ipm04palaky@iimrohtak.ac.in": {
    name: "Palak Yadav",
    courses: [
      "GSEC",
      "SNCM Sec-A",
      "SSM",
      "PBM Sec-B",
      "TQMS Sec-A",
      "MSS Sec-A"
    ]
  },
  "pgp16hidayrajsinhc@iimrohtak.ac.in": {
    name: "Hidayrajsinh Chauhan",
    courses: [
      "GSEC",
      "FIS",
      "FORM",
      "IB",
      "SNCM Sec-B",
      "MSS Sec-C"
    ]
  },
  "ipm04adityabs@iimrohtak.ac.in": {
    name: "Aditya Brijgopal Sarda",
    courses: [
      "GSEC",
      "AAB",
      "FIS",
      "IB",
      "SNCM Sec-A",
      "MSS Sec-A"
    ]
  },
  "ipm04prithivit@iimrohtak.ac.in": {
    name: "Prithivi Tejeshwar",
    courses: [
      "FORM",
      "IB",
      "PFWM",
      "PBM Sec-A",
      "MSS Sec-C",
      "Project Course"
    ]
  },
  "pgp16tanishthav@iimrohtak.ac.in": {
    name: "Tanishtha Verma",
    courses: [
      "GSEC",
      "MBFM",
      "SM",
      "MSD",
      "TQMS Sec-B",
      "MSS Sec-D"
    ]
  },
  "pgp16akshita@iimrohtak.ac.in": {
    name: "Akshita",
    courses: [
      "SNCM Sec-A",
      "PBM Sec-B",
      "SNAB",
      "NPD",
      "TQMS Sec-A",
      "MSS Sec-A"
    ]
  },
  "ipm04mridulu@iimrohtak.ac.in": {
    name: "Mridul Upadhyay",
    courses: [
      "AAB",
      "SNCM Sec-A",
      "PBM Sec-B",
      "SoM",
      "MSS Sec-B",
      "Project Course"
    ]
  },
  "pgp16divyanshid@iimrohtak.ac.in": {
    name: "Divyanshi Dongre",
    courses: [
      "GSEC",
      "CSY",
      "IT",
      "SNCM Sec-A",
      "IMC",
      "SM",
      "MSS Sec-B"
    ]
  },
  "ipm04rainaa@iimrohtak.ac.in": {
    name: "Raina Arjun",
    courses: [
      "GSEC",
      "AAB",
      "FIS",
      "IB",
      "SNCM Sec-A",
      "MSS Sec-A"
    ]
  }
};

// Default Timetable Mapping (Spans late June to late July 2026 to match stats & dates in screenshots)
const EXAMS_TIMETABLE = [
  // 24th August, 2026 (Monday)
  { dateKey: "2026-08-24", day: "Monday", slot: "10:30 - 12:30", courseId: "MBPET", subject: "EXAM: Managing Business Processes with Emerging Technologies (MBPET)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-08-24", day: "Monday", slot: "14:30 - 16:30", courseId: "CV", subject: "EXAM: Corporate Valuation (CV)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-08-24", day: "Monday", slot: "14:30 - 16:30", courseId: "PM", subject: "EXAM: Project Management (PM)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-08-24", day: "Monday", slot: "14:30 - 16:30", courseId: "PCM", subject: "EXAM: Performance and Compensation Management (PCM)", room: "Exam Hall", instructor: "EXAM" },

  // 25th August, 2026 (Tuesday)
  { dateKey: "2026-08-25", day: "Tuesday", slot: "10:30 - 12:30", courseId: "AIDMD", subject: "EXAM: AI-Driven Marketing Decision Making (AIDMD)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-08-25", day: "Tuesday", slot: "14:30 - 16:30", courseId: "SCM", subject: "EXAM: Supply Chain Management (SCM)", room: "Exam Hall", instructor: "EXAM" },

  // 27th August, 2026 (Thursday)
  { dateKey: "2026-08-27", day: "Thursday", slot: "10:30 - 12:30", courseId: "FADT", subject: "EXAM: Fundamentals and Applications of Design Thinking (FADT)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-08-27", day: "Thursday", slot: "10:30 - 12:30", courseId: "IBS", subject: "EXAM: International Business Strategies (IBS)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-08-27", day: "Thursday", slot: "14:30 - 16:30", courseId: "BA", subject: "EXAM: Business Analytics (BA)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-08-27", day: "Thursday", slot: "14:30 - 16:30", courseId: "BGRI", subject: "EXAM: Business–Government Relations in India (BGRI)", room: "Exam Hall", instructor: "EXAM" },

  // 28th August, 2026 (Friday)
  { dateKey: "2026-08-28", day: "Friday", slot: "10:30 - 12:30", courseId: "FM", subject: "EXAM: Financial Modelling (FM)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-08-28", day: "Friday", slot: "14:30 - 16:30", courseId: "GBS", subject: "EXAM: Global Business Simulation (GBS)", room: "Exam Hall", instructor: "EXAM" },

  // 29th August, 2026 (Saturday)
  { dateKey: "2026-08-29", day: "Saturday", slot: "10:30 - 12:30", courseId: "TA", subject: "EXAM: Talent Acquisition (TA)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-08-29", day: "Saturday", slot: "14:30 - 16:30", courseId: "CB", subject: "EXAM: Consumer Behaviour (CB)", room: "Exam Hall", instructor: "EXAM" },

  // 30th August, 2026 (Sunday)
  { dateKey: "2026-08-30", day: "Sunday", slot: "10:30 - 12:30", courseId: "PS", subject: "EXAM: Pricing Strategies (PS)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-08-30", day: "Sunday", slot: "10:30 - 12:30", courseId: "FSA", subject: "EXAM: Financial Statement Analysis (FSA)", room: "Exam Hall", instructor: "EXAM" },

  // 31st August, 2026 (Monday)
  { dateKey: "2026-08-31", day: "Monday", slot: "10:30 - 12:30", courseId: "MS", subject: "EXAM: Managing Sustainability (MS)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-08-31", day: "Monday", slot: "14:30 - 16:30", courseId: "PWMP", subject: "EXAM: Playing to Win Market and Power (PWMP)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-08-31", day: "Monday", slot: "14:30 - 16:30", courseId: "SHRM", subject: "EXAM: Strategic Human Resource Management (SHRM)", room: "Exam Hall", instructor: "EXAM" },

  // 1st September, 2026 (Tuesday)
  { dateKey: "2026-09-01", day: "Tuesday", slot: "10:30 - 12:30", courseId: "IMDM", subject: "EXAM: Insurance and Managerial Decision Making (IMDM)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-09-01", day: "Tuesday", slot: "14:30 - 16:30", courseId: "SDM", subject: "EXAM: Sales and Distribution Management (SDM)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-09-01", day: "Tuesday", slot: "14:30 - 16:30", courseId: "IAPM", subject: "EXAM: Investment Analysis & Portfolio Management (IAPM)", room: "Exam Hall", instructor: "EXAM" },

  // 2nd September, 2026 (Wednesday)
  { dateKey: "2026-09-02", day: "Wednesday", slot: "10:30 - 12:30", courseId: "PFM", subject: "EXAM: Python for Managers (PFM)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-09-02", day: "Wednesday", slot: "14:30 - 16:30", courseId: "B2B", subject: "EXAM: B2B Marketing (B2B)", room: "Exam Hall", instructor: "EXAM" },

  // 3rd September, 2026 (Thursday)
  { dateKey: "2026-09-03", day: "Thursday", slot: "10:30 - 12:30", courseId: "SC", subject: "EXAM: Strategic Consulting (SC)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-09-03", day: "Thursday", slot: "14:30 - 16:30", courseId: "L&D", subject: "EXAM: Learning and Development (L&D)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-09-03", day: "Thursday", slot: "14:30 - 16:30", courseId: "MFIS", subject: "EXAM: Management of Financial Institutions and Services (MFIS)", room: "Exam Hall", instructor: "EXAM" },
  { dateKey: "2026-09-03", day: "Thursday", slot: "14:30 - 16:30", courseId: "DBM", subject: "EXAM: Digital Business Models (DBM)", room: "Exam Hall", instructor: "EXAM" }
];

const DEFAULT_TIMETABLE = [
  {
    "dateKey": "2001-08-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "MSD",
    "subject": "MSD 6(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "SNCM",
    "subject": "SNCM 6(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "IB",
    "subject": "IB 5(VB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 10(SV)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 10(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "IB",
    "subject": "IB 6(VB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "IT",
    "subject": "IT 8(DB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "ENV 6(RC)",
    "subject": "ENV 6(RC)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "NPD",
    "subject": "NPD 6(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 10 (AY)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 10(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 11(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "MBFM",
    "subject": "MBFM 1(CSVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "TM 7(LRM)",
    "subject": "TM 7(LRM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-09-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 9(AK1)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-09-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "MBFM",
    "subject": "MBFM 3(CSVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-09-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "MSD",
    "subject": "MSD 7(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-09-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "SNCM",
    "subject": "SNCM 7(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-09-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "IT",
    "subject": "IT 9(DB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-09-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "IB",
    "subject": "IB 7(VB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "IT",
    "subject": "IT 10(DB)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 11 (AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "IMC",
    "subject": "IMC 7(GRVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 11(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 11(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 11(AK3)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "IMC",
    "subject": "IMC 9(GRVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "SNCM",
    "subject": "SNCM 8(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "MSD",
    "subject": "MSD 8(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "PBM",
    "subject": "PBM 8 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "IMC",
    "subject": "IMC 11(GRVF)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 10(AK1)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 12(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "ENV 7(RC)",
    "subject": "ENV 7(RC)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "TM 8(LRM)",
    "subject": "TM 8(LRM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "SNAB",
    "subject": "SNAB 9(PD)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "NPD",
    "subject": "NPD 7(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-15",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 12 (AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-09-13",
    "day": "Scheduled",
    "slot": "08:45 - 10:00",
    "courseId": "Fixed Income Securities",
    "subject": "Fixed Income Securities",
    "room": "LR 07",
    "instructor": "Dr. Amit Pandey"
  },
  {
    "dateKey": "2026-09-14",
    "day": "Scheduled",
    "slot": "08:45 - 10:00",
    "courseId": "PFWM",
    "subject": "Personal Finance & Wealth Management",
    "room": "LR 07",
    "instructor": "Dr Surbhi Verma"
  },
  {
    "dateKey": "2026-09-15",
    "day": "Scheduled",
    "slot": "08:45 - 10:00",
    "courseId": "Markstrat Simulations (Core)",
    "subject": "Markstrat Simulations (Core)",
    "room": "LR 07",
    "instructor": "Dr. Abhishek Yadav (A&D), Dr. Harmanjit Singh (C), Dr. Archit V. Tapar (B)"
  },
  {
    "dateKey": "2026-09-16",
    "day": "Scheduled",
    "slot": "08:45 - 10:00",
    "courseId": "Mergers and Acquisitions",
    "subject": "Mergers and Acquisitions",
    "room": "LR 07",
    "instructor": "Dr. Deepali Dhingra"
  },
  {
    "dateKey": "2026-09-17",
    "day": "Scheduled",
    "slot": "08:45 - 10:00",
    "courseId": "Strategies for New Age Businesses",
    "subject": "Strategies for New Age Businesses",
    "room": "LR 07",
    "instructor": "Dr. Pranav Dharmani"
  },
  {
    "dateKey": "2026-10-15",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 12(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-15",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 12(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-15",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "PBM",
    "subject": "PBM 9 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-15",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 13(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 11(AK1)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "MSD",
    "subject": "MSD 9(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "SNCM",
    "subject": "SNCM 9(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "IB",
    "subject": "IB 8(VB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 12(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "MBFM",
    "subject": "MBFM 5(CSVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "NPD",
    "subject": "NPD 8(AT)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "MBFM",
    "subject": "MBFM 7(CSVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "ENV 8(RC)",
    "subject": "ENV 8(RC)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 13(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 13(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "PBM",
    "subject": "PBM 10 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-12-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 12(AK1)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-12-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "SNAB",
    "subject": "SNAB 10(PD)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-12-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 13(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-12-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 13 (AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-12-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "MSD",
    "subject": "MSD 10(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-12-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "SNCM",
    "subject": "SNCM 10(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-20",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "Dussehra",
    "subject": "Dussehra",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-09-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "TM 9(LRM)",
    "subject": "TM 9(LRM)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-09-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "IB",
    "subject": "IB 9(VB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-09-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "NPD",
    "subject": "NPD 9(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-09-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "PBM",
    "subject": "PBM 11 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-09-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 14(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-09-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 14(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "SNAB",
    "subject": "SNAB 11(PD)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 14 (AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 14(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "PBM",
    "subject": "PBM 12 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "NPD",
    "subject": "NPD 10(AT)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 14(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "ENV 9(RC)",
    "subject": "ENV 9(RC)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 13(AK1)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "MBFM",
    "subject": "MBFM 8(CSVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "CSY",
    "subject": "CSY 1(ACVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "CSY",
    "subject": "CSY 2(ACVF)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Scheduled",
    "slot": "08:45 - 10:00",
    "courseId": "Date",
    "subject": "Date",
    "room": "Section C: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Scheduled",
    "slot": "08:45 - 10:00",
    "courseId": "Sections",
    "subject": "Sections",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Scheduled",
    "slot": "08:45 - 10:00",
    "courseId": "LUNCH",
    "subject": "LUNCH",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Scheduled",
    "slot": "08:45 - 10:00",
    "courseId": "Course",
    "subject": "Course",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Scheduled",
    "slot": "08:45 - 10:00",
    "courseId": "Course Abb.",
    "subject": "Course Abb.",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Scheduled",
    "slot": "08:45 - 10:00",
    "courseId": "Name of the Faculty",
    "subject": "Name of the Faculty",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Scheduled",
    "slot": "08:45 - 10:00",
    "courseId": "Faculty Abb.",
    "subject": "Faculty Abb.",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Scheduled",
    "slot": "08:45 - 10:00",
    "courseId": "Credit",
    "subject": "Credit",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Scheduled",
    "slot": "08:45 - 10:00",
    "courseId": "Section",
    "subject": "Section",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "TM 1(LRM)",
    "subject": "TM 1(LRM)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "IT",
    "subject": "IT 1(DB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 1(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 1(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 1(AK1)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 1(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 1(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "Dr. Ashwani Kumar",
    "subject": "Dr. Ashwani Kumar",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "AK1",
    "subject": "AK1",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-09-13",
    "day": "Sunday",
    "slot": "12:30",
    "courseId": "Fixed Income Securities",
    "subject": "Fixed Income Securities",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-09-13",
    "day": "Sunday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-09-13",
    "day": "Sunday",
    "slot": "12:30",
    "courseId": "Dr. Amit Pandey",
    "subject": "Dr. Amit Pandey",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-09-13",
    "day": "Sunday",
    "slot": "12:30",
    "courseId": "AP2",
    "subject": "AP2",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 2(CPG)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 2(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 2(AK1)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 2(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 2(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 1(AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "Dr Surbhi Verma",
    "subject": "Dr Surbhi Verma",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "SV",
    "subject": "SV",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "IB",
    "subject": "IB 1(VB)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "PBM",
    "subject": "PBM 1 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "ENV 1(RC)",
    "subject": "ENV 1(RC)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "NPD",
    "subject": "NPD 1(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "MSD",
    "subject": "MSD 1(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "SNCM",
    "subject": "SNCM 1(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "Markstrat Simulations (Core)",
    "subject": "Markstrat Simulations (Core)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "Dr. Abhishek Yadav (A&D), Dr. Harmanjit Singh (C), Dr. Archit V. Tapar (B)",
    "subject": "Dr. Abhishek Yadav (A&D), Dr. Harmanjit Singh (C), Dr. Archit V. Tapar (B)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "AY,HS,AVT",
    "subject": "AY,HS,AVT",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 2(AY)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 3(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 3(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 3(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 3(AK1)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 3(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "Mergers and Acquisitions",
    "subject": "Mergers and Acquisitions",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "M & A",
    "subject": "M & A",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "Dr. Deepali Dhingra",
    "subject": "Dr. Deepali Dhingra",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "DD",
    "subject": "DD",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "ENV 2(RC)",
    "subject": "ENV 2(RC)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "SNAB",
    "subject": "SNAB 1(PD)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "IT",
    "subject": "IT 2(DB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 3(AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "IB",
    "subject": "IB 2(VB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "TM 2(LRM)",
    "subject": "TM 2(LRM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "Strategies for New Age Businesses",
    "subject": "Strategies for New Age Businesses",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "Dr. Pranav Dharmani",
    "subject": "Dr. Pranav Dharmani",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "PD",
    "subject": "PD",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "IT",
    "subject": "IT 3(DB)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 4(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "PBM",
    "subject": "PBM 2 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 4(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "NPD",
    "subject": "NPD 2(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 4(AK1)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "SNCM",
    "subject": "SNCM 2(MM)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "MSD",
    "subject": "MSD 2(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 4 (AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 4(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 4(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-05-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 5 (AY)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-05-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 5(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-05-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 5(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-05-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 5(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-05-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "PBM",
    "subject": "PBM 3 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-05-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 5(AK1)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-05-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 5(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-05-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "SNCM",
    "subject": "SNCM 3(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-05-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "SNAB",
    "subject": "SNAB 2(PD)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-05-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 6(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-07-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 7(CPG)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-07-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 6(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-07-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 6(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-07-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "SNAB",
    "subject": "SNAB 3(PD)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-07-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "IT",
    "subject": "IT 4(DB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-04-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "PBM",
    "subject": "PBM 4 (AVT)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-04-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 6(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-04-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "SNCM",
    "subject": "SNCM 4(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-04-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "SNAB",
    "subject": "SNAB 4(PD)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-04-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 6(AK1)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-04-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 7(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-04-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 7(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-04-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 6 (AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-04-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "MSD",
    "subject": "MSD 3(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-09-26",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "PBM",
    "subject": "PBM 5 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-09-26",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 7(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-09-26",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "SNCM",
    "subject": "SNCM 5(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-09-26",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "MSD",
    "subject": "MSD 4(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "IB",
    "subject": "IB 3(VB)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "ENV 3(RC)",
    "subject": "ENV 3(RC)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "TM 3(LRM)",
    "subject": "TM 3(LRM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "SNAB",
    "subject": "SNAB 5(PD)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 8(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "IT",
    "subject": "IT 5(DB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 8(AK3)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 8(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 8(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 7(AK1)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "ENV 4(RC)",
    "subject": "ENV 4(RC)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "MSD",
    "subject": "MSD 5(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "NPD",
    "subject": "NPD 3(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "IT",
    "subject": "IT 6(DB)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "IB",
    "subject": "IB 4(VB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 9(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "TM 4(LRM)",
    "subject": "TM 4(LRM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 7 (AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "SNAB",
    "subject": "SNAB 6(PD)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "PBM",
    "subject": "PBM 6 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 9(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 9(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-02",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "Gandhi Jayanti",
    "subject": "Gandhi Jayanti",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-04-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "NPD",
    "subject": "NPD 4(AT)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-04-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 8 (AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-04-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "IMC",
    "subject": "IMC 1(GRVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-04-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "SNAB",
    "subject": "SNAB 7(PD)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Sunday",
    "slot": "12:30",
    "courseId": "IMC",
    "subject": "IMC 3(GRVF)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Sunday",
    "slot": "12:30",
    "courseId": "IMC",
    "subject": "IMC 4(GRVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-05",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 9 (AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-05",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 9(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-05",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "TM 6(LRM)",
    "subject": "TM 6(LRM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-05",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "IMC",
    "subject": "IMC 5(GRVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-07-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "IT",
    "subject": "IT 7(DB)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-07-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "ENV 5(RC)",
    "subject": "ENV 5(RC)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-07-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 8(AK1)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-07-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "PBM",
    "subject": "PBM 7 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-07-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "NPD",
    "subject": "NPD 5(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "SNAB",
    "subject": "SNAB 8(PD)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "TM 5(LRM)",
    "subject": "TM 5(LRM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 10(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "MSD",
    "subject": "MSD 6(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "SNCM",
    "subject": "SNCM 6(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "IB",
    "subject": "IB 5(VB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 10(SV)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 10(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "IB",
    "subject": "IB 6(VB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "IT",
    "subject": "IT 8(DB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "ENV 6(RC)",
    "subject": "ENV 6(RC)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "NPD",
    "subject": "NPD 6(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 10 (AY)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 10(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 11(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "MBFM",
    "subject": "MBFM 1(CSVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "TM 7(LRM)",
    "subject": "TM 7(LRM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-09-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 9(AK1)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-09-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "MBFM",
    "subject": "MBFM 3(CSVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-09-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "MSD",
    "subject": "MSD 7(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-09-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "SNCM",
    "subject": "SNCM 7(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-09-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "IT",
    "subject": "IT 9(DB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-09-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "IB",
    "subject": "IB 7(VB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "IT",
    "subject": "IT 10(DB)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 11 (AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "IMC",
    "subject": "IMC 7(GRVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 11(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 11(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 11(AK3)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "IMC",
    "subject": "IMC 9(GRVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "SNCM",
    "subject": "SNCM 8(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "MSD",
    "subject": "MSD 8(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "PBM",
    "subject": "PBM 8 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "IMC",
    "subject": "IMC 11(GRVF)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 10(AK1)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 12(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "ENV 7(RC)",
    "subject": "ENV 7(RC)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "TM 8(LRM)",
    "subject": "TM 8(LRM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "SNAB",
    "subject": "SNAB 9(PD)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "NPD",
    "subject": "NPD 7(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-15",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 12 (AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-15",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 12(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-15",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 12(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-15",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "PBM",
    "subject": "PBM 9 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-15",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 13(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 11(AK1)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "MSD",
    "subject": "MSD 9(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "SNCM",
    "subject": "SNCM 9(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "IB",
    "subject": "IB 8(VB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 12(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "MBFM",
    "subject": "MBFM 5(CSVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "NPD",
    "subject": "NPD 8(AT)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "MBFM",
    "subject": "MBFM 7(CSVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "ENV 8(RC)",
    "subject": "ENV 8(RC)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 13(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 13(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "PBM",
    "subject": "PBM 10 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-12-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 12(AK1)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-12-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "SNAB",
    "subject": "SNAB 10(PD)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-12-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 13(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-12-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 13 (AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-12-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "MSD",
    "subject": "MSD 10(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-12-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "SNCM",
    "subject": "SNCM 10(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-20",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "Dussehra",
    "subject": "Dussehra",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-09-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "TM 9(LRM)",
    "subject": "TM 9(LRM)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-09-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "IB",
    "subject": "IB 9(VB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-09-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "NPD",
    "subject": "NPD 9(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-09-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "PBM",
    "subject": "PBM 11 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-09-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 14(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-09-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 14(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "SNAB",
    "subject": "SNAB 11(PD)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 14 (AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 14(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "PBM",
    "subject": "PBM 12 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "NPD",
    "subject": "NPD 10(AT)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 14(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "ENV 9(RC)",
    "subject": "ENV 9(RC)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 13(AK1)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "MBFM",
    "subject": "MBFM 8(CSVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "CSY",
    "subject": "CSY 1(ACVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "CSY",
    "subject": "CSY 2(ACVF)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "CSY",
    "subject": "CSY 3(ACVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "MBFM",
    "subject": "MBFM 10(CSVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "IB",
    "subject": "IB 10(VB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "TM 10(LRM)",
    "subject": "TM 10(LRM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 15 (AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "MSD",
    "subject": "MSD 11(AT)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "SNCM",
    "subject": "SNCM 11(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "SNAB",
    "subject": "SNAB 12(PD)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 15(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "NPD",
    "subject": "NPD 11(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 15(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-11-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "ENV 10(RC)",
    "subject": "ENV 10(RC)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-27",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "PBM",
    "subject": "PBM 13 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-27",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 15(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-27",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 15(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-27",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "TM 11(LRM)",
    "subject": "TM 11(LRM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-27",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 14(AK1)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-27",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "IB",
    "subject": "IB 11(VB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-28",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 16(AP2)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-28",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "ENV 11(RC)",
    "subject": "ENV 11(RC)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-28",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "NPD",
    "subject": "NPD 13(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-28",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "MSD",
    "subject": "MSD 12(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-28",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "SNCM",
    "subject": "SNCM 12(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-28",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "ENV 12(RC)",
    "subject": "ENV 12(RC)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-12-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "TM 12(LRM)",
    "subject": "TM 12(LRM)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-12-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 16(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-12-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 16 (AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-12-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "IB",
    "subject": "IB 12(VB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-12-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "SNAB",
    "subject": "SNAB 13(PD)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-30",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "PBM",
    "subject": "PBM 14 (AVT)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-30",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 15(AK1)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-30",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 17(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-30",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "IB",
    "subject": "IB 13(VB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-10-30",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "MBFM",
    "subject": "MBFM 11(CSVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-12-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "IMC",
    "subject": "IMC 12(GRVF)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-12-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "IMC",
    "subject": "IMC 13(GRVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-12-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "MBFM",
    "subject": "MBFM 14(CSVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-12-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "SNAB",
    "subject": "SNAB 14(PD)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-12-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "ENV 13(RC)",
    "subject": "ENV 13(RC)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-12-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "NPD",
    "subject": "NPD 12(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-01",
    "day": "Sunday",
    "slot": "12:30",
    "courseId": "IMC",
    "subject": "IMC 14(GRVF)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-01",
    "day": "Sunday",
    "slot": "12:30",
    "courseId": "IMC",
    "subject": "IMC 15(GRVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-02",
    "day": "Monday",
    "slot": "13:30",
    "courseId": "MSS",
    "subject": "MSS 17 (AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-02",
    "day": "Monday",
    "slot": "13:30",
    "courseId": "IMC",
    "subject": "IMC 16(GRVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-02",
    "day": "Monday",
    "slot": "13:30",
    "courseId": "CSY",
    "subject": "CSY 4(ACVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-02",
    "day": "Monday",
    "slot": "13:30",
    "courseId": "GSEC",
    "subject": "GSEC 16(AK1)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-02",
    "day": "Monday",
    "slot": "13:30",
    "courseId": "ENV 14(RC)",
    "subject": "ENV 14(RC)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Tuesday",
    "slot": "13:30",
    "courseId": "CSY",
    "subject": "CSY 6(ACVF)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Tuesday",
    "slot": "13:30",
    "courseId": "MSD",
    "subject": "MSD 13(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Tuesday",
    "slot": "13:30",
    "courseId": "SNCM",
    "subject": "SNCM 13(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Tuesday",
    "slot": "13:30",
    "courseId": "AAB",
    "subject": "AAB 17(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Tuesday",
    "slot": "13:30",
    "courseId": "PBM",
    "subject": "PBM 15 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-04",
    "day": "Wednesday",
    "slot": "13:30",
    "courseId": "PFWM",
    "subject": "PFWM 16(SV)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-04",
    "day": "Wednesday",
    "slot": "13:30",
    "courseId": "TQMS",
    "subject": "TQMS 16(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-04",
    "day": "Wednesday",
    "slot": "13:30",
    "courseId": "TM 13(LRM)",
    "subject": "TM 13(LRM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-04",
    "day": "Wednesday",
    "slot": "13:30",
    "courseId": "IB",
    "subject": "IB 14(VB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-04",
    "day": "Wednesday",
    "slot": "13:30",
    "courseId": "SNAB",
    "subject": "SNAB 15(PD)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-04",
    "day": "Wednesday",
    "slot": "13:30",
    "courseId": "FIS",
    "subject": "FIS 18(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-04",
    "day": "Wednesday",
    "slot": "13:30",
    "courseId": "NPD",
    "subject": "NPD 14(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-05",
    "day": "Thursday",
    "slot": "13:30",
    "courseId": "ENV 15(RC)",
    "subject": "ENV 15(RC)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-05",
    "day": "Thursday",
    "slot": "13:30",
    "courseId": "GSEC",
    "subject": "GSEC 17(AK1)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-05",
    "day": "Thursday",
    "slot": "13:30",
    "courseId": "MSS",
    "subject": "MSS 18 (AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-06",
    "day": "Friday",
    "slot": "13:30",
    "courseId": "NPD",
    "subject": "NPD 15(AT)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-06",
    "day": "Friday",
    "slot": "13:30",
    "courseId": "MSD",
    "subject": "MSD 14(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-06",
    "day": "Friday",
    "slot": "13:30",
    "courseId": "SNCM",
    "subject": "SNCM 14(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-06",
    "day": "Friday",
    "slot": "13:30",
    "courseId": "TM 14(LRM)",
    "subject": "TM 14(LRM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-06",
    "day": "Friday",
    "slot": "13:30",
    "courseId": "PBM",
    "subject": "PBM 16 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-06",
    "day": "Friday",
    "slot": "13:30",
    "courseId": "SNAB",
    "subject": "SNAB 16(PD)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-07",
    "day": "Saturday",
    "slot": "13:30",
    "courseId": "Diwali Break",
    "subject": "Diwali Break",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-13",
    "day": "Friday",
    "slot": "13:30",
    "courseId": "AAB",
    "subject": "AAB 18(AK3)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-13",
    "day": "Friday",
    "slot": "13:30",
    "courseId": "PBM",
    "subject": "PBM 17 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-13",
    "day": "Friday",
    "slot": "13:30",
    "courseId": "FIS",
    "subject": "FIS 19(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-13",
    "day": "Friday",
    "slot": "13:30",
    "courseId": "NPD",
    "subject": "NPD 16(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-13",
    "day": "Friday",
    "slot": "13:30",
    "courseId": "MBFM",
    "subject": "MBFM 15(CSVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-14",
    "day": "Saturday",
    "slot": "13:30",
    "courseId": "ENV 16(RC)",
    "subject": "ENV 16(RC)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-14",
    "day": "Saturday",
    "slot": "13:30",
    "courseId": "MBFM",
    "subject": "MBFM 17(CSVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-14",
    "day": "Saturday",
    "slot": "13:30",
    "courseId": "MSD",
    "subject": "MSD 15(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-14",
    "day": "Saturday",
    "slot": "13:30",
    "courseId": "SNCM",
    "subject": "SNCM 15(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-14",
    "day": "Saturday",
    "slot": "13:30",
    "courseId": "IB",
    "subject": "IB 15(VB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-14",
    "day": "Saturday",
    "slot": "13:30",
    "courseId": "PFWM",
    "subject": "PFWM 17(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-14",
    "day": "Saturday",
    "slot": "13:30",
    "courseId": "TQMS",
    "subject": "TQMS 17(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-16",
    "day": "Monday",
    "slot": "13:30",
    "courseId": "Foundation Day of IIM Rohtak",
    "subject": "Foundation Day of IIM Rohtak",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-17",
    "day": "Tuesday",
    "slot": "13:30",
    "courseId": "IMC",
    "subject": "IMC 17(GRVF)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-17",
    "day": "Tuesday",
    "slot": "13:30",
    "courseId": "IMC",
    "subject": "IMC 18(GRVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-17",
    "day": "Tuesday",
    "slot": "13:30",
    "courseId": "TM 15(LRM)",
    "subject": "TM 15(LRM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-17",
    "day": "Tuesday",
    "slot": "13:30",
    "courseId": "PBM",
    "subject": "PBM 18 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-17",
    "day": "Tuesday",
    "slot": "13:30",
    "courseId": "MSD",
    "subject": "MSD 16(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-17",
    "day": "Tuesday",
    "slot": "13:30",
    "courseId": "SNCM",
    "subject": "SNCM 16(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-18",
    "day": "Wednesday",
    "slot": "13:30",
    "courseId": "IMC",
    "subject": "IMC 19(GRVF)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-18",
    "day": "Wednesday",
    "slot": "13:30",
    "courseId": "IMC",
    "subject": "IMC 20(GRVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-18",
    "day": "Wednesday",
    "slot": "13:30",
    "courseId": "SNAB",
    "subject": "SNAB 17(PD)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-18",
    "day": "Wednesday",
    "slot": "13:30",
    "courseId": "MSS",
    "subject": "MSS 19 (AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-18",
    "day": "Wednesday",
    "slot": "13:30",
    "courseId": "IB",
    "subject": "IB 16(VB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2025-11-19",
    "day": "Wednesday",
    "slot": "13:30",
    "courseId": "MSD",
    "subject": "MSD 17(AT)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2025-11-19",
    "day": "Wednesday",
    "slot": "13:30",
    "courseId": "SNCM",
    "subject": "SNCM 17(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Scheduled",
    "slot": "08:45 - 10:00",
    "courseId": "Date",
    "subject": "Date",
    "room": "Section C: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2025-11-19",
    "day": "Wednesday",
    "slot": "13:30",
    "courseId": "PFWM",
    "subject": "PFWM 18(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2025-11-19",
    "day": "Wednesday",
    "slot": "13:30",
    "courseId": "TQMS",
    "subject": "TQMS 18(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2025-11-19",
    "day": "Wednesday",
    "slot": "13:30",
    "courseId": "GSEC",
    "subject": "GSEC 18(AK1)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2025-11-19",
    "day": "Wednesday",
    "slot": "13:30",
    "courseId": "TM 16(LRM)",
    "subject": "TM 16(LRM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2025-11-19",
    "day": "Wednesday",
    "slot": "13:30",
    "courseId": "NPD",
    "subject": "NPD 17(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-20",
    "day": "Friday",
    "slot": "13:30",
    "courseId": "IB",
    "subject": "IB 17(VB)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-20",
    "day": "Friday",
    "slot": "13:30",
    "courseId": "ENV 17(RC)",
    "subject": "ENV 17(RC)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-20",
    "day": "Friday",
    "slot": "13:30",
    "courseId": "PBM",
    "subject": "PBM 19 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-20",
    "day": "Friday",
    "slot": "13:30",
    "courseId": "CSY",
    "subject": "CSY 7(ACVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-20",
    "day": "Friday",
    "slot": "13:30",
    "courseId": "MBFM",
    "subject": "MBFM 18(CSVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-21",
    "day": "Saturday",
    "slot": "13:30",
    "courseId": "FIS",
    "subject": "FIS 20(AP2)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-21",
    "day": "Saturday",
    "slot": "13:30",
    "courseId": "MBFM",
    "subject": "MBFM 20(CSVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-21",
    "day": "Saturday",
    "slot": "13:30",
    "courseId": "CSY",
    "subject": "CSY 8(ACVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-21",
    "day": "Saturday",
    "slot": "13:30",
    "courseId": "SNAB",
    "subject": "SNAB 18(PD)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-21",
    "day": "Saturday",
    "slot": "13:30",
    "courseId": "TM 17(LRM)",
    "subject": "TM 17(LRM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-21",
    "day": "Saturday",
    "slot": "13:30",
    "courseId": "AAB",
    "subject": "AAB 19(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Monday",
    "slot": "13:30",
    "courseId": "CSY",
    "subject": "CSY 10(ACVF)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Monday",
    "slot": "13:30",
    "courseId": "MSS",
    "subject": "MSS 20 (AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Monday",
    "slot": "13:30",
    "courseId": "MSD",
    "subject": "MSD 18(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Monday",
    "slot": "13:30",
    "courseId": "SNCM",
    "subject": "SNCM 18(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Monday",
    "slot": "13:30",
    "courseId": "ENV 18(RC)",
    "subject": "ENV 18(RC)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-10-01",
    "day": "Monday",
    "slot": "13:30",
    "courseId": "GSEC",
    "subject": "GSEC 19(AK1)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-24",
    "day": "Tuesday",
    "slot": "13:30",
    "courseId": "Guru Nanak's Birthday",
    "subject": "Guru Nanak's Birthday",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-25",
    "day": "Wednesday",
    "slot": "13:30",
    "courseId": "SNCM",
    "subject": "SNCM 19(MM)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-25",
    "day": "Wednesday",
    "slot": "13:30",
    "courseId": "MSD",
    "subject": "MSD 19(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-25",
    "day": "Wednesday",
    "slot": "13:30",
    "courseId": "SNAB",
    "subject": "SNAB 19(PD)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-25",
    "day": "Wednesday",
    "slot": "13:30",
    "courseId": "NPD",
    "subject": "NPD 18(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-25",
    "day": "Wednesday",
    "slot": "13:30",
    "courseId": "PFWM",
    "subject": "PFWM 19(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-25",
    "day": "Wednesday",
    "slot": "13:30",
    "courseId": "TQMS",
    "subject": "TQMS 19(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-26",
    "day": "Thursday",
    "slot": "13:30",
    "courseId": "ENV 19(RC)",
    "subject": "ENV 19(RC)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-26",
    "day": "Thursday",
    "slot": "13:30",
    "courseId": "PBM",
    "subject": "PBM 20 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-26",
    "day": "Thursday",
    "slot": "13:30",
    "courseId": "TM 18(LRM)",
    "subject": "TM 18(LRM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-26",
    "day": "Thursday",
    "slot": "13:30",
    "courseId": "IB",
    "subject": "IB 18(VB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-26",
    "day": "Thursday",
    "slot": "13:30",
    "courseId": "AAB",
    "subject": "AAB 20(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-27",
    "day": "Friday",
    "slot": "13:30",
    "courseId": "PFWM",
    "subject": "PFWM 20(SV)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-27",
    "day": "Friday",
    "slot": "13:30",
    "courseId": "TQMS",
    "subject": "TQMS 20(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-27",
    "day": "Friday",
    "slot": "13:30",
    "courseId": "GSEC",
    "subject": "GSEC 20(AK1)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-27",
    "day": "Friday",
    "slot": "13:30",
    "courseId": "SNAB",
    "subject": "SNAB 20(PD)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-27",
    "day": "Friday",
    "slot": "13:30",
    "courseId": "NPD",
    "subject": "NPD 19(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-27",
    "day": "Friday",
    "slot": "13:30",
    "courseId": "TM 19(LRM)",
    "subject": "TM 19(LRM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-28",
    "day": "Saturday",
    "slot": "13:30",
    "courseId": "IB",
    "subject": "IB 19(VB)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-28",
    "day": "Saturday",
    "slot": "13:30",
    "courseId": "MSD",
    "subject": "MSD 20(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-28",
    "day": "Saturday",
    "slot": "13:30",
    "courseId": "SNCM",
    "subject": "SNCM 20(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-30",
    "day": "Monday",
    "slot": "13:30",
    "courseId": "IB",
    "subject": "IB 20(VB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-30",
    "day": "Monday",
    "slot": "13:30",
    "courseId": "TM 20(LRM)",
    "subject": "TM 20(LRM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-30",
    "day": "Monday",
    "slot": "13:30",
    "courseId": "NPD",
    "subject": "NPD 20(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-11-30",
    "day": "Monday",
    "slot": "13:30",
    "courseId": "ENV 20(RC)",
    "subject": "ENV 20(RC)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "CSY",
    "subject": "CSY 3(ACVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "MBFM",
    "subject": "MBFM 10(CSVF)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "IB",
    "subject": "IB 10(VB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "TM 10(LRM)",
    "subject": "TM 10(LRM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 15 (AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Scheduled",
    "slot": "08:45 - 10:00",
    "courseId": "Date",
    "subject": "Date",
    "room": "Section C: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Scheduled",
    "slot": "08:45 - 10:00",
    "courseId": "Sections",
    "subject": "Sections",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Scheduled",
    "slot": "08:45 - 10:00",
    "courseId": "LUNCH",
    "subject": "LUNCH",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Scheduled",
    "slot": "08:45 - 10:00",
    "courseId": "Course",
    "subject": "Course",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Scheduled",
    "slot": "08:45 - 10:00",
    "courseId": "Course Abb.",
    "subject": "Course Abb.",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Scheduled",
    "slot": "08:45 - 10:00",
    "courseId": "Name of the Faculty",
    "subject": "Name of the Faculty",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Scheduled",
    "slot": "08:45 - 10:00",
    "courseId": "Faculty Abb.",
    "subject": "Faculty Abb.",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Scheduled",
    "slot": "08:45 - 10:00",
    "courseId": "Credit",
    "subject": "Credit",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Scheduled",
    "slot": "08:45 - 10:00",
    "courseId": "Section",
    "subject": "Section",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "TM 1(LRM)",
    "subject": "TM 1(LRM)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "IT",
    "subject": "IT 1(DB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 1(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 1(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 1(AK1)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 1(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 1(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "Dr. Ashwani Kumar",
    "subject": "Dr. Ashwani Kumar",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "AK1",
    "subject": "AK1",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-09-13",
    "day": "Sunday",
    "slot": "12:30",
    "courseId": "Fixed Income Securities",
    "subject": "Fixed Income Securities",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-09-13",
    "day": "Sunday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-09-13",
    "day": "Sunday",
    "slot": "12:30",
    "courseId": "Dr. Amit Pandey",
    "subject": "Dr. Amit Pandey",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-09-13",
    "day": "Sunday",
    "slot": "12:30",
    "courseId": "AP2",
    "subject": "AP2",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 2(CPG)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 2(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 2(AK1)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 2(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 2(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 1(AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "Dr Surbhi Verma",
    "subject": "Dr Surbhi Verma",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "SV",
    "subject": "SV",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "IB",
    "subject": "IB 1(VB)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "PBM",
    "subject": "PBM 1 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "ENV 1(RC)",
    "subject": "ENV 1(RC)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "NPD",
    "subject": "NPD 1(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "MSD",
    "subject": "MSD 1(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "SNCM",
    "subject": "SNCM 1(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "Markstrat Simulations (Core)",
    "subject": "Markstrat Simulations (Core)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "Dr. Abhishek Yadav (A&D), Dr. Harmanjit Singh (C), Dr. Archit V. Tapar (B)",
    "subject": "Dr. Abhishek Yadav (A&D), Dr. Harmanjit Singh (C), Dr. Archit V. Tapar (B)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-01-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "AY,HS,AVT",
    "subject": "AY,HS,AVT",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 2(AY)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 3(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 3(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 3(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 3(AK1)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 3(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "Mergers and Acquisitions",
    "subject": "Mergers and Acquisitions",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "M & A",
    "subject": "M & A",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "Dr. Deepali Dhingra",
    "subject": "Dr. Deepali Dhingra",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "DD",
    "subject": "DD",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "ENV 2(RC)",
    "subject": "ENV 2(RC)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "SNAB",
    "subject": "SNAB 1(PD)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "IT",
    "subject": "IT 2(DB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 3(AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "IB",
    "subject": "IB 2(VB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "TM 2(LRM)",
    "subject": "TM 2(LRM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "Strategies for New Age Businesses",
    "subject": "Strategies for New Age Businesses",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "Dr. Pranav Dharmani",
    "subject": "Dr. Pranav Dharmani",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "PD",
    "subject": "PD",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "IT",
    "subject": "IT 3(DB)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 4(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "PBM",
    "subject": "PBM 2 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 4(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "NPD",
    "subject": "NPD 2(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 4(AK1)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "SNCM",
    "subject": "SNCM 2(MM)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "MSD",
    "subject": "MSD 2(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 4 (AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 4(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-02-01",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 4(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-05-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 5 (AY)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-05-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 5(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-05-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 5(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-05-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 5(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-05-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "PBM",
    "subject": "PBM 3 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-05-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 5(AK1)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-05-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 5(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-05-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "SNCM",
    "subject": "SNCM 3(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-05-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "SNAB",
    "subject": "SNAB 2(PD)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-05-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 6(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-07-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 7(CPG)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-07-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 6(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-07-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 6(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-07-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "SNAB",
    "subject": "SNAB 3(PD)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-07-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "IT",
    "subject": "IT 4(DB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-04-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "PBM",
    "subject": "PBM 4 (AVT)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-04-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 6(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-04-01",
    "day": "Thursday",
    "slot": "12:30",
    "courseId": "SNCM",
    "subject": "SNCM 4(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-04-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "SNAB",
    "subject": "SNAB 4(PD)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-04-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 6(AK1)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-04-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 7(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-04-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 7(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-04-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 6 (AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-04-01",
    "day": "Friday",
    "slot": "12:30",
    "courseId": "MSD",
    "subject": "MSD 3(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-09-26",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "PBM",
    "subject": "PBM 5 (AVT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-09-26",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 7(AK3)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-09-26",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "SNCM",
    "subject": "SNCM 5(MM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-09-26",
    "day": "Saturday",
    "slot": "12:30",
    "courseId": "MSD",
    "subject": "MSD 4(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-06-12",
    "day": "Friday",
    "slot": "08:45 - 10:00",
    "courseId": "CV Sec-A",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 02",
    "instructor": "SA|1"
  },
  {
    "dateKey": "2026-06-12",
    "day": "Friday",
    "slot": "16:05 - 17:20",
    "courseId": "FADT",
    "subject": "Fundamentals and Applications of Design Thinking (FADT)",
    "room": "LR 02",
    "instructor": "RSY|1"
  },
  {
    "dateKey": "2026-06-12",
    "day": "Friday",
    "slot": "17:40 - 18:55",
    "courseId": "FSA",
    "subject": "Financial Statement Analysis (FSA)",
    "room": "LR 02",
    "instructor": "SB1|1"
  },
  {
    "dateKey": "2026-06-12",
    "day": "Friday",
    "slot": "19:15 - 20:30",
    "courseId": "PWMP",
    "subject": "Playing to Win Market and Power (PWMP)",
    "room": "LR 02",
    "instructor": "SB2|1"
  },
  {
    "dateKey": "2026-06-12",
    "day": "Friday",
    "slot": "20:50 - 22:05",
    "courseId": "L&D",
    "subject": "L&D",
    "room": "LR 02",
    "instructor": "SY|1"
  },
  {
    "dateKey": "2026-06-12",
    "day": "Friday",
    "slot": "08:45 - 10:00",
    "courseId": "PM",
    "subject": "Project Management (PM)",
    "room": "LR 07",
    "instructor": "AS1|1"
  },
  {
    "dateKey": "2026-06-12",
    "day": "Friday",
    "slot": "14:30 - 15:45",
    "courseId": "CV Sec-B",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 07",
    "instructor": "SA|1"
  },
  {
    "dateKey": "2026-06-12",
    "day": "Friday",
    "slot": "16:05 - 17:20",
    "courseId": "IBS",
    "subject": "International Business Strategies (IBS)",
    "room": "LR 07",
    "instructor": "PD|1"
  },
  {
    "dateKey": "2026-06-12",
    "day": "Friday",
    "slot": "17:40 - 18:55",
    "courseId": "PS",
    "subject": "Pricing Strategies (PS)",
    "room": "LR 07",
    "instructor": "HS|1"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "IB",
    "subject": "IB 3(VB)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "ENV 3(RC)",
    "subject": "ENV 3(RC)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "TM 3(LRM)",
    "subject": "TM 3(LRM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "SNAB",
    "subject": "SNAB 5(PD)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 8(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-03-01",
    "day": "Monday",
    "slot": "12:30",
    "courseId": "IT",
    "subject": "IT 5(DB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "AAB",
    "subject": "AAB 8(AK3)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "TQMS",
    "subject": "TQMS 8(CPG)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "PFWM",
    "subject": "PFWM 8(SV)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "GSEC",
    "subject": "GSEC 7(AK1)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "ENV 4(RC)",
    "subject": "ENV 4(RC)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "MSD",
    "subject": "MSD 5(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-08-01",
    "day": "Tuesday",
    "slot": "12:30",
    "courseId": "NPD",
    "subject": "NPD 3(AT)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "IT",
    "subject": "IT 6(DB)",
    "room": "Section D: LR - 06",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "IB",
    "subject": "IB 4(VB)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "FIS",
    "subject": "FIS 9(AP2)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "TM 4(LRM)",
    "subject": "TM 4(LRM)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "MSS",
    "subject": "MSS 7 (AY)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2001-06-01",
    "day": "Wednesday",
    "slot": "12:30",
    "courseId": "SNAB",
    "subject": "SNAB 6(PD)",
    "room": "LR 07",
    "instructor": "Faculty"
  },
  {
    "dateKey": "2026-06-12",
    "day": "Friday",
    "slot": "19:15 - 20:30",
    "courseId": "SHRM",
    "subject": "Strategic Human Resource Management (SHRM)",
    "room": "LR 07",
    "instructor": "AP1|1"
  },
  {
    "dateKey": "2026-06-12",
    "day": "Friday",
    "slot": "20:50 - 22:05",
    "courseId": "MFIS",
    "subject": "Management of Financial Institutions and Services (MFIS)",
    "room": "LR 07",
    "instructor": "VB|1"
  },
  {
    "dateKey": "2026-06-12",
    "day": "Friday",
    "slot": "08:45 - 10:00",
    "courseId": "PCM",
    "subject": "Performance and Compensation Management (PCM)",
    "room": "LR 06",
    "instructor": "RSY|1"
  },
  {
    "dateKey": "2026-06-12",
    "day": "Friday",
    "slot": "20:50 - 22:05",
    "courseId": "DBM",
    "subject": "Digital Business Models (DBM)",
    "room": "LR 06",
    "instructor": "SS|1"
  },
  {
    "dateKey": "2026-06-13",
    "day": "Saturday",
    "slot": "08:45 - 10:00",
    "courseId": "IAPM",
    "subject": "Investment Analysis & Portfolio Management (IAPM)",
    "room": "LR 02",
    "instructor": "AP2|1"
  },
  {
    "dateKey": "2026-06-13",
    "day": "Saturday",
    "slot": "14:30 - 15:45",
    "courseId": "GBS Sec-A",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 02",
    "instructor": "PD|1"
  },
  {
    "dateKey": "2026-06-13",
    "day": "Saturday",
    "slot": "17:40 - 18:55",
    "courseId": "SCM Sec-A",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 02",
    "instructor": "PP|1"
  },
  {
    "dateKey": "2026-06-13",
    "day": "Saturday",
    "slot": "20:50 - 22:05",
    "courseId": "TA",
    "subject": "Talent Acquisition (TA)",
    "room": "LR 02",
    "instructor": "RSY|1"
  },
  {
    "dateKey": "2026-06-13",
    "day": "Saturday",
    "slot": "22:25 - 23:40",
    "courseId": "FM",
    "subject": "Financial Modelling (FM)",
    "room": "LR 02",
    "instructor": "AKM|1"
  },
  {
    "dateKey": "2026-06-13",
    "day": "Saturday",
    "slot": "08:45 - 10:00",
    "courseId": "SDM",
    "subject": "Sales and Distribution Management (SDM)",
    "room": "LR 07",
    "instructor": "AS2|1"
  },
  {
    "dateKey": "2026-06-13",
    "day": "Saturday",
    "slot": "14:30 - 15:45",
    "courseId": "AIDMD",
    "subject": "AI-Driven Marketing Decision Making (AIDMD)",
    "room": "LR 07",
    "instructor": "AK2|1"
  },
  {
    "dateKey": "2026-06-13",
    "day": "Saturday",
    "slot": "16:05 - 17:20",
    "courseId": "GBS Sec-B",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 07",
    "instructor": "PD|1"
  },
  {
    "dateKey": "2026-06-13",
    "day": "Saturday",
    "slot": "17:40 - 18:55",
    "courseId": "SC",
    "subject": "Strategic Consulting (SC)",
    "room": "LR 07",
    "instructor": "DD|1"
  },
  {
    "dateKey": "2026-06-13",
    "day": "Saturday",
    "slot": "19:15 - 20:30",
    "courseId": "SCM Sec-B",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 07",
    "instructor": "PP|1"
  },
  {
    "dateKey": "2026-06-13",
    "day": "Saturday",
    "slot": "14:30 - 15:45",
    "courseId": "GBS Sec-C",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "RC|1"
  },
  {
    "dateKey": "2026-06-13",
    "day": "Saturday",
    "slot": "16:05 - 17:20",
    "courseId": "GBS Sec-D",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "DD|1"
  },
  {
    "dateKey": "2026-06-15",
    "day": "Monday",
    "slot": "08:45 - 10:00",
    "courseId": "IMDM",
    "subject": "Insurance and Managerial Decision Making (IMDM)",
    "room": "LR 02",
    "instructor": "SB2|1"
  },
  {
    "dateKey": "2026-06-15",
    "day": "Monday",
    "slot": "14:30 - 15:45",
    "courseId": "CV Sec-A",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 02",
    "instructor": "SA|2"
  },
  {
    "dateKey": "2026-06-15",
    "day": "Monday",
    "slot": "17:40 - 18:55",
    "courseId": "FADT",
    "subject": "Fundamentals and Applications of Design Thinking (FADT)",
    "room": "LR 02",
    "instructor": "RSY|2"
  },
  {
    "dateKey": "2026-06-15",
    "day": "Monday",
    "slot": "19:15 - 20:30",
    "courseId": "L&D",
    "subject": "L&D",
    "room": "LR 02",
    "instructor": "SY|2"
  },
  {
    "dateKey": "2026-06-15",
    "day": "Monday",
    "slot": "20:50 - 22:05",
    "courseId": "FM",
    "subject": "Financial Modelling (FM)",
    "room": "LR 02",
    "instructor": "AKM|2"
  },
  {
    "dateKey": "2026-06-15",
    "day": "Monday",
    "slot": "22:25 - 23:40",
    "courseId": "FSA",
    "subject": "Financial Statement Analysis (FSA)",
    "room": "LR 02",
    "instructor": "SB1|2"
  },
  {
    "dateKey": "2026-06-15",
    "day": "Monday",
    "slot": "14:30 - 15:45",
    "courseId": "PM",
    "subject": "Project Management (PM)",
    "room": "LR 07",
    "instructor": "AS1|2"
  },
  {
    "dateKey": "2026-06-15",
    "day": "Monday",
    "slot": "16:05 - 17:20",
    "courseId": "CV Sec-B",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 07",
    "instructor": "SA|2"
  },
  {
    "dateKey": "2026-06-15",
    "day": "Monday",
    "slot": "17:40 - 18:55",
    "courseId": "IBS",
    "subject": "International Business Strategies (IBS)",
    "room": "LR 07",
    "instructor": "PD|2"
  },
  {
    "dateKey": "2026-06-15",
    "day": "Monday",
    "slot": "19:15 - 20:30",
    "courseId": "MFIS",
    "subject": "Management of Financial Institutions and Services (MFIS)",
    "room": "LR 07",
    "instructor": "VB|2"
  },
  {
    "dateKey": "2026-06-15",
    "day": "Monday",
    "slot": "22:25 - 23:40",
    "courseId": "PS",
    "subject": "Pricing Strategies (PS)",
    "room": "LR 07",
    "instructor": "HS|2"
  },
  {
    "dateKey": "2026-06-15",
    "day": "Monday",
    "slot": "14:30 - 15:45",
    "courseId": "PCM",
    "subject": "Performance and Compensation Management (PCM)",
    "room": "LR 06",
    "instructor": "RSY|2"
  },
  {
    "dateKey": "2026-06-15",
    "day": "Monday",
    "slot": "19:15 - 20:30",
    "courseId": "DBM",
    "subject": "Digital Business Models (DBM)",
    "room": "LR 06",
    "instructor": "SS|2"
  },
  {
    "dateKey": "2026-06-16",
    "day": "Tuesday",
    "slot": "08:45 - 10:00",
    "courseId": "PWMP",
    "subject": "Playing to Win Market and Power (PWMP)",
    "room": "LR 02",
    "instructor": "SB2|2"
  },
  {
    "dateKey": "2026-06-16",
    "day": "Tuesday",
    "slot": "14:30 - 15:45",
    "courseId": "FSA",
    "subject": "Financial Statement Analysis (FSA)",
    "room": "LR 02",
    "instructor": "SB1|3"
  },
  {
    "dateKey": "2026-06-16",
    "day": "Tuesday",
    "slot": "16:05 - 17:20",
    "courseId": "GBS Sec-A",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 02",
    "instructor": "PD|2"
  },
  {
    "dateKey": "2026-06-16",
    "day": "Tuesday",
    "slot": "19:15 - 20:30",
    "courseId": "SCM Sec-A",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 02",
    "instructor": "PP|2"
  },
  {
    "dateKey": "2026-06-16",
    "day": "Tuesday",
    "slot": "08:45 - 10:00",
    "courseId": "SHRM",
    "subject": "Strategic Human Resource Management (SHRM)",
    "room": "LR 07",
    "instructor": "AP1|2"
  },
  {
    "dateKey": "2026-06-16",
    "day": "Tuesday",
    "slot": "14:30 - 15:45",
    "courseId": "PS",
    "subject": "Pricing Strategies (PS)",
    "room": "LR 07",
    "instructor": "HS|3"
  },
  {
    "dateKey": "2026-06-16",
    "day": "Tuesday",
    "slot": "16:05 - 17:20",
    "courseId": "AIDMD",
    "subject": "AI-Driven Marketing Decision Making (AIDMD)",
    "room": "LR 07",
    "instructor": "AK2|2"
  },
  {
    "dateKey": "2026-06-16",
    "day": "Tuesday",
    "slot": "17:40 - 18:55",
    "courseId": "GBS Sec-B",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 07",
    "instructor": "PD|2"
  },
  {
    "dateKey": "2026-06-16",
    "day": "Tuesday",
    "slot": "19:15 - 20:30",
    "courseId": "SC",
    "subject": "Strategic Consulting (SC)",
    "room": "LR 07",
    "instructor": "DD|2"
  },
  {
    "dateKey": "2026-06-16",
    "day": "Tuesday",
    "slot": "20:50 - 22:05",
    "courseId": "SCM Sec-B",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 07",
    "instructor": "PP|2"
  },
  {
    "dateKey": "2026-06-16",
    "day": "Tuesday",
    "slot": "22:25 - 23:40",
    "courseId": "BA Sec-B",
    "subject": "Business Analytics (BA)",
    "room": "LR 07",
    "instructor": "PRS|1"
  },
  {
    "dateKey": "2026-06-16",
    "day": "Tuesday",
    "slot": "16:05 - 17:20",
    "courseId": "GBS Sec-C",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "RC|2"
  },
  {
    "dateKey": "2026-06-16",
    "day": "Tuesday",
    "slot": "17:40 - 18:55",
    "courseId": "GBS Sec-D",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "DD|2"
  },
  {
    "dateKey": "2026-06-17",
    "day": "Wednesday",
    "slot": "08:45 - 10:00",
    "courseId": "FM",
    "subject": "Financial Modelling (FM)",
    "room": "LR 02",
    "instructor": "AKM|3"
  },
  {
    "dateKey": "2026-06-17",
    "day": "Wednesday",
    "slot": "14:30 - 15:45",
    "courseId": "TA",
    "subject": "Talent Acquisition (TA)",
    "room": "LR 02",
    "instructor": "RSY|2"
  },
  {
    "dateKey": "2026-06-17",
    "day": "Wednesday",
    "slot": "16:05 - 17:20",
    "courseId": "BA Sec-A",
    "subject": "Business Analytics (BA)",
    "room": "LR 02",
    "instructor": "PRS|1"
  },
  {
    "dateKey": "2026-06-17",
    "day": "Wednesday",
    "slot": "20:50 - 22:05",
    "courseId": "IMDM",
    "subject": "Insurance and Managerial Decision Making (IMDM)",
    "room": "LR 02",
    "instructor": "SB2|2"
  },
  {
    "dateKey": "2026-06-17",
    "day": "Wednesday",
    "slot": "16:05 - 17:20",
    "courseId": "BGRI",
    "subject": "Business\u2013Government Relations in India (BGRI)",
    "room": "LR 07",
    "instructor": "RK|1"
  },
  {
    "dateKey": "2026-06-17",
    "day": "Wednesday",
    "slot": "17:40 - 18:55",
    "courseId": "BA Sec-B",
    "subject": "Business Analytics (BA)",
    "room": "LR 07",
    "instructor": "PRS|2"
  },
  {
    "dateKey": "2026-06-17",
    "day": "Wednesday",
    "slot": "19:15 - 20:30",
    "courseId": "SDM",
    "subject": "Sales and Distribution Management (SDM)",
    "room": "LR 07",
    "instructor": "AS2|2"
  },
  {
    "dateKey": "2026-06-17",
    "day": "Wednesday",
    "slot": "22:25 - 23:40",
    "courseId": "PCM",
    "subject": "Performance and Compensation Management (PCM)",
    "room": "LR 06",
    "instructor": "RSY|3"
  },
  {
    "dateKey": "2026-06-18",
    "day": "Thursday",
    "slot": "08:45 - 10:00",
    "courseId": "CB Sec-A",
    "subject": "Consumer Behaviour (CB)",
    "room": "LR 02",
    "instructor": "AY|1"
  },
  {
    "dateKey": "2026-06-18",
    "day": "Thursday",
    "slot": "16:05 - 17:20",
    "courseId": "CV Sec-A",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 02",
    "instructor": "SA|3"
  },
  {
    "dateKey": "2026-06-18",
    "day": "Thursday",
    "slot": "19:15 - 20:30",
    "courseId": "FADT",
    "subject": "Fundamentals and Applications of Design Thinking (FADT)",
    "room": "LR 02",
    "instructor": "RSY|3"
  },
  {
    "dateKey": "2026-06-18",
    "day": "Thursday",
    "slot": "20:50 - 22:05",
    "courseId": "FSA",
    "subject": "Financial Statement Analysis (FSA)",
    "room": "LR 02",
    "instructor": "SB1|4"
  },
  {
    "dateKey": "2026-06-18",
    "day": "Thursday",
    "slot": "22:25 - 23:40",
    "courseId": "PWMP",
    "subject": "Playing to Win Market and Power (PWMP)",
    "room": "LR 02",
    "instructor": "SB2|3"
  },
  {
    "dateKey": "2026-06-18",
    "day": "Thursday",
    "slot": "08:45 - 10:00",
    "courseId": "B2B",
    "subject": "B2B Marketing (B2B)",
    "room": "LR 07",
    "instructor": "MK|1"
  },
  {
    "dateKey": "2026-06-18",
    "day": "Thursday",
    "slot": "14:30 - 15:45",
    "courseId": "CB Sec-B",
    "subject": "Consumer Behaviour (CB)",
    "room": "LR 07",
    "instructor": "AY|1"
  },
  {
    "dateKey": "2026-06-18",
    "day": "Thursday",
    "slot": "16:05 - 17:20",
    "courseId": "PM",
    "subject": "Project Management (PM)",
    "room": "LR 07",
    "instructor": "AS1|3"
  },
  {
    "dateKey": "2026-06-18",
    "day": "Thursday",
    "slot": "17:40 - 18:55",
    "courseId": "CV Sec-B",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 07",
    "instructor": "SA|3"
  },
  {
    "dateKey": "2026-06-18",
    "day": "Thursday",
    "slot": "19:15 - 20:30",
    "courseId": "IBS",
    "subject": "International Business Strategies (IBS)",
    "room": "LR 07",
    "instructor": "PD|3"
  },
  {
    "dateKey": "2026-06-18",
    "day": "Thursday",
    "slot": "20:50 - 22:05",
    "courseId": "PS",
    "subject": "Pricing Strategies (PS)",
    "room": "LR 07",
    "instructor": "HS|4"
  },
  {
    "dateKey": "2026-06-18",
    "day": "Thursday",
    "slot": "22:25 - 23:40",
    "courseId": "SHRM",
    "subject": "Strategic Human Resource Management (SHRM)",
    "room": "LR 07",
    "instructor": "AP1|3"
  },
  {
    "dateKey": "2026-06-19",
    "day": "Friday",
    "slot": "08:45 - 10:00",
    "courseId": "GBS Sec-A",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 02",
    "instructor": "PD|3"
  },
  {
    "dateKey": "2026-06-19",
    "day": "Friday",
    "slot": "16:05 - 17:20",
    "courseId": "SCM Sec-A",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 02",
    "instructor": "PP|3"
  },
  {
    "dateKey": "2026-06-19",
    "day": "Friday",
    "slot": "19:15 - 20:30",
    "courseId": "MBPET",
    "subject": "Managing Business Processes with Emerging Technologies (MBPET)",
    "room": "LR 02",
    "instructor": "RN|1"
  },
  {
    "dateKey": "2026-06-19",
    "day": "Friday",
    "slot": "20:50 - 22:05",
    "courseId": "L&D",
    "subject": "L&D",
    "room": "LR 02",
    "instructor": "SY|3"
  },
  {
    "dateKey": "2026-06-19",
    "day": "Friday",
    "slot": "08:45 - 10:00",
    "courseId": "AIDMD",
    "subject": "AI-Driven Marketing Decision Making (AIDMD)",
    "room": "LR 07",
    "instructor": "AK2|3"
  },
  {
    "dateKey": "2026-06-19",
    "day": "Friday",
    "slot": "14:30 - 15:45",
    "courseId": "GBS Sec-B",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 07",
    "instructor": "PD|3"
  },
  {
    "dateKey": "2026-06-19",
    "day": "Friday",
    "slot": "16:05 - 17:20",
    "courseId": "SC",
    "subject": "Strategic Consulting (SC)",
    "room": "LR 07",
    "instructor": "DD|3"
  },
  {
    "dateKey": "2026-06-19",
    "day": "Friday",
    "slot": "17:40 - 18:55",
    "courseId": "SCM Sec-B",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 07",
    "instructor": "PP|3"
  },
  {
    "dateKey": "2026-06-19",
    "day": "Friday",
    "slot": "20:50 - 22:05",
    "courseId": "MFIS",
    "subject": "Management of Financial Institutions and Services (MFIS)",
    "room": "LR 07",
    "instructor": "VB|3"
  },
  {
    "dateKey": "2026-06-19",
    "day": "Friday",
    "slot": "22:25 - 23:40",
    "courseId": "SDM",
    "subject": "Sales and Distribution Management (SDM)",
    "room": "LR 07",
    "instructor": "AS2|3"
  },
  {
    "dateKey": "2026-06-19",
    "day": "Friday",
    "slot": "08:45 - 10:00",
    "courseId": "GBS Sec-C",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "RC|3"
  },
  {
    "dateKey": "2026-06-19",
    "day": "Friday",
    "slot": "20:50 - 22:05",
    "courseId": "DBM",
    "subject": "Digital Business Models (DBM)",
    "room": "LR 06",
    "instructor": "SS|3"
  },
  {
    "dateKey": "2026-06-19",
    "day": "Friday",
    "slot": "14:30 - 15:45",
    "courseId": "GBS Sec-D",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "DD|3"
  },
  {
    "dateKey": "2026-06-20",
    "day": "Saturday",
    "slot": "14:30 - 15:45",
    "courseId": "BA Sec-A",
    "subject": "Business Analytics (BA)",
    "room": "LR 02",
    "instructor": "PRS|2"
  },
  {
    "dateKey": "2026-06-20",
    "day": "Saturday",
    "slot": "16:05 - 17:20",
    "courseId": "TA",
    "subject": "Talent Acquisition (TA)",
    "room": "LR 02",
    "instructor": "RSY|3"
  },
  {
    "dateKey": "2026-06-20",
    "day": "Saturday",
    "slot": "17:40 - 18:55",
    "courseId": "MBPET",
    "subject": "Managing Business Processes with Emerging Technologies (MBPET)",
    "room": "LR 02",
    "instructor": "RN|2"
  },
  {
    "dateKey": "2026-06-20",
    "day": "Saturday",
    "slot": "19:15 - 20:30",
    "courseId": "MBPET",
    "subject": "Managing Business Processes with Emerging Technologies (MBPET)",
    "room": "LR 02",
    "instructor": "RN|3"
  },
  {
    "dateKey": "2026-06-20",
    "day": "Saturday",
    "slot": "20:50 - 22:05",
    "courseId": "FSA",
    "subject": "Financial Statement Analysis (FSA)",
    "room": "LR 02",
    "instructor": "SB1|5"
  },
  {
    "dateKey": "2026-06-20",
    "day": "Saturday",
    "slot": "22:25 - 23:40",
    "courseId": "FADT",
    "subject": "Fundamentals and Applications of Design Thinking (FADT)",
    "room": "LR 02",
    "instructor": "RSY|4"
  },
  {
    "dateKey": "2026-06-20",
    "day": "Saturday",
    "slot": "08:45 - 10:00",
    "courseId": "BA Sec-B",
    "subject": "Business Analytics (BA)",
    "room": "LR 07",
    "instructor": "PRS|3"
  },
  {
    "dateKey": "2026-06-20",
    "day": "Saturday",
    "slot": "14:30 - 15:45",
    "courseId": "BGRI",
    "subject": "Business\u2013Government Relations in India (BGRI)",
    "room": "LR 07",
    "instructor": "RK|2"
  },
  {
    "dateKey": "2026-06-20",
    "day": "Saturday",
    "slot": "20:50 - 22:05",
    "courseId": "PS",
    "subject": "Pricing Strategies (PS)",
    "room": "LR 07",
    "instructor": "HS|5"
  },
  {
    "dateKey": "2026-06-20",
    "day": "Saturday",
    "slot": "22:25 - 23:40",
    "courseId": "IBS",
    "subject": "International Business Strategies (IBS)",
    "room": "LR 07",
    "instructor": "PD|3"
  },
  {
    "dateKey": "2026-06-21",
    "day": "Sunday",
    "slot": "08:45 - 10:00",
    "courseId": "MBPET",
    "subject": "Managing Business Processes with Emerging Technologies (MBPET)",
    "room": "LR 02",
    "instructor": "RN|4"
  },
  {
    "dateKey": "2026-06-21",
    "day": "Sunday",
    "slot": "10:20 - 11:35",
    "courseId": "MBPET",
    "subject": "Managing Business Processes with Emerging Technologies (MBPET)",
    "room": "LR 02",
    "instructor": "RN|5"
  },
  {
    "dateKey": "2026-06-22",
    "day": "Monday",
    "slot": "14:30 - 15:45",
    "courseId": "SCM Sec-A",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 02",
    "instructor": "PP|4"
  },
  {
    "dateKey": "2026-06-22",
    "day": "Monday",
    "slot": "16:05 - 17:20",
    "courseId": "SCM Sec-A",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 02",
    "instructor": "PP|5"
  },
  {
    "dateKey": "2026-06-22",
    "day": "Monday",
    "slot": "17:40 - 18:55",
    "courseId": "GBS Sec-A",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 02",
    "instructor": "PD|4"
  },
  {
    "dateKey": "2026-06-22",
    "day": "Monday",
    "slot": "19:15 - 20:30",
    "courseId": "IMDM",
    "subject": "Insurance and Managerial Decision Making (IMDM)",
    "room": "LR 02",
    "instructor": "SB2|3"
  },
  {
    "dateKey": "2026-06-22",
    "day": "Monday",
    "slot": "20:50 - 22:05",
    "courseId": "BA Sec-A",
    "subject": "Business Analytics (BA)",
    "room": "LR 02",
    "instructor": "PRS|3"
  },
  {
    "dateKey": "2026-06-22",
    "day": "Monday",
    "slot": "22:25 - 23:40",
    "courseId": "CV Sec-A",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 02",
    "instructor": "SA|4"
  },
  {
    "dateKey": "2026-06-22",
    "day": "Monday",
    "slot": "08:45 - 10:00",
    "courseId": "GBS Sec-B",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 07",
    "instructor": "PD|4"
  },
  {
    "dateKey": "2026-06-22",
    "day": "Monday",
    "slot": "14:30 - 15:45",
    "courseId": "SC",
    "subject": "Strategic Consulting (SC)",
    "room": "LR 07",
    "instructor": "DD|4"
  },
  {
    "dateKey": "2026-06-22",
    "day": "Monday",
    "slot": "17:40 - 18:55",
    "courseId": "AIDMD",
    "subject": "AI-Driven Marketing Decision Making (AIDMD)",
    "room": "LR 07",
    "instructor": "AK2|4"
  },
  {
    "dateKey": "2026-06-22",
    "day": "Monday",
    "slot": "20:50 - 22:05",
    "courseId": "BGRI",
    "subject": "Business\u2013Government Relations in India (BGRI)",
    "room": "LR 07",
    "instructor": "RK|3"
  },
  {
    "dateKey": "2026-06-22",
    "day": "Monday",
    "slot": "22:25 - 23:40",
    "courseId": "PM",
    "subject": "Project Management (PM)",
    "room": "LR 07",
    "instructor": "AS1|4"
  },
  {
    "dateKey": "2026-06-22",
    "day": "Monday",
    "slot": "17:40 - 18:55",
    "courseId": "GBS Sec-C",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "RC|4"
  },
  {
    "dateKey": "2026-06-22",
    "day": "Monday",
    "slot": "22:25 - 23:40",
    "courseId": "PCM",
    "subject": "Performance and Compensation Management (PCM)",
    "room": "LR 06",
    "instructor": "RSY|4"
  },
  {
    "dateKey": "2026-06-22",
    "day": "Monday",
    "slot": "08:45 - 10:00",
    "courseId": "GBS Sec-D",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "DD|4"
  },
  {
    "dateKey": "2026-06-23",
    "day": "Tuesday",
    "slot": "14:30 - 15:45",
    "courseId": "BA Sec-A",
    "subject": "Business Analytics (BA)",
    "room": "LR 02",
    "instructor": "PRS|4"
  },
  {
    "dateKey": "2026-06-23",
    "day": "Tuesday",
    "slot": "16:05 - 17:20",
    "courseId": "FSA",
    "subject": "Financial Statement Analysis (FSA)",
    "room": "LR 02",
    "instructor": "SB1|6"
  },
  {
    "dateKey": "2026-06-23",
    "day": "Tuesday",
    "slot": "17:40 - 18:55",
    "courseId": "TA",
    "subject": "Talent Acquisition (TA)",
    "room": "LR 02",
    "instructor": "RSY|4"
  },
  {
    "dateKey": "2026-06-23",
    "day": "Tuesday",
    "slot": "19:15 - 20:30",
    "courseId": "L&D",
    "subject": "L&D",
    "room": "LR 02",
    "instructor": "SY|4"
  },
  {
    "dateKey": "2026-06-23",
    "day": "Tuesday",
    "slot": "20:50 - 22:05",
    "courseId": "FM",
    "subject": "Financial Modelling (FM)",
    "room": "LR 02",
    "instructor": "AKM|4"
  },
  {
    "dateKey": "2026-06-23",
    "day": "Tuesday",
    "slot": "08:45 - 10:00",
    "courseId": "BA Sec-B",
    "subject": "Business Analytics (BA)",
    "room": "LR 07",
    "instructor": "PRS|4"
  },
  {
    "dateKey": "2026-06-23",
    "day": "Tuesday",
    "slot": "14:30 - 15:45",
    "courseId": "BGRI",
    "subject": "Business\u2013Government Relations in India (BGRI)",
    "room": "LR 07",
    "instructor": "RK|4"
  },
  {
    "dateKey": "2026-06-23",
    "day": "Tuesday",
    "slot": "16:05 - 17:20",
    "courseId": "PS",
    "subject": "Pricing Strategies (PS)",
    "room": "LR 07",
    "instructor": "HS|6"
  },
  {
    "dateKey": "2026-06-23",
    "day": "Tuesday",
    "slot": "19:15 - 20:30",
    "courseId": "MFIS",
    "subject": "Management of Financial Institutions and Services (MFIS)",
    "room": "LR 07",
    "instructor": "VB|4"
  },
  {
    "dateKey": "2026-06-23",
    "day": "Tuesday",
    "slot": "22:25 - 23:40",
    "courseId": "CV Sec-B",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 07",
    "instructor": "SA|4"
  },
  {
    "dateKey": "2026-06-23",
    "day": "Tuesday",
    "slot": "19:15 - 20:30",
    "courseId": "DBM",
    "subject": "Digital Business Models (DBM)",
    "room": "LR 06",
    "instructor": "SS|4"
  },
  {
    "dateKey": "2026-06-24",
    "day": "Wednesday",
    "slot": "08:45 - 10:00",
    "courseId": "CB Sec-A",
    "subject": "Consumer Behaviour (CB)",
    "room": "LR 02",
    "instructor": "AY|2"
  },
  {
    "dateKey": "2026-06-24",
    "day": "Wednesday",
    "slot": "16:05 - 17:20",
    "courseId": "PWMP",
    "subject": "Playing to Win Market and Power (PWMP)",
    "room": "LR 02",
    "instructor": "SB2|4"
  },
  {
    "dateKey": "2026-06-24",
    "day": "Wednesday",
    "slot": "17:40 - 18:55",
    "courseId": "FADT",
    "subject": "Fundamentals and Applications of Design Thinking (FADT)",
    "room": "LR 02",
    "instructor": "RSY|5"
  },
  {
    "dateKey": "2026-06-24",
    "day": "Wednesday",
    "slot": "19:15 - 20:30",
    "courseId": "CV Sec-A",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 02",
    "instructor": "SA|5"
  },
  {
    "dateKey": "2026-06-24",
    "day": "Wednesday",
    "slot": "22:25 - 23:40",
    "courseId": "GBS Sec-A",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 02",
    "instructor": "PD|5"
  },
  {
    "dateKey": "2026-06-24",
    "day": "Wednesday",
    "slot": "08:45 - 10:00",
    "courseId": "B2B",
    "subject": "B2B Marketing (B2B)",
    "room": "LR 07",
    "instructor": "MK|2"
  },
  {
    "dateKey": "2026-06-24",
    "day": "Wednesday",
    "slot": "14:30 - 15:45",
    "courseId": "CB Sec-B",
    "subject": "Consumer Behaviour (CB)",
    "room": "LR 07",
    "instructor": "AY|2"
  },
  {
    "dateKey": "2026-06-24",
    "day": "Wednesday",
    "slot": "16:05 - 17:20",
    "courseId": "SHRM",
    "subject": "Strategic Human Resource Management (SHRM)",
    "room": "LR 07",
    "instructor": "AP1|4"
  },
  {
    "dateKey": "2026-06-24",
    "day": "Wednesday",
    "slot": "17:40 - 18:55",
    "courseId": "IBS",
    "subject": "International Business Strategies (IBS)",
    "room": "LR 07",
    "instructor": "PD|4"
  },
  {
    "dateKey": "2026-06-24",
    "day": "Wednesday",
    "slot": "19:15 - 20:30",
    "courseId": "PM",
    "subject": "Project Management (PM)",
    "room": "LR 07",
    "instructor": "AS1|5"
  },
  {
    "dateKey": "2026-06-24",
    "day": "Wednesday",
    "slot": "20:50 - 22:05",
    "courseId": "CV Sec-B",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 07",
    "instructor": "SA|5"
  },
  {
    "dateKey": "2026-06-24",
    "day": "Wednesday",
    "slot": "22:25 - 23:40",
    "courseId": "AIDMD",
    "subject": "AI-Driven Marketing Decision Making (AIDMD)",
    "room": "LR 07",
    "instructor": "AK2|5"
  },
  {
    "dateKey": "2026-06-24",
    "day": "Wednesday",
    "slot": "19:15 - 20:30",
    "courseId": "PCM",
    "subject": "Performance and Compensation Management (PCM)",
    "room": "LR 06",
    "instructor": "RSY|5"
  },
  {
    "dateKey": "2026-06-24",
    "day": "Wednesday",
    "slot": "22:25 - 23:40",
    "courseId": "GBS Sec-C",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "RC|5"
  },
  {
    "dateKey": "2026-06-25",
    "day": "Thursday",
    "slot": "08:45 - 10:00",
    "courseId": "TA",
    "subject": "Talent Acquisition (TA)",
    "room": "LR 02",
    "instructor": "RSY|5"
  },
  {
    "dateKey": "2026-06-25",
    "day": "Thursday",
    "slot": "17:40 - 18:55",
    "courseId": "GBS Sec-A",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 02",
    "instructor": "PD|6"
  },
  {
    "dateKey": "2026-06-25",
    "day": "Thursday",
    "slot": "19:15 - 20:30",
    "courseId": "IAPM",
    "subject": "Investment Analysis & Portfolio Management (IAPM)",
    "room": "LR 02",
    "instructor": "AP2|2"
  },
  {
    "dateKey": "2026-06-25",
    "day": "Thursday",
    "slot": "22:25 - 23:40",
    "courseId": "CB Sec-A",
    "subject": "Consumer Behaviour (CB)",
    "room": "LR 02",
    "instructor": "AY|3"
  },
  {
    "dateKey": "2026-06-25",
    "day": "Thursday",
    "slot": "14:30 - 15:45",
    "courseId": "SCM Sec-B",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 07",
    "instructor": "PP|4"
  },
  {
    "dateKey": "2026-06-25",
    "day": "Thursday",
    "slot": "16:05 - 17:20",
    "courseId": "SCM Sec-B",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 07",
    "instructor": "PP|5"
  },
  {
    "dateKey": "2026-06-25",
    "day": "Thursday",
    "slot": "17:40 - 18:55",
    "courseId": "AIDMD",
    "subject": "AI-Driven Marketing Decision Making (AIDMD)",
    "room": "LR 07",
    "instructor": "AK2|6"
  },
  {
    "dateKey": "2026-06-25",
    "day": "Thursday",
    "slot": "19:15 - 20:30",
    "courseId": "SDM",
    "subject": "Sales and Distribution Management (SDM)",
    "room": "LR 07",
    "instructor": "AS2|4"
  },
  {
    "dateKey": "2026-06-25",
    "day": "Thursday",
    "slot": "20:50 - 22:05",
    "courseId": "GBS Sec-B",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 07",
    "instructor": "PD|5"
  },
  {
    "dateKey": "2026-06-25",
    "day": "Thursday",
    "slot": "22:25 - 23:40",
    "courseId": "B2B",
    "subject": "B2B Marketing (B2B)",
    "room": "LR 07",
    "instructor": "MK|3"
  },
  {
    "dateKey": "2026-06-25",
    "day": "Thursday",
    "slot": "17:40 - 18:55",
    "courseId": "GBS Sec-C",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "RC|6"
  },
  {
    "dateKey": "2026-06-25",
    "day": "Thursday",
    "slot": "20:50 - 22:05",
    "courseId": "GBS Sec-D",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "DD|5"
  },
  {
    "dateKey": "2026-06-27",
    "day": "Saturday",
    "slot": "08:45 - 10:00",
    "courseId": "L&D",
    "subject": "L&D",
    "room": "LR 02",
    "instructor": "SY|5"
  },
  {
    "dateKey": "2026-06-27",
    "day": "Saturday",
    "slot": "17:40 - 18:55",
    "courseId": "FADT",
    "subject": "Fundamentals and Applications of Design Thinking (FADT)",
    "room": "LR 02",
    "instructor": "RSY|6"
  },
  {
    "dateKey": "2026-06-27",
    "day": "Saturday",
    "slot": "20:50 - 22:05",
    "courseId": "CV Sec-A",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 02",
    "instructor": "SA|6"
  },
  {
    "dateKey": "2026-06-27",
    "day": "Saturday",
    "slot": "08:45 - 10:00",
    "courseId": "MFIS",
    "subject": "Management of Financial Institutions and Services (MFIS)",
    "room": "LR 07",
    "instructor": "VB|5"
  },
  {
    "dateKey": "2026-06-27",
    "day": "Saturday",
    "slot": "17:40 - 18:55",
    "courseId": "IBS",
    "subject": "International Business Strategies (IBS)",
    "room": "LR 07",
    "instructor": "PD|5"
  },
  {
    "dateKey": "2026-06-27",
    "day": "Saturday",
    "slot": "19:15 - 20:30",
    "courseId": "CV Sec-B",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 07",
    "instructor": "SA|6"
  },
  {
    "dateKey": "2026-06-27",
    "day": "Saturday",
    "slot": "20:50 - 22:05",
    "courseId": "PM",
    "subject": "Project Management (PM)",
    "room": "LR 07",
    "instructor": "AS1|6"
  },
  {
    "dateKey": "2026-06-27",
    "day": "Saturday",
    "slot": "22:25 - 23:40",
    "courseId": "GBS Sec-B",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 07",
    "instructor": "PD|6"
  },
  {
    "dateKey": "2026-06-27",
    "day": "Saturday",
    "slot": "08:45 - 10:00",
    "courseId": "DBM",
    "subject": "Digital Business Models (DBM)",
    "room": "LR 06",
    "instructor": "SS|5"
  },
  {
    "dateKey": "2026-06-27",
    "day": "Saturday",
    "slot": "20:50 - 22:05",
    "courseId": "PCM",
    "subject": "Performance and Compensation Management (PCM)",
    "room": "LR 06",
    "instructor": "RSY|6"
  },
  {
    "dateKey": "2026-06-27",
    "day": "Saturday",
    "slot": "22:25 - 23:40",
    "courseId": "GBS Sec-D",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "DD|6"
  },
  {
    "dateKey": "2026-06-28",
    "day": "Sunday",
    "slot": "17:40 - 18:55",
    "courseId": "CW Sec-B",
    "subject": "Communication Workshop",
    "room": "LR 07",
    "instructor": "XZR|1"
  },
  {
    "dateKey": "2026-06-28",
    "day": "Sunday",
    "slot": "19:15 - 20:30",
    "courseId": "CW Sec-C",
    "subject": "Communication Workshop",
    "room": "LR 06",
    "instructor": "XZR|1"
  },
  {
    "dateKey": "2026-06-29",
    "day": "Monday",
    "slot": "08:45 - 10:00",
    "courseId": "TA",
    "subject": "Talent Acquisition (TA)",
    "room": "LR 02",
    "instructor": "RSY|6"
  },
  {
    "dateKey": "2026-06-29",
    "day": "Monday",
    "slot": "10:20 - 11:35",
    "courseId": "CW Sec-A",
    "subject": "Communication Workshop",
    "room": "LR 02",
    "instructor": "XZR|1"
  },
  {
    "dateKey": "2026-06-29",
    "day": "Monday",
    "slot": "14:30 - 15:45",
    "courseId": "IAPM",
    "subject": "Investment Analysis & Portfolio Management (IAPM)",
    "room": "LR 02",
    "instructor": "AP2|3"
  },
  {
    "dateKey": "2026-06-29",
    "day": "Monday",
    "slot": "19:15 - 20:30",
    "courseId": "BA Sec-A",
    "subject": "Business Analytics (BA)",
    "room": "LR 02",
    "instructor": "PRS|5"
  },
  {
    "dateKey": "2026-06-29",
    "day": "Monday",
    "slot": "20:50 - 22:05",
    "courseId": "GBS Sec-A",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 02",
    "instructor": "PD|7"
  },
  {
    "dateKey": "2026-06-29",
    "day": "Monday",
    "slot": "22:25 - 23:40",
    "courseId": "CV Sec-A",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 02",
    "instructor": "SA|7"
  },
  {
    "dateKey": "2026-06-29",
    "day": "Monday",
    "slot": "14:30 - 15:45",
    "courseId": "SDM",
    "subject": "Sales and Distribution Management (SDM)",
    "room": "LR 07",
    "instructor": "AS2|5"
  },
  {
    "dateKey": "2026-06-29",
    "day": "Monday",
    "slot": "16:05 - 17:20",
    "courseId": "MFIS",
    "subject": "Management of Financial Institutions and Services (MFIS)",
    "room": "LR 07",
    "instructor": "VB|6"
  },
  {
    "dateKey": "2026-06-29",
    "day": "Monday",
    "slot": "17:40 - 18:55",
    "courseId": "BA Sec-B",
    "subject": "Business Analytics (BA)",
    "room": "LR 07",
    "instructor": "PRS|5"
  },
  {
    "dateKey": "2026-06-29",
    "day": "Monday",
    "slot": "19:15 - 20:30",
    "courseId": "BGRI",
    "subject": "Business\u2013Government Relations in India (BGRI)",
    "room": "LR 07",
    "instructor": "RK|5"
  },
  {
    "dateKey": "2026-06-29",
    "day": "Monday",
    "slot": "20:50 - 22:05",
    "courseId": "AIDMD",
    "subject": "AI-Driven Marketing Decision Making (AIDMD)",
    "room": "LR 07",
    "instructor": "AK2|7"
  },
  {
    "dateKey": "2026-06-29",
    "day": "Monday",
    "slot": "22:25 - 23:40",
    "courseId": "PM",
    "subject": "Project Management (PM)",
    "room": "LR 07",
    "instructor": "AS1|7"
  },
  {
    "dateKey": "2026-06-29",
    "day": "Monday",
    "slot": "20:50 - 22:05",
    "courseId": "GBS Sec-C",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "RC|7"
  },
  {
    "dateKey": "2026-06-29",
    "day": "Monday",
    "slot": "22:25 - 23:40",
    "courseId": "PCM",
    "subject": "Performance and Compensation Management (PCM)",
    "room": "LR 06",
    "instructor": "RSY|7"
  },
  {
    "dateKey": "2026-06-29",
    "day": "Monday",
    "slot": "11:55 - 01:10",
    "courseId": "CW Sec-D",
    "subject": "Communication Workshop",
    "room": "LR 06",
    "instructor": "XZR|1"
  },
  {
    "dateKey": "2026-06-30",
    "day": "Tuesday",
    "slot": "08:45 - 10:00",
    "courseId": "FSA",
    "subject": "Financial Statement Analysis (FSA)",
    "room": "LR 02",
    "instructor": "SB1|7"
  },
  {
    "dateKey": "2026-06-30",
    "day": "Tuesday",
    "slot": "14:30 - 15:45",
    "courseId": "FADT",
    "subject": "Fundamentals and Applications of Design Thinking (FADT)",
    "room": "LR 02",
    "instructor": "RSY|7"
  },
  {
    "dateKey": "2026-06-30",
    "day": "Tuesday",
    "slot": "16:05 - 17:20",
    "courseId": "PWMP",
    "subject": "Playing to Win Market and Power (PWMP)",
    "room": "LR 02",
    "instructor": "SB2|5"
  },
  {
    "dateKey": "2026-06-30",
    "day": "Tuesday",
    "slot": "20:50 - 22:05",
    "courseId": "SCM Sec-A",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 02",
    "instructor": "PP|6"
  },
  {
    "dateKey": "2026-06-30",
    "day": "Tuesday",
    "slot": "08:45 - 10:00",
    "courseId": "PS",
    "subject": "Pricing Strategies (PS)",
    "room": "LR 07",
    "instructor": "HS|7"
  },
  {
    "dateKey": "2026-06-30",
    "day": "Tuesday",
    "slot": "14:30 - 15:45",
    "courseId": "IBS",
    "subject": "International Business Strategies (IBS)",
    "room": "LR 07",
    "instructor": "PD|6"
  },
  {
    "dateKey": "2026-06-30",
    "day": "Tuesday",
    "slot": "16:05 - 17:20",
    "courseId": "SHRM",
    "subject": "Strategic Human Resource Management (SHRM)",
    "room": "LR 07",
    "instructor": "AP1|5"
  },
  {
    "dateKey": "2026-06-30",
    "day": "Tuesday",
    "slot": "17:40 - 18:55",
    "courseId": "GBS Sec-B",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 07",
    "instructor": "PD|7"
  },
  {
    "dateKey": "2026-06-30",
    "day": "Tuesday",
    "slot": "19:15 - 20:30",
    "courseId": "CV Sec-B",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 07",
    "instructor": "SA|7"
  },
  {
    "dateKey": "2026-06-30",
    "day": "Tuesday",
    "slot": "20:50 - 22:05",
    "courseId": "SC",
    "subject": "Strategic Consulting (SC)",
    "room": "LR 07",
    "instructor": "DD|5"
  },
  {
    "dateKey": "2026-06-30",
    "day": "Tuesday",
    "slot": "22:25 - 23:40",
    "courseId": "SCM Sec-B",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 07",
    "instructor": "PP|6"
  },
  {
    "dateKey": "2026-06-30",
    "day": "Tuesday",
    "slot": "17:40 - 18:55",
    "courseId": "GBS Sec-D",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "DD|7"
  },
  {
    "dateKey": "2026-07-01",
    "day": "Wednesday",
    "slot": "08:45 - 10:00",
    "courseId": "SCM Sec-A",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 02",
    "instructor": "PP|7"
  },
  {
    "dateKey": "2026-07-01",
    "day": "Wednesday",
    "slot": "16:05 - 17:20",
    "courseId": "IAPM",
    "subject": "Investment Analysis & Portfolio Management (IAPM)",
    "room": "LR 02",
    "instructor": "AP2|4"
  },
  {
    "dateKey": "2026-07-01",
    "day": "Wednesday",
    "slot": "17:40 - 18:55",
    "courseId": "L&D",
    "subject": "L&D",
    "room": "LR 02",
    "instructor": "SY|6"
  },
  {
    "dateKey": "2026-07-01",
    "day": "Wednesday",
    "slot": "19:15 - 20:30",
    "courseId": "IMDM",
    "subject": "Insurance and Managerial Decision Making (IMDM)",
    "room": "LR 02",
    "instructor": "SB2|4"
  },
  {
    "dateKey": "2026-07-01",
    "day": "Wednesday",
    "slot": "20:50 - 22:05",
    "courseId": "FM",
    "subject": "Financial Modelling (FM)",
    "room": "LR 02",
    "instructor": "AKM|5"
  },
  {
    "dateKey": "2026-07-01",
    "day": "Wednesday",
    "slot": "08:45 - 10:00",
    "courseId": "SC",
    "subject": "Strategic Consulting (SC)",
    "room": "LR 07",
    "instructor": "DD|6"
  },
  {
    "dateKey": "2026-07-01",
    "day": "Wednesday",
    "slot": "14:30 - 15:45",
    "courseId": "SCM Sec-B",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 07",
    "instructor": "PP|7"
  },
  {
    "dateKey": "2026-07-01",
    "day": "Wednesday",
    "slot": "17:40 - 18:55",
    "courseId": "MFIS",
    "subject": "Management of Financial Institutions and Services (MFIS)",
    "room": "LR 07",
    "instructor": "VB|7"
  },
  {
    "dateKey": "2026-07-01",
    "day": "Wednesday",
    "slot": "22:25 - 23:40",
    "courseId": "CB Sec-B",
    "subject": "Consumer Behaviour (CB)",
    "room": "LR 07",
    "instructor": "AY|3"
  },
  {
    "dateKey": "2026-07-01",
    "day": "Wednesday",
    "slot": "17:40 - 18:55",
    "courseId": "DBM",
    "subject": "Digital Business Models (DBM)",
    "room": "LR 06",
    "instructor": "SS|6"
  },
  {
    "dateKey": "2026-07-02",
    "day": "Thursday",
    "slot": "08:45 - 10:00",
    "courseId": "IAPM",
    "subject": "Investment Analysis & Portfolio Management (IAPM)",
    "room": "LR 02",
    "instructor": "AP2|5"
  },
  {
    "dateKey": "2026-07-02",
    "day": "Thursday",
    "slot": "14:30 - 15:45",
    "courseId": "FSA",
    "subject": "Financial Statement Analysis (FSA)",
    "room": "LR 02",
    "instructor": "SB1|8"
  },
  {
    "dateKey": "2026-07-02",
    "day": "Thursday",
    "slot": "16:05 - 17:20",
    "courseId": "CB Sec-A",
    "subject": "Consumer Behaviour (CB)",
    "room": "LR 02",
    "instructor": "AY|4"
  },
  {
    "dateKey": "2026-07-02",
    "day": "Thursday",
    "slot": "20:50 - 22:05",
    "courseId": "SCM Sec-A",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 02",
    "instructor": "PP|8"
  },
  {
    "dateKey": "2026-07-02",
    "day": "Thursday",
    "slot": "08:45 - 10:00",
    "courseId": "SDM",
    "subject": "Sales and Distribution Management (SDM)",
    "room": "LR 07",
    "instructor": "AS2|6"
  },
  {
    "dateKey": "2026-07-02",
    "day": "Thursday",
    "slot": "14:30 - 15:45",
    "courseId": "PS",
    "subject": "Pricing Strategies (PS)",
    "room": "LR 07",
    "instructor": "HS|8"
  },
  {
    "dateKey": "2026-07-02",
    "day": "Thursday",
    "slot": "16:05 - 17:20",
    "courseId": "B2B",
    "subject": "B2B Marketing (B2B)",
    "room": "LR 07",
    "instructor": "MK|4"
  },
  {
    "dateKey": "2026-07-02",
    "day": "Thursday",
    "slot": "17:40 - 18:55",
    "courseId": "CB Sec-B",
    "subject": "Consumer Behaviour (CB)",
    "room": "LR 07",
    "instructor": "AY|4"
  },
  {
    "dateKey": "2026-07-02",
    "day": "Thursday",
    "slot": "19:15 - 20:30",
    "courseId": "BGRI",
    "subject": "Business\u2013Government Relations in India (BGRI)",
    "room": "LR 07",
    "instructor": "RK|6"
  },
  {
    "dateKey": "2026-07-02",
    "day": "Thursday",
    "slot": "20:50 - 22:05",
    "courseId": "SC",
    "subject": "Strategic Consulting (SC)",
    "room": "LR 07",
    "instructor": "DD|7"
  },
  {
    "dateKey": "2026-07-02",
    "day": "Thursday",
    "slot": "22:25 - 23:40",
    "courseId": "SCM Sec-B",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 07",
    "instructor": "PP|8"
  },
  {
    "dateKey": "2026-07-03",
    "day": "Friday",
    "slot": "08:45 - 10:00",
    "courseId": "CW Sec-A",
    "subject": "Communication Workshop",
    "room": "LR 02",
    "instructor": "XZR|2"
  },
  {
    "dateKey": "2026-07-03",
    "day": "Friday",
    "slot": "16:05 - 17:20",
    "courseId": "CV Sec-A",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 02",
    "instructor": "SA|8"
  },
  {
    "dateKey": "2026-07-03",
    "day": "Friday",
    "slot": "17:40 - 18:55",
    "courseId": "MBPET",
    "subject": "Managing Business Processes with Emerging Technologies (MBPET)",
    "room": "LR 02",
    "instructor": "RN|6"
  },
  {
    "dateKey": "2026-07-03",
    "day": "Friday",
    "slot": "19:15 - 20:30",
    "courseId": "MBPET",
    "subject": "Managing Business Processes with Emerging Technologies (MBPET)",
    "room": "LR 02",
    "instructor": "RN|7"
  },
  {
    "dateKey": "2026-07-03",
    "day": "Friday",
    "slot": "20:50 - 22:05",
    "courseId": "PWMP",
    "subject": "Playing to Win Market and Power (PWMP)",
    "room": "LR 02",
    "instructor": "SB2|6"
  },
  {
    "dateKey": "2026-07-03",
    "day": "Friday",
    "slot": "22:25 - 23:40",
    "courseId": "FSA",
    "subject": "Financial Statement Analysis (FSA)",
    "room": "LR 02",
    "instructor": "SB1|9"
  },
  {
    "dateKey": "2026-07-03",
    "day": "Friday",
    "slot": "10:20 - 11:35",
    "courseId": "CW Sec-B",
    "subject": "Communication Workshop",
    "room": "LR 07",
    "instructor": "XZR|2"
  },
  {
    "dateKey": "2026-07-03",
    "day": "Friday",
    "slot": "14:30 - 15:45",
    "courseId": "CV Sec-B",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 07",
    "instructor": "SA|8"
  },
  {
    "dateKey": "2026-07-03",
    "day": "Friday",
    "slot": "20:50 - 22:05",
    "courseId": "SHRM",
    "subject": "Strategic Human Resource Management (SHRM)",
    "room": "LR 07",
    "instructor": "AP1|6"
  },
  {
    "dateKey": "2026-07-03",
    "day": "Friday",
    "slot": "22:25 - 23:40",
    "courseId": "PS",
    "subject": "Pricing Strategies (PS)",
    "room": "LR 07",
    "instructor": "HS|9"
  },
  {
    "dateKey": "2026-07-04",
    "day": "Saturday",
    "slot": "14:30 - 15:45",
    "courseId": "CB Sec-A",
    "subject": "Consumer Behaviour (CB)",
    "room": "LR 02",
    "instructor": "AY|5"
  },
  {
    "dateKey": "2026-07-04",
    "day": "Saturday",
    "slot": "17:40 - 18:55",
    "courseId": "MBPET",
    "subject": "Managing Business Processes with Emerging Technologies (MBPET)",
    "room": "LR 02",
    "instructor": "RN|8"
  },
  {
    "dateKey": "2026-07-04",
    "day": "Saturday",
    "slot": "19:15 - 20:30",
    "courseId": "MBPET",
    "subject": "Managing Business Processes with Emerging Technologies (MBPET)",
    "room": "LR 02",
    "instructor": "RN|9"
  },
  {
    "dateKey": "2026-07-04",
    "day": "Saturday",
    "slot": "20:50 - 22:05",
    "courseId": "L&D",
    "subject": "L&D",
    "room": "LR 02",
    "instructor": "SY|7"
  },
  {
    "dateKey": "2026-07-04",
    "day": "Saturday",
    "slot": "14:30 - 15:45",
    "courseId": "B2B",
    "subject": "B2B Marketing (B2B)",
    "room": "LR 07",
    "instructor": "MK|5"
  },
  {
    "dateKey": "2026-07-04",
    "day": "Saturday",
    "slot": "16:05 - 17:20",
    "courseId": "CB Sec-B",
    "subject": "Consumer Behaviour (CB)",
    "room": "LR 07",
    "instructor": "AY|5"
  },
  {
    "dateKey": "2026-07-04",
    "day": "Saturday",
    "slot": "20:50 - 22:05",
    "courseId": "MFIS",
    "subject": "Management of Financial Institutions and Services (MFIS)",
    "room": "LR 07",
    "instructor": "VB|8"
  },
  {
    "dateKey": "2026-07-04",
    "day": "Saturday",
    "slot": "08:45 - 10:00",
    "courseId": "CW Sec-C",
    "subject": "Communication Workshop",
    "room": "LR 06",
    "instructor": "XZR|2"
  },
  {
    "dateKey": "2026-07-04",
    "day": "Saturday",
    "slot": "20:50 - 22:05",
    "courseId": "DBM",
    "subject": "Digital Business Models (DBM)",
    "room": "LR 06",
    "instructor": "SS|7"
  },
  {
    "dateKey": "2026-07-04",
    "day": "Saturday",
    "slot": "10:20 - 11:35",
    "courseId": "CW Sec-D",
    "subject": "Communication Workshop",
    "room": "LR 06",
    "instructor": "XZR|2"
  },
  {
    "dateKey": "2026-07-05",
    "day": "Sunday",
    "slot": "08:45 - 10:00",
    "courseId": "MBPET",
    "subject": "Managing Business Processes with Emerging Technologies (MBPET)",
    "room": "LR 02",
    "instructor": "RN|10"
  },
  {
    "dateKey": "2026-07-06",
    "day": "Monday",
    "slot": "14:30 - 15:45",
    "courseId": "CV Sec-A",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 02",
    "instructor": "SA|9"
  },
  {
    "dateKey": "2026-07-06",
    "day": "Monday",
    "slot": "16:05 - 17:20",
    "courseId": "FADT",
    "subject": "Fundamentals and Applications of Design Thinking (FADT)",
    "room": "LR 02",
    "instructor": "RSY|8"
  },
  {
    "dateKey": "2026-07-06",
    "day": "Monday",
    "slot": "17:40 - 18:55",
    "courseId": "IMDM",
    "subject": "Insurance and Managerial Decision Making (IMDM)",
    "room": "LR 02",
    "instructor": "SB2|5"
  },
  {
    "dateKey": "2026-07-06",
    "day": "Monday",
    "slot": "19:15 - 20:30",
    "courseId": "GBS Sec-A",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 02",
    "instructor": "PD|8"
  },
  {
    "dateKey": "2026-07-06",
    "day": "Monday",
    "slot": "08:45 - 10:00",
    "courseId": "BA Sec-B",
    "subject": "Business Analytics (BA)",
    "room": "LR 07",
    "instructor": "PRS|6"
  },
  {
    "dateKey": "2026-07-06",
    "day": "Monday",
    "slot": "14:30 - 15:45",
    "courseId": "PM",
    "subject": "Project Management (PM)",
    "room": "LR 07",
    "instructor": "AS1|8"
  },
  {
    "dateKey": "2026-07-06",
    "day": "Monday",
    "slot": "16:05 - 17:20",
    "courseId": "IBS",
    "subject": "International Business Strategies (IBS)",
    "room": "LR 07",
    "instructor": "PD|7"
  },
  {
    "dateKey": "2026-07-06",
    "day": "Monday",
    "slot": "19:15 - 20:30",
    "courseId": "AIDMD",
    "subject": "AI-Driven Marketing Decision Making (AIDMD)",
    "room": "LR 07",
    "instructor": "AK2|8"
  },
  {
    "dateKey": "2026-07-06",
    "day": "Monday",
    "slot": "20:50 - 22:05",
    "courseId": "GBS Sec-B",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 07",
    "instructor": "PD|8"
  },
  {
    "dateKey": "2026-07-06",
    "day": "Monday",
    "slot": "22:25 - 23:40",
    "courseId": "CV Sec-B",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 07",
    "instructor": "SA|9"
  },
  {
    "dateKey": "2026-07-06",
    "day": "Monday",
    "slot": "14:30 - 15:45",
    "courseId": "PCM",
    "subject": "Performance and Compensation Management (PCM)",
    "room": "LR 06",
    "instructor": "RSY|8"
  },
  {
    "dateKey": "2026-07-06",
    "day": "Monday",
    "slot": "19:15 - 20:30",
    "courseId": "GBS Sec-C",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "RC|8"
  },
  {
    "dateKey": "2026-07-06",
    "day": "Monday",
    "slot": "20:50 - 22:05",
    "courseId": "GBS Sec-D",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "DD|8"
  },
  {
    "dateKey": "2026-07-07",
    "day": "Tuesday",
    "slot": "08:45 - 10:00",
    "courseId": "L&D",
    "subject": "L&D",
    "room": "LR 02",
    "instructor": "SY|8"
  },
  {
    "dateKey": "2026-07-07",
    "day": "Tuesday",
    "slot": "14:30 - 15:45",
    "courseId": "TA",
    "subject": "Talent Acquisition (TA)",
    "room": "LR 02",
    "instructor": "RSY|7"
  },
  {
    "dateKey": "2026-07-07",
    "day": "Tuesday",
    "slot": "17:40 - 18:55",
    "courseId": "CB Sec-A",
    "subject": "Consumer Behaviour (CB)",
    "room": "LR 02",
    "instructor": "AY|6"
  },
  {
    "dateKey": "2026-07-07",
    "day": "Tuesday",
    "slot": "19:15 - 20:30",
    "courseId": "PWMP",
    "subject": "Playing to Win Market and Power (PWMP)",
    "room": "LR 02",
    "instructor": "SB2|7"
  },
  {
    "dateKey": "2026-07-07",
    "day": "Tuesday",
    "slot": "20:50 - 22:05",
    "courseId": "IAPM",
    "subject": "Investment Analysis & Portfolio Management (IAPM)",
    "room": "LR 02",
    "instructor": "AP2|6"
  },
  {
    "dateKey": "2026-07-07",
    "day": "Tuesday",
    "slot": "22:25 - 23:40",
    "courseId": "BA Sec-A",
    "subject": "Business Analytics (BA)",
    "room": "LR 02",
    "instructor": "PRS|6"
  },
  {
    "dateKey": "2026-07-07",
    "day": "Tuesday",
    "slot": "08:45 - 10:00",
    "courseId": "MFIS",
    "subject": "Management of Financial Institutions and Services (MFIS)",
    "room": "LR 07",
    "instructor": "VB|9"
  },
  {
    "dateKey": "2026-07-07",
    "day": "Tuesday",
    "slot": "16:05 - 17:20",
    "courseId": "CB Sec-B",
    "subject": "Consumer Behaviour (CB)",
    "room": "LR 07",
    "instructor": "AY|6"
  },
  {
    "dateKey": "2026-07-07",
    "day": "Tuesday",
    "slot": "17:40 - 18:55",
    "courseId": "B2B",
    "subject": "B2B Marketing (B2B)",
    "room": "LR 07",
    "instructor": "MK|6"
  },
  {
    "dateKey": "2026-07-07",
    "day": "Tuesday",
    "slot": "19:15 - 20:30",
    "courseId": "SHRM",
    "subject": "Strategic Human Resource Management (SHRM)",
    "room": "LR 07",
    "instructor": "AP1|7"
  },
  {
    "dateKey": "2026-07-07",
    "day": "Tuesday",
    "slot": "20:50 - 22:05",
    "courseId": "SDM",
    "subject": "Sales and Distribution Management (SDM)",
    "room": "LR 07",
    "instructor": "AS2|7"
  },
  {
    "dateKey": "2026-07-07",
    "day": "Tuesday",
    "slot": "22:25 - 23:40",
    "courseId": "BGRI",
    "subject": "Business\u2013Government Relations in India (BGRI)",
    "room": "LR 07",
    "instructor": "RK|7"
  },
  {
    "dateKey": "2026-07-07",
    "day": "Tuesday",
    "slot": "08:45 - 10:00",
    "courseId": "DBM",
    "subject": "Digital Business Models (DBM)",
    "room": "LR 06",
    "instructor": "SS|8"
  },
  {
    "dateKey": "2026-07-08",
    "day": "Wednesday",
    "slot": "08:45 - 10:00",
    "courseId": "Ind 4.0",
    "subject": "Industry 4.0 Revolutionize your Business (IND 4.0)",
    "room": "LR 02",
    "instructor": "AK1|1"
  },
  {
    "dateKey": "2026-07-08",
    "day": "Wednesday",
    "slot": "16:05 - 17:20",
    "courseId": "GBS Sec-A",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 02",
    "instructor": "PD|9"
  },
  {
    "dateKey": "2026-07-08",
    "day": "Wednesday",
    "slot": "17:40 - 18:55",
    "courseId": "IMDM",
    "subject": "Insurance and Managerial Decision Making (IMDM)",
    "room": "LR 02",
    "instructor": "SB2|6"
  },
  {
    "dateKey": "2026-07-08",
    "day": "Wednesday",
    "slot": "19:15 - 20:30",
    "courseId": "SCM Sec-A",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 02",
    "instructor": "PP|9"
  },
  {
    "dateKey": "2026-07-08",
    "day": "Wednesday",
    "slot": "22:25 - 23:40",
    "courseId": "CV Sec-A",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 02",
    "instructor": "SA|10"
  },
  {
    "dateKey": "2026-07-08",
    "day": "Wednesday",
    "slot": "08:45 - 10:00",
    "courseId": "GFMG",
    "subject": "Global Financial Markets and Geopolitics (GFMG)",
    "room": "LR 07",
    "instructor": "US|1"
  },
  {
    "dateKey": "2026-07-08",
    "day": "Wednesday",
    "slot": "14:30 - 15:45",
    "courseId": "GBS Sec-B",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 07",
    "instructor": "PD|9"
  },
  {
    "dateKey": "2026-07-08",
    "day": "Wednesday",
    "slot": "16:05 - 17:20",
    "courseId": "AIDMD",
    "subject": "AI-Driven Marketing Decision Making (AIDMD)",
    "room": "LR 07",
    "instructor": "AK2|9"
  },
  {
    "dateKey": "2026-07-08",
    "day": "Wednesday",
    "slot": "19:15 - 20:30",
    "courseId": "SC",
    "subject": "Strategic Consulting (SC)",
    "room": "LR 07",
    "instructor": "DD|8"
  },
  {
    "dateKey": "2026-07-08",
    "day": "Wednesday",
    "slot": "20:50 - 22:05",
    "courseId": "SCM Sec-B",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 07",
    "instructor": "PP|9"
  },
  {
    "dateKey": "2026-07-08",
    "day": "Wednesday",
    "slot": "22:25 - 23:40",
    "courseId": "PM",
    "subject": "Project Management (PM)",
    "room": "LR 07",
    "instructor": "AS1|9"
  },
  {
    "dateKey": "2026-07-08",
    "day": "Wednesday",
    "slot": "08:45 - 10:00",
    "courseId": "PFM",
    "subject": "Python for Managers (PFM)",
    "room": "LR 06",
    "instructor": "AK3|1"
  },
  {
    "dateKey": "2026-07-08",
    "day": "Wednesday",
    "slot": "16:05 - 17:20",
    "courseId": "GBS Sec-C",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "RC|9"
  },
  {
    "dateKey": "2026-07-08",
    "day": "Wednesday",
    "slot": "22:25 - 23:40",
    "courseId": "PCM",
    "subject": "Performance and Compensation Management (PCM)",
    "room": "LR 06",
    "instructor": "RSY|09"
  },
  {
    "dateKey": "2026-07-08",
    "day": "Wednesday",
    "slot": "14:30 - 15:45",
    "courseId": "GBS Sec-D",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "DD|9"
  },
  {
    "dateKey": "2026-07-09",
    "day": "Thursday",
    "slot": "14:30 - 15:45",
    "courseId": "CV Sec-A",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 02",
    "instructor": "SA|11"
  },
  {
    "dateKey": "2026-07-09",
    "day": "Thursday",
    "slot": "16:05 - 17:20",
    "courseId": "FADT",
    "subject": "Fundamentals and Applications of Design Thinking (FADT)",
    "room": "LR 02",
    "instructor": "RSY|9"
  },
  {
    "dateKey": "2026-07-09",
    "day": "Thursday",
    "slot": "17:40 - 18:55",
    "courseId": "FSA",
    "subject": "Financial Statement Analysis (FSA)",
    "room": "LR 02",
    "instructor": "SB1|10"
  },
  {
    "dateKey": "2026-07-09",
    "day": "Thursday",
    "slot": "19:15 - 20:30",
    "courseId": "BA Sec-A",
    "subject": "Business Analytics (BA)",
    "room": "LR 02",
    "instructor": "PRS|7"
  },
  {
    "dateKey": "2026-07-09",
    "day": "Thursday",
    "slot": "22:25 - 23:40",
    "courseId": "L&D",
    "subject": "L&D",
    "room": "LR 02",
    "instructor": "SY|9"
  },
  {
    "dateKey": "2026-07-09",
    "day": "Thursday",
    "slot": "14:30 - 15:45",
    "courseId": "PM",
    "subject": "Project Management (PM)",
    "room": "LR 07",
    "instructor": "AS1|10"
  },
  {
    "dateKey": "2026-07-09",
    "day": "Thursday",
    "slot": "16:05 - 17:20",
    "courseId": "IBS",
    "subject": "International Business Strategies (IBS)",
    "room": "LR 07",
    "instructor": "PD|8"
  },
  {
    "dateKey": "2026-07-09",
    "day": "Thursday",
    "slot": "17:40 - 18:55",
    "courseId": "PS",
    "subject": "Pricing Strategies (PS)",
    "room": "LR 07",
    "instructor": "HS|10"
  },
  {
    "dateKey": "2026-07-09",
    "day": "Thursday",
    "slot": "19:15 - 20:30",
    "courseId": "BGRI",
    "subject": "Business\u2013Government Relations in India (BGRI)",
    "room": "LR 07",
    "instructor": "RK|8"
  },
  {
    "dateKey": "2026-07-09",
    "day": "Thursday",
    "slot": "20:50 - 22:05",
    "courseId": "BA Sec-B",
    "subject": "Business Analytics (BA)",
    "room": "LR 07",
    "instructor": "PRS|7"
  },
  {
    "dateKey": "2026-07-09",
    "day": "Thursday",
    "slot": "14:30 - 15:45",
    "courseId": "PCM",
    "subject": "Performance and Compensation Management (PCM)",
    "room": "LR 06",
    "instructor": "RSY|10"
  },
  {
    "dateKey": "2026-07-09",
    "day": "Thursday",
    "slot": "22:25 - 23:40",
    "courseId": "DBM",
    "subject": "Digital Business Models (DBM)",
    "room": "LR 06",
    "instructor": "SS|9"
  },
  {
    "dateKey": "2026-07-10",
    "day": "Friday",
    "slot": "08:45 - 10:00",
    "courseId": "IAPM",
    "subject": "Investment Analysis & Portfolio Management (IAPM)",
    "room": "LR 02",
    "instructor": "AP2|7"
  },
  {
    "dateKey": "2026-07-10",
    "day": "Friday",
    "slot": "16:05 - 17:20",
    "courseId": "CB Sec-A",
    "subject": "Consumer Behaviour (CB)",
    "room": "LR 02",
    "instructor": "AY|7"
  },
  {
    "dateKey": "2026-07-10",
    "day": "Friday",
    "slot": "17:40 - 18:55",
    "courseId": "PWMP",
    "subject": "Playing to Win Market and Power (PWMP)",
    "room": "LR 02",
    "instructor": "SB2|8"
  },
  {
    "dateKey": "2026-07-10",
    "day": "Friday",
    "slot": "19:15 - 20:30",
    "courseId": "TA",
    "subject": "Talent Acquisition (TA)",
    "room": "LR 02",
    "instructor": "RSY|8"
  },
  {
    "dateKey": "2026-07-10",
    "day": "Friday",
    "slot": "20:50 - 22:05",
    "courseId": "IMDM",
    "subject": "Insurance and Managerial Decision Making (IMDM)",
    "room": "LR 02",
    "instructor": "SB2|7"
  },
  {
    "dateKey": "2026-07-10",
    "day": "Friday",
    "slot": "08:45 - 10:00",
    "courseId": "SDM",
    "subject": "Sales and Distribution Management (SDM)",
    "room": "LR 07",
    "instructor": "AS2|8"
  },
  {
    "dateKey": "2026-07-10",
    "day": "Friday",
    "slot": "14:30 - 15:45",
    "courseId": "CB Sec-B",
    "subject": "Consumer Behaviour (CB)",
    "room": "LR 07",
    "instructor": "AY|7"
  },
  {
    "dateKey": "2026-07-10",
    "day": "Friday",
    "slot": "16:05 - 17:20",
    "courseId": "B2B",
    "subject": "B2B Marketing (B2B)",
    "room": "LR 07",
    "instructor": "MK|7"
  },
  {
    "dateKey": "2026-07-10",
    "day": "Friday",
    "slot": "17:40 - 18:55",
    "courseId": "SHRM",
    "subject": "Strategic Human Resource Management (SHRM)",
    "room": "LR 07",
    "instructor": "AP1|8"
  },
  {
    "dateKey": "2026-07-10",
    "day": "Friday",
    "slot": "22:25 - 23:40",
    "courseId": "SC",
    "subject": "Strategic Consulting (SC)",
    "room": "LR 07",
    "instructor": "DD|9"
  },
  {
    "dateKey": "2026-07-11",
    "day": "Saturday",
    "slot": "08:45 - 10:00",
    "courseId": "FADT",
    "subject": "Fundamentals and Applications of Design Thinking (FADT)",
    "room": "LR 02",
    "instructor": "RSY|10"
  },
  {
    "dateKey": "2026-07-11",
    "day": "Saturday",
    "slot": "14:30 - 15:45",
    "courseId": "GBS Sec-A",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 02",
    "instructor": "PD|10"
  },
  {
    "dateKey": "2026-07-11",
    "day": "Saturday",
    "slot": "16:05 - 17:20",
    "courseId": "L&D",
    "subject": "L&D",
    "room": "LR 02",
    "instructor": "SY|10"
  },
  {
    "dateKey": "2026-07-11",
    "day": "Saturday",
    "slot": "20:50 - 22:05",
    "courseId": "SCM Sec-A",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 02",
    "instructor": "PP|10"
  },
  {
    "dateKey": "2026-07-11",
    "day": "Saturday",
    "slot": "08:45 - 10:00",
    "courseId": "IBS",
    "subject": "International Business Strategies (IBS)",
    "room": "LR 07",
    "instructor": "PD|9"
  },
  {
    "dateKey": "2026-07-11",
    "day": "Saturday",
    "slot": "14:30 - 15:45",
    "courseId": "AIDMD",
    "subject": "AI-Driven Marketing Decision Making (AIDMD)",
    "room": "LR 07",
    "instructor": "AK2|10"
  },
  {
    "dateKey": "2026-07-11",
    "day": "Saturday",
    "slot": "16:05 - 17:20",
    "courseId": "MFIS",
    "subject": "Management of Financial Institutions and Services (MFIS)",
    "room": "LR 07",
    "instructor": "VB|10"
  },
  {
    "dateKey": "2026-07-11",
    "day": "Saturday",
    "slot": "17:40 - 18:55",
    "courseId": "GBS Sec-B",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 07",
    "instructor": "PD|10"
  },
  {
    "dateKey": "2026-07-11",
    "day": "Saturday",
    "slot": "19:15 - 20:30",
    "courseId": "SCM Sec-B",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 07",
    "instructor": "PP|10"
  },
  {
    "dateKey": "2026-07-11",
    "day": "Saturday",
    "slot": "20:50 - 22:05",
    "courseId": "SC",
    "subject": "Strategic Consulting (SC)",
    "room": "LR 07",
    "instructor": "DD|10"
  },
  {
    "dateKey": "2026-07-11",
    "day": "Saturday",
    "slot": "22:25 - 23:40",
    "courseId": "PM",
    "subject": "Project Management (PM)",
    "room": "LR 07",
    "instructor": "AS1|11"
  },
  {
    "dateKey": "2026-07-11",
    "day": "Saturday",
    "slot": "14:30 - 15:45",
    "courseId": "GBS Sec-C",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "RC|10"
  },
  {
    "dateKey": "2026-07-11",
    "day": "Saturday",
    "slot": "16:05 - 17:20",
    "courseId": "DBM",
    "subject": "Digital Business Models (DBM)",
    "room": "LR 06",
    "instructor": "SS|10"
  },
  {
    "dateKey": "2026-07-11",
    "day": "Saturday",
    "slot": "17:40 - 18:55",
    "courseId": "GBS Sec-D",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "DD|10"
  },
  {
    "dateKey": "2026-07-13",
    "day": "Monday",
    "slot": "08:45 - 10:00",
    "courseId": "GBS Sec-A",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 02",
    "instructor": "PD|11"
  },
  {
    "dateKey": "2026-07-13",
    "day": "Monday",
    "slot": "16:05 - 17:20",
    "courseId": "SCM Sec-A",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 02",
    "instructor": "PP|11"
  },
  {
    "dateKey": "2026-07-13",
    "day": "Monday",
    "slot": "19:15 - 20:30",
    "courseId": "FSA",
    "subject": "Financial Statement Analysis (FSA)",
    "room": "LR 02",
    "instructor": "SB1|11"
  },
  {
    "dateKey": "2026-07-13",
    "day": "Monday",
    "slot": "20:50 - 22:05",
    "courseId": "IAPM",
    "subject": "Investment Analysis & Portfolio Management (IAPM)",
    "room": "LR 02",
    "instructor": "AP2|8"
  },
  {
    "dateKey": "2026-07-13",
    "day": "Monday",
    "slot": "08:45 - 10:00",
    "courseId": "AIDMD",
    "subject": "AI-Driven Marketing Decision Making (AIDMD)",
    "room": "LR 07",
    "instructor": "AK2|11"
  },
  {
    "dateKey": "2026-07-13",
    "day": "Monday",
    "slot": "14:30 - 15:45",
    "courseId": "GBS Sec-B",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 07",
    "instructor": "PD|11"
  },
  {
    "dateKey": "2026-07-13",
    "day": "Monday",
    "slot": "16:05 - 17:20",
    "courseId": "SC",
    "subject": "Strategic Consulting (SC)",
    "room": "LR 07",
    "instructor": "DD|11"
  },
  {
    "dateKey": "2026-07-13",
    "day": "Monday",
    "slot": "17:40 - 18:55",
    "courseId": "SCM Sec-B",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 07",
    "instructor": "PP|11"
  },
  {
    "dateKey": "2026-07-13",
    "day": "Monday",
    "slot": "19:15 - 20:30",
    "courseId": "PS",
    "subject": "Pricing Strategies (PS)",
    "room": "LR 07",
    "instructor": "HS|11"
  },
  {
    "dateKey": "2026-07-13",
    "day": "Monday",
    "slot": "22:25 - 23:40",
    "courseId": "CV Sec-B",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 07",
    "instructor": "SA|10"
  },
  {
    "dateKey": "2026-07-13",
    "day": "Monday",
    "slot": "08:45 - 10:00",
    "courseId": "GBS Sec-C",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "RC|11"
  },
  {
    "dateKey": "2026-07-13",
    "day": "Monday",
    "slot": "14:30 - 15:45",
    "courseId": "GBS Sec-D",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "DD|11"
  },
  {
    "dateKey": "2026-07-14",
    "day": "Tuesday",
    "slot": "08:45 - 10:00",
    "courseId": "L&D",
    "subject": "L&D",
    "room": "LR 02",
    "instructor": "SY|11"
  },
  {
    "dateKey": "2026-07-14",
    "day": "Tuesday",
    "slot": "14:30 - 15:45",
    "courseId": "FM",
    "subject": "Financial Modelling (FM)",
    "room": "LR 02",
    "instructor": "AKM|6"
  },
  {
    "dateKey": "2026-07-14",
    "day": "Tuesday",
    "slot": "16:05 - 17:20",
    "courseId": "PWMP",
    "subject": "Playing to Win Market and Power (PWMP)",
    "room": "LR 02",
    "instructor": "SB2|9"
  },
  {
    "dateKey": "2026-07-14",
    "day": "Tuesday",
    "slot": "17:40 - 18:55",
    "courseId": "IAPM",
    "subject": "Investment Analysis & Portfolio Management (IAPM)",
    "room": "LR 02",
    "instructor": "AP2|9"
  },
  {
    "dateKey": "2026-07-14",
    "day": "Tuesday",
    "slot": "19:15 - 20:30",
    "courseId": "CB Sec-A",
    "subject": "Consumer Behaviour (CB)",
    "room": "LR 02",
    "instructor": "AY|8"
  },
  {
    "dateKey": "2026-07-14",
    "day": "Tuesday",
    "slot": "08:45 - 10:00",
    "courseId": "MFIS",
    "subject": "Management of Financial Institutions and Services (MFIS)",
    "room": "LR 07",
    "instructor": "VB|11"
  },
  {
    "dateKey": "2026-07-14",
    "day": "Tuesday",
    "slot": "16:05 - 17:20",
    "courseId": "SHRM",
    "subject": "Strategic Human Resource Management (SHRM)",
    "room": "LR 07",
    "instructor": "AP1|9"
  },
  {
    "dateKey": "2026-07-14",
    "day": "Tuesday",
    "slot": "17:40 - 18:55",
    "courseId": "SDM",
    "subject": "Sales and Distribution Management (SDM)",
    "room": "LR 07",
    "instructor": "AS2|9"
  },
  {
    "dateKey": "2026-07-14",
    "day": "Tuesday",
    "slot": "19:15 - 20:30",
    "courseId": "B2B",
    "subject": "B2B Marketing (B2B)",
    "room": "LR 07",
    "instructor": "MK|8"
  },
  {
    "dateKey": "2026-07-14",
    "day": "Tuesday",
    "slot": "20:50 - 22:05",
    "courseId": "CB Sec-B",
    "subject": "Consumer Behaviour (CB)",
    "room": "LR 07",
    "instructor": "AY|8"
  },
  {
    "dateKey": "2026-07-14",
    "day": "Tuesday",
    "slot": "22:25 - 23:40",
    "courseId": "CV Sec-B",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 07",
    "instructor": "SA|11"
  },
  {
    "dateKey": "2026-07-14",
    "day": "Tuesday",
    "slot": "08:45 - 10:00",
    "courseId": "DBM",
    "subject": "Digital Business Models (DBM)",
    "room": "LR 06",
    "instructor": "SS|11"
  },
  {
    "dateKey": "2026-07-15",
    "day": "Wednesday",
    "slot": "08:45 - 10:00",
    "courseId": "FADT",
    "subject": "Fundamentals and Applications of Design Thinking (FADT)",
    "room": "LR 02",
    "instructor": "RSY|11"
  },
  {
    "dateKey": "2026-07-15",
    "day": "Wednesday",
    "slot": "14:30 - 15:45",
    "courseId": "IMDM",
    "subject": "Insurance and Managerial Decision Making (IMDM)",
    "room": "LR 02",
    "instructor": "SB2|8"
  },
  {
    "dateKey": "2026-07-15",
    "day": "Wednesday",
    "slot": "17:40 - 18:55",
    "courseId": "BA Sec-A",
    "subject": "Business Analytics (BA)",
    "room": "LR 02",
    "instructor": "PRS|8"
  },
  {
    "dateKey": "2026-07-15",
    "day": "Wednesday",
    "slot": "20:50 - 22:05",
    "courseId": "CV Sec-A",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 02",
    "instructor": "SA|12"
  },
  {
    "dateKey": "2026-07-15",
    "day": "Wednesday",
    "slot": "08:45 - 10:00",
    "courseId": "IBS",
    "subject": "International Business Strategies (IBS)",
    "room": "LR 07",
    "instructor": "PD|10"
  },
  {
    "dateKey": "2026-07-15",
    "day": "Wednesday",
    "slot": "16:05 - 17:20",
    "courseId": "CV Sec-B",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 07",
    "instructor": "SA|12"
  },
  {
    "dateKey": "2026-07-15",
    "day": "Wednesday",
    "slot": "17:40 - 18:55",
    "courseId": "BGRI",
    "subject": "Business\u2013Government Relations in India (BGRI)",
    "room": "LR 07",
    "instructor": "RK|9"
  },
  {
    "dateKey": "2026-07-15",
    "day": "Wednesday",
    "slot": "19:15 - 20:30",
    "courseId": "BA Sec-B",
    "subject": "Business Analytics (BA)",
    "room": "LR 07",
    "instructor": "PRS|8"
  },
  {
    "dateKey": "2026-07-15",
    "day": "Wednesday",
    "slot": "20:50 - 22:05",
    "courseId": "PM",
    "subject": "Project Management (PM)",
    "room": "LR 07",
    "instructor": "AS1|12"
  },
  {
    "dateKey": "2026-07-15",
    "day": "Wednesday",
    "slot": "20:50 - 22:05",
    "courseId": "PCM",
    "subject": "Performance and Compensation Management (PCM)",
    "room": "LR 06",
    "instructor": "RSY|11"
  },
  {
    "dateKey": "2026-07-16",
    "day": "Thursday",
    "slot": "08:45 - 10:00",
    "courseId": "Ind 4.0",
    "subject": "Industry 4.0 Revolutionize your Business (IND 4.0)",
    "room": "LR 02",
    "instructor": "AK1|2"
  },
  {
    "dateKey": "2026-07-16",
    "day": "Thursday",
    "slot": "14:30 - 15:45",
    "courseId": "TA",
    "subject": "Talent Acquisition (TA)",
    "room": "LR 02",
    "instructor": "RSY|9"
  },
  {
    "dateKey": "2026-07-16",
    "day": "Thursday",
    "slot": "16:05 - 17:20",
    "courseId": "GBS Sec-A",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 02",
    "instructor": "PD|12"
  },
  {
    "dateKey": "2026-07-16",
    "day": "Thursday",
    "slot": "17:40 - 18:55",
    "courseId": "CW Sec-A",
    "subject": "Communication Workshop",
    "room": "LR 02",
    "instructor": "XZR|3"
  },
  {
    "dateKey": "2026-07-16",
    "day": "Thursday",
    "slot": "20:50 - 22:05",
    "courseId": "SCM Sec-A",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 02",
    "instructor": "PP|12"
  },
  {
    "dateKey": "2026-07-16",
    "day": "Thursday",
    "slot": "08:45 - 10:00",
    "courseId": "GFMG",
    "subject": "Global Financial Markets and Geopolitics (GFMG)",
    "room": "LR 07",
    "instructor": "US|2"
  },
  {
    "dateKey": "2026-07-16",
    "day": "Thursday",
    "slot": "16:05 - 17:20",
    "courseId": "AIDMD",
    "subject": "AI-Driven Marketing Decision Making (AIDMD)",
    "room": "LR 07",
    "instructor": "AK2|12"
  },
  {
    "dateKey": "2026-07-16",
    "day": "Thursday",
    "slot": "17:40 - 18:55",
    "courseId": "GBS Sec-B",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 07",
    "instructor": "PD|12"
  },
  {
    "dateKey": "2026-07-16",
    "day": "Thursday",
    "slot": "19:15 - 20:30",
    "courseId": "SCM Sec-B",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 07",
    "instructor": "PP|12"
  },
  {
    "dateKey": "2026-07-16",
    "day": "Thursday",
    "slot": "20:50 - 22:05",
    "courseId": "SC",
    "subject": "Strategic Consulting (SC)",
    "room": "LR 07",
    "instructor": "DD|12"
  },
  {
    "dateKey": "2026-07-16",
    "day": "Thursday",
    "slot": "08:45 - 10:00",
    "courseId": "PFM",
    "subject": "Python for Managers (PFM)",
    "room": "LR 06",
    "instructor": "AK3|2"
  },
  {
    "dateKey": "2026-07-16",
    "day": "Thursday",
    "slot": "10:20 - 11:35",
    "courseId": "CW Sec-C",
    "subject": "Communication Workshop",
    "room": "LR 06",
    "instructor": "XZR|3"
  },
  {
    "dateKey": "2026-07-16",
    "day": "Thursday",
    "slot": "16:05 - 17:20",
    "courseId": "GBS Sec-C",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "RC|12"
  },
  {
    "dateKey": "2026-07-16",
    "day": "Thursday",
    "slot": "17:40 - 18:55",
    "courseId": "GBS Sec-D",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "DD|12"
  },
  {
    "dateKey": "2026-07-17",
    "day": "Friday",
    "slot": "08:45 - 10:00",
    "courseId": "IMDM",
    "subject": "Insurance and Managerial Decision Making (IMDM)",
    "room": "LR 02",
    "instructor": "SB2|9"
  },
  {
    "dateKey": "2026-07-17",
    "day": "Friday",
    "slot": "14:30 - 15:45",
    "courseId": "IAPM",
    "subject": "Investment Analysis & Portfolio Management (IAPM)",
    "room": "LR 02",
    "instructor": "AP2|10"
  },
  {
    "dateKey": "2026-07-17",
    "day": "Friday",
    "slot": "16:05 - 17:20",
    "courseId": "BA Sec-A",
    "subject": "Business Analytics (BA)",
    "room": "LR 02",
    "instructor": "PRS|9"
  },
  {
    "dateKey": "2026-07-17",
    "day": "Friday",
    "slot": "20:50 - 22:05",
    "courseId": "CB Sec-A",
    "subject": "Consumer Behaviour (CB)",
    "room": "LR 02",
    "instructor": "AY|9"
  },
  {
    "dateKey": "2026-07-17",
    "day": "Friday",
    "slot": "10:20 - 11:35",
    "courseId": "CW Sec-B",
    "subject": "Communication Workshop",
    "room": "LR 07",
    "instructor": "XZR|3"
  },
  {
    "dateKey": "2026-07-17",
    "day": "Friday",
    "slot": "14:30 - 15:45",
    "courseId": "SDM",
    "subject": "Sales and Distribution Management (SDM)",
    "room": "LR 07",
    "instructor": "AS2|10"
  },
  {
    "dateKey": "2026-07-17",
    "day": "Friday",
    "slot": "16:05 - 17:20",
    "courseId": "BGRI",
    "subject": "Business\u2013Government Relations in India (BGRI)",
    "room": "LR 07",
    "instructor": "RK|10"
  },
  {
    "dateKey": "2026-07-17",
    "day": "Friday",
    "slot": "17:40 - 18:55",
    "courseId": "BA Sec-B",
    "subject": "Business Analytics (BA)",
    "room": "LR 07",
    "instructor": "PRS|9"
  },
  {
    "dateKey": "2026-07-17",
    "day": "Friday",
    "slot": "19:15 - 20:30",
    "courseId": "CB Sec-B",
    "subject": "Consumer Behaviour (CB)",
    "room": "LR 07",
    "instructor": "AY|9"
  },
  {
    "dateKey": "2026-07-17",
    "day": "Friday",
    "slot": "20:50 - 22:05",
    "courseId": "B2B",
    "subject": "B2B Marketing (B2B)",
    "room": "LR 07",
    "instructor": "MK|9"
  },
  {
    "dateKey": "2026-07-17",
    "day": "Friday",
    "slot": "22:25 - 23:40",
    "courseId": "CW Sec-D",
    "subject": "Communication Workshop",
    "room": "LR 06",
    "instructor": "XZR|3"
  },
  {
    "dateKey": "2026-07-18",
    "day": "Saturday",
    "slot": "08:45 - 10:00",
    "courseId": "L&D",
    "subject": "L&D",
    "room": "LR 02",
    "instructor": "SY|12"
  },
  {
    "dateKey": "2026-07-18",
    "day": "Saturday",
    "slot": "10:20 - 11:35",
    "courseId": "CW Sec-A",
    "subject": "Communication Workshop",
    "room": "LR 02",
    "instructor": "XZR|4"
  },
  {
    "dateKey": "2026-07-18",
    "day": "Saturday",
    "slot": "14:30 - 15:45",
    "courseId": "PWMP",
    "subject": "Playing to Win Market and Power (PWMP)",
    "room": "LR 02",
    "instructor": "SB2|10"
  },
  {
    "dateKey": "2026-07-18",
    "day": "Saturday",
    "slot": "16:05 - 17:20",
    "courseId": "FADT",
    "subject": "Fundamentals and Applications of Design Thinking (FADT)",
    "room": "LR 02",
    "instructor": "RSY|12"
  },
  {
    "dateKey": "2026-07-18",
    "day": "Saturday",
    "slot": "17:40 - 18:55",
    "courseId": "FSA",
    "subject": "Financial Statement Analysis (FSA)",
    "room": "LR 02",
    "instructor": "SB1|12"
  },
  {
    "dateKey": "2026-07-18",
    "day": "Saturday",
    "slot": "19:15 - 20:30",
    "courseId": "CV Sec-A",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 02",
    "instructor": "SA|13"
  },
  {
    "dateKey": "2026-07-18",
    "day": "Saturday",
    "slot": "08:45 - 10:00",
    "courseId": "MFIS",
    "subject": "Management of Financial Institutions and Services (MFIS)",
    "room": "LR 07",
    "instructor": "VB|12"
  },
  {
    "dateKey": "2026-07-18",
    "day": "Saturday",
    "slot": "11:55 - 01:10",
    "courseId": "CW Sec-B",
    "subject": "Communication Workshop",
    "room": "LR 07",
    "instructor": "XZR|4"
  },
  {
    "dateKey": "2026-07-18",
    "day": "Saturday",
    "slot": "14:30 - 15:45",
    "courseId": "SHRM",
    "subject": "Strategic Human Resource Management (SHRM)",
    "room": "LR 07",
    "instructor": "AP1|10"
  },
  {
    "dateKey": "2026-07-18",
    "day": "Saturday",
    "slot": "16:05 - 17:20",
    "courseId": "IBS",
    "subject": "International Business Strategies (IBS)",
    "room": "LR 07",
    "instructor": "PD|11"
  },
  {
    "dateKey": "2026-07-18",
    "day": "Saturday",
    "slot": "17:40 - 18:55",
    "courseId": "PS",
    "subject": "Pricing Strategies (PS)",
    "room": "LR 07",
    "instructor": "HS|12"
  },
  {
    "dateKey": "2026-07-18",
    "day": "Saturday",
    "slot": "19:15 - 20:30",
    "courseId": "PM",
    "subject": "Project Management (PM)",
    "room": "LR 07",
    "instructor": "AS1|13"
  },
  {
    "dateKey": "2026-07-18",
    "day": "Saturday",
    "slot": "20:50 - 22:05",
    "courseId": "CV Sec-B",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 07",
    "instructor": "SA|13"
  },
  {
    "dateKey": "2026-07-18",
    "day": "Saturday",
    "slot": "22:25 - 23:40",
    "courseId": "BA Sec-B",
    "subject": "Business Analytics (BA)",
    "room": "LR 07",
    "instructor": "PRS|10"
  },
  {
    "dateKey": "2026-07-18",
    "day": "Saturday",
    "slot": "08:45 - 10:00",
    "courseId": "DBM",
    "subject": "Digital Business Models (DBM)",
    "room": "LR 06",
    "instructor": "SS|12"
  },
  {
    "dateKey": "2026-07-18",
    "day": "Saturday",
    "slot": "19:15 - 20:30",
    "courseId": "PCM",
    "subject": "Performance and Compensation Management (PCM)",
    "room": "LR 06",
    "instructor": "RSY|12"
  },
  {
    "dateKey": "2026-07-20",
    "day": "Monday",
    "slot": "08:45 - 10:00",
    "courseId": "SCM Sec-A",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 02",
    "instructor": "PP|13"
  },
  {
    "dateKey": "2026-07-20",
    "day": "Monday",
    "slot": "16:05 - 17:20",
    "courseId": "Ind 4.0",
    "subject": "Industry 4.0 Revolutionize your Business (IND 4.0)",
    "room": "LR 02",
    "instructor": "AK1|3"
  },
  {
    "dateKey": "2026-07-20",
    "day": "Monday",
    "slot": "17:40 - 18:55",
    "courseId": "TA",
    "subject": "Talent Acquisition (TA)",
    "room": "LR 02",
    "instructor": "RSY|10"
  },
  {
    "dateKey": "2026-07-20",
    "day": "Monday",
    "slot": "19:15 - 20:30",
    "courseId": "GBS Sec-A",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 02",
    "instructor": "PD|13"
  },
  {
    "dateKey": "2026-07-20",
    "day": "Monday",
    "slot": "22:25 - 23:40",
    "courseId": "IMDM",
    "subject": "Insurance and Managerial Decision Making (IMDM)",
    "room": "LR 02",
    "instructor": "SB2|10"
  },
  {
    "dateKey": "2026-07-20",
    "day": "Monday",
    "slot": "08:45 - 10:00",
    "courseId": "SC",
    "subject": "Strategic Consulting (SC)",
    "room": "LR 07",
    "instructor": "DD|13"
  },
  {
    "dateKey": "2026-07-20",
    "day": "Monday",
    "slot": "14:30 - 15:45",
    "courseId": "SCM Sec-B",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 07",
    "instructor": "PP|13"
  },
  {
    "dateKey": "2026-07-20",
    "day": "Monday",
    "slot": "16:05 - 17:20",
    "courseId": "GFMG",
    "subject": "Global Financial Markets and Geopolitics (GFMG)",
    "room": "LR 07",
    "instructor": "US|3"
  },
  {
    "dateKey": "2026-07-20",
    "day": "Monday",
    "slot": "19:15 - 20:30",
    "courseId": "AIDMD",
    "subject": "AI-Driven Marketing Decision Making (AIDMD)",
    "room": "LR 07",
    "instructor": "AK2|13"
  },
  {
    "dateKey": "2026-07-20",
    "day": "Monday",
    "slot": "20:50 - 22:05",
    "courseId": "GBS Sec-B",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 07",
    "instructor": "PD|13"
  },
  {
    "dateKey": "2026-07-20",
    "day": "Monday",
    "slot": "16:05 - 17:20",
    "courseId": "PFM",
    "subject": "Python for Managers (PFM)",
    "room": "LR 06",
    "instructor": "AK3|3"
  },
  {
    "dateKey": "2026-07-20",
    "day": "Monday",
    "slot": "19:15 - 20:30",
    "courseId": "GBS Sec-C",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "RC|13"
  },
  {
    "dateKey": "2026-07-20",
    "day": "Monday",
    "slot": "20:50 - 22:05",
    "courseId": "GBS Sec-D",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "DD|13"
  },
  {
    "dateKey": "2026-07-21",
    "day": "Tuesday",
    "slot": "08:45 - 10:00",
    "courseId": "BA Sec-A",
    "subject": "Business Analytics (BA)",
    "room": "LR 02",
    "instructor": "PRS|10"
  },
  {
    "dateKey": "2026-07-21",
    "day": "Tuesday",
    "slot": "16:05 - 17:20",
    "courseId": "FSA",
    "subject": "Financial Statement Analysis (FSA)",
    "room": "LR 02",
    "instructor": "SB1|13"
  },
  {
    "dateKey": "2026-07-21",
    "day": "Tuesday",
    "slot": "19:15 - 20:30",
    "courseId": "CV Sec-A",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 02",
    "instructor": "SA|14"
  },
  {
    "dateKey": "2026-07-21",
    "day": "Tuesday",
    "slot": "20:50 - 22:05",
    "courseId": "FADT",
    "subject": "Fundamentals and Applications of Design Thinking (FADT)",
    "room": "LR 02",
    "instructor": "RSY|13"
  },
  {
    "dateKey": "2026-07-21",
    "day": "Tuesday",
    "slot": "08:45 - 10:00",
    "courseId": "BGRI",
    "subject": "Business\u2013Government Relations in India (BGRI)",
    "room": "LR 07",
    "instructor": "RK|11"
  },
  {
    "dateKey": "2026-07-21",
    "day": "Tuesday",
    "slot": "14:30 - 15:45",
    "courseId": "BA Sec-B",
    "subject": "Business Analytics (BA)",
    "room": "LR 07",
    "instructor": "PRS|11"
  },
  {
    "dateKey": "2026-07-21",
    "day": "Tuesday",
    "slot": "16:05 - 17:20",
    "courseId": "PS",
    "subject": "Pricing Strategies (PS)",
    "room": "LR 07",
    "instructor": "HS|13"
  },
  {
    "dateKey": "2026-07-21",
    "day": "Tuesday",
    "slot": "17:40 - 18:55",
    "courseId": "CV Sec-B",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 07",
    "instructor": "SA|14"
  },
  {
    "dateKey": "2026-07-21",
    "day": "Tuesday",
    "slot": "20:50 - 22:05",
    "courseId": "IBS",
    "subject": "International Business Strategies (IBS)",
    "room": "LR 07",
    "instructor": "PD|12"
  },
  {
    "dateKey": "2026-07-21",
    "day": "Tuesday",
    "slot": "19:15 - 20:30",
    "courseId": "PCM",
    "subject": "Performance and Compensation Management (PCM)",
    "room": "LR 06",
    "instructor": "RSY|13"
  },
  {
    "dateKey": "2026-07-22",
    "day": "Wednesday",
    "slot": "08:45 - 10:00",
    "courseId": "PWMP",
    "subject": "Playing to Win Market and Power (PWMP)",
    "room": "LR 02",
    "instructor": "SB2|11"
  },
  {
    "dateKey": "2026-07-22",
    "day": "Wednesday",
    "slot": "14:30 - 15:45",
    "courseId": "L&D",
    "subject": "L&D",
    "room": "LR 02",
    "instructor": "SY|13"
  },
  {
    "dateKey": "2026-07-22",
    "day": "Wednesday",
    "slot": "17:40 - 18:55",
    "courseId": "SCM Sec-A",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 02",
    "instructor": "PP|14"
  },
  {
    "dateKey": "2026-07-22",
    "day": "Wednesday",
    "slot": "20:50 - 22:05",
    "courseId": "GBS Sec-A",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 02",
    "instructor": "PD|14"
  },
  {
    "dateKey": "2026-07-22",
    "day": "Wednesday",
    "slot": "22:25 - 23:40",
    "courseId": "TA",
    "subject": "Talent Acquisition (TA)",
    "room": "LR 02",
    "instructor": "RSY|11"
  },
  {
    "dateKey": "2026-07-22",
    "day": "Wednesday",
    "slot": "08:45 - 10:00",
    "courseId": "SHRM",
    "subject": "Strategic Human Resource Management (SHRM)",
    "room": "LR 07",
    "instructor": "AP1|11"
  },
  {
    "dateKey": "2026-07-22",
    "day": "Wednesday",
    "slot": "14:30 - 15:45",
    "courseId": "MFIS",
    "subject": "Management of Financial Institutions and Services (MFIS)",
    "room": "LR 07",
    "instructor": "VB|13"
  },
  {
    "dateKey": "2026-07-22",
    "day": "Wednesday",
    "slot": "16:05 - 17:20",
    "courseId": "SCM Sec-B",
    "subject": "Supply Chain Management (SCM)",
    "room": "LR 07",
    "instructor": "PP|14"
  },
  {
    "dateKey": "2026-07-22",
    "day": "Wednesday",
    "slot": "17:40 - 18:55",
    "courseId": "SC",
    "subject": "Strategic Consulting (SC)",
    "room": "LR 07",
    "instructor": "DD|14"
  },
  {
    "dateKey": "2026-07-22",
    "day": "Wednesday",
    "slot": "19:15 - 20:30",
    "courseId": "GBS Sec-B",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 07",
    "instructor": "PD|14"
  },
  {
    "dateKey": "2026-07-22",
    "day": "Wednesday",
    "slot": "20:50 - 22:05",
    "courseId": "AIDMD",
    "subject": "AI-Driven Marketing Decision Making (AIDMD)",
    "room": "LR 07",
    "instructor": "AK2|14"
  },
  {
    "dateKey": "2026-07-22",
    "day": "Wednesday",
    "slot": "14:30 - 15:45",
    "courseId": "DBM",
    "subject": "Digital Business Models (DBM)",
    "room": "LR 06",
    "instructor": "SS|13"
  },
  {
    "dateKey": "2026-07-22",
    "day": "Wednesday",
    "slot": "20:50 - 22:05",
    "courseId": "GBS Sec-C",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "RC|14"
  },
  {
    "dateKey": "2026-07-22",
    "day": "Wednesday",
    "slot": "19:15 - 20:30",
    "courseId": "GBS Sec-D",
    "subject": "Global Business Simulation (GBS)",
    "room": "LR 06",
    "instructor": "DD|14"
  },
  {
    "dateKey": "2026-07-23",
    "day": "Thursday",
    "slot": "08:45 - 10:00",
    "courseId": "IAPM",
    "subject": "Investment Analysis & Portfolio Management (IAPM)",
    "room": "LR 02",
    "instructor": "AP2|11"
  },
  {
    "dateKey": "2026-07-23",
    "day": "Thursday",
    "slot": "17:40 - 18:55",
    "courseId": "CB Sec-A",
    "subject": "Consumer Behaviour (CB)",
    "room": "LR 02",
    "instructor": "AY|10"
  },
  {
    "dateKey": "2026-07-23",
    "day": "Thursday",
    "slot": "19:15 - 20:30",
    "courseId": "BA Sec-A",
    "subject": "Business Analytics (BA)",
    "room": "LR 02",
    "instructor": "PRS|11"
  },
  {
    "dateKey": "2026-07-23",
    "day": "Thursday",
    "slot": "22:25 - 23:40",
    "courseId": "PWMP",
    "subject": "Playing to Win Market and Power (PWMP)",
    "room": "LR 02",
    "instructor": "SB2|12"
  },
  {
    "dateKey": "2026-07-23",
    "day": "Thursday",
    "slot": "08:45 - 10:00",
    "courseId": "SDM",
    "subject": "Sales and Distribution Management (SDM)",
    "room": "LR 07",
    "instructor": "AS2|11"
  },
  {
    "dateKey": "2026-07-23",
    "day": "Thursday",
    "slot": "14:30 - 15:45",
    "courseId": "IBS",
    "subject": "International Business Strategies (IBS)",
    "room": "LR 07",
    "instructor": "PD|13"
  },
  {
    "dateKey": "2026-07-23",
    "day": "Thursday",
    "slot": "16:05 - 17:20",
    "courseId": "CB Sec-B",
    "subject": "Consumer Behaviour (CB)",
    "room": "LR 07",
    "instructor": "AY|10"
  },
  {
    "dateKey": "2026-07-23",
    "day": "Thursday",
    "slot": "17:40 - 18:55",
    "courseId": "B2B",
    "subject": "B2B Marketing (B2B)",
    "room": "LR 07",
    "instructor": "MK|10"
  },
  {
    "dateKey": "2026-07-23",
    "day": "Thursday",
    "slot": "19:15 - 20:30",
    "courseId": "BGRI",
    "subject": "Business\u2013Government Relations in India (BGRI)",
    "room": "LR 07",
    "instructor": "RK|12"
  },
  {
    "dateKey": "2026-07-23",
    "day": "Thursday",
    "slot": "20:50 - 22:05",
    "courseId": "BA Sec-B",
    "subject": "Business Analytics (BA)",
    "room": "LR 07",
    "instructor": "PRS|12"
  },
  {
    "dateKey": "2026-07-23",
    "day": "Thursday",
    "slot": "22:25 - 23:40",
    "courseId": "SHRM",
    "subject": "Strategic Human Resource Management (SHRM)",
    "room": "LR 07",
    "instructor": "AP1|12"
  },
  {
    "dateKey": "2026-07-24",
    "day": "Friday",
    "slot": "14:30 - 15:45",
    "courseId": "FADT",
    "subject": "Fundamentals and Applications of Design Thinking (FADT)",
    "room": "LR 02",
    "instructor": "RSY|14"
  },
  {
    "dateKey": "2026-07-24",
    "day": "Friday",
    "slot": "16:05 - 17:20",
    "courseId": "CV Sec-A",
    "subject": "Corporate Valuation (CV)",
    "room": "LR 02",
    "instructor": "SA|15"
  },
  {
    "dateKey": "2026-07-24",
    "day": "Friday",
    "slot": "17:40 - 18:55",
    "courseId": "MBPET",
    "subject": "Managing Business Processes with Emerging Technologies (MBPET)",
    "room": "LR 02",
    "instructor": "RN|11"
  },
  {
    "dateKey": "2026-07-24",
    "day": "Friday",
    "slot": "19:15 - 20:30",
    "courseId": "MBPET",
    "subject": "Managing Business Processes with Emerging Technologies (MBPET)",
    "room": "LR 02",
    "instructor": "RN|12"
  },
  {
    "dateKey": "2026-07-24",
    "day": "Friday",
    "slot": "20:50 - 22:05",
    "courseId": "Ind 4.0",
    "subject": "Industry 4.0 Revolutionize your Business (IND 4.0)",
    "room": "LR 02",
    "instructor": "AK1|4"
  },
  {
    "dateKey": "2026-07-24",
    "day": "Friday",
    "slot": "22:25 - 23:40",
    "courseId": "L&D",
    "subject": "L&D",
    "room": "LR 02",
    "instructor": "SY|14"
  }
];

