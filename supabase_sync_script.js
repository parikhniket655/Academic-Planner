// Google Apps Script — Sync Live Term V Google Sheet Timetable to Supabase & Send Daily Wazir Emails
// Spreadsheet ID: 1KO1bwDTVyirnMFLKpsdDe8y6OiicN-Xju9ytnpnDIFQ

const SUPABASE_URL = "https://frnyuuywkteqiyinlrmp.supabase.co";
const SUPABASE_KEY = "sb_publishable_dfysjA_5CU1AmweExgrmiA_FD0AS34o";
const SHEET_ID = "1KO1bwDTVyirnMFLKpsdDe8y6OiicN-Xju9ytnpnDIFQ";

// Wazir Members Configuration (9 active members for Term V)
const WAZIR_MEMBERS = {
  "ipm04niketp@iimrohtak.ac.in": {
    "name": "Niket Parikh",
    "courses": ["CSY", "IT", "FORM", "PBM Sec-A", "SNAB", "TQMS Sec-B", "MSS Sec-A"]
  },
  "pgp16hidayrajsinhc@iimrohtak.ac.in": {
    "name": "Hidayrajsinh Chauhan",
    "courses": ["GSEC", "FIS", "FORM", "IB", "SNCM Sec-B", "MSS Sec-C"]
  },
  "ipm04adityabs@iimrohtak.ac.in": {
    "name": "Aditya Brijgopal Sarda",
    "courses": ["GSEC", "AAB", "FIS", "IB", "SNCM Sec-A", "MSS Sec-A"]
  },
  "ipm04prithivit@iimrohtak.ac.in": {
    "name": "Prithivi Tejeshwar",
    "courses": ["FORM", "IB", "PFWM", "PBM Sec-A", "MSS Sec-C", "Project Course"]
  },
  "pgp16tanishthav@iimrohtak.ac.in": {
    "name": "Tanishtha Verma",
    "courses": ["GSEC", "MBFM", "SM", "MSD", "TQMS Sec-B", "MSS Sec-D"]
  },
  "pgp16akshita@iimrohtak.ac.in": {
    "name": "Akshita",
    "courses": ["SNCM Sec-A", "PBM Sec-B", "SNAB", "NPD", "TQMS Sec-A", "MSS Sec-A"]
  },
  "ipm04mridulu@iimrohtak.ac.in": {
    "name": "Mridul Upadhyay",
    "courses": ["AAB", "SNCM Sec-A", "PBM Sec-B", "SoM", "MSS Sec-B", "Project Course"]
  },
  "pgp16divyanshid@iimrohtak.ac.in": {
    "name": "Divyanshi Dongre",
    "courses": ["GSEC", "CSY", "IT", "SNCM Sec-A", "IMC", "SM", "MSS Sec-B"]
  },
  "ipm04rainaa@iimrohtak.ac.in": {
    "name": "Raina Arjun",
    "courses": ["GSEC", "AAB", "FIS", "IB", "SNCM Sec-A", "MSS Sec-A"]
  }
};

const FACULTY_MAP = {
  "CSY": "Dr. Ankit Chaudhary",
  "IT": "Dr. Deepabali Bhattacharjee",
  "FORM": "Dr. Ujjwal Sawarn",
  "PBM Sec-A": "Dr. Archit V. Tapar",
  "PBM Sec-B": "Dr. Harmanjit Singh",
  "TQMS Sec-A": "Dr. C.P. Garg",
  "TQMS Sec-B": "Dr. V.K. Gupta",
  "MSS Sec-A": "Dr. Abhishek Yadav",
  "MSS Sec-B": "Dr. Archit V. Tapar",
  "MSS Sec-C": "Dr. Harmanjit Singh",
  "MSS Sec-D": "Dr. Abhishek Yadav",
  "SNCM Sec-A": "Dr. Madhurima Mishra",
  "SNCM Sec-B": "Dr. Madhurima Mishra",
  "GSEC": "Dr. Ashwani Kumar",
  "AAB": "Dr. Anurag Kulshrestha",
  "PFWM": "Dr Surbhi Verma",
  "MBFM": "Dr. Deepali Dhingra",
  "SNAB": "Dr. Pranav Dharmani",
  "M&A": "Dr. Deepali Dhingra",
  "TM": "Dr. Lubna Rashid Malik",
  "SoM": "Dr. Manish Kumar",
  "FIS": "Dr. Amit Pandey",
  "IB": "Dr. Varun Dawar",
  "MSD": "Dr. Archit V. Tapar",
  "NPD": "Dr. Archit V. Tapar",
  "IMC": "Dr. Garima Sharma",
  "SSM": "Prof. K.K. Garg",
  "ENV": "Dr. Rupesh Chandra",
  "ESMM": "Dr. P.K. Sharma"
};

