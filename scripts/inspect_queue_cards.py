import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

pos = html.find('id="investigation-queue-grid"')
if pos != -1:
    pos_end = html.find('</div>\n        </div>\n\n        <!-- 5. 256-DIE POPULATION REPOSITORY', pos)
    if pos_end == -1: pos_end = pos + 2500
    print(html[pos:pos_end])
