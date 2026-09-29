import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'id="hero-chip-3d-card"' in l:
        print(f"Found on line {i+1}")
        for j in range(i, min(len(lines), i+120)):
            print(f"{j+1}: {lines[j]}", end='')
        break
