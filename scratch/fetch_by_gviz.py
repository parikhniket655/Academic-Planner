import urllib.request
import ssl

sheet_id = "1b2abkLcJAavna03KhesMOUamufMgABuuHmuojpZPIZ8"
url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?tqx=out:csv&sheet=Imported%20Menu"

context = ssl._create_unverified_context()
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, context=context, timeout=10) as response:
        content = response.read().decode('utf-8')
        print("Success! Length:", len(content))
        print("First 200 chars:\n", content[:200])
except Exception as e:
    print("Error:", e)
