const fs = require('fs');

const transcriptPath = 'C:\\Users\\UMESH PANDEY\\.gemini\\antigravity\\brain\\add06595-93a6-486f-90f8-2d0e91b0d528\\.system_generated\\logs\\transcript.jsonl';
const transcriptFullPath = 'C:\\Users\\UMESH PANDEY\\.gemini\\antigravity\\brain\\add06595-93a6-486f-90f8-2d0e91b0d528\\.system_generated\\logs\\transcript_full.jsonl';

console.log('Transcript exists:', fs.existsSync(transcriptPath), 'Full exists:', fs.existsSync(transcriptFullPath));
