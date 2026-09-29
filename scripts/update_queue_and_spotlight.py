import re
import sys
import shutil

sys.stdout.reconfigure(encoding='utf-8')

# 1. Update style.css with spotlight styles
with open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()

spotlight_css = """
/* ─── LATENT ESCAPE SPOTLIGHT ─── */
.latent-spotlight-card {
  background: #FFFFFF;
  border: 1px solid #D8E5EF;
  border-radius: 8px;
  padding: 16px 20px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
}

.spotlight-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid #E2E8F0;
  flex-wrap: wrap;
  gap: 10px;
}

.spotlight-evidence-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.spotlight-cell {
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 6px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
}

.spotlight-cell.warning-border {
  border-left: 3px solid #D97706;
}

.spotlight-cell.critical-border {
  border-left: 3px solid #DC2626;
}

.spotlight-cell.decision-cell {
  border-left: 3px solid #DC2626;
  background: #FEF2F2;
}

.spotlight-cell-label {
  font-size: 10.5px;
  font-weight: 700;
  color: #64748B;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.spotlight-cell-val {
  font-size: 13.5px;
  font-weight: 800;
  color: #123B63;
  margin-bottom: 4px;
}

.spotlight-cell-desc {
  font-size: 11px;
  color: #475569;
  line-height: 1.35;
}

@media (max-width: 1024px) {
  .spotlight-evidence-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .spotlight-evidence-grid {
    grid-template-columns: 1fr;
  }
}
"""

if ".latent-spotlight-card" not in css:
    css += "\n" + spotlight_css
    print("✔ Added spotlight CSS to style.css")

with open('style.css', 'w', encoding='utf-8') as f:
    f.write(css)

# 2. Update index.html to ensure all 8 queue cards are formatted identically
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

