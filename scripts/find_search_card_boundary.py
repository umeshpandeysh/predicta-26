import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

pos_card = html.find('Search Component or Lot...')
card_start = html.rfind('<div class="card"', 0, pos_card)
print(html[card_start-300:card_start+50])
