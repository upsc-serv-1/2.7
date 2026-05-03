import os

files_to_update = [
    r"c:\Users\Dr. Yogesh\Pictures\g1\src\app.js",
    r"c:\Users\Dr. Yogesh\Pictures\g1\index.html"
]

search_text = "UPSC Vault"
replace_text = "Dr. UPSC"

for file_path in files_to_update:
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = content.replace(search_text, replace_text)
        
        if new_content != content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated: {file_path}")
        else:
            print(f"No changes needed for: {file_path}")
    else:
        print(f"File not found: {file_path}")
