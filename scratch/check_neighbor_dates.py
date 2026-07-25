import urllib.request
import ssl
import json

context = ssl._create_unverified_context()
headers = {
    'User-Agent': 'Mozilla/5.0',
    'apikey': 'sb_publishable_dfysjA_5CU1AmweExgrmiA_FD0AS34o',
    'Authorization': 'Bearer sb_publishable_dfysjA_5CU1AmweExgrmiA_FD0AS34o'
}

for date_val in ["2026-07-25", "2026-07-26", "2026-07-27"]:
    url = f"https://frnyuuywkteqiyinlrmp.supabase.co/rest/v1/timetable?date_key=eq.{date_val}"
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, context=context, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            print(f"Date: {date_val} | Total classes: {len(data)}")
            for idx, r in enumerate(data[:15]):
                print(f"  {idx+1}: Course: {r.get('course_id')} | Slot: {r.get('slot')} | Instr: {r.get('instructor')}")
    except Exception as e:
        print("Error:", e)
