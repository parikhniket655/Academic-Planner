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
        cb_records = [r for r in data if r.get('course_id', '').startswith('CB')]
        print(f"Success! Total CB records in Supabase: {len(cb_records)}")
        cb_records.sort(key=lambda x: (x.get('date_key', ''), x.get('course_id', '')))
        for idx, row in enumerate(cb_records):
            instr = row.get('instructor', '')
            prof = instr.split('|')[0] if '|' in instr else instr
            s_num = instr.split('|')[1] if '|' in instr else '?'
            print(f"  {idx+1}: Date: {row.get('date_key')} | Course: {row.get('course_id')} | Slot: {row.get('slot')} | Session: #{s_num} | Prof: {prof}")
except Exception as e:
    print("Error:", e)
