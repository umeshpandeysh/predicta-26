const fs = require('fs');
const readline = require('readline');

const transcriptFullPath = 'C:\\Users\\UMESH PANDEY\\.gemini\\antigravity\\brain\\add06595-93a6-486f-90f8-2d0e91b0d528\\.system_generated\\logs\\transcript_full.jsonl';

async function extractPreviousState() {
  const fileStream = fs.createReadStream(transcriptFullPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      // Look for steps around 68040 - 68110
      if (obj.step_index >= 68040 && obj.step_index <= 68110) {
        if (obj.tool_calls) {
          obj.tool_calls.forEach(tc => {
            console.log(`Step ${obj.step_index}: ${tc.name} -> ${JSON.stringify(tc.args).substring(0, 150)}`);
          });
        }
      }
    } catch (e) {}
  }
}

extractPreviousState();
