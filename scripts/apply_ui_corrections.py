import re
import sys
import shutil

sys.stdout.reconfigure(encoding='utf-8')

print("=== APPLYING 5 PRECISE UI CORRECTIONS ===")

# 1. Update style.css
with open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Replace .topnav-container
old_topnav_container = """.topnav-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}"""

new_topnav_container = """.topnav-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
  height: 60px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 16px;
}

.brand-section {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  justify-self: start;
}

.topnav-menu {
  display: flex;
  align-items: center;
  gap: 4px;
  justify-self: center;
}

.topnav-spacer {
  display: flex;
  justify-self: end;
}"""

if old_topnav_container in css:
    css = css.replace(old_topnav_container, new_topnav_container)
    print("✔ Updated .topnav-container grid in style.css")
else:
    print("ℹ .topnav-container already modified or different")

# Add new layout classes if not present
layout_classes = """
/* ─── UI CORRECTIONS: STATIC VS DYNAMIC, MODULES & QUEUE ─── */
.static-vs-dynamic-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 12px;
}

.screening-pillar-card {
  background: #FFFFFF;
  border: 1px solid #D8E5EF;
  border-radius: 8px;
  padding: 16px 18px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.screening-pillar-card.static {
  border-left: 4px solid #94A3B8;
}

.screening-pillar-card.predicta {
  border-left: 4px solid #1976B8;
  background: #FDFEFE;
}

.flow-progression-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin: 12px 0;
  padding: 10px 12px;
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 6px;
}

.flow-node {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
  background: #FFFFFF;
  border: 1px solid #CBD5E1;
  color: #334155;
  white-space: nowrap;
}

.flow-node.highlight-pass {
  background: #ECFDF5;
  border-color: #6EE7B7;
  color: #059669;
  font-weight: 700;
}

.flow-node.highlight-escape {
  background: #FEF2F2;
  border-color: #FCA5A5;
  color: #DC2626;
  font-weight: 700;
}

.flow-node.highlight-warn {
  background: #FFFBEB;
  border-color: #FCD34D;
  color: #D97706;
  font-weight: 700;
}

.flow-node.highlight-crit {
  background: #FEF2F2;
  border-color: #FCA5A5;
  color: #DC2626;
  font-weight: 700;
}

.flow-arrow {
  color: #94A3B8;
  font-size: 12px;
  font-weight: bold;
}

.module-nav-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 12px;
}

.module-nav-card {
  background: #FFFFFF;
  border: 1px solid #D8E5EF;
  border-radius: 8px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
}

.module-nav-card:hover {
  border-color: #1976B8;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(25, 118, 184, 0.08);
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.card-icon-box {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: #EAF4FB;
  color: #1976B8;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-arrow {
  margin-left: auto;
  color: #94A3B8;
  font-size: 14px;
  transition: transform 0.2s ease;
}

.module-nav-card:hover .card-arrow {
  color: #1976B8;
  transform: translateX(3px);
}

.investigation-queue-container {
  max-width: 1400px;
  margin: 0 auto 24px auto;
}

.queue-summary-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 10px;
}

.queue-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.queue-card {
  background: #FFFFFF;
  border: 1px solid #D8E5EF;
  border-radius: 6px;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
}

.queue-card:hover {
  border-color: #1976B8;
  background: #FDFEFE;
  box-shadow: 0 2px 6px rgba(18, 59, 99, 0.05);
}

.queue-card.critical {
  border-left: 4px solid #DC2626;
}

.queue-card.warning {
  border-left: 4px solid #D97706;
}

.queue-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.queue-card-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.queue-card-evidence-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr) auto;
  gap: 12px;
  align-items: center;
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 11.5px;
}

@media (max-width: 1024px) {
  .module-nav-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .static-vs-dynamic-grid {
    grid-template-columns: 1fr;
  }
  .queue-card-evidence-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .module-nav-grid {
    grid-template-columns: 1fr;
  }
  .queue-card-evidence-row {
    grid-template-columns: 1fr;
  }
}
"""

if ".static-vs-dynamic-grid" not in css:
    css += "\n" + layout_classes
    print("✔ Appended layout classes to style.css")

with open('style.css', 'w', encoding='utf-8') as f:
    f.write(css)

# 2. Update index.html
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Fix 1: Topnav spacer
old_nav_block = """        <nav class="topnav-menu" id="topnav-menu">
          <button class="nav-link active" data-page="page-home" onclick="window.switchPage('page-home')">Home</button>
          <button class="nav-link" data-page="page-screening" onclick="window.switchPage('page-screening')">Screening</button>
          <button class="nav-link" data-page="page-monitor" onclick="window.switchPage('page-monitor')">Live Monitor</button>
          <button class="nav-link" data-page="page-components" onclick="window.switchPage('page-components')">Components</button>
          <button class="nav-link" data-page="page-advanced" onclick="window.switchPage('page-advanced')">Advanced</button>
        </nav>

        
      </div>"""

