import os

path = r"c:\Users\Dr. Yogesh\Pictures\g1\src\app.js"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove the dead code at the end of the file
relocated_marker = "// Source Scope Segmented Control"
relocated_idx = content.find(relocated_marker)
if relocated_idx != -1:
    # Find the end of this block
    end_marker = "            renderApp();\n        }\n    });"
    # Again, find the second one
    first_close = content.find(end_marker, relocated_idx)
    second_close = content.find(end_marker, first_close + len(end_marker))
    
    if second_close != -1:
        block_end = second_close + len(end_marker)
        listeners_code = content[relocated_idx:block_end]
        content = content[:relocated_idx] + content[block_end:]
    else:
        print("Could not find second close for listeners")
        # Fallback: take until the end of the file if it's near
        content_lines = content.splitlines()
        # Find where it starts
        for i, line in enumerate(content_lines):
            if relocated_marker in line:
                listeners_code = "\\n".join(content_lines[i:])
                content = "\\n".join(content_lines[:i])
                break

# 2. Find bindGlobalEvents and insert the code
# I'll insert it at the beginning of the function for safety
# function bindGlobalEvents() {
bind_marker = "function bindGlobalEvents() {"
bind_idx = content.find(bind_marker)
if bind_idx != -1:
    insert_idx = bind_idx + len(bind_marker)
    # Insert with some spacing
    content = content[:insert_idx] + "\n" + listeners_code + "\n" + content[insert_idx:]

# 3. Final Syntax Check: Ensure no mismatched braces were left in the Nav [data-view] block
# Line 14587 area
# I'll search for "renderApp();" followed by multiple closing braces
# Since I already cleaned it with fix_syntax.py, it should be fine, but let's be sure.

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Properly relocated listeners into bindGlobalEvents.")
