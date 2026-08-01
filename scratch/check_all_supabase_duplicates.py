import urllib.request
import ssl
import json

url = "https://frnyuuywkteqiyinlrmp.supabase.co/rest/v1/timetable"
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
        print("Total records in Supabase timetable:", len(data))
        
        # Look for August 1st CV and GBS records
        aug1_records = [r for r in data if r.get('date_key') == '2026-08-01']
        print(f"August 1st records ({len(aug1_records)} found):")
        for r in aug1_records:
            print(f"  ID: {r.get('id')} | Course: {r.get('course_id')} | Slot: {r.get('slot')} | Subject: {r.get('subject')}")
except Exception as e:
    print("Error:", e)
