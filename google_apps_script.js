// Google Apps Script – Complete Non-Cyclical 4-Row Grid Parser for Term V Timetable
// Spreadsheet ID: 1KO1bwDTVyirnMFLKpsdDe8y6OiicN-Xju9ytnpnDIFQ

const SUPABASE_URL = "https://frnyuuywkteqiyinlrmp.supabase.co";
const SUPABASE_KEY = "sb_publishable_dfysjA_5CU1AmweExgrmiA_FD0AS34o";
const SHEET_ID = "1KO1bwDTVyirnMFLKpsdDe8y6OiicN-Xju9ytnpnDIFQ";

function doGet(e) {
  try {
    var sessions = fetchTimetableSessions();
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      count: sessions.length,
      lastUpdated: new Date().toISOString(),
      sessions: sessions
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function mapToCourseCode(cName) {
  if (!cName) return "";
  var str = String(cName).trim();
  var u = str.toUpperCase();

  var secMatch = u.match(/SEC[\s\-]*([A-D])/);
  var secStr = secMatch ? (" Sec-" + secMatch[1]) : "";

  if (u.includes("GROWTH") || u.includes("EMERGING") || u.includes("GSEC")) return "GSEC";
  if (u.includes("CYBER") || u.includes("CSY")) return "CSY";
  if (u.includes("INFORMATION TECH") || u.includes("IT STRATEGY") || u === "IT" || u.startsWith("IT ")) return "IT";
  if (u.includes("FINANCIAL RISK") || u.includes("OPERATIONS MANAGEMENT") || u.includes("FORM")) return "FORM";
  if (u.includes("PRODUCT & BRAND") || u.includes("BRAND MANAGEMENT") || u.includes("PBM")) return "PBM" + secStr;
  if (u.includes("SOCIAL NETWORK") || u.includes("STRATEGIES FOR NEW AGE") || u.includes("SNAB")) return "SNAB";
  if (u.includes("QUALITY") || u.includes("SIX SIGMA") || u.includes("TQMS")) return "TQMS" + secStr;
  if (u.includes("MANAGEMENT SYSTEMS") || u.includes("MANAGEMENT STRUCTURE") || u.includes("MSS")) return "MSS" + secStr;
  if (u.includes("INSTITUTIONS") || u.includes("FINANCIAL SERVICES") || u.includes("FIS")) return "FIS";
  if (u.includes("INTERNATIONAL BUSINESS") || u === "IB" || u.startsWith("IB ")) return "IB";
  if (u.includes("NEGOTIATION") || u.includes("COMMERCIAL MANAGEMENT") || u.includes("SNCM")) return "SNCM" + secStr;
  if (u.includes("ADVANCED ACCOUNTING") || u.includes("AAB")) return "AAB";
  if (u.includes("WEALTH") || u.includes("PERSONAL FINANCE") || u.includes("PFWM")) return "PFWM";
  if (u.includes("BANKING") || u.includes("MBFM")) return "MBFM";
  if (u.includes("STRATEGIC MANAGEMENT") || u === "SM" || u.startsWith("SM ")) return "SM";
  if (u.includes("MARKET STRUCTURE") || u.includes("MSD")) return "MSD";
  if (u.includes("NEW PRODUCT") || u.includes("NPD")) return "NPD";
  if (u.includes("SERVICE OPERATIONS") || u.includes("SOM")) return "SoM";
  if (u.includes("INTEGRATED MARKETING") || u.includes("IMC")) return "IMC";
  if (u.includes("SERVICES MARKETING") || u.includes("SSM")) return "SSM";
  if (u.includes("TALENT MANAGEMENT") || u === "TM" || u.startsWith("TM ")) return "TM";
  if (u.includes("MERGERS") || u === "M&A" || u.includes("M & A")) return "M&A";
  if (u.includes("ENTREPRENEURSHIP") || u === "ENV") return "ENV";
  if (u.includes("PROJECT COURSE")) return "Project Course";

  return "";
}

function formatDateToKey(dVal) {
  if (!dVal) return "";
  if (dVal instanceof Date) {
    if (isNaN(dVal.getTime())) return "";
    return Utilities.formatDate(dVal, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  var str = String(dVal).trim();
  
  var mSlash = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (mSlash) {
    return mSlash[3] + "-" + String(mSlash[2]).padStart(2, '0') + "-" + String(mSlash[1]).padStart(2, '0');
  }
  
  var mISO = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (mISO) {
    return mISO[1] + "-" + String(mISO[2]).padStart(2, '0') + "-" + String(mISO[3]).padStart(2, '0');
  }

  // Handle strings like "12-Sep-26" or "12-Sep-2026"
  var mText = str.match(/^(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{2,4})/);
  if (mText) {
    var day = String(mText[1]).padStart(2, '0');
    var monthMap = { 'JAN':'01', 'FEB':'02', 'MAR':'03', 'APR':'04', 'MAY':'05', 'JUN':'06', 'JUL':'07', 'AUG':'08', 'SEP':'09', 'OCT':'10', 'NOV':'11', 'DEC':'12' };
    var mon = monthMap[mText[2].toUpperCase()] || '09';
    var yr = mText[3].length === 2 ? ('20' + mText[3]) : mText[3];
    return yr + "-" + mon + "-" + day;
  }

  var pDate = new Date(str);
  if (!isNaN(pDate.getTime()) && pDate.getFullYear() > 2020 && pDate.getFullYear() < 2030) {
    return Utilities.formatDate(pDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return "";
}

function formatSlotTime(str) {
  if (!str) return "08:45 - 10:00";
  var s = String(str).trim();
  
  var match = s.match(/(\d{1,2}:\d{2})\s*[\-\u2013\u2014to]*\s*(\d{1,2}:\d{2})/i);
  if (match) {
    var start = match[1].padStart(5, '0');
    var end = match[2].padStart(5, '0');
    return start + " - " + end;
  }
  
  var single = s.match(/(\d{1,2}:\d{2})/);
  if (single) {
    return single[1].padStart(5, '0');
  }
  return s;
}

function fetchTimetableSessions() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheets = ss.getSheets();
  var sessions = [];
  var seenKeys = {};

  var sectionRooms = { "A": "LR 02", "B": "LR 07", "C": "LR 06", "D": "LR 06" };

  var courseAbbrMap = {
    "TM": "Talent Management",
    "IT": "Information Technology",
    "TQMS": "Total Quality Management & Six Sigma",
    "PFWM": "Personal Finance & Wealth Management",
    "GSEC": "Growth Strategies for E-Commerce",
    "AAB": "Advanced Accounting for Business",
    "FIS": "Fixed Income Securities",
    "M&A": "Mergers and Acquisitions",
    "FORM": "Financial Operations & Risk Management",
    "SM": "Strategic Management",
    "CSY": "Cyber Security",
    "SNAB": "Strategies for New Age Businesses",
    "MSS": "Management Structure & Systems",
    "PBM": "Product & Brand Management",
    "SNCM": "Strategic Negotiation & Commercial Management",
    "IB": "International Business",
    "MBFM": "Management of Banking & Financial Services",
    "MSD": "Market Structure & Dynamics",
    "NPD": "New Product Development",
    "SoM": "Service Operations Management",
    "IMC": "Integrated Marketing Communication",
    "SSM": "Services Marketing",
    "ENV": "Entrepreneurship & New Ventures",
    "ESMM": "Executive Sales & Marketing",
    "Project Course": "Project Course"
  };

  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    var data = sheet.getDataRange().getValues();
    if (!data || data.length < 4) continue;

    var headerRowIdx = -1;
    var timeSlotCols = [];

    for (var r = 0; r < Math.min(10, data.length); r++) {
      var rowStr = data[r].map(function(c) { return String(c).trim(); });
      var dIdx = rowStr.findIndex(function(h) { return h.toLowerCase().includes("date"); });
      var sIdx = rowStr.findIndex(function(h) { return h.toLowerCase().includes("section"); });

      if (dIdx !== -1 || sIdx !== -1) {
        headerRowIdx = r;
        for (var c = 2; c < Math.min(13, rowStr.length); c++) {
          var val = rowStr[c];
          if (val && !val.toUpperCase().includes("LUNCH")) {
            timeSlotCols.push({ col: c, slot: formatSlotTime(val) });
          }
        }
        break;
      }
    }

    if (headerRowIdx === -1 || timeSlotCols.length === 0) continue;

    var currentDateKey = "";
    var currentDayName = "";

    for (var r = headerRowIdx + 1; r < data.length; r++) {
      var row = data[r];
      if (!row || row.length < 2) continue;

      var cellA = row[0];
      if (cellA instanceof Date) {
        var formatted = formatDateToKey(cellA);
        if (formatted) {
          currentDateKey = formatted;
          currentDayName = Utilities.formatDate(cellA, Session.getScriptTimeZone(), "EEEE");
        }
      } else if (cellA) {
        var strA = String(cellA).trim();
        var parsedA = formatDateToKey(strA);
        if (parsedA) {
          currentDateKey = parsedA;
        }
        if (/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i.test(strA)) {
          currentDayName = strA;
        }
      }

      if (!currentDateKey) continue;

      var sectionLetter = String(row[1] || "").trim().toUpperCase();
      if (!sectionLetter || !["A", "B", "C", "D"].includes(sectionLetter)) {
        continue;
      }

      var roomName = sectionRooms[sectionLetter] || "LR 07";

      for (var t = 0; t < timeSlotCols.length; t++) {
        var colIdx = timeSlotCols[t].col;
        var slotTime = timeSlotCols[t].slot;

        var cellVal = String(row[colIdx] || "").trim();
        if (!cellVal || cellVal.toUpperCase() === "LUNCH") continue;

        var match = cellVal.match(/^([A-Za-z0-9&\s\.\-]+?)\s*(\d+)?\s*(?:\(([^)]+)\))?$/);
        if (match) {
          var rawCode = match[1].trim();
          var profInitials = match[3] ? match[3].trim() : "Faculty";
          var sessionNum = match[2] ? match[2].trim() : "1";

          var courseCode = mapToCourseCode(rawCode);
          if (!courseCode) continue;

          var sectionedCourses = ["PBM", "TQMS", "SNCM", "MSS", "BA", "CV", "GBS", "CW"];
          var courseId = courseCode;
          if (sectionedCourses.includes(courseCode)) {
            courseId = courseCode + " Sec-" + sectionLetter;
          }

          var subjectName = courseAbbrMap[courseCode] || cellVal;

          var uniqueKey = currentDateKey + "_" + slotTime + "_" + courseId + "_" + sectionLetter;
          if (!seenKeys[uniqueKey]) {
            seenKeys[uniqueKey] = true;
            sessions.push({
              dateKey: currentDateKey,
              day: currentDayName || "Scheduled",
              slot: slotTime,
              courseId: courseId,
              subject: subjectName,
              room: roomName,
              instructor: profInitials + "|" + sessionNum,
              section: sectionLetter
            });
          }
        }
      }
    }
  }

  Logger.log("Total parsed 4-row grid sessions: " + sessions.length);
  return sessions;
}

function syncTimetableToSupabase() {
  var sessions = fetchTimetableSessions();
  Logger.log("Found " + sessions.length + " sessions. Syncing to Supabase...");
  
  if (sessions.length === 0) return;

  var url = SUPABASE_URL + "/rest/v1/timetable";
  var headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": "Bearer " + SUPABASE_KEY,
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
  };

  var chunkSize = 50;
  for (var i = 0; i < sessions.length; i += chunkSize) {
    var chunk = sessions.slice(i, i + chunkSize);
    var payload = chunk.map(function(s) {
      return {
        date_key: s.dateKey,
        day: s.day || "Scheduled",
        slot: s.slot,
        course_id: s.courseId,
        subject: s.subject || s.courseId,
        room: s.room,
        instructor: s.instructor,
        section: s.section
      };
    });

    var options = {
      "method": "post",
      "headers": headers,
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    };

    var response = UrlFetchApp.fetch(url, options);
    Logger.log("Chunk " + (Math.floor(i / chunkSize) + 1) + " Supabase response: " + response.getContentText());
  }
}