const QUOTES = [
  "Love is beautiful. So is being employed.",
  "The only way to do great work is to love what you do. - Steve Jobs",
  "It always seems impossible until it's done. - Nelson Mandela",
  "Success is not final, failure is not fatal: it is the courage to continue that counts. - Winston Churchill",
  "Opportunities don't happen, you create them. - Chris Grosser",
  "The secret of getting ahead is getting started. - Mark Twain",
  "Consulting is the art of telling someone how to build a watch after borrowing their own watch.",
  "An expert is a person who has made all the mistakes that can be made in a very narrow field. - Niels Bohr",
  "Action is the foundational key to all success. - Pablo Picasso",
  "The best way to predict the future is to create it. - Peter Drucker",
  "Focus on being productive instead of busy. - Tim Ferriss"
];

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.debug) {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var sheet = ss.getSheets()[0];
      var raw = sheet.getRange(1, 1, 12, 12).getDisplayValues();
      return ContentService.createTextOutput(JSON.stringify(raw, null, 2)).setMimeType(ContentService.MimeType.JSON);
    }

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
  if (u.includes("INFORMATION TECH") || u.includes("IT STRATEGY") || u === "IT" || u.startsWith("IT ") || u.startsWith("IT(") || u.startsWith("IT1") || u.startsWith("IT2")) return "IT";
  if (u.includes("FINANCIAL RISK") || u.includes("OPERATIONS MANAGEMENT") || u.includes("FORM")) return "FORM";
  if (u.includes("PRODUCT & BRAND") || u.includes("BRAND MANAGEMENT") || u.includes("PBM")) return "PBM" + secStr;
  if (u.includes("SOCIAL NETWORK") || u.includes("STRATEGIES FOR NEW AGE") || u.includes("SNAB")) return "SNAB";
  if (u.includes("QUALITY") || u.includes("SIX SIGMA") || u.includes("TQMS")) return "TQMS" + secStr;
  if (u.includes("MANAGEMENT SYSTEMS") || u.includes("MANAGEMENT STRUCTURE") || u.includes("MSS")) return "MSS" + secStr;
  if (u.includes("INSTITUTIONS") || u.includes("FINANCIAL SERVICES") || u.includes("FIS")) return "FIS";
  if (u.includes("INTERNATIONAL BUSINESS") || u === "IB" || u.startsWith("IB ") || u.startsWith("IB(") || u.startsWith("IB1") || u.startsWith("IB2")) return "IB";
  if (u.includes("NEGOTIATION") || u.includes("COMMERCIAL MANAGEMENT") || u.includes("SNCM")) return "SNCM" + secStr;
  if (u.includes("ADVANCED ACCOUNTING") || u.includes("AAB")) return "AAB";
  if (u.includes("WEALTH") || u.includes("PERSONAL FINANCE") || u.includes("PFWM")) return "PFWM";
  if (u.includes("BANKING") || u.includes("MBFM")) return "MBFM";
  if (u.includes("STRATEGIC MANAGEMENT") || u === "SM" || u.startsWith("SM ") || u.startsWith("SM(") || u.startsWith("SM1") || u.startsWith("SM2")) return "SM";
  if (u.includes("MARKET STRUCTURE") || u.includes("MSD")) return "MSD";
  if (u.includes("NEW PRODUCT") || u.includes("NPD")) return "NPD";
  if (u.includes("SERVICE OPERATIONS") || u.includes("SOM")) return "SoM";
  if (u.includes("INTEGRATED MARKETING") || u.includes("IMC")) return "IMC";
  if (u.includes("SERVICES MARKETING") || u.includes("SSM")) return "SSM";
  if (u.includes("TALENT MANAGEMENT") || u === "TM" || u.startsWith("TM ") || u.startsWith("TM(") || u.startsWith("TM1") || u.startsWith("TM2")) return "TM";
  if (u.includes("MERGERS") || u === "M&A" || u.includes("M & A")) return "M&A";
  if (u.includes("ENTREPRENEURSHIP") || u === "ENV")) return "ENV";
  if (u.includes("EXECUTIVE SALES") || u === "ESMM" || u.startsWith("ESMM ") || u.startsWith("ESMM(")) return "ESMM";
  if (u.includes("PROJECT COURSE")) return "Project Course";

  return "";
}

