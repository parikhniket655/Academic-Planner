import urllib.request
import ssl
import json

url = "https://frnyuuywkteqiyinlrmp.supabase.co/rest/v1/timetable?date_key=eq.2026-07-27"
context = ssl._create_unverified_context()
headers = {
    'User-Agent': 'Mozilla/5.0',
    'apikey': 'sb_publishable_dfysjA_5CU1AmweExgrmiA_FD0AS34o',
    'Authorization': 'Bearer sb_publishable_dfysjA_5CU1AmweExgrmiA_FD0AS34o'
}

try:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, context=context, timeout=10) as response:
        content = response.read().decode('utf-8')
        data = json.loads(content)
        print("Success! All records on 2026-07-27:")
        for idx, row in enumerate(data):
            print(f"  {idx+1}: Course: {row.get('course_id')} | Day: {row.get('day')} | Slot: {row.get('slot')} | Instr: {row.get('instructor')}")
except Exception as e:
    print("Error:", e)
