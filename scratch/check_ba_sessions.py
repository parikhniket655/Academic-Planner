import urllib.request
import ssl
import json

url = "https://frnyuuywkteqiyinlrmp.supabase.co/rest/v1/timetable?course_id=eq.BA%20Sec-A"
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
        print("Success! Total BA Sec-A records in Supabase:", len(data))
        data.sort(key=lambda x: (x.get('date_key'), x.get('slot')))
        for idx, row in enumerate(data):
            print(f"  {idx+1}: Date: {row.get('date_key')} | Slot: {row.get('slot')}")
except Exception as e:
    print("Error:", e)