new_nav_block = """        <nav class="topnav-menu" id="topnav-menu">
          <button class="nav-link active" data-page="page-home" onclick="window.switchPage('page-home')">Home</button>
          <button class="nav-link" data-page="page-screening" onclick="window.switchPage('page-screening')">Screening</button>
          <button class="nav-link" data-page="page-monitor" onclick="window.switchPage('page-monitor')">Live Monitor</button>
          <button class="nav-link" data-page="page-components" onclick="window.switchPage('page-components')">Components</button>
          <button class="nav-link" data-page="page-advanced" onclick="window.switchPage('page-advanced')">Advanced</button>
        </nav>

        <div class="topnav-spacer"></div>
      </div>"""

if old_nav_block in html:
    html = html.replace(old_nav_block, new_nav_block)
    print("✔ Added topnav-spacer to index.html")

# Fix 4: Fix missing closing tags on screening-view-csv so screening-view-manual displays properly
csv_block_target = """            <div id="csv-batch-progress-container" style="display:none;">
              <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:600; color:#123B63; margin-bottom:4px;">
                <span id="csv-progress-label">Processing ML Pipeline...</span>
                <span id="csv-progress-percent">0%</span>
              </div>
              <div style="height:8px; background:#D8E5EF; border-radius:4px; overflow:hidden;">
                <div id="csv-progress-bar" style="height:100%; width:0%; background:#1976B8; transition:width 0.2s;"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- ─── WORKFLOW B: SINGLE-DIE PARAMETRIC QUALIFICATION WORKSTATION (PRIMARY) ───────────── -->
        <div id="screening-view-manual" style="display:block;">"""

csv_block_fixed = """            <div id="csv-batch-progress-container" style="display:none;">
              <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:600; color:#123B63; margin-bottom:4px;">
                <span id="csv-progress-label">Processing ML Pipeline...</span>
                <span id="csv-progress-percent">0%</span>
              </div>
              <div style="height:8px; background:#D8E5EF; border-radius:4px; overflow:hidden;">
                <div id="csv-progress-bar" style="height:100%; width:0%; background:#1976B8; transition:width 0.2s;"></div>
              </div>
            </div>
          </div>
          </div>
        </div>

        <!-- ─── WORKFLOW B: SINGLE-DIE PARAMETRIC QUALIFICATION WORKSTATION (PRIMARY) ───────────── -->
        <div id="screening-view-manual" style="display:block;">"""

if csv_block_target in html:
    html = html.replace(csv_block_target, csv_block_fixed)
    print("✔ Fixed unclosed div in screening-view-csv")

