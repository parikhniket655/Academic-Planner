import urllib.request
import ssl
import json

context = ssl._create_unverified_context()
headers = {
    'User-Agent': 'Mozilla/5.0',
    'apikey': 'sb_publishable_dfysjA_5CU1AmweExgrmiA_FD0AS34o',
    'Authorization': 'Bearer sb_publishable_dfysjA_5CU1AmweExgrmiA_FD0AS34o',
    'Content-Type': 'application/json'
}

# Fetch all IBS logs for July 9 and 11
url = "https://frnyuuywkteqiyinlrmp.supabase.co/rest/v1/attendance_logs?course_id=eq.IBS"

try:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, context=context, timeout=10) as response:
        content = response.read().decode('utf-8')
        data = json.loads(content)
        
    logs_09 = [r for r in data if r.get('date_key') == '2026-07-09']
    logs_11 = [r for r in data if r.get('date_key') == '2026-07-11']
    
    print(f"Loaded {len(logs_09)} logs for July 9th, {len(logs_11)} logs for July 11th.")
    
    for r09 in logs_09:
        email = r09.get('email')
        r09_id = r09.get('id')
        
        # Check if there is an existing log on July 11th for this student
        matching_11 = [r for r in logs_11 if r.get('email') == email]
        if matching_11:
            r11_id = matching_11[0].get('id')
            # Delete the duplicate July 11th record
            del_url = f"https://frnyuuywkteqiyinlrmp.supabase.co/rest/v1/attendance_logs?id=eq.{r11_id}"
            req = urllib.request.Request(del_url, method='DELETE', headers=headers)
            with urllib.request.urlopen(req, context=context, timeout=10):
                print(f"  Deleted duplicate log {r11_id} on July 11th for {email}.")
                
        # Now update the July 9th record to July 11th
        upd_url = f"https://frnyuuywkteqiyinlrmp.supabase.co/rest/v1/attendance_logs?id=eq.{r09_id}"
        payload = {"date_key": "2026-07-11"}
        req = urllib.request.Request(
            upd_url,
            method='PATCH',
            headers=headers,
            data=json.dumps(payload).encode('utf-8')
        )
        with urllib.request.urlopen(req, context=context, timeout=10):
            print(f"  Successfully moved log {r09_id} for {email} from July 9th to July 11th.")

except Exception as e:
    print("Error during migration:", e)
