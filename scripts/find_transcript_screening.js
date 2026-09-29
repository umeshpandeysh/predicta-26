const fs = require('fs');
const readline = require('readline');

async function findScreeningSection() {
  const fileStream = fs.createReadStream('C:\\Users\\UMESH PANDEY\\.gemini\\antigravity\\brain\\add06595-93a6-486f-90f8-2d0e91b0d528\\.system_generated\\logs\\transcript_full.jsonl');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.step_index >= 67865 && obj.step_index <= 68110) {
        if (obj.tool_calls) {
          for (const tc of obj.tool_calls) {
            const code = tc.args?.CodeContent || tc.args?.CommandLine || '';
            if (code.includes('adm-decision-command-panel') && code.length > 500) {
              console.log('Found in step', obj.step_index, 'len:', code.length);
            }
          }
        }
      }
    } catch (e) {}
  }
}
findScreeningSection();
