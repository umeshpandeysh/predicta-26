import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

start = html.find('Static vs. Dynamic')
if start != -1:
    card_start = html.rfind('<div class="card"', 0, start)
    mod_start = html.find('<!-- ── 6 CORE WORKSTATION MODULES')
    print(html[card_start:mod_start])
