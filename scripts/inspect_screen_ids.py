import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

screen_pos = html.find('id="page-screening"')
screen_end = html.find('id="page-monitor"')
print("Total chars in page-screening:", screen_end - screen_pos)

# print all divs with id in page-screening
import re
div_ids = re.findall(r'<div[^>]*id="([^"]+)"[^>]*>', html[screen_pos:screen_end])
print("Div IDs in page-screening:", div_ids)
