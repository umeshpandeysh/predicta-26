import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()

import re
matches = re.findall(r'(\.static-vs-dynamic[^{]*\{[^}]*\}|\.screening-pillar[^{]*\{[^}]*\}|\.flow-progression[^{]*\{[^}]*\}|\.flow-node[^{]*\{[^}]*\}|\.flow-arrow[^{]*\{[^}]*\})', css)
for m in matches:
    print(m)
