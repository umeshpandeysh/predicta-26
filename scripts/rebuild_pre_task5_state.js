const fs = require('fs');
const cp = require('child_process');

console.log('=== REBUILDING PRE-TASK-5 GOLDEN FRONTEND STATE ===');

// 1. Checkout base from 485eb45 for index.html, style.css, script.js
console.log('Step 1: Extracting clean base files from commit 485eb45...');
const baseIndex = cp.execSync('git show 485eb45:index.html', { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });
const baseStyle = cp.execSync('git show 485eb45:style.css', { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });
const baseScript = cp.execSync('git show 485eb45:script.js', { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });

fs.writeFileSync('index.html', baseIndex, 'utf8');
fs.writeFileSync('frontend/index.html', baseIndex, 'utf8');

fs.writeFileSync('style.css', baseStyle, 'utf8');
fs.writeFileSync('frontend/style.css', baseStyle, 'utf8');

fs.writeFileSync('script.js', baseScript, 'utf8');
fs.writeFileSync('frontend/script.js', baseScript, 'utf8');

console.log('✔ Base files written.');

// 2. Apply Step 67870: apply_fullscreen_decision_panel_and_cleanup.js
console.log('Step 2: Executing apply_fullscreen_decision_panel_and_cleanup.js...');
cp.execSync('node scripts/apply_fullscreen_decision_panel_and_cleanup.js', { stdio: 'inherit' });

// 3. Apply Step 67950: apply_home_hero_and_spotlight_relocation.js
console.log('Step 3: Executing apply_home_hero_and_spotlight_relocation.js...');
cp.execSync('node scripts/apply_home_hero_and_spotlight_relocation.js', { stdio: 'inherit' });

// 4. Apply Step 67975: apply_hero_proportional_polish.js
console.log('Step 4: Executing apply_hero_proportional_polish.js...');
cp.execSync('node scripts/apply_hero_proportional_polish.js', { stdio: 'inherit' });

// 5. Apply Step 68045: apply_index_monitor.js
console.log('Step 5: Executing apply_index_monitor.js...');
cp.execSync('node scripts/apply_index_monitor.js', { stdio: 'inherit' });

// 6. Apply Step 68069: apply_script_monitor_exact.js
console.log('Step 6: Executing apply_script_monitor_exact.js...');
cp.execSync('node scripts/apply_script_monitor_exact.js', { stdio: 'inherit' });

// 7. Apply Step 68091: upgrade_svg_fonts.js
console.log('Step 7: Executing upgrade_svg_fonts.js...');
cp.execSync('node scripts/upgrade_svg_fonts.js', { stdio: 'inherit' });

// 8. Sync frontend/ folder
['index.html', 'style.css', 'script.js'].forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  fs.writeFileSync('frontend/' + file, content, 'utf8');
});

console.log('✔ Sync completed for frontend/ directory.');
console.log('=== EXACT RESTORE COMPLETE ===');
