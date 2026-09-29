import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

pos = html.find('id="investigation-queue-grid"')
pos_controls = html.find('window.filterComponentsTable()')
print(html[pos_controls-400:pos_controls])
