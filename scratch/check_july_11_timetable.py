import urllib.request
import ssl
import json

url = "https://frnyuuywkteqiyinlrmp.supabase.co/rest/v1/timetable?date_key=eq.2026-07-11"
context = ssl._create_unverified_context()

try:
    req = urllib.request.Request(
        url,
        headers={
            'User-Agent': 'Mozilla/5.0',
            'apikey': 'sb_publishable_dfysjA_5CU1AmweExgrmiA_FD0AS34o',
            'Authorization': 'Bearer sb_publishable_dfysjA_5CU1AmweExgrmiA_FD0AS34o'
        }
    )
    with urllib.request.urlopen(req, context=context, timeout=10) as response:
        content = response.read().decode('utf-8')
        data = json.loads(content)
        print("Success! Total records on 2026-07-11 in Supabase:", len(data))
        for row in data:
            print(f"  Course: {row.get('course_id')} | Slot: {row.get('slot')} | Subject: {row.get('subject')} | Instructor: {row.get('instructor')}")
except Exception as e:
    print("Error:", e)