function formatDateToKey(dVal) {
  if (!dVal) return "";
  if (dVal instanceof Date) {
    if (isNaN(dVal.getTime())) return "";
    var yr = dVal.getFullYear();
    if (yr === 2025 || yr === 2001) yr = 2026;
    var mo = String(dVal.getMonth() + 1).padStart(2, '0');
    var da = String(dVal.getDate()).padStart(2, '0');
    return yr + "-" + mo + "-" + da;
  }
  var str = String(dVal).trim();
  
  var mSlash = str.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (mSlash) {
    var day = String(mSlash[1]).padStart(2, '0');
    var mon = String(mSlash[2]).padStart(2, '0');
    var yr = mSlash[3] ? (mSlash[3].length === 2 ? ('20' + mSlash[3]) : mSlash[3]) : '2026';
    if (yr === '2025' || yr === '2001') yr = '2026';
    return yr + "-" + mon + "-" + day;
  }
  
  var mISO = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (mISO) {
    var yr = mISO[1];
    if (yr === '2025' || yr === '2001') yr = '2026';
    return yr + "-" + String(mISO[2]).padStart(2, '0') + "-" + String(mISO[3]).padStart(2, '0');
  }

  var mText = str.match(/^(\d{1,2})[\/\-]([A-Za-z]{3})(?:[\/\-](\d{2,4}))?/);
  if (mText) {
    var day = String(mText[1]).padStart(2, '0');
    var monthMap = { 'JAN':'01', 'FEB':'02', 'MAR':'03', 'APR':'04', 'MAY':'05', 'JUN':'06', 'JUL':'07', 'AUG':'08', 'SEP':'09', 'OCT':'10', 'NOV':'11', 'DEC':'12' };
    var mon = monthMap[mText[2].toUpperCase()] || '09';
    var yr = mText[3] ? (mText[3].length === 2 ? ('20' + mText[3]) : mText[3]) : '2026';
    if (yr === '2025' || yr === '2001') yr = '2026';
    return yr + "-" + mon + "-" + day;
  }

  var pDate = new Date(str);
  if (!isNaN(pDate.getTime())) {
    var yr = pDate.getFullYear();
    if (yr === 2025 || yr === 2001) yr = 2026;
    var mo = String(pDate.getMonth() + 1).padStart(2, '0');
    var da = String(pDate.getDate()).padStart(2, '0');
    return yr + "-" + mo + "-" + da;
  }
  return "";
}

