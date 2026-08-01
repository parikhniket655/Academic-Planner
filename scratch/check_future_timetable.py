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
        
        # Filter for dates >= 2026-07-31
        future_data = [r for r in data if r.get('date_key', '') >= '2026-07-31']
        print(f"Total future records from 2026-07-31 onwards: {len(future_data)}")
        
        # Check for duplicates in this subset
        seen = {}
        duplicates = []
        for idx, r in enumerate(future_data):
            key = (r.get('date_key'), r.get('slot'), r.get('course_id'))
            if key in seen:
                duplicates.append((key, r.get('id'), seen[key]))
            else:
                seen[key] = r.get('id')
                
        print(f"Found {len(duplicates)} duplicates from 2026-07-31 onwards.")
        if duplicates:
            print("Duplicate details:")
            for key, dup_id, original_id in duplicates[:10]:
                print(f"  Key: {key} | Duplicate ID: {dup_id} | Original ID: {original_id}")
                
except Exception as e:
    print("Error:", e)
