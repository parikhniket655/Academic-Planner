import urllib.request
import ssl
import json

# Delete the IBS session on 2026-07-11
url = "https://frnyuuywkteqiyinlrmp.supabase.co/rest/v1/timetable?course_id=eq.IBS&date_key=eq.2026-07-11"
context = ssl._create_unverified_context()

try:
    req = urllib.request.Request(
        url,
        method='DELETE',
        headers={
            'User-Agent': 'Mozilla/5.0',
            'apikey': 'sb_publishable_dfysjA_5CU1AmweExgrmiA_FD0AS34o',
            'Authorization': 'Bearer sb_publishable_dfysjA_5CU1AmweExgrmiA_FD0AS34o'
        }
    )
    with urllib.request.urlopen(req, context=context, timeout=10) as response:
        print("Success! Deleted July 11 IBS session from Supabase table.")
except Exception as e:
    print("Error deleting row from Supabase:", e)