function fetchTimetableSessions() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheets = ss.getSheets();
  var sessions = [];
  var seenKeys = {};

  var sectionRooms = { "A": "LR 02", "B": "LR 07", "C": "LR 06", "D": "LR 06" };

  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    var data = sheet.getDataRange().getValues();
    if (!data || data.length < 4) continue;

    var headerRowIdx = -1;
    var timeSlotCols = [];

    // Find the row that contains the actual time slots (must have at least 3 cells with HH:MM - HH:MM)
    for (var r = 0; r < Math.min(10, data.length); r++) {
      var row = data[r];
      var slotsInThisRow = [];
      for (var c = 0; c < row.length; c++) {
        var cellVal = String(row[c] || "").trim();
        var match = cellVal.match(/(\d{1,2}:\d{2})\s*[\-–—to]+\s*(\d{1,2}:\d{2})/i);
        if (match) {
          var start = match[1].padStart(5, '0');
          var end = match[2].padStart(5, '0');
          // Standardize Slot 1
          if (start === "08:30") start = "08:45";
          slotsInThisRow.push({ col: c, slot: start + " - " + end });
        }
      }
      if (slotsInThisRow.length >= 3) {
        timeSlotCols = slotsInThisRow;
        headerRowIdx = r;
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

      // Extract section letter from column 1 (or column 0)
      var sectionLetter = "";
      var s1 = String(row[1] || "").trim().toUpperCase();
      var s0 = String(row[0] || "").trim().toUpperCase();
      if (["A", "B", "C", "D"].includes(s1)) {
        sectionLetter = s1;
      } else if (["A", "B", "C", "D"].includes(s0)) {
        sectionLetter = s0;
      } else {
        var mSec = (s1 + " " + s0).match(/SEC(?:TION)?[\s\-]*([A-D])/i);
        if (mSec) sectionLetter = mSec[1].toUpperCase();
      }

      if (!sectionLetter) continue;

      var roomName = sectionRooms[sectionLetter] || "LR 07";

      for (var t = 0; t < timeSlotCols.length; t++) {
        var colIdx = timeSlotCols[t].col;
        var slotTime = timeSlotCols[t].slot;

        var rawCell = String(row[colIdx] || "").trim();
        if (!rawCell || rawCell.toUpperCase() === "LUNCH" || rawCell.toUpperCase().includes("HOLIDAY") || rawCell.toUpperCase().includes("BREAK")) continue;

        var cleanVal = rawCell.replace(/?
/g, ' ').replace(/\s+/g, ' ').trim();
        var match = cleanVal.match(/^([A-Za-z0-9&\s\.\-]+?)\s*(\d+)?\s*(?:\(([^)]+)\))?$/);
        if (match) {
          var rawCode = match[1].trim();
          var profInitials = match[3] ? match[3].trim() : "";
          var sessionNum = match[2] ? match[2].trim() : "";

          var courseCode = mapToCourseCode(rawCode);
          if (!courseCode) continue;

          var sectionedCourses = ["PBM", "TQMS", "SNCM", "MSS", "BA", "CV", "GBS", "CW"];
          var courseId = courseCode;
          if (sectionedCourses.includes(courseCode)) {
            courseId = courseCode + " Sec-" + sectionLetter;
          }

          var faculty = FACULTY_MAP[courseId] || FACULTY_MAP[courseCode] || profInitials || "Faculty";

          var uniqueKey = currentDateKey + "_" + slotTime + "_" + courseId + "_" + sectionLetter;
          if (!seenKeys[uniqueKey]) {
            seenKeys[uniqueKey] = true;
            sessions.push({
              dateKey: currentDateKey,
              day: currentDayName || "Scheduled",
              slot: slotTime,
              courseId: courseId,
              subject: cleanVal,
              room: roomName,
              instructor: faculty,
              section: sectionLetter
            });
          }
        }
      }
    }
  }

  Logger.log("Total parsed sessions across entire sheet: " + sessions.length);
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

