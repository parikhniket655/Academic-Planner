import urllib.request
import ssl
import json

url = "https://frnyuuywkteqiyinlrmp.supabase.co/rest/v1/timetable?date_key=eq.2026-08-01"
context = ssl._create_unverified_context()
headers = {
    'User-Agent': 'Mozilla/5.0',
    'apikey': 'sb_publishable_dfysjA_5CU1AmweExgrmiA_FD0AS34o',
    'Authorization': 'Bearer sb_publishable_dfysjA_5CU1AmweExgrmiA_FD0AS34o'
}

try:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, context=context, timeout=10) as response:
        data = json.loads(response.read().decode('utf-8'))
        print(f"Raw records in Supabase for 2026-08-01 ({len(data)} total):")
        for r in data:
            print(f"  ID: {r.get('id')} | Course: {r.get('course_id')} | Slot: {repr(r.get('slot'))} | Subject: {r.get('subject')}")
except Exception as e:
    print("Error:", e)
