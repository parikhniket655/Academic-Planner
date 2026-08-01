import json

filepath = "/Users/ketanparikh/Desktop/Antigravity Work/planner/scratch/web_app_response.json"
try:
    with open(filepath, "r") as f:
        data = json.load(f)
    print("Total items in Web App response:", len(data))
    
    # Check for duplicates on dateKey and slot and courseId
    seen = {}
    duplicates = []
    for idx, item in enumerate(data):
        key = (item.get('dateKey'), item.get('slot'), item.get('courseId'))
        if key in seen:
            duplicates.append((key, seen[key], idx))
        else:
            seen[key] = idx
            
    print("Found total duplicate items in Web App response:", len(duplicates))
    if len(duplicates) > 0:
        print("First 10 duplicates:")
        for key, first_idx, dup_idx in duplicates[:10]:
            print(f"  Key: {key} | First seen at index {first_idx} | Duplicate at index {dup_idx}")
            
except Exception as e:
    print("Error:", e)
