import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()

import re
matches = re.findall(r'(\.[a-zA-Z0-9_-]*hero[a-zA-Z0-9_-]*[^{]*\{[^}]*\}|\.[a-zA-Z0-9_-]*chip[a-zA-Z0-9_-]*[^{]*\{[^}]*\})', css)
for m in matches:
    print(m)
