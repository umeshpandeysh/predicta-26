import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

pos = html.find('id="investigation-queue-grid"')
# find next section or card after queue
next_pos = html.find('id="component-search-input"', pos)
print("pos:", pos, "next_pos:", next_pos)
print(html[next_pos-300:next_pos+100])