# Fix 5: Replace queue cards with structured horizontal cards in index.html
old_queue_grid_start = '<div class="queue-grid" id="investigation-queue-grid">'
queue_start_idx = html.find(old_queue_grid_start)
if queue_start_idx != -1:
    queue_end_idx = html.find('</div>\n        </div>\n\n        <!-- 5. 256-DIE POPULATION REPOSITORY', queue_start_idx)
    if queue_end_idx != -1:
        new_queue_html = """<div class="queue-grid" id="investigation-queue-grid">
            <!-- Item 1 -->
            <div class="queue-card critical" data-status="REJECT" onclick="window.openReliabilityPassport('DIE-R20C20')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong style="font-size:13.5px; font-family:var(--font-mono); color:#123B63;">DIE-R20C20</strong>
                  <span style="font-size:11px; font-family:var(--font-mono); color:#64748B; background:#F1F5F9; padding:2px 6px; border-radius:3px;">LOT-SYN-048</span>
                  <span style="font-size:12px; color:#334155; font-weight:500;">High Anomaly + Prognostic Limit Exceeded</span>
                </div>
                <span class="badge reject" style="font-size:10px; font-weight:700;">REJECT</span>
              </div>
              <div class="queue-card-evidence-row">
                <div><span style="color:#64748B;">P(Failure):</span> <strong style="color:#DC2626;">99.9%</strong></div>
                <div><span style="color:#64748B;">Anomaly:</span> <strong style="font-family:var(--font-mono); color:#123B63;">0.94</strong></div>
                <div><span style="color:#64748B;">Breach:</span> <strong style="font-family:var(--font-mono); color:#123B63;">48.0h</strong></div>
                <div><span style="color:#64748B;">Evidence:</span> <strong style="color:#059669;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline" style="font-size:10.5px; padding:3px 10px;" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R20C20')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>

            <!-- Item 2 -->
            <div class="queue-card critical" data-status="REJECT" onclick="window.openReliabilityPassport('DIE-R05C12')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong style="font-size:13.5px; font-family:var(--font-mono); color:#123B63;">DIE-R05C12</strong>
                  <span style="font-size:11px; font-family:var(--font-mono); color:#64748B; background:#F1F5F9; padding:2px 6px; border-radius:3px;">LOT-SYN-044</span>
                  <span style="font-size:12px; color:#334155; font-weight:500;">Severe Gate Leakage Drift</span>
                </div>
                <span class="badge reject" style="font-size:10px; font-weight:700;">REJECT</span>
              </div>
              <div class="queue-card-evidence-row">
                <div><span style="color:#64748B;">P(Failure):</span> <strong style="color:#DC2626;">99.4%</strong></div>
                <div><span style="color:#64748B;">Anomaly:</span> <strong style="font-family:var(--font-mono); color:#123B63;">0.88</strong></div>
                <div><span style="color:#64748B;">Breach:</span> <strong style="font-family:var(--font-mono); color:#123B63;">72.0h</strong></div>
                <div><span style="color:#64748B;">Evidence:</span> <strong style="color:#059669;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline" style="font-size:10.5px; padding:3px 10px;" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R05C12')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>

            <!-- Item 3 -->
            <div class="queue-card warning" data-status="MONITOR" onclick="window.openReliabilityPassport('DIE-R12C28')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong style="font-size:13.5px; font-family:var(--font-mono); color:#123B63;">DIE-R12C28</strong>
                  <span style="font-size:11px; font-family:var(--font-mono); color:#64748B; background:#F1F5F9; padding:2px 6px; border-radius:3px;">LOT-SYN-045</span>
                  <span style="font-size:12px; color:#334155; font-weight:500;">Moderate Temporal Drift (Monitoring)</span>
                </div>
                <span class="badge warning" style="font-size:10px; font-weight:700;">MONITOR</span>
              </div>
              <div class="queue-card-evidence-row">
                <div><span style="color:#64748B;">P(Failure):</span> <strong style="color:#D97706;">24.5%</strong></div>
                <div><span style="color:#64748B;">Anomaly:</span> <strong style="font-family:var(--font-mono); color:#123B63;">0.52</strong></div>
                <div><span style="color:#64748B;">Breach:</span> <strong style="font-family:var(--font-mono); color:#123B63;">144.0h</strong></div>
                <div><span style="color:#64748B;">Evidence:</span> <strong style="color:#059669;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline" style="font-size:10.5px; padding:3px 10px;" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R12C28')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>

            <!-- Item 4 -->
            <div class="queue-card warning" data-status="MONITOR" onclick="window.openReliabilityPassport('DIE-R35C35')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong style="font-size:13.5px; font-family:var(--font-mono); color:#123B63;">DIE-R35C35</strong>
                  <span style="font-size:11px; font-family:var(--font-mono); color:#64748B; background:#F1F5F9; padding:2px 6px; border-radius:3px;">LOT-SYN-047</span>
                  <span style="font-size:12px; color:#334155; font-weight:500;">Thermal Margin Degradation</span>
                </div>
                <span class="badge warning" style="font-size:10px; font-weight:700;">MONITOR</span>
              </div>
              <div class="queue-card-evidence-row">
                <div><span style="color:#64748B;">P(Failure):</span> <strong style="color:#D97706;">18.8%</strong></div>
                <div><span style="color:#64748B;">Anomaly:</span> <strong style="font-family:var(--font-mono); color:#123B63;">0.41</strong></div>
                <div><span style="color:#64748B;">Breach:</span> <strong style="font-family:var(--font-mono); color:#123B63;">168.0h</strong></div>
                <div><span style="color:#64748B;">Evidence:</span> <strong style="color:#059669;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline" style="font-size:10.5px; padding:3px 10px;" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R35C35')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>
          </div>"""
        html = html[:queue_start_idx] + new_queue_html + html[queue_end_idx:]
        print("✔ Updated investigation-queue-grid in index.html")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

# 3. Synchronize to frontend/ directory
shutil.copy('index.html', 'frontend/index.html')
shutil.copy('style.css', 'frontend/style.css')
shutil.copy('script.js', 'frontend/script.js')
print("✔ Synchronized frontend/index.html, frontend/style.css, frontend/script.js")
print("=== UI CORRECTIONS APPLIED SUCCESSFULLY ===")
