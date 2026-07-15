import urllib.request
import json
import ssl

url = "https://script.google.com/macros/s/AKfycbzKMkHRtxKEWhyybW6CLdlfAHIS0ICimLE4g4-n5Oa_ipo3tG22NEjRMZlvcIxNBB_K/exec"
context = ssl._create_unverified_context()

try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, context=context, timeout=15) as response:
        content = response.read().decode('utf-8')
        data = json.loads(content)
        sessions = data.get("sessions", [])
        print("Success!")
        print("Total sessions returned by App Script:", len(sessions))
        if len(sessions) > 0:
            print("First 3 parsed sessions:")
            for s in sessions[:3]:
                print(f"  {s.get('dateKey')} | {s.get('courseId')} | {s.get('slot')} | {s.get('subject')}")
except Exception as e:
    print("Error:", e)
