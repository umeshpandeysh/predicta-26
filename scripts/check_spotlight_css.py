with open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()

import re
matches = re.findall(r'(\.[a-zA-Z0-9_-]*spotlight[a-zA-Z0-9_-]*[^{]*\{[^}]*\})', css)
for m in matches:
    print(m)
