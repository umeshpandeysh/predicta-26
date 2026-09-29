import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

pos = html.find('id="investigation-queue-grid"')
print(html[pos+len('id="investigation-queue-grid"'):pos+2000])
