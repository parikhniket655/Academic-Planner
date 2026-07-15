import urllib.request
import ssl
import json

url = "https://frnyuuywkteqiyinlrmp.supabase.co/rest/v1/attendance_logs?course_id=eq.IBS&email=eq.ipm04niketp@iimrohtak.ac.in"
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
        print("Success! Total IBS logs for Niket:", len(data))
        data.sort(key=lambda x: x.get('date_key', ''))
        for row in data:
            print(f"  Date: {row.get('date_key')} | Status: {row.get('status')}")
except Exception as e:
    print("Error:", e)
