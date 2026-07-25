import urllib.request
import ssl
import json

url = "https://frnyuuywkteqiyinlrmp.supabase.co/rest/v1/timetable?course_id=eq.BA%20Sec-B&date_key=eq.2026-07-17"
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
        print("Success! BA Sec-B Today schedule in Supabase:")
        for row in data:
            for k, v in row.items():
                print(f"  {k}: {v}")
except Exception as e:
    print("Error:", e)
