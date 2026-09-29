import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'Static vs. Dynamic' in l:
        print(f"Found on line {i+1}")
        for j in range(max(0, i-10), min(len(lines), i+150)):
            print(f"{j+1}: {lines[j]}", end='')
        break
