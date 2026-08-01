import openpyxl
from datetime import datetime

wb = openpyxl.load_workbook("/Users/ketanparikh/Desktop/Antigravity Work/Course wise combined list Term IV PGP 16.xlsx", data_only=True)
sheet = wb["Schedule"]

# Read all rows into a list of lists
data = []
for row in sheet.iter_rows(values_only=True):
    data.append(list(row))

# Simulating google_apps_script.js logic
timeSlots = []
# Row 3 (index 2) contains slots
for c in range(2, len(data[2])):
    val = str(data[2][c]).strip() if data[2][c] is not None else ""
    if val and any(char.isdigit() for char in val):
        timeSlots.append({"col": c, "slot": val.replace("-", " - ")})

sectionRooms = { "A": "LR 02", "B": "LR 07", "C": "LR 06", "D": "LR 06" }

# Legend mapping
courseAbbrMap = {}
for r in range(2, len(data)):
    if len(data[r]) > 14 and data[r][13] is not None and data[r][14] is not None:
        fullName = str(data[r][13]).strip()
        abbr = str(data[r][14]).strip()
        if fullName and abbr and len(abbr) <= 10:
            courseAbbrMap[abbr] = fullName

sessions = []
currentDate = None
currentDay = None
lastValidDate = None

for r in range(3, len(data)):
    row = data[r]
    dateVal = row[0]
    
    if dateVal is not None:
        if isinstance(dateVal, datetime):
            currentDate = dateVal
            currentDay = currentDate.strftime("%A")
            lastValidDate = datetime(currentDate.year, currentDate.month, currentDate.day)
        else:
            dateStr = str(dateVal).strip()
            if "SUNDAY" in dateStr.upper():
                if lastValidDate:
                    currentDate = lastValidDate
                    if currentDate.weekday() != 6: # Not Sunday (6 in python is Sunday? No, Monday is 0, Sunday is 6)
                        # Let's count days to Sunday
                        # In JS: getDay() === 0 (0 is Sunday)
                        # We want Sunday date = lastValidDate + 1 day
                        # JS logic: if (currentDate.getDay() !== 0) { currentDate.setDate(currentDate.getDate() + 1); }
                        currentDate = currentDate # Simulating the JS check
                        # In JS, getDay() !== 0 is true if it's Saturday, so it adds 1 day and becomes Sunday
                        # Let's write the exact JS date logic in Python:
                        # JS code:
                        # var currentDate = new Date(lastValidDate);
                        # if (currentDate.getDay() !== 0) { currentDate.setDate(currentDate.getDate() + 1); }
                        # Since lastValidDate is Saturday (getDay() = 6), getDay() !== 0 is true, so it adds 1 -> Sunday.
                        pass
                    # Let's just emulate the JS date shift:
                    # In this sheet, Sunday rows follow Saturday rows, so adding 1 day to Saturday gives Sunday.
                    # Since we have the exact dates in the sheet, let's look at the parsed sessions!
                    pass

# Let's just parse the sheet dates directly to see what python gets
for r in range(3, len(data)):
    row = data[r]
    dateVal = row[0]
    if dateVal is not None:
        if isinstance(dateVal, datetime):
            currentDate = dateVal
        elif str(dateVal).strip():
            # try parsing
            try:
                currentDate = datetime.strptime(str(dateVal).strip(), "%d-%b-%y")
            except:
                pass
                
    if not currentDate:
        continue
        
    section = str(row[1]).strip().upper() if row[1] is not None else ""
    if not section or "SUNDAY" in section:
        continue
        
    dateKey = currentDate.strftime("%Y-%m-%d")
    
    for t in timeSlots:
        cellVal = str(row[t["col"]]).strip() if row[t["col"]] is not None else ""
        if not cellVal:
            continue
            
        import re
        match = re.match(r"^([A-Za-z0-9&\s\.\-]+?)\s*(\d+)\s*\(([^)]+)\)\s*$", cellVal)
        if match:
            courseCode = match.group(1).strip().rstrip("- ")
            sessionNum = match.group(2).strip()
            profInitials = match.group(3).strip()
            
            courseId = courseCode
            if courseCode in ["BA", "CB", "CV", "GBS", "SCM", "CW"]:
                courseId = f"{courseCode} Sec-{section}"
                
            sessions.append({
                "dateKey": dateKey,
                "slot": t["slot"],
                "courseId": courseId,
                "subject": courseAbbrMap.get(courseCode, courseCode),
                "instructor": f"{profInitials}|{sessionNum}",
                "section": section
            })

print("Total sessions parsed in simulation:", len(sessions))
# Check for duplicates on dateKey, slot, courseId
seen = {}
duplicates = []
for idx, s in enumerate(sessions):
    key = (s["dateKey"], s["slot"], s["courseId"])
    if key in seen:
        duplicates.append((key, seen[key], idx))
    else:
        seen[key] = idx
        
print("Duplicates found:", len(duplicates))
if duplicates:
    for key, f, d in duplicates[:10]:
        print(f"Duplicate key: {key} | indices: {f} vs {d}")
