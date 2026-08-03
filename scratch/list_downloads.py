import os
from datetime import datetime

path = "/Users/ketanparikh/Downloads"
if os.path.exists(path):
    print(f"Listing files in {path}:")
    files = []
    for root, dirs, filenames in os.walk(path):
        for f in filenames:
            fpath = os.path.join(root, f)
            try:
                mtime = os.path.getmtime(fpath)
                files.append((fpath, mtime))
            except:
                pass
                
    files.sort(key=lambda x: x[1], reverse=True)
    for f, mtime in files[:50]:
        dt = datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
        print(f"  {f} | Modified: {dt} | Size: {os.path.getsize(f)} bytes")
else:
    print(f"Directory {path} does not exist!")
