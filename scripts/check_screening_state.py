import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

screen_pos = html.find('id="screening-empty-state"')
print("screening-empty-state pos:", screen_pos)
screen_cont = html.find('id="screening-content"')
print("screening-content pos:", screen_cont)
if screen_pos != -1:
    print("Empty state HTML:")
    print(html[screen_pos-50:screen_pos+1000])
if screen_cont != -1:
    print("Screening content HTML:")
    print(html[screen_cont-50:screen_cont+1000])