all_8_queue_cards = """<div class="queue-grid" id="investigation-queue-grid">
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
            <div class="queue-card critical" data-status="REJECT" onclick="window.openReliabilityPassport('DIE-R02C14')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong style="font-size:13.5px; font-family:var(--font-mono); color:#123B63;">DIE-R02C14</strong>
                  <span style="font-size:11px; font-family:var(--font-mono); color:#64748B; background:#F1F5F9; padding:2px 6px; border-radius:3px;">LOT-SYN-046</span>
                  <span style="font-size:12px; color:#334155; font-weight:500;">Thermal Runaway &amp; Electromigration</span>
                </div>
                <span class="badge reject" style="font-size:10px; font-weight:700;">REJECT</span>
              </div>
              <div class="queue-card-evidence-row">
                <div><span style="color:#64748B;">P(Failure):</span> <strong style="color:#DC2626;">98.8%</strong></div>
                <div><span style="color:#64748B;">Anomaly:</span> <strong style="font-family:var(--font-mono); color:#123B63;">0.82</strong></div>
                <div><span style="color:#64748B;">Breach:</span> <strong style="font-family:var(--font-mono); color:#123B63;">96.0h</strong></div>
                <div><span style="color:#64748B;">Evidence:</span> <strong style="color:#059669;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline" style="font-size:10.5px; padding:3px 10px;" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R02C14')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>

            <!-- Item 4 -->
            <div class="queue-card critical" data-status="REJECT" onclick="window.openReliabilityPassport('DIE-R08C08')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong style="font-size:13.5px; font-family:var(--font-mono); color:#123B63;">DIE-R08C08</strong>
                  <span style="font-size:11px; font-family:var(--font-mono); color:#64748B; background:#F1F5F9; padding:2px 6px; border-radius:3px;">LOT-SYN-047</span>
                  <span style="font-size:12px; color:#334155; font-weight:500;">Module A COPOD Statistical Outlier</span>
                </div>
                <span class="badge reject" style="font-size:10px; font-weight:700;">REJECT</span>
              </div>
              <div class="queue-card-evidence-row">
                <div><span style="color:#64748B;">P(Failure):</span> <strong style="color:#DC2626;">97.5%</strong></div>
                <div><span style="color:#64748B;">Anomaly:</span> <strong style="font-family:var(--font-mono); color:#123B63;">0.79</strong></div>
                <div><span style="color:#64748B;">Breach:</span> <strong style="font-family:var(--font-mono); color:#123B63;">96.0h</strong></div>
                <div><span style="color:#64748B;">Evidence:</span> <strong style="color:#059669;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline" style="font-size:10.5px; padding:3px 10px;" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R08C08')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>

            <!-- Item 5 -->
            <div class="queue-card warning" data-status="MONITOR" onclick="window.openReliabilityPassport('DIE-R12C28')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong style="font-size:13.5px; font-family:var(--font-mono); color:#123B63;">DIE-R12C28</strong>
                  <span style="font-size:11px; font-family:var(--font-mono); color:#64748B; background:#F1F5F9; padding:2px 6px; border-radius:3px;">LOT-SYN-045</span>
                  <span style="font-size:12px; color:#334155; font-weight:500;">Borderline Prognostic Timing Drift</span>
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

            <!-- Item 6 -->
            <div class="queue-card warning" data-status="MONITOR" onclick="window.openReliabilityPassport('DIE-R05C05')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong style="font-size:13.5px; font-family:var(--font-mono); color:#123B63;">DIE-R05C05</strong>
                  <span style="font-size:11px; font-family:var(--font-mono); color:#64748B; background:#F1F5F9; padding:2px 6px; border-radius:3px;">LOT-SYN-043</span>
                  <span style="font-size:12px; color:#334155; font-weight:500;">PAT-MAD Elevated IDDQ Distribution</span>
                </div>
                <span class="badge warning" style="font-size:10px; font-weight:700;">MONITOR</span>
              </div>
              <div class="queue-card-evidence-row">
                <div><span style="color:#64748B;">P(Failure):</span> <strong style="color:#D97706;">16.2%</strong></div>
                <div><span style="color:#64748B;">Anomaly:</span> <strong style="font-family:var(--font-mono); color:#123B63;">0.38</strong></div>
                <div><span style="color:#64748B;">Breach:</span> <strong style="font-family:var(--font-mono); color:#123B63;">168.0h</strong></div>
                <div><span style="color:#64748B;">Evidence:</span> <strong style="color:#059669;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline" style="font-size:10.5px; padding:3px 10px;" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R05C05')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>

            <!-- Item 7 -->
            <div class="queue-card warning" data-status="MONITOR" onclick="window.openReliabilityPassport('DIE-R16C04')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong style="font-size:13.5px; font-family:var(--font-mono); color:#123B63;">DIE-R16C04</strong>
                  <span style="font-size:11px; font-family:var(--font-mono); color:#64748B; background:#F1F5F9; padding:2px 6px; border-radius:3px;">LOT-SYN-049</span>
                  <span style="font-size:12px; color:#334155; font-weight:500;">Voltage Headroom Near Limit</span>
                </div>
                <span class="badge warning" style="font-size:10px; font-weight:700;">MONITOR</span>
              </div>
              <div class="queue-card-evidence-row">
                <div><span style="color:#64748B;">P(Failure):</span> <strong style="color:#D97706;">18.9%</strong></div>
                <div><span style="color:#64748B;">Anomaly:</span> <strong style="font-family:var(--font-mono); color:#123B63;">0.45</strong></div>
                <div><span style="color:#64748B;">Breach:</span> <strong style="font-family:var(--font-mono); color:#123B63;">120.0h</strong></div>
                <div><span style="color:#64748B;">Evidence:</span> <strong style="color:#059669;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline" style="font-size:10.5px; padding:3px 10px;" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R16C04')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>

            <!-- Item 8 -->
            <div class="queue-card" data-status="INSUFFICIENT" onclick="window.openReliabilityPassport('DIE-R09C11')" style="border-left: 4px solid #94A3B8;">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong style="font-size:13.5px; font-family:var(--font-mono); color:#123B63;">DIE-R09C11</strong>
                  <span style="font-size:11px; font-family:var(--font-mono); color:#64748B; background:#F1F5F9; padding:2px 6px; border-radius:3px;">LOT-SYN-050</span>
                  <span style="font-size:12px; color:#334155; font-weight:500;">Sensor Telemetry Incomplete at 24h</span>
                </div>
                <span class="badge" style="background:#F1F5F9; color:#475569; font-size:10px; font-weight:700;">INSUFFICIENT</span>
              </div>
              <div class="queue-card-evidence-row">
                <div><span style="color:#64748B;">P(Failure):</span> <strong style="color:#64748B;">N/A</strong></div>
                <div><span style="color:#64748B;">Anomaly:</span> <strong style="font-family:var(--font-mono); color:#64748B;">0.00</strong></div>
                <div><span style="color:#64748B;">Breach:</span> <strong style="font-family:var(--font-mono); color:#64748B;">N/A</strong></div>
                <div><span style="color:#64748B;">Evidence:</span> <strong style="color:#D97706;">50%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline" style="font-size:10.5px; padding:3px 10px;" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R09C11')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>
          </div>"""

queue_start_idx = html.find('<div class="queue-grid" id="investigation-queue-grid">')
if queue_start_idx != -1:
    queue_end_idx = html.find('</div>\n        </div>\n\n        <!-- 5. 256-DIE POPULATION REPOSITORY', queue_start_idx)
    if queue_end_idx != -1:
        html = html[:queue_start_idx] + all_8_queue_cards + html[queue_end_idx:]
        print("✔ Updated all 8 queue cards in index.html")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

shutil.copy('index.html', 'frontend/index.html')
shutil.copy('style.css', 'frontend/style.css')
print("✔ Re-synchronized frontend/index.html and frontend/style.css")
