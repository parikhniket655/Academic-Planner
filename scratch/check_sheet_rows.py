import urllib.request
import ssl

sheet_id = "1WPTKyFL52nR6PdJ2n2hdlw2yb-S5A6wiiHW1QBdUitU"
gid = "345505707"
url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"

context = ssl._create_unverified_context()
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, context=context, timeout=15) as response:
        content = response.read().decode('utf-8')
        lines = content.splitlines()
        print("Success!")
        print("Total rows in CSV:", len(lines))
        print("First 5 lines:")
        for line in lines[:5]:
            print("  ", line)
except Exception as e:
    print("Error:", e)
