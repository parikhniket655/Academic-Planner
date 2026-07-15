import urllib.request
import ssl
import json

context = ssl._create_unverified_context()
headers = {
    'User-Agent': 'Mozilla/5.0',
    'apikey': 'sb_publishable_dfysjA_5CU1AmweExgrmiA_FD0AS34o',
    'Authorization': 'Bearer sb_publishable_dfysjA_5CU1AmweExgrmiA_FD0AS34o',
    'Content-Type': 'application/json'
}

# 1. Insert the July 11th IBS session
insert_url = "https://frnyuuywkteqiyinlrmp.supabase.co/rest/v1/timetable"
session_data = {
    "date_key": "2026-07-11",
    "day": "Saturday",
    "slot": "08:45 - 10:00",
    "course_id": "IBS",
    "subject": "International Business Strategies (IBS)",
    "room": "LR 07",
    "instructor": "PD|9", # Added parsed session number payload
    "section": "Sec-B"
}

try:
    req = urllib.request.Request(
        insert_url,
        method='POST',
        headers=headers,
        data=json.dumps(session_data).encode('utf-8')
    )
    with urllib.request.urlopen(req, context=context, timeout=10) as response:
        print("Success! Inserted July 11 IBS session.")
except Exception as e:
    print("Error inserting July 11 IBS session:", e)

# 2. Delete the July 9th IBS session
delete_url = "https://frnyuuywkteqiyinlrmp.supabase.co/rest/v1/timetable?course_id=eq.IBS&date_key=eq.2026-07-09"
try:
    req = urllib.request.Request(
        delete_url,
        method='DELETE',
        headers=headers
    )
    with urllib.request.urlopen(req, context=context, timeout=10) as response:
        print("Success! Deleted July 9 IBS session.")
except Exception as e:
    print("Error deleting July 9 IBS session:", e)

# 3. Update the attendance logs for IBS on 2026-07-09 to 2026-07-11
update_url = "https://frnyuuywkteqiyinlrmp.supabase.co/rest/v1/attendance_logs?course_id=eq.IBS&date_key=eq.2026-07-09"
update_data = {
    "date_key": "2026-07-11"
}
try:
    req = urllib.request.Request(
        update_url,
        method='PATCH',
        headers=headers,
        data=json.dumps(update_data).encode('utf-8')
    )
    with urllib.request.urlopen(req, context=context, timeout=10) as response:
        print("Success! Updated IBS attendance logs from July 9 to July 11.")
except Exception as e:
    print("Error updating IBS attendance logs:", e)
