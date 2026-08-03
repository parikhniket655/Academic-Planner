import os
import glob
from datetime import datetime

search_paths = [
    "/Users/ketanparikh/Desktop",
    "/Users/ketanparikh/Downloads"
]

print("Searching specifically for files with 'mess' or 'menu' in their name...")
found = []
for p in search_paths:
    if os.path.exists(p):
        for root, dirs, files in os.walk(p):
            for file in files:
                lf = file.lower()
                if "mess" in lf or "menu" in lf:
                    fpath = os.path.join(root, file)
                    try:
                        mtime = os.path.getmtime(fpath)
                        found.append((fpath, mtime))
                    except Exception as e:
                        pass

# Sort by mtime descending (most recent first)
found = list(set(found))
found.sort(key=lambda x: x[1], reverse=True)

print(f"Found {len(found)} files:")
for f, mtime in found[:20]:
    dt = datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
    print(f"  {f} | Modified: {dt} | Size: {os.path.getsize(f)} bytes")
