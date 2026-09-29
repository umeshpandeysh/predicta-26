const fs = require('fs');
const cp = require('child_process');

console.log('=== AUDITING SUPABASE IN CODEBASE ===');
try {
  const matches = cp.execSync('git grep -i "bolrnmtfrketllhhefza"', { encoding: 'utf8' });
  console.log(matches);
} catch (e) {
  console.log('No git grep matches for project ID.');
}

try {
  const matches2 = cp.execSync('git grep -i "createClient"', { encoding: 'utf8' });
  console.log('createClient occurrences:');
  console.log(matches2);
} catch (e) {
  console.log('No createClient occurrences.');
}
