import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

keywords = ['Space Grotesk', 'space-grotesk', '1778C8', '1fa6c9', '1FA6C9', '5b61c7', '5B61C7', 'D5E3EF', 'd5e3ef', 'PREDICTA-BUILD-TYPOGRAPHY']
files_to_check = ['index.html', 'style.css', 'script.js', 'frontend/index.html', 'frontend/style.css', 'frontend/script.js']

found_any = False
for fname in files_to_check:
    if os.path.exists(fname):
        with open(fname, 'r', encoding='utf-8') as f:
            content = f.read()
            for kw in keywords:
                count = content.count(kw)
                if count > 0:
                    print(f'Found {count} occurrences of "{kw}" in {fname}')
                    found_any = True

if not found_any:
    print("✔ ZERO occurrences of any experiment tokens (Space Grotesk, 1778C8, 1FA6C9, 5B61C7, D5E3EF, etc.) in active frontend files!")

# Let's also inspect style.css font imports and root variables
with open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()

print("\n=== CURRENT style.css FONT IMPORT ===")
for line in css.splitlines()[:5]:
    print(line)

print("\n=== CURRENT style.css :root TOKENS ===")
root_idx = css.find(':root')
root_end = css.find('}', root_idx)
print(css[root_idx:root_end+1])
