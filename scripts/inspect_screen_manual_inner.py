import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

screen_pos = html.find('id="screening-view-manual"')
if screen_pos != -1:
    print(html[screen_pos+2000:screen_pos+6000])
