// Google Apps Script — Sync Live Term V Google Sheet Timetable to Supabase & Send Daily Wazir Emails
// Spreadsheet ID: 1KO1bwDTVyirnMFLKpsdDe8y6OiicN-Xju9ytnpnDIFQ

const SUPABASE_URL = "https://frnyuuywkteqiyinlrmp.supabase.co";
const SUPABASE_KEY = "sb_publishable_dfysjA_5CU1AmweExgrmiA_FD0AS34o";
const SHEET_ID = "1KO1bwDTVyirnMFLKpsdDe8y6OiicN-Xju9ytnpnDIFQ";

// Wazir Members Configuration (10 active members for Term V)
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
  },
  "ipm04palaky@iimrohtak.ac.in": {
    "name": "Palak Yadav",
    "courses": ["GSEC", "SNCM Sec-A", "SSM", "PBM Sec-B", "TQMS Sec-A", "MSS Sec-A"]
  }
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
    var day = String(mSlash[1]).padStart(2, '0');
    var mon = String(mSlash[2]).padStart(2, '0');
    var yr = mSlash[3];
    return yr + "-" + mon + "-" + day;
  }
  
  var mISO = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (mISO) {
    return mISO[1] + "-" + String(mISO[2]).padStart(2, '0') + "-" + String(mISO[3]).padStart(2, '0');
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

  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    var data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) continue;

    var currentDateKey = "";
    var currentDayName = "";
    
    var roomCols = {};
    var slotCols = {};

    for (var r = 0; r < Math.min(5, data.length); r++) {
      for (var c = 0; c < data[r].length; c++) {
        var cellStr = String(data[r][c]).trim();
        if (/LR[\s\-]*\d+/i.test(cellStr) || /CR[\s\-]*\d+/i.test(cellStr) || /Hall/i.test(cellStr) || /Auditorium/i.test(cellStr)) {
          roomCols[c] = cellStr;
        }
        if (/\d{1,2}:\d{2}/.test(cellStr)) {
          slotCols[c] = formatSlotTime(cellStr);
        }
      }
    }

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (!row || row.length === 0) continue;

      for (var c = 0; c < Math.min(4, row.length); c++) {
        var cellVal = row[c];
        if (cellVal instanceof Date) {
          var formatted = formatDateToKey(cellVal);
          if (formatted) {
            currentDateKey = formatted;
            currentDayName = Utilities.formatDate(cellVal, Session.getScriptTimeZone(), "EEEE");
          }
        } else if (cellVal) {
          var vStr = String(cellVal).trim();
          var parsedDate = formatDateToKey(vStr);
          if (parsedDate) {
            currentDateKey = parsedDate;
          }
          if (/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i.test(vStr)) {
            currentDayName = vStr;
          }
        }
      }

      if (!currentDateKey) continue;

      var rowSlotTime = "";
      for (var c = 0; c < Math.min(5, row.length); c++) {
        var vStr = String(row[c]).trim();
        if (/\d{1,2}:\d{2}\s*[\-\u2013to]*\s*\d{1,2}:\d{2}/i.test(vStr)) {
          rowSlotTime = formatSlotTime(vStr);
          break;
        }
      }

      for (var c = 0; c < row.length; c++) {
        var cellVal = String(row[c] || "").trim();
        if (!cellVal) continue;

        var cCode = mapToCourseCode(cellVal);
        if (!cCode) continue;

        var slotTime = rowSlotTime || slotCols[c] || "08:45 - 10:00";
        var roomName = roomCols[c] || "LR 07";

        var profName = "Faculty";
        var lines = cellVal.split(/\r?\n/);
        if (lines.length > 1) {
          profName = lines[lines.length - 1].trim();
        }

        var uniqueKey = currentDateKey + "_" + slotTime + "_" + cCode + "_" + roomName;
        if (!seenKeys[uniqueKey]) {
          seenKeys[uniqueKey] = true;
          sessions.push({
            dateKey: currentDateKey,
            day: currentDayName || "Scheduled",
            slot: slotTime,
            courseId: cCode,
            subject: cellVal.replace(/[\r\n]+/g, ' '),
            room: roomName,
            instructor: profName
          });
        }
      }
    }
  }

  Logger.log("Total parsed sessions across sheet: " + sessions.length);
  return sessions;
}

function syncTimetableToSupabase() {
  var sessions = fetchTimetableSessions();
  Logger.log("Found " + sessions.length + " sessions. Syncing to Supabase...");
  
  if (sessions.length === 0) return;
  
  // 1. Delete old rows
  var deleteUrl = SUPABASE_URL + "/rest/v1/timetable?id=gt.0";
  var deleteOptions = {
    method: "delete",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY
    }
  };
  try {
    UrlFetchApp.fetch(deleteUrl, deleteOptions);
    Logger.log("Cleared old Supabase timetable entries.");
  } catch(e) {
    Logger.log("Clear failed: " + e.toString());
  }

  // 2. Insert new non-cyclical sessions in chunks of 50
  var url = SUPABASE_URL + "/rest/v1/timetable";
  var headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": "Bearer " + SUPABASE_KEY,
    "Content-Type": "application/json"
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
        instructor: s.instructor
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

// Send daily evening email to Wazir members about tomorrow's classes
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

    Logger.log("Sending schedule emails for date: " + dateKey + " (" + tomorrowClasses.length + " classes total)");

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

      var htmlBody = '<div style="font-family: \'Segoe UI\', Tahoma, Geneva, Verdana, sans-serif; background-color: #0d1117; color: #c9d1d9; padding: 20px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #30363d; line-height: 1.6;">';
      htmlBody += '<h2 style="color: #58a6ff; border-bottom: 1px solid #30363d; padding-bottom: 10px; margin-top: 0; font-size: 1.5em; display: flex; align-items: center; gap: 8px;">📅 Tomorrow\'s Class Schedule</h2>';
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
