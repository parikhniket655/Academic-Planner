import urllib.request
import ssl
import json
from collections import Counter

url = "https://frnyuuywkteqiyinlrmp.supabase.co/rest/v1/timetable?select=course_id"
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
        courses = [r.get('course_id') for r in data if r.get('course_id')]
        counts = Counter(courses)
        print("Success! Total timetable rows in Supabase:", len(data))
        print("Session counts by course:")
        for course, count in sorted(counts.items()):
            print(f"  {course}: {count} sessions")
except Exception as e:
    print("Error:", e)
