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

insert_url = "https://frnyuuywkteqiyinlrmp.supabase.co/rest/v1/timetable"
session_data = {
    "date_key": "2026-07-25",
    "day": "Saturday",
    "slot": "19:15 - 20:30",
    "course_id": "MBPET",
    "subject": "Managing Business Processes with Emerging Technologies (MBPET)",
    "room": "LR 07",
    "instructor": "RN|14",
    "section": "Combined"
}

try:
    req = urllib.request.Request(
        insert_url,
        method='POST',
        headers=headers,
        data=json.dumps(session_data).encode('utf-8')
    )
    with urllib.request.urlopen(req, context=context, timeout=10) as response:
        print("Success! Inserted MBPET session 14 into Supabase table.")
except Exception as e:
    print("Error inserting MBPET session 14:", e)
