import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

pos = html.find('id="page-home"')
print(html[pos:pos+3500])
