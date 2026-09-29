import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('script.js', 'r', encoding='utf-8') as f:
    script = f.read()

import re
queue_func = re.search(r'function (?:renderInvestigationQueue|filterInvestigationQueue|populateInvestigationQueue|initInvestigationQueue)[\s\S]*?\{[\s\S]*?\n\}', script)
if queue_func:
    print(queue_func.group(0)[:2000])
else:
    # search for investigation-queue-grid in script.js
    pos = script.find('investigation-queue-grid')
    if pos != -1:
        print(script[pos-100:pos+1500])
