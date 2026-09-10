// Google Apps Script – Universal Term V Live Google Sheet Parser & Supabase Synchronizer
// Tracking Live Google Sheet: 1KO1bwDTVyirnMFLKpsdDe8y6OiicN-Xju9ytnpnDIFQ

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

  // Extract Section suffix if explicitly in cell
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
  
  // DD/MM/YYYY or DD-MM-YYYY
  var mSlash = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (mSlash) {
    var day = String(mSlash[1]).padStart(2, '0');
    var mon = String(mSlash[2]).padStart(2, '0');
    var yr = mSlash[3];
    return yr + "-" + mon + "-" + day;
  }
  
  // YYYY-MM-DD
  var mISO = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (mISO) {
    return mISO[1] + "-" + String(mISO[2]).padStart(2, '0') + "-" + String(mISO[3]).padStart(2, '0');
  }

  // Parse strings like "Sat Sep 12 2026" or "12 Sep 2026" or "Sep 12, 2026"
  var pDate = new Date(str);
  if (!isNaN(pDate.getTime()) && pDate.getFullYear() > 2020 && pDate.getFullYear() < 2030) {
    return Utilities.formatDate(pDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return "";
}

function formatSlotTime(str) {
  if (!str) return "08:45 - 10:00";
  var s = String(str).trim();
  
  // Look for time range like 08:45-10:00 or 8:45 - 10:00
  var match = s.match(/(\d{1,2}:\d{2})\s*[\-\u2013\u2014to]*\s*(\d{1,2}:\d{2})/i);
  if (match) {
    var start = match[1].padStart(5, '0');
    var end = match[2].padStart(5, '0');
    return start + " - " + end;
  }
  
  // Single time like 08:45
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
    
    // Check if sheet has room headers in row 0-5 or column headers
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

      // Check Column A/B/C for Date & Day
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

      // Determine slot time for this row if row has explicit slot column
      var rowSlotTime = "";
      for (var c = 0; c < Math.min(5, row.length); c++) {
        var vStr = String(row[c]).trim();
        if (/\d{1,2}:\d{2}\s*[\-\u2013to]*\s*\d{1,2}:\d{2}/i.test(vStr)) {
          rowSlotTime = formatSlotTime(vStr);
          break;
        }
      }

      // Process cells in row
      for (var c = 0; c < row.length; c++) {
        var cellVal = String(row[c] || "").trim();
        if (!cellVal) continue;

        var cCode = mapToCourseCode(cellVal);
        if (!cCode) continue;

        var slotTime = rowSlotTime || slotCols[c] || "08:45 - 10:00";
        var roomName = roomCols[c] || "LR 07";

        // Extract professor name from multiline cell if present
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
        day: s.day || "Mon",
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
