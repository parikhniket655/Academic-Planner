import urllib.request
import ssl
import json

context = ssl._create_unverified_context()
headers = {
    'User-Agent': 'Mozilla/5.0',
    'apikey': 'sb_publishable_dfysjA_5CU1AmweExgrmiA_FD0AS34o',
    'Authorization': 'Bearer sb_publishable_dfysjA_5CU1AmweExgrmiA_FD0AS34o'
}

url = "https://frnyuuywkteqiyinlrmp.supabase.co/rest/v1/attendance_logs?course_id=eq.IBS"

try:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, context=context, timeout=10) as response:
        content = response.read().decode('utf-8')
        data = json.loads(content)
        print("Success! IBS Attendance Logs:")
        for row in data:
            date = row.get('date_key')
            if date in ['2026-07-09', '2026-07-11']:
                print(f"  ID: {row.get('id')} | Date: {date} | Email: {row.get('email')} | Status: {row.get('status')}")
except Exception as e:
    print("Error:", e)
