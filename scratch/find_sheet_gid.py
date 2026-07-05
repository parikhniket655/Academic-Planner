import re

html_file = "/Users/ketanparikh/.gemini/antigravity/brain/41bd2155-ecab-4d14-a357-5cb041f771d1/scratch/fetch_page_test.py" # wait, fetch_page_test.py was the script, not the HTML.
# Let's write a script that fetches the page and searches the HTML.

import urllib.request
import ssl

url = "https://docs.google.com/spreadsheets/d/1b2abkLcJAavna03KhesMOUamufMgABuuHmuojpZPIZ8/edit?usp=sharing"
context = ssl._create_unverified_context()

try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, context=context, timeout=10) as response:
        html = response.read().decode('utf-8', errors='ignore')
        
        # Look for sheet name and search around it for digits (gids)
        # Typically Google Sheets stores this in: bootstrapData
        # Or search for: "Imported Menu"
        idx = html.find("Imported Menu")
        if idx != -1:
            print("Found 'Imported Menu' at index:", idx)
            # Print 500 characters around it
            start = max(0, idx - 200)
            end = min(len(html), idx + 300)
            print("Snippet:", html[start:end])
            
            # Find all numbers around it
            numbers = re.findall(r'\b\d+\b', html[start:end])
            print("Numbers near it:", numbers)
        else:
            print("Could not find 'Imported Menu' in HTML")
except Exception as e:
    print("Error:", e)
