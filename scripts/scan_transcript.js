const fs = require('fs');
const readline = require('readline');

const transcriptFullPath = 'C:\\Users\\UMESH PANDEY\\.gemini\\antigravity\\brain\\add06595-93a6-486f-90f8-2d0e91b0d528\\.system_generated\\logs\\transcript_full.jsonl';

async function scanTranscript() {
  const fileStream = fs.createReadStream(transcriptFullPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let stepIdx = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      const time = obj.created_at || '';
      if (time.includes('2026-09-29T04:4') || time.includes('2026-09-29T04:3')) {
        const toolCalls = obj.tool_calls || [];
        for (const tc of toolCalls) {
          console.log(`[Step ${obj.step_index}] [${time}] Tool: ${tc.name}`);
          if (tc.name === 'write_to_file') {
            console.log(`   Target: ${tc.args.TargetFile}`);
          }
        }
      }
    } catch (e) {}
  }
}

scanTranscript();
