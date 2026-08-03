import urllib.request
import ssl

url = "https://docs.google.com/spreadsheets/d/1b2abkLcJAavna03KhesMOUamufMgABuuHmuojpZPIZ8/export?format=csv&gid=216885731"
context = ssl._create_unverified_context()
headers = {
    'User-Agent': 'Mozilla/5.0'
}

try:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, context=context, timeout=10) as response:
        content = response.read().decode('utf-8')
        lines = content.splitlines()
        print(f"Successfully fetched CSV. Total lines: {len(lines)}")
        print("First 20 lines of the mess menu spreadsheet:")
        for i, line in enumerate(lines[:20]):
            print(f"  {i+1}: {line}")
except Exception as e:
    print("Error:", e)
