// Google Apps Script — Sync Google Sheet Timetable to Supabase
// Paste this inside script.google.com and run it (or set a trigger)

const SUPABASE_URL = "https://frnyuuywkteqiyinlrmp.supabase.co";
const SUPABASE_KEY = "sb_publishable_dfysjA_5CU1AmweExgrmiA_FD0AS34o";

function syncTimetableToSupabase() {
  try {
    var ss = SpreadsheetApp.openById("1WPTKyFL52nR6PdJ2n2hdlw2yb-S5A6wiiHW1QBdUitU");
    var sheet = ss.getSheetByName("Schedule");
    if (!sheet) {
      var sheets = ss.getSheets();
      for (var i = 0; i < sheets.length; i++) {
        if (sheets[i].getSheetId() == 345505707) {
          sheet = sheets[i];
          break;
        }
      }
    }
    if (!sheet) {
      Logger.log("Error: Schedule sheet not found");
      return;
    }

    var data = sheet.getDataRange().getValues();
    
    var timeSlots = [];
    for (var c = 2; c < data[2].length; c++) {
      var val = String(data[2][c]).trim();
      if (val && val.match(/\d{1,2}[:\-]\d{2}/)) {
        timeSlots.push({ col: c, slot: val.replace(/-/g, " - ") });
      }
    }
    
    var sectionRooms = { "A": "LR 02", "B": "LR 07", "C": "LR 06", "D": "LR 06" };
    
    var courseAbbrMap = {};
    for (var r = 2; r < data.length; r++) {
      if (data[r].length > 14 && data[r][13] && data[r][14]) {
        var fullName = String(data[r][13]).trim();
        var abbr = String(data[r][14]).trim();
        if (fullName && abbr && abbr.length <= 10) {
          courseAbbrMap[abbr] = fullName;
        }
      }
    }

    var sessions = [];
    var currentDate = null;
    var currentDay = null;
    var lastValidDate = null;

    for (var r = 3; r < data.length; r++) {
      var row = data[r];
      var dateVal = row[0];
      if (dateVal) {
        if (dateVal instanceof Date) {
          currentDate = dateVal;
          currentDay = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
          lastValidDate = new Date(currentDate);
        } else {
          var dateStr = String(dateVal).trim();
          if (dateStr.toUpperCase().indexOf("SUNDAY") !== -1) {
            if (lastValidDate) {
              currentDate = new Date(lastValidDate);
              currentDate.setDate(currentDate.getDate() + 1);
              currentDay = "Sunday";
            } else {
              currentDate = null;
              currentDay = null;
            }
          } else if (dateStr !== "") {
            var parsed = Date.parse(dateStr);
            if (!isNaN(parsed)) {
              currentDate = new Date(parsed);
              currentDay = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
              lastValidDate = new Date(currentDate);
            }
          }
        }
      }
      
      if (!currentDate) continue;
      
      var section = String(row[1]).trim().toUpperCase();
      if (!section || section === "SUNDAY") continue;
      
      var room = sectionRooms[section] || "LHC";
      
      var year = currentDate.getFullYear();
      var month = String(currentDate.getMonth() + 1).padStart(2, '0');
      var day = String(currentDate.getDate()).padStart(2, '0');
      var dateKey = year + "-" + month + "-" + day;
      
      for (var t = 0; t < timeSlots.length; t++) {
        var cellVal = String(row[timeSlots[t].col] || "").trim();
        if (!cellVal) continue;
        
        var match = cellVal.match(/^([A-Za-z0-9&\s\.\-]+?)\s*(\d+)\s*\(([^)]+)\)\s*$/);
        if (match) {
          var courseCode = match[1].trim().replace(/[\-\s]+$/, "");
          var sessionNum = match[2].trim();
          var profInitials = match[3].trim();
          
          var courseId = courseCode;
          var sectionCourses = ["BA", "CB", "CV", "GBS", "SCM", "CW"];
          if (sectionCourses.includes(courseCode)) {
            courseId = courseCode + " Sec-" + section;
          }
          
          var subject = courseAbbrMap[courseCode] || courseCode;
          
          sessions.push({
            date_key: dateKey,
            day: currentDay,
            slot: timeSlots[t].slot,
            course_id: courseId,
            subject: subject,
            room: room,
            instructor: profInitials + "|" + sessionNum,
            section: section
          });
        }
      }
    }
    
    Logger.log("Parsed " + sessions.length + " sessions from sheet.");
    
    // Push to Supabase:
    // 1. Delete all current rows in the timetable table
    var deleteUrl = SUPABASE_URL + "/rest/v1/timetable?id=gt.0";
    var deleteOptions = {
      method: "delete",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": "Bearer " + SUPABASE_KEY
      }
    };
    UrlFetchApp.fetch(deleteUrl, deleteOptions);
    Logger.log("Deleted old sessions in Supabase.");
    
    // 2. Insert new sessions in chunks of 50
    var chunkSize = 50;
    for (var i = 0; i < sessions.length; i += chunkSize) {
      var chunk = sessions.slice(i, i + chunkSize);
      var insertUrl = SUPABASE_URL + "/rest/v1/timetable";
      var insertOptions = {
        method: "post",
        contentType: "application/json",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": "Bearer " + SUPABASE_KEY,
          "Prefer": "return=minimal"
        },
        payload: JSON.stringify(chunk)
      };
      UrlFetchApp.fetch(insertUrl, insertOptions);
    }
    Logger.log("Successfully synced " + sessions.length + " sessions to Supabase!");
    
  } catch (err) {
    Logger.log("Error: " + err.toString());
  }
}

function debugTimetableRows() {
  try {
    var ss = SpreadsheetApp.openById("1WPTKyFL52nR6PdJ2n2hdlw2yb-S5A6wiiHW1QBdUitU");
    var sheet = ss.getSheetByName("Schedule");
    if (!sheet) {
      var sheets = ss.getSheets();
      for (var i = 0; i < sheets.length; i++) {
        if (sheets[i].getSheetId() == 345505707) {
          sheet = sheets[i];
          break;
        }
      }
    }
    if (!sheet) {
      Logger.log("Error: Schedule sheet not found");
      return;
    }

    var data = sheet.getDataRange().getValues();
    var current_date = "";
    
    Logger.log("Scanning sheet for CW entries...");
    for (var r = 3; r < data.length; r++) {
      var dateVal = data[r][0];
      if (dateVal) {
        current_date = dateVal;
      }
      var section = String(data[r][1]).trim();
      
      for (var c = 2; c < data[r].length; c++) {
        var cellVal = String(data[r][c]).trim();
        if (cellVal.indexOf("CW") !== -1 || cellVal.indexOf("Communication") !== -1) {
          Logger.log("Row " + (r+1) + " | Date: " + current_date + " | Section: " + section + " | Col: " + c + " | Cell: " + cellVal);
        }
      }
    }
  } catch (err) {
    Logger.log("Error in debug: " + err.toString());
  }
}
