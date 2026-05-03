import os

path = r"c:\Users\Dr. Yogesh\Pictures\g1\src\app.js"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the FIRST occurrence of renderSourceSelectorModal
# It starts at line 3004
marker = "function renderSourceSelectorModal() {"
start_idx = content.find(marker)
if start_idx != -1:
    # Find the next occurrence to be sure we don't delete both if they are close
    next_idx = content.find(marker, start_idx + len(marker))
    if next_idx != -1:
        # We have two. Remove the first one.
        # Find the closing brace of the first one.
        # It should be before some other function like "function renderApp()" or similar.
        # Or I can just search for the next function start.
        
        # Let's find the closing brace that matches the opening one.
        brace_count = 0
        end_idx = -1
        for i in range(start_idx, next_idx):
            if content[i] == '{':
                brace_count += 1
            elif content[i] == '}':
                brace_count -= 1
                if brace_count == 0:
                    end_idx = i + 1
                    break
        
        if end_idx != -1:
            content = content[:start_idx] + content[end_idx:]
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            print("Successfully removed the duplicate function at the beginning of app.js.")
        else:
            print("Could not find closing brace for the first occurrence.")
    else:
        print("Only one occurrence found. Nothing to remove.")
else:
    print("Function not found.")
