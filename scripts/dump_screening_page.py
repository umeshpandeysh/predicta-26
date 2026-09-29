import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

screen_pos = html.find('id="page-screening"')
if screen_pos != -1:
    screen_end = html.find('</section>', screen_pos)
    print(html[screen_pos:screen_end+10])
