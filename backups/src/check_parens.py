import os
import re

path = r"c:\Users\Dr. Yogesh\Pictures\g1\src\app.js"
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    # Find suspiciously nested parens
    if '))' in line or '))}' in line or '}) )' in line:
        # Check if it's a known pattern like map().join("") or addEventListener(() => { ... })
        # common_patterns = [r'.map\(.*\)\.join\(.*\)', r'addEventListener\(.*\)', r'forEach\(.*\)']
        # For now, just print it for manual review
        print(f"Line {i+1}: {line.strip()}")
