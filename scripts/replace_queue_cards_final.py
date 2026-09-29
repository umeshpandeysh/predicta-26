import re
import sys
import shutil

sys.stdout.reconfigure(encoding='utf-8')

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Build clean, elegant queue items
cards = [
    {
        "uid": "DIE-R20C20",
        "lot": "LOT-SYN-048",
        "reason": "High Anomaly + Prognostic Limit Exceeded",
        "badge_class": "reject",
        "badge_text": "REJECT",
        "card_class": "critical",
        "status": "REJECT",
        "prob": "99.9%",
        "prob_color": "#DC2626",
        "anomaly": "0.94",
        "breach": "48.0h",
        "evidence": "100%",
        "evidence_color": "#059669"
    },
    {
        "uid": "DIE-R05C12",
        "lot": "LOT-SYN-044",
        "reason": "Severe Gate Leakage Drift",
        "badge_class": "reject",
        "badge_text": "REJECT",
        "card_class": "critical",
        "status": "REJECT",
        "prob": "99.4%",
        "prob_color": "#DC2626",
        "anomaly": "0.88",
        "breach": "72.0h",
        "evidence": "100%",
        "evidence_color": "#059669"
    },
    {
        "uid": "DIE-R02C14",
        "lot": "LOT-SYN-046",
        "reason": "Thermal Runaway & Electromigration",
        "badge_class": "reject",
        "badge_text": "REJECT",
        "card_class": "critical",
        "status": "REJECT",
        "prob": "98.8%",
        "prob_color": "#DC2626",
        "anomaly": "0.82",
        "breach": "96.0h",
        "evidence": "100%",
        "evidence_color": "#059669"
    },
    {
        "uid": "DIE-R08C08",
        "lot": "LOT-SYN-047",
        "reason": "Module A COPOD Statistical Outlier",
        "badge_class": "reject",
        "badge_text": "REJECT",
        "card_class": "critical",
        "status": "REJECT",
        "prob": "97.5%",
        "prob_color": "#DC2626",
        "anomaly": "0.79",
        "breach": "96.0h",
        "evidence": "100%",
        "evidence_color": "#059669"
    },
    {
        "uid": "DIE-R12C28",
        "lot": "LOT-SYN-045",
        "reason": "Borderline Prognostic Timing Drift",
        "badge_class": "warning",
        "badge_text": "MONITOR",
        "card_class": "warning",
        "status": "MONITOR",
        "prob": "24.5%",
        "prob_color": "#D97706",
        "anomaly": "0.52",
        "breach": "144.0h",
        "evidence": "100%",
        "evidence_color": "#059669"
    },
    {
        "uid": "DIE-R05C05",
        "lot": "LOT-SYN-043",
        "reason": "PAT-MAD Elevated IDDQ Distribution",
        "badge_class": "warning",
        "badge_text": "MONITOR",
        "card_class": "warning",
        "status": "MONITOR",
        "prob": "16.2%",
        "prob_color": "#D97706",
        "anomaly": "0.38",
        "breach": "168.0h",
        "evidence": "100%",
        "evidence_color": "#059669"
    },
    {
        "uid": "DIE-R16C04",
        "lot": "LOT-SYN-049",
        "reason": "Voltage Headroom Near Limit",
        "badge_class": "warning",
        "badge_text": "MONITOR",
        "card_class": "warning",
        "status": "MONITOR",
        "prob": "18.9%",
        "prob_color": "#D97706",
        "anomaly": "0.45",
        "breach": "120.0h",
        "evidence": "100%",
        "evidence_color": "#059669"
    },
    {
        "uid": "DIE-R09C11",
        "lot": "LOT-SYN-050",
        "reason": "Sensor Telemetry Incomplete at 24h",
        "badge_class": "badge",
        "badge_text": "INSUFFICIENT",
        "card_class": "",
        "status": "INSUFFICIENT",
        "prob": "N/A",
        "prob_color": "#64748B",
        "anomaly": "0.00",
        "breach": "N/A",
        "evidence": "50%",
        "evidence_color": "#D97706"
    }
]

rendered_cards = []
for c in cards:
    card_html = f"""            <div class="queue-card {c['card_class']}" data-status="{c['status']}" onclick="window.openReliabilityPassport('{c['uid']}')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong style="font-size:13.5px; font-family:var(--font-mono); color:#123B63;">{c['uid']}</strong>
                  <span style="font-size:11px; font-family:var(--font-mono); color:#64748B; background:#F1F5F9; padding:2px 6px; border-radius:3px;">{c['lot']}</span>
                  <span style="font-size:12px; color:#334155; font-weight:500;">{c['reason']}</span>
                </div>
                <span class="badge {c['badge_class']}" style="font-size:10px; font-weight:700;">{c['badge_text']}</span>
              </div>
              <div class="queue-card-evidence-row">
                <div><span style="color:#64748B;">P(Failure):</span> <strong style="color:{c['prob_color']};">{c['prob']}</strong></div>
                <div><span style="color:#64748B;">Anomaly:</span> <strong style="font-family:var(--font-mono); color:#123B63;">{c['anomaly']}</strong></div>
                <div><span style="color:#64748B;">Breach:</span> <strong style="font-family:var(--font-mono); color:#123B63;">{c['breach']}</strong></div>
                <div><span style="color:#64748B;">Evidence:</span> <strong style="color:{c['evidence_color']};">{c['evidence']}</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline" style="font-size:10.5px; padding:3px 10px;" onclick="event.stopPropagation(); window.openReliabilityPassport('{c['uid']}')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>"""
    rendered_cards.append(card_html)

new_queue_grid = '<div class="queue-grid" id="investigation-queue-grid">\n' + '\n'.join(rendered_cards) + '\n          </div>\n        </div>\n\n        <!-- '

grid_start = html.find('<div class="queue-grid" id="investigation-queue-grid">')
pos_card = html.find('Search Component or Lot...')
card_start = html.rfind('<!-- ', 0, pos_card)

print("grid_start:", grid_start, "card_start:", card_start)

if grid_start != -1 and card_start != -1:
    html = html[:grid_start] + new_queue_grid + html[card_start+len('<!-- '):]
    print("✔ Successfully replaced all 8 queue cards!")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

shutil.copy('index.html', 'frontend/index.html')
shutil.copy('style.css', 'frontend/style.css')
print("✔ Re-synchronized frontend files")
