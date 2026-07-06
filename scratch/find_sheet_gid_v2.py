import urllib.request
import ssl
import re

url = "https://docs.google.com/spreadsheets/d/1b2abkLcJAavna03KhesMOUamufMgABuuHmuojpZPIZ8/edit?usp=sharing"
context = ssl._create_unverified_context()

try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, context=context, timeout=10) as response:
        html = response.read().decode('utf-8', errors='ignore')
        
        # Google sheets stores tab data in a JSON array inside a script tag
        # Look for bootstrapData or a sheet list data block
        # Let's search for "Imported Menu" and show everything around it
        matches = [m.start() for m in re.finditer("Imported Menu", html)]
        print(f"Found {len(matches)} occurrences of 'Imported Menu'")
        
        for idx in matches:
            print("\n--- Occurrence at", idx, "---")
            start = max(0, idx - 400)
            end = min(len(html), idx + 600)
            print(html[start:end])
except Exception as e:
    print("Error:", e)
