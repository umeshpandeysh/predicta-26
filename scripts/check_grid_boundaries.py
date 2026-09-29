with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

pos = html.find('id="investigation-queue-grid"')
pos_table = html.find('id="component-inventory-table"')
print("pos:", pos, "pos_table:", pos_table)
print(html[pos:pos+400])
print("...")
print(html[pos_table-400:pos_table])