function sendDailyScheduleEmails() {
  try {
    var sessions = fetchTimetableSessions();

    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    var year = tomorrow.getFullYear();
    var month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    var day = String(tomorrow.getDate()).padStart(2, '0');
    var dateKey = year + "-" + month + "-" + day;
    
    var formattedDate = tomorrow.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    var dayOfYear = Math.floor((tomorrow - new Date(tomorrow.getFullYear(), 0, 0)) / 86400000);
    var quote = QUOTES[dayOfYear % QUOTES.length];

    var tomorrowClasses = sessions.filter(function(s) {
      return s.dateKey === dateKey;
    });

    function isStudentEnrolled(studentCourses, courseId) {
      if (!studentCourses || !courseId) return false;
      var baseId = courseId.split(' ')[0];
      for (var i = 0; i < studentCourses.length; i++) {
        var c = studentCourses[i];
        var cBase = c.split(' ')[0];
        if (cBase === baseId) {
          if (c.indexOf("Sec-") !== -1 && courseId.indexOf("Sec-") !== -1) {
            if (c !== courseId) continue;
          }
          return true;
        }
      }
      return false;
    }

    for (var email in WAZIR_MEMBERS) {
      var member = WAZIR_MEMBERS[email];
      var name = member.name;
      var courses = member.courses;
      
      var myClasses = tomorrowClasses.filter(function(c) {
        return isStudentEnrolled(courses, c.courseId);
      });
      
      myClasses.sort(function(a, b) {
        return a.slot.localeCompare(b.slot);
      });

      var htmlBody = '<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0d1117; color: #c9d1d9; padding: 20px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #30363d; line-height: 1.6;">';
      htmlBody += '<h2 style="color: #58a6ff; border-bottom: 1px solid #30363d; padding-bottom: 10px; margin-top: 0; font-size: 1.5em; display: flex; align-items: center; gap: 8px;">📅 Tomorrow's Class Schedule</h2>';
      htmlBody += '<p style="font-size: 1.05em; color: #f0f6fc;">Hi <strong>' + name + '</strong>,</p>';
      htmlBody += '<p style="color: #8b949e;">Please find your personalized academic timetable for tomorrow, <strong>' + formattedDate + '</strong>.</p>';

      if (myClasses.length > 0) {
        for (var i = 0; i < myClasses.length; i++) {
          var c = myClasses[i];
          
          htmlBody += '<div style="background-color: #21262d; border: 1px solid #30363d; border-radius: 6px; padding: 15px; margin-bottom: 12px;">';
          htmlBody += '<div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #30363d; padding-bottom: 8px; margin-bottom: 8px;">';
          htmlBody += '<span style="font-weight: bold; color: #58a6ff; font-size: 1.1em;">' + c.slot + '</span>';
          htmlBody += '<span style="background-color: #388bfd26; color: #58a6ff; padding: 3px 10px; border-radius: 12px; font-size: 0.8em; font-weight: bold; text-transform: uppercase;">' + c.courseId + '</span>';
          htmlBody += '</div>';
          htmlBody += '<div style="font-size: 1.1em; font-weight: bold; margin-bottom: 6px; color: #f0f6fc;">' + c.subject + '</div>';
          htmlBody += '<div style="font-size: 0.9em; color: #8b949e;">';
          htmlBody += 'Room: <strong style="color: #c9d1d9;">' + c.room + '</strong> &nbsp;|&nbsp; Instructor: <strong style="color: #c9d1d9;">' + c.instructor + '</strong>';
          htmlBody += '</div>';
          htmlBody += '</div>';
        }
      } else {
        htmlBody += '<div style="background-color: #161b22; border: 1px dashed #30363d; border-radius: 6px; padding: 25px; text-align: center; color: #8b949e; font-size: 1.1em; margin: 18px 0;">';
        htmlBody += '🎉 <strong>0 classes scheduled!</strong> Enjoy your day off.';
        htmlBody += '</div>';
      }

      htmlBody += '<p style="font-style: italic; color: #8b949e; margin-top: 15px; background: #161b22; padding: 10px; border-radius: 6px;">💡 ' + quote + '</p>';
      htmlBody += '<p style="margin-top: 25px; font-size: 0.9em; color: #8b949e; border-top: 1px solid #30363d; padding-top: 15px;">';
      htmlBody += 'Regards,<br>';
      htmlBody += '<strong style="color: #f0f6fc;">Wazir Strategy & Consulting Club</strong>';
      htmlBody += '</p>';
      htmlBody += '</div>';

      var subjectLine = "TimeTable | " + name + " | " + dateKey;
      
      MailApp.sendEmail({
        to: email,
        subject: subjectLine,
        htmlBody: htmlBody,
        name: "Wazir Family"
      });
      
      Logger.log("Emailed " + name + " (" + email + ") successfully.");
    }
  } catch (err) {
    Logger.log("Error in sendDailyScheduleEmails: " + err.toString());
  }
}

function setupHourlySyncTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncTimetableToSupabase') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('syncTimetableToSupabase')
    .timeBased()
    .everyHours(1)
    .create();
  Logger.log("Successfully created hourly live sheet sync trigger!");
}

function setupDailyEmailTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sendDailyScheduleEmails') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('sendDailyScheduleEmails')
    .timeBased()
    .everyDays(1)
    .atHour(18)
    .create();
  Logger.log("Successfully created daily evening email trigger!");
}
