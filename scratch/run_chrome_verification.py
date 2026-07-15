import subprocess
import time
import re

cmd = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '--headless=new',
    '--disable-gpu',
    '--dump-dom',
    'http://localhost:8000/planner/index.html'
]

print("Running Google Chrome in headless mode to render the website...")
process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
time.sleep(5)
process.terminate()
stdout, stderr = process.communicate()

html = stdout.decode('utf-8', errors='ignore')
print(f"Successfully loaded DOM. Length: {len(html)} characters.")

# Search for the today's schedule list container
schedule_pattern = re.compile(r'id="dashboard-today-schedule-list".*?>(.*?)</div>\s*</div>', re.DOTALL)
match = schedule_pattern.search(html)

if match:
    print("\n--- Rendered Today's Schedule (HTML excerpt) ---")
    print(match.group(1).strip()[:1500])
else:
    # Try finding it broadly
    idx = html.find('id="dashboard-today-schedule-list"')
    if idx != -1:
        print("\n--- Today's Schedule List Container Found ---")
        print(html[idx:idx+1000])
    else:
        print("\nCould not find 'dashboard-today-schedule-list' in DOM!")

# Search for any page warnings or errors in the debug element or body
if "error" in html.lower() or "fail" in html.lower():
    print("\n--- Potential Error Messages in DOM ---")
    lines = html.split('\n')
    for line in lines:
        if "error" in line.lower() or "exception" in line.lower() or "fail" in line.lower():
            if len(line.strip()) < 200:
                print("  ", line.strip())

# Search for the script tag to ensure it loaded the correct version
script_match = re.search(r'src="app\.js\?v=[^"]+"', html)
if script_match:
    print(f"\nLoaded script version tag: {script_match.group(0)}")
else:
    print("\nCould not locate app.js script version tag!")
