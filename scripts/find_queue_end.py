import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

pos = html.find('id="investigation-queue-grid"')
pos2 = html.find('Showing 256 / 256 Active Components')
print("pos:", pos, "pos2:", pos2)
print(html[pos2-500:pos2])
