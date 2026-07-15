import urllib.request
import ssl

class RedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, hdrs, newurl):
        print(f"Redirecting to: {newurl}")
        return super().redirect_request(req, fp, code, msg, hdrs, newurl)

url = "https://script.google.com/macros/s/AKfycbzKMkHRtxKEWhyybW6CLdlfAHIS0ICimLE4g4-n5Oa_ipo3tG22NEjRMZlvcIxNBB_K/exec"
context = ssl._create_unverified_context()

opener = urllib.request.build_opener(RedirectHandler)
urllib.request.install_opener(opener)

try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'})
    with urllib.request.urlopen(req, context=context, timeout=15) as response:
        content = response.read().decode('utf-8')
        print("Final URL:", response.geturl())
        print("Response length:", len(content))
        print("First 200 chars of response:", content[:200])
except Exception as e:
    print("Error:", e)
