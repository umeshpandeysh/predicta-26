import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

pos = html.find('class="hero-chip-card"')
pos_end = html.find('<!-- 2. ACTIVE LOT STATUS SUMMARY', pos)
print(html[pos:pos_end])
