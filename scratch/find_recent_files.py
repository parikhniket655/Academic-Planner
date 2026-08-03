import os
import glob
from datetime import datetime, timedelta

search_paths = [
    "/Users/ketanparikh/Desktop",
    "/Users/ketanparikh/Downloads"
]

cutoff = datetime.now() - timedelta(hours=24)
print(f"Searching for files modified since {cutoff.strftime('%Y-%m-%d %H:%M:%S')}...")
found = []
for p in search_paths:
    if os.path.exists(p):
        for root, dirs, files in os.walk(p):
            for file in files:
                fpath = os.path.join(root, file)
                try:
                    mtime = datetime.fromtimestamp(os.path.getmtime(fpath))
                    if mtime > cutoff:
                        found.append((fpath, mtime))
                except Exception as e:
                    pass

found = list(set(found))
found.sort(key=lambda x: x[1], reverse=True)

print(f"Found {len(found)} files modified in the last 24 hours:")
for f, mtime in found[:30]:
    dt = mtime.strftime('%Y-%m-%d %H:%M:%S')
    print(f"  {f} | Modified: {dt} | Size: {os.path.getsize(f)} bytes")
