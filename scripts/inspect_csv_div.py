import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

csv_pos = html.find('id="screening-view-csv"')
manual_pos = html.find('id="screening-view-manual"')
print(html[csv_pos:manual_pos+100])
