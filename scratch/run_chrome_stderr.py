import subprocess
import time

cmd = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '--headless=new',
    '--disable-gpu',
    '--dump-dom',
    'http://localhost:8000/planner/index.html'
]

print("Running Google Chrome...")
process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
time.sleep(3)
process.terminate()
stdout, stderr = process.communicate()

print("STDOUT length:", len(stdout))
print("STDERR content:")
print(stderr.decode('utf-8', errors='ignore'))
