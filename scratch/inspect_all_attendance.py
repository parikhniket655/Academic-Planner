import urllib.request
import ssl
import json

url = "https://frnyuuywkteqiyinlrmp.supabase.co/rest/v1/attendance_logs?select=*"
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
        print("Success! Total attendance logs in Supabase:", len(data))
        cancelled = [r for r in data if r.get('status') == 'cancelled']
        print("Total cancelled logs:", len(cancelled))
        for r in cancelled:
            print(f"  Date: {r.get('date_key')} | Course: {r.get('course_id')} | Status: {r.get('status')}")
except Exception as e:
    print("Error:", e)
