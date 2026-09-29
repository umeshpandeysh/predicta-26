import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Let's inspect the topnav rules in style.css
pos = css.find('.topnav-container')
print(css[pos-50:pos+400])
