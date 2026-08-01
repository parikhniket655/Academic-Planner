import urllib.request
import ssl
import json

url = "https://script.google.com/macros/s/AKfycbzKMkHRtxKEWhyybW6CLdlfAHIS0ICimLE4g4-n5Oa_ipo3tG22NEjRMZlvcIxNBB_K/exec"
context = ssl._create_unverified_context()
headers = {
    'User-Agent': 'Mozilla/5.0'
}

try:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, context=context, timeout=15) as response:
        content = response.read().decode('utf-8')
        data = json.loads(content)
        print("Success! Number of sessions returned:", len(data))
        # Print a sample of tomorrow's sessions (August 1st or 2nd)
        sample = [s for s in data if s.get('dateKey') in ('2026-08-01', '2026-08-02')]
        print(f"Sample sessions for August 1st/2nd ({len(sample)} found):")
        for s in sample:
            print(f"  Date: {s.get('dateKey')} | Course: {s.get('courseId')} | Slot: {s.get('slot')} | Instructor: {s.get('instructor')}")
except Exception as e:
    print("Error:", e)
