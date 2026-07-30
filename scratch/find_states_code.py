import os

search_term = "jyevnvqbsjjaarsmxzhy"
directories_to_search = [
    "/Users/ketanparikh/Desktop",
    "/Users/ketanparikh/Downloads"
]

print("Searching for files containing the Supabase project ID:", search_term)

found_files = []
for directory in directories_to_search:
    if not os.path.exists(directory):
        continue
    for root, dirs, files in os.walk(directory):
        # Skip node_modules and .git
        if "node_modules" in root or ".git" in root:
            continue
        for file in files:
            if file.endswith((".py", ".js", ".json", ".html", ".env", ".ts", ".txt")):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                        if search_term in f.read():
                            found_files.append(filepath)
                            print(f"Found match: {filepath}")
                except Exception:
                    pass

if not found_files:
    print("No files found containing the project ID.")
