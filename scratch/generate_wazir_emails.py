import urllib.request
import ssl
import json
from datetime import datetime, timedelta

# List of 8 Wazir members
wazir_members = [
    "ipm04niketp@iimrohtak.ac.in",
    "pgp16hidayrajsinhc@iimrohtak.ac.in",
    "ipm04adityabs@iimrohtak.ac.in",
    "ipm04prithivit@iimrohtak.ac.in",
    "pgp16tanishthav@iimrohtak.ac.in",
    "pgp16akshita@iimrohtak.ac.in",
    "ipm04mridulu@iimrohtak.ac.in",
    "pgp16divyanshid@iimrohtak.ac.in"
]

# Load student database to get their courses
with open("/Users/ketanparikh/Desktop/Antigravity Work/planner/student_db.json", "r") as f:
    student_db = json.load(f)

# Query Supabase for upcoming timetable starting from today (2026-07-30)
start_date = "2026-07-30"
url = f"https://frnyuuywkteqiyinlrmp.supabase.co/rest/v1/timetable?date_key=gte.{start_date}&order=date_key.asc,slot.asc"
context = ssl._create_unverified_context()
headers = {
    'User-Agent': 'Mozilla/5.0',
    'apikey': 'sb_publishable_dfysjA_5CU1AmweExgrmiA_FD0AS34o',
    'Authorization': 'Bearer sb_publishable_dfysjA_5CU1AmweExgrmiA_FD0AS34o'
}

try:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, context=context, timeout=10) as response:
        timetable = json.loads(response.read().decode('utf-8'))
    print(f"Loaded {len(timetable)} upcoming classes from database.")
except Exception as e:
    print("Error loading timetable:", e)
    timetable = []

# Helper to check if a student is enrolled in a class
def is_enrolled(student_courses, course_id):
    if not student_courses or not course_id:
        return False
    base_id = course_id.split(' ')[0]
    for c in student_courses:
        c_base = c.split(' ')[0]
        if c_base == base_id:
            # If the course specifies a section, check if it matches
            if "Sec-" in c and "Sec-" in course_id:
                if c != course_id:
                    continue
            return True
    return False

# Generate schedule for each member for the next 7 days
today = datetime.strptime(start_date, "%Y-%m-%d")
date_range = [(today + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]

email_reports = {}

for email in wazir_members:
    student = student_db.get(email)
    if not student:
        continue
    
    student_name = student["name"]
    student_courses = student["courses"]
    
    report_lines = []
    report_lines.append(f"Subject: IIM Rohtak Academic Tracker - Upcoming Schedule for {student_name}")
    report_lines.append(f"Hello {student_name},\n")
    report_lines.append("Here is your personalized class schedule for the upcoming week (July 30th to August 5th):\n")
    
    total_classes = 0
    for date_str in date_range:
        formatted_date = datetime.strptime(date_str, "%Y-%m-%d").strftime("%A, %B %d, %Y")
        day_classes = [s for s in timetable if s.get("date_key") == date_str and is_enrolled(student_courses, s.get("course_id"))]
        
        if day_classes:
            report_lines.append(f"📅 {formatted_date}:")
            for c in day_classes:
                total_classes += 1
                slot = c.get("slot")
                subject = c.get("subject")
                room = c.get("room")
                instructor_info = c.get("instructor", "")
                instructor = instructor_info.split('|')[0] if '|' in instructor_info else instructor_info
                session_num = instructor_info.split('|')[1] if '|' in instructor_info else "?"
                
                report_lines.append(f"  • {slot} | {subject} (Session #{session_num})")
                report_lines.append(f"    Room: {room} | Prof: {instructor}")
            report_lines.append("")
            
    if total_classes == 0:
        report_lines.append("🎉 No classes scheduled for you this week!")
        
    report_lines.append("\nBest regards,\nIIMR Academic Tracker Bot")
    
    email_reports[email] = "\n".join(report_lines)

# Save the reports locally for review
output_path = "/Users/ketanparikh/Desktop/Antigravity Work/planner/scratch/wazir_emails_draft.txt"
with open(output_path, "w") as f:
    for email, report in email_reports.items():
        f.write(f"==================================================\n")
        f.write(f"TO: {email}\n")
        f.write(f"==================================================\n")
        f.write(report)
        f.write("\n\n")

print(f"Generated email drafts saved to: {output_path}")
