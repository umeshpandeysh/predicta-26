import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

pos1 = html.find('class="hero-chip-card"')
pos2 = html.find('<!-- 2. ACTIVE LOT STATUS SUMMARY', pos1)
hero_block = html[pos1-20:pos2]
print(hero_block[:2000])
print("...")
print(hero_block[-1000:])
