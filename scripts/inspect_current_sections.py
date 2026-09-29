import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

with open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()

print('=== 1. TOPNAV CSS ===')
topnav_matches = re.findall(r'(\.topnav[^{]*\{[^}]*\})', css)
for m in topnav_matches:
    print(m)

print('\n=== 2. HOME STATIC VS DYNAMIC ===')
static_pos = html.find('Static vs. Dynamic')
if static_pos != -1:
    mod_pos = html.find('6 CORE WORKSTATION MODULES')
    print(html[static_pos-200:mod_pos])

print('\n=== 3. HOME MODULES ===')
if mod_pos != -1:
    print(html[mod_pos-50:mod_pos+3000])

print('\n=== 4. SCREENING PAGE ===')
screen_pos = html.find('id="page-screening"')
if screen_pos != -1:
    screen_end = html.find('</section>', screen_pos)
    print(html[screen_pos:screen_end+10])

print('\n=== 5. INVESTIGATION QUEUE ===')
queue_pos = html.find('Investigation Queue')
if queue_pos != -1:
    print(html[queue_pos-200:queue_pos+2000])
