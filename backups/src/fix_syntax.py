import os

path = r"c:\Users\Dr. Yogesh\Pictures\g1\src\app.js"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# I need to extract the misplaced listeners and put them in the correct place.
# The code was accidentally injected inside the [data-view] listener.

problem_start = '    // Source Scope Segmented Control'
start_idx = content.find(problem_start)
if start_idx != -1:
    # Marker for the end of the block I injected
    # I'll search for the last part of my injected code block
    end_marker = '            renderApp();\n        }\n    });'
    # There are two of these closings in the block. We need the second one.
    first_close = content.find(end_marker, start_idx)
    if first_close != -1:
        second_close = content.find(end_marker, first_close + len(end_marker))
        if second_close != -1:
            full_end = second_close + len(end_marker)
            
            # Extract the block
            listeners_block = content[start_idx:full_end]
            
            # Clean app.js
            content_cleaned = content[:start_idx] + content[full_end:]
            
            # Now find the end of bindGlobalEvents()
            # It should be right before renderPracticeSearchPanel
            search_func_token = "function renderPracticeSearchPanel() {"
            search_idx = content_cleaned.find(search_func_token)
            if search_idx != -1:
                # Find the closing brace before the search function
                final_brace_idx = content_cleaned.rfind("}", search_idx)
                if final_brace_idx != -1:
                    # Insert before the last brace of bindGlobalEvents
                    # Actually bindGlobalEvents is a long function. 
                    # Let's verify the indentation to be sure it's the right brace.
                    
                    content_fixed = content_cleaned[:final_brace_idx] + listeners_block + "\n" + content_cleaned[final_brace_idx:]
                    
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(content_fixed)
                    print("Relocated listeners successfully.")
                else:
                    print("Error: Could not find bindGlobalEvents closing brace.")
            else:
                print("Error: Could not find renderPracticeSearchPanel.")
        else:
            print("Error: Could not find second closing brace.")
    else:
        print("Error: Could not find first closing brace.")
else:
    print("Error: Could not find start of problem block.")
