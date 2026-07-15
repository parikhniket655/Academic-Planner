// Google Apps Script — Deploy as Web App
// This reads the live PGP-16 timetable sheet and returns JSON.
// Any changes the admin makes to the sheet are reflected instantly.

function doGet(e) {
  try {
    var ss = SpreadsheetApp.openById("1WPTKyFL52nR6PdJ2n2hdlw2yb-S5A6wiiHW1QBdUitU");
    var sheet = ss.getSheetByName("Schedule");
    if (!sheet) {
      // Try by GID (345505707)
      var sheets = ss.getSheets();
      for (var i = 0; i < sheets.length; i++) {
        if (sheets[i].getSheetId() == 345505707) {
          sheet = sheets[i];
          break;
        }
      }
    }
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Schedule sheet not found" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var data = sheet.getDataRange().getValues();
    
    // Row 1: Section A - LR 02 | Section B - LR 07 | Section C/D - LR 06
    // Row 2: Term Schedule header
    // Row 3: Headers — Section, 08:45-10:00, 10:20-11:35, ... 22:25-23:40
    // Row 4+: Date, Section (A/B/C/D), then course entries in each time slot
    
    var timeSlots = [];
    // Extract time slots from row 3 (index 2)
    for (var c = 2; c < data[2].length; c++) {
      var val = String(data[2][c]).trim();
      if (val && val.match(/\d{1,2}[:\-]\d{2}/)) {
        // Normalize format: "08:45-10:00" or "0845-1000" etc.
        timeSlots.push({ col: c, slot: val.replace(/-/g, " - ") });
      }
    }
    
    // Room mapping from row 1
    // Section A = LR 02, Section B = LR 07, Section C/D = LR 06
    var sectionRooms = { "A": "LR 02", "B": "LR 07", "C": "LR 06", "D": "LR 06" };
    
    // Course abbreviation mapping from the right-side legend (columns N & O)
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
      
      // Column A: Date (might be empty for continuation rows)
      var dateVal = row[0];
      if (dateVal) {
        if (dateVal instanceof Date) {
          currentDate = dateVal;
          currentDay = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
          lastValidDate = new Date(currentDate);
        } else {
          var dateStr = String(dateVal).trim();
          if (dateStr.toUpperCase() === "SUNDAY") {
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
      
      // Format dateKey as yyyy-mm-dd
      var year = currentDate.getFullYear();
      var month = String(currentDate.getMonth() + 1).padStart(2, '0');
      var day = String(currentDate.getDate()).padStart(2, '0');
      var dateKey = year + "-" + month + "-" + day;
      
      // Check each time slot
      for (var t = 0; t < timeSlots.length; t++) {
        var cellVal = String(row[timeSlots[t].col] || "").trim();
        if (!cellVal) continue;
        
        // Parse course entry like "CV 1 (SA)" or "AIDMD 3 (AK2)"
        // Format: COURSE_CODE SESSION_NUM (PROF_INITIALS)
        var match = cellVal.match(/^([A-Za-z0-9&\s\.\-]+?)\s*(\d+)\s*\(([^)]+)\)\s*$/);
        if (match) {
          var courseCode = match[1].trim().replace(/[\-\s]+$/, "");
          var sessionNum = match[2].trim();
          var profInitials = match[3].trim();
          
          // Determine courseId with section suffix if applicable
          var courseId = courseCode;
          var sectionCourses = ["BA", "CB", "CV", "GBS", "SCM", "CW"];
          if (sectionCourses.includes(courseCode)) {
            courseId = courseCode + " Sec-" + section;
          }
          
          // Map to full subject name
          var subject = courseAbbrMap[courseCode] || courseCode;
          
          sessions.push({
            dateKey: dateKey,
            day: currentDay,
            slot: timeSlots[t].slot,
            courseId: courseId,
            subject: subject,
            room: room,
            instructor: profInitials + "|" + sessionNum
          });
        }
      }
    }
    
    var result = {
      lastUpdated: new Date().toISOString(),
      sessionCount: sessions.length,
      sessions: sessions
    };
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
