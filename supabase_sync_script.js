// Google Apps Script — Sync Google Sheet Timetable to Supabase & Send Daily Wazir Emails
// Paste this inside script.google.com and run it (or set a trigger)

const SUPABASE_URL = "https://frnyuuywkteqiyinlrmp.supabase.co";
const SUPABASE_KEY = "sb_publishable_dfysjA_5CU1AmweExgrmiA_FD0AS34o";

// Wazir Members Configuration (8 active members)
const WAZIR_MEMBERS = {
  "ipm04niketp@iimrohtak.ac.in": {
    "name": "Niket Parikh",
    "courses": ["AIDMD", "B2B", "BA Sec-A", "CV Sec-A", "IBS", "PFM", "GBS Sec-B", "CW Sec-B"]
  },
  "pgp16hidayrajsinhc@iimrohtak.ac.in": {
    "name": "Hidayrajsinh Chauhan",
    "courses": ["BA Sec-A", "CV Sec-A", "FM", "FSA", "GFMG", "MFIS", "PWMP", "GBS Sec-D", "CW Sec-D"]
  },
  "ipm04adityabs@iimrohtak.ac.in": {
    "name": "Aditya Brijgopal Sarda",
    "courses": ["BA Sec-A", "CV Sec-A", "FM", "FSA", "GFMG", "MFIS", "PWMP", "GBS Sec-A", "CW Sec-A"]
  },
  "ipm04prithivit@iimrohtak.ac.in": {
    "name": "Prithivi Tejeshwar",
    "courses": ["BA Sec-B", "CV Sec-B", "FSA", "IBS", "MFIS", "GBS Sec-C", "CW Sec-C"]
  },
  "pgp16tanishthav@iimrohtak.ac.in": {
    "name": "Tanishtha Verma",
    "courses": ["AIDMD", "B2B", "BA Sec-B", "DBM", "PCM", "PFM", "GBS Sec-D", "CW Sec-D"]
  },
  "pgp16akshita@iimrohtak.ac.in": {
    "name": "Akshita",
    "courses": ["B2B", "BA Sec-A", "Ind4.0", "PCM", "SCM Sec-A", "SHRM", "GBS Sec-A", "CW Sec-A"]
  },
  "ipm04mridulu@iimrohtak.ac.in": {
    "name": "Mridul Upadhyay",
    "courses": ["B2B", "BA Sec-A", "CV Sec-A", "IBS", "SCM Sec-A", "GBS Sec-A", "CW Sec-A"]
  },
  "pgp16divyanshid@iimrohtak.ac.in": {
    "name": "Divyanshi Dongre",
    "courses": ["CB Sec-A", "DBM", "MBPET", "PCM", "PS", "SHRM", "GBS Sec-B", "CW Sec-B"]
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
    var sessions = parseSessionsFromData(data);
    
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

// Helper to parse timetable sessions from sheet data
function parseSessionsFromData(data) {
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
            if (currentDate.getDay() !== 0) {
              currentDate.setDate(currentDate.getDate() + 1);
            }
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
  return sessions;
}

// Send daily evening email to Wazir members about tomorrow's classes
function sendDailyScheduleEmails() {
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
      Logger.log("Error: Schedule sheet not found for daily emails");
      return;
    }

    var data = sheet.getDataRange().getValues();
    var sessions = parseSessionsFromData(data);

    // Calculate tomorrow's date details
    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    var year = tomorrow.getFullYear();
    var month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    var day = String(tomorrow.getDate()).padStart(2, '0');
    var dateKey = year + "-" + month + "-" + day;
    
    var formattedDate = tomorrow.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    // Choose Quote of the Day randomly based on the day of the year
    var dayOfYear = Math.floor((tomorrow - new Date(tomorrow.getFullYear(), 0, 0)) / 86400000);
    var quote = QUOTES[dayOfYear % QUOTES.length];

    // Filter tomorrow's classes
    var tomorrowClasses = sessions.filter(function(s) {
      return s.date_key === dateKey;
    });

    Logger.log("Sending schedule emails for date: " + dateKey + " (" + tomorrowClasses.length + " classes total)");

    // Helper check if enrolled
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

    // Process each Wazir member
    for (var email in WAZIR_MEMBERS) {
      var member = WAZIR_MEMBERS[email];
      var name = member.name;
      var courses = member.courses;
      
      // Filter tomorrow's classes for this member
      var myClasses = tomorrowClasses.filter(function(c) {
        return isStudentEnrolled(courses, c.course_id);
      });
      
      // Sort classes chronologically by time slot
      myClasses.sort(function(a, b) {
        return a.slot.localeCompare(b.slot);
      });

      // Build HTML body
      var htmlBody = '<div style="font-family: \'Segoe UI\', Tahoma, Geneva, Verdana, sans-serif; background-color: #0d1117; color: #c9d1d9; padding: 20px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #30363d; line-height: 1.6;">';
      htmlBody += '<h2 style="color: #58a6ff; border-bottom: 1px solid #30363d; padding-bottom: 10px; margin-top: 0; font-size: 1.5em; display: flex; align-items: center; gap: 8px;">📅 Tomorrow\'s Class Schedule</h2>';
      htmlBody += '<p style="font-size: 1.05em; color: #f0f6fc;">Hi <strong>' + name + '</strong>,</p>';
      htmlBody += '<p style="color: #8b949e;">Please find your personalized academic timetable for tomorrow, <strong>' + formattedDate + '</strong>.</p>';

      if (myClasses.length > 0) {
        for (var i = 0; i < myClasses.length; i++) {
          var c = myClasses[i];
          var parts = c.instructor.split('|');
          var prof = parts[0];
          var sessionNum = parts[1] || "?";
          
          htmlBody += '<div style="background-color: #21262d; border: 1px solid #30363d; border-radius: 6px; padding: 15px; margin-bottom: 12px;">';
          htmlBody += '<div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #30363d; padding-bottom: 8px; margin-bottom: 8px;">';
          htmlBody += '<span style="font-weight: bold; color: #58a6ff; font-size: 1.1em;">' + c.slot + '</span>';
          htmlBody += '<span style="background-color: #388bfd26; color: #58a6ff; padding: 3px 10px; border-radius: 12px; font-size: 0.8em; font-weight: bold; text-transform: uppercase;">' + c.course_id + '</span>';
          htmlBody += '</div>';
          htmlBody += '<div style="font-size: 1.1em; font-weight: bold; margin-bottom: 6px; color: #f0f6fc;">' + c.subject + '</div>';
          htmlBody += '<div style="font-size: 0.9em; color: #8b949e;">';
          htmlBody += 'Room: <strong style="color: #c9d1d9;">' + c.room + '</strong> &nbsp;|&nbsp; Prof: <strong style="color: #c9d1d9;">' + prof + '</strong> &nbsp;|&nbsp; Session: <strong style="color: #c9d1d9;">#' + sessionNum + '</strong>';
          htmlBody += '</div>';
          htmlBody += '</div>';
        }
      } else {
        htmlBody += '<div style="background-color: #161b22; border: 1px dashed #30363d; border-radius: 6px; padding: 25px; text-align: center; color: #8b949e; font-size: 1.1em; margin: 18px 0;">';
        htmlBody += '🎉 <strong>0 classes scheduled!</strong> Enjoy your day off.';
        htmlBody += '</div>';
      }

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
        name: "TimeTable"
      });
      
      Logger.log("Emailed " + name + " (" + email + ") successfully.");
    }
  } catch (err) {
    Logger.log("Error in sendDailyScheduleEmails: " + err.toString());
  }
}

function setupSpreadsheetEditTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncTimetableToSupabase' && 
        triggers[i].getEventType() === ScriptApp.EventType.ON_EDIT) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('syncTimetableToSupabase')
    .forSpreadsheet('1WPTKyFL52nR6PdJ2n2hdlw2yb-S5A6wiiHW1QBdUitU')
    .onEdit()
    .create();
  Logger.log("Successfully created spreadsheet edit trigger!");
}

// Programmatically create the daily evening email trigger (runs every day 6:00 PM - 7:00 PM)
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
    .atHour(18) // 6:00 PM (runs between 6 PM and 7 PM)
    .create();
  Logger.log("Successfully created daily evening email trigger!");
}
