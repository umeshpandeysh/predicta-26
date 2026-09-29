import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

pos1 = html.find('class="hero-chip-card"')
pos2 = html.find('<!-- 2. ACTIVE LOT STATUS SUMMARY', pos1)
print(html[pos1-50:pos2])
