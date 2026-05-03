import os

def check_balance(content):
    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    lines = content.split('\\n')
    
    # We need to skip comments and strings to be accurate
    # This is a simple tokenizer
    in_string = False
    string_char = None
    in_multiline_comment = False
    in_single_line_comment = False
    
    for i, line in enumerate(lines):
        line_num = i + 1
        j = 0
        while j < len(line):
            char = line[j]
            
            if in_multiline_comment:
                if line[j:j+2] == '*/':
                    in_multiline_comment = False
                    j += 1
            elif in_single_line_comment:
                break # Skip rest of line
            elif in_string:
                if char == '\\\\' and j + 1 < len(line):
                    j += 1 # Skip escaped char
                elif char == string_char:
                    in_string = False
            else:
                if line[j:j+2] == '/*':
                    in_multiline_comment = True
                    j += 1
                elif line[j:j+2] == '//':
                    break # Rest of line is comment
                elif char in ["'", '"', '`']:
                    in_string = True
                    string_char = char
                elif char in '([{':
                    stack.append((char, line_num, j + 1))
                elif char in ')]}':
                    if not stack:
                        return f"Unmatched closing {char} at line {line_num}, col {j+1}"
                    top_char, top_line, top_col = stack.pop()
                    if top_char != pairs[char]:
                        return f"Mismatched {char} at line {line_num}, col {j+1} (expected {pairs[char]} but found {top_char} from line {top_line}, col {top_col})"
            j += 1
        in_single_line_comment = False
        
    if stack:
        top_char, top_line, top_col = stack.pop()
        return f"Unclosed {top_char} from line {top_line}, col {top_col}"
    
    return "Balanced"

path = r"c:\Users\Dr. Yogesh\Pictures\g1\src\app.js"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

result = check_balance(content)
print(result)
