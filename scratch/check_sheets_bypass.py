import urllib.request
import ssl
import json

url = "https://script.google.com/macros/s/AKfycbzKMkHRtxKEWhyybW6CLdlfAHIS0ICimLE4g4-n5Oa_ipo3tG22NEjRMZlvcIxNBB_K/exec"
context = ssl._create_unverified_context()

try:
    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'Mozilla/5.0'}
    )
    with urllib.request.urlopen(req, context=context, timeout=10) as response:
        content = response.read().decode('utf-8', errors='ignore')
        print("Success! Response length:", len(content))
        if len(content) > 0:
            print("Response start:")
            print(content[:500])
except Exception as e:
    print("Failed to fetch macro:", e)
