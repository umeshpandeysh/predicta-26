const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

const startTag = '<div class="queue-grid" id="investigation-queue-grid">';
const startIdx = html.indexOf(startTag);
if (startIdx === -1) {
  console.error('startTag not found!');
  process.exit(1);
}

// Find the closing </div> of queue-grid (it contains 8 queue cards)
const lastComp = 'DIE-R09C11';
const lastCompIdx = html.indexOf(lastComp, startIdx);
const cardClose = html.indexOf('</div>', lastCompIdx);
const rowClose = html.indexOf('</div>', cardClose + 6);
const gridClose = html.indexOf('</div>', rowClose + 6);

console.log('Replacing from', startIdx, 'to', gridClose + 6);

const newQueueGrid = `<div class="queue-grid" id="investigation-queue-grid">
            <div class="queue-card critical" data-status="REJECT" onclick="window.openReliabilityPassport('DIE-R20C20')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong class="queue-card-die-id" style="font-size:15px; font-family:var(--font-mono); color:#123B63; font-weight:800;">DIE-R20C20</strong>
                  <span class="queue-card-lot-badge" style="font-size:13px; font-family:var(--font-mono); color:#1E293B; background:#EAF4FB; border:1px solid #BAE6FD; padding:2px 8px; border-radius:4px; font-weight:700;">LOT-SYN-048</span>
                  <span class="queue-card-desc" style="font-size:13.5px; color:#334155; font-weight:600;">High Anomaly + Prognostic Limit Exceeded</span>
                </div>
                <span class="badge reject queue-status-badge" style="font-size:13px; font-weight:800; padding:3px 10px;">REJECT</span>
              </div>
              <div class="queue-card-evidence-row" style="display:grid; grid-template-columns: repeat(4, 1fr) auto; gap:10px; align-items:center; background:#F8FAFC; border:1px solid #E2E8F0; padding:6px 12px; border-radius:4px; font-size:13.5px;">
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">P(Failure):</span> <strong class="queue-metric-val" style="color: #991B1B; font-size:14px; font-weight:700;">99.9%</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Anomaly:</span> <strong class="queue-metric-val" style="font-family:var(--font-mono); font-size:14px; font-weight:700; color:#123B63;">0.94</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Breach:</span> <strong class="queue-metric-val" style="font-family:var(--font-mono); font-size:14px; font-weight:700; color:#123B63;">48.0h</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Evidence:</span> <strong class="queue-metric-val" style="color: #166534; font-size:14px; font-weight:700;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline queue-action-btn" style="font-size:13px; font-weight:700; padding:4px 12px;" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R20C20')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>
            <div class="queue-card critical" data-status="REJECT" onclick="window.openReliabilityPassport('DIE-R05C12')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong class="queue-card-die-id" style="font-size:15px; font-family:var(--font-mono); color:#123B63; font-weight:800;">DIE-R05C12</strong>
                  <span class="queue-card-lot-badge" style="font-size:13px; font-family:var(--font-mono); color:#1E293B; background:#EAF4FB; border:1px solid #BAE6FD; padding:2px 8px; border-radius:4px; font-weight:700;">LOT-SYN-044</span>
                  <span class="queue-card-desc" style="font-size:13.5px; color:#334155; font-weight:600;">Rapid Acceleration • Thermal Runaway</span>
                </div>
                <span class="badge reject queue-status-badge" style="font-size:13px; font-weight:800; padding:3px 10px;">REJECT</span>
              </div>
              <div class="queue-card-evidence-row" style="display:grid; grid-template-columns: repeat(4, 1fr) auto; gap:10px; align-items:center; background:#F8FAFC; border:1px solid #E2E8F0; padding:6px 12px; border-radius:4px; font-size:13.5px;">
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">P(Failure):</span> <strong class="queue-metric-val" style="color: #991B1B; font-size:14px; font-weight:700;">94.1%</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Anomaly:</span> <strong class="queue-metric-val" style="font-family:var(--font-mono); font-size:14px; font-weight:700; color:#123B63;">0.88</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Breach:</span> <strong class="queue-metric-val" style="font-family:var(--font-mono); font-size:14px; font-weight:700; color:#123B63;">36.0h</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Evidence:</span> <strong class="queue-metric-val" style="color: #166534; font-size:14px; font-weight:700;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline queue-action-btn" style="font-size:13px; font-weight:700; padding:4px 12px;" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R05C12')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>
            <div class="queue-card critical" data-status="REJECT" onclick="window.openReliabilityPassport('DIE-R45C15')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong class="queue-card-die-id" style="font-size:15px; font-family:var(--font-mono); color:#123B63; font-weight:800;">DIE-R45C15</strong>
                  <span class="queue-card-lot-badge" style="font-size:13px; font-family:var(--font-mono); color:#1E293B; background:#EAF4FB; border:1px solid #BAE6FD; padding:2px 8px; border-radius:4px; font-weight:700;">LOT-SYN-046</span>
                  <span class="queue-card-desc" style="font-size:13.5px; color:#334155; font-weight:600;">Severe Gate Leakage • Die Edge Defect</span>
                </div>
                <span class="badge reject queue-status-badge" style="font-size:13px; font-weight:800; padding:3px 10px;">REJECT</span>
              </div>
              <div class="queue-card-evidence-row" style="display:grid; grid-template-columns: repeat(4, 1fr) auto; gap:10px; align-items:center; background:#F8FAFC; border:1px solid #E2E8F0; padding:6px 12px; border-radius:4px; font-size:13.5px;">
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">P(Failure):</span> <strong class="queue-metric-val" style="color: #991B1B; font-size:14px; font-weight:700;">99.5%</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Anomaly:</span> <strong class="queue-metric-val" style="font-family:var(--font-mono); font-size:14px; font-weight:700; color:#123B63;">0.96</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Breach:</span> <strong class="queue-metric-val" style="font-family:var(--font-mono); font-size:14px; font-weight:700; color:#123B63;">24.0h</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Evidence:</span> <strong class="queue-metric-val" style="color: #166534; font-size:14px; font-weight:700;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline queue-action-btn" style="font-size:13px; font-weight:700; padding:4px 12px;" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R45C15')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>
            <div class="queue-card critical" data-status="REJECT" onclick="window.openReliabilityPassport('DIE-R12C08')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong class="queue-card-die-id" style="font-size:15px; font-family:var(--font-mono); color:#123B63; font-weight:800;">DIE-R12C08</strong>
                  <span class="queue-card-lot-badge" style="font-size:13px; font-family:var(--font-mono); color:#1E293B; background:#EAF4FB; border:1px solid #BAE6FD; padding:2px 8px; border-radius:4px; font-weight:700;">LOT-SYN-045</span>
                  <span class="queue-card-desc" style="font-size:13.5px; color:#334155; font-weight:600;">Prognostic IDDQ Breach at 96h</span>
                </div>
                <span class="badge reject queue-status-badge" style="font-size:13px; font-weight:800; padding:3px 10px;">REJECT</span>
              </div>
              <div class="queue-card-evidence-row" style="display:grid; grid-template-columns: repeat(4, 1fr) auto; gap:10px; align-items:center; background:#F8FAFC; border:1px solid #E2E8F0; padding:6px 12px; border-radius:4px; font-size:13.5px;">
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">P(Failure):</span> <strong class="queue-metric-val" style="color: #991B1B; font-size:14px; font-weight:700;">88.4%</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Anomaly:</span> <strong class="queue-metric-val" style="font-family:var(--font-mono); font-size:14px; font-weight:700; color:#123B63;">0.82</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Breach:</span> <strong class="queue-metric-val" style="font-family:var(--font-mono); font-size:14px; font-weight:700; color:#123B63;">96.0h</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Evidence:</span> <strong class="queue-metric-val" style="color: #166534; font-size:14px; font-weight:700;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline queue-action-btn" style="font-size:13px; font-weight:700; padding:4px 12px;" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R12C08')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>
            <div class="queue-card warning" data-status="MONITOR" onclick="window.openReliabilityPassport('DIE-R15C15')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong class="queue-card-die-id" style="font-size:15px; font-family:var(--font-mono); color:#123B63; font-weight:800;">DIE-R15C15</strong>
                  <span class="queue-card-lot-badge" style="font-size:13px; font-family:var(--font-mono); color:#1E293B; background:#EAF4FB; border:1px solid #BAE6FD; padding:2px 8px; border-radius:4px; font-weight:700;">LOT-SYN-043</span>
                  <span class="queue-card-desc" style="font-size:13.5px; color:#334155; font-weight:600;">Sub-threshold Drift • Elevated Leakage Rate</span>
                </div>
                <span class="badge warning queue-status-badge" style="font-size:13px; font-weight:800; padding:3px 10px;">MONITOR</span>
              </div>
              <div class="queue-card-evidence-row" style="display:grid; grid-template-columns: repeat(4, 1fr) auto; gap:10px; align-items:center; background:#F8FAFC; border:1px solid #E2E8F0; padding:6px 12px; border-radius:4px; font-size:13.5px;">
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">P(Failure):</span> <strong class="queue-metric-val" style="color: #92400E; font-size:14px; font-weight:700;">18.4%</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Anomaly:</span> <strong class="queue-metric-val" style="font-family:var(--font-mono); font-size:14px; font-weight:700; color:#123B63;">0.42</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Breach:</span> <strong class="queue-metric-val" style="font-family:var(--font-mono); font-size:14px; font-weight:700; color:#123B63;">120.0h</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Evidence:</span> <strong class="queue-metric-val" style="color: #166534; font-size:14px; font-weight:700;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline queue-action-btn" style="font-size:13px; font-weight:700; padding:4px 12px;" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R15C15')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>
            <div class="queue-card warning" data-status="MONITOR" onclick="window.openReliabilityPassport('DIE-R02C14')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong class="queue-card-die-id" style="font-size:15px; font-family:var(--font-mono); color:#123B63; font-weight:800;">DIE-R02C14</strong>
                  <span class="queue-card-lot-badge" style="font-size:13px; font-family:var(--font-mono); color:#1E293B; background:#EAF4FB; border:1px solid #BAE6FD; padding:2px 8px; border-radius:4px; font-weight:700;">LOT-SYN-046</span>
                  <span class="queue-card-desc" style="font-size:13.5px; color:#334155; font-weight:600;">Spatial Cluster Outlier • Neighbor Anomaly</span>
                </div>
                <span class="badge warning queue-status-badge" style="font-size:13px; font-weight:800; padding:3px 10px;">MONITOR</span>
              </div>
              <div class="queue-card-evidence-row" style="display:grid; grid-template-columns: repeat(4, 1fr) auto; gap:10px; align-items:center; background:#F8FAFC; border:1px solid #E2E8F0; padding:6px 12px; border-radius:4px; font-size:13.5px;">
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">P(Failure):</span> <strong class="queue-metric-val" style="color: #92400E; font-size:14px; font-weight:700;">19.8%</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Anomaly:</span> <strong class="queue-metric-val" style="font-family:var(--font-mono); font-size:14px; font-weight:700; color:#123B63;">0.48</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Breach:</span> <strong class="queue-metric-val" style="font-family:var(--font-mono); font-size:14px; font-weight:700; color:#123B63;">144.0h</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Evidence:</span> <strong class="queue-metric-val" style="color: #166534; font-size:14px; font-weight:700;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline queue-action-btn" style="font-size:13px; font-weight:700; padding:4px 12px;" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R02C14')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>
            <div class="queue-card warning" data-status="MONITOR" onclick="window.openReliabilityPassport('DIE-R08C08')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong class="queue-card-die-id" style="font-size:15px; font-family:var(--font-mono); color:#123B63; font-weight:800;">DIE-R08C08</strong>
                  <span class="queue-card-lot-badge" style="font-size:13px; font-family:var(--font-mono); color:#1E293B; background:#EAF4FB; border:1px solid #BAE6FD; padding:2px 8px; border-radius:4px; font-weight:700;">LOT-SYN-047</span>
                  <span class="queue-card-desc" style="font-size:13.5px; color:#334155; font-weight:600;">Timing Degradation Margin Narrowing</span>
                </div>
                <span class="badge warning queue-status-badge" style="font-size:13px; font-weight:800; padding:3px 10px;">MONITOR</span>
              </div>
              <div class="queue-card-evidence-row" style="display:grid; grid-template-columns: repeat(4, 1fr) auto; gap:10px; align-items:center; background:#F8FAFC; border:1px solid #E2E8F0; padding:6px 12px; border-radius:4px; font-size:13.5px;">
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">P(Failure):</span> <strong class="queue-metric-val" style="color: #92400E; font-size:14px; font-weight:700;">15.1%</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Anomaly:</span> <strong class="queue-metric-val" style="font-family:var(--font-mono); font-size:14px; font-weight:700; color:#123B63;">0.36</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Breach:</span> <strong class="queue-metric-val" style="font-family:var(--font-mono); font-size:14px; font-weight:700; color:#123B63;">&gt;168h</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Evidence:</span> <strong class="queue-metric-val" style="color: #166534; font-size:14px; font-weight:700;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline queue-action-btn" style="font-size:13px; font-weight:700; padding:4px 12px;" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R08C08')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>
            <div class="queue-card warning" data-status="MONITOR" onclick="window.openReliabilityPassport('DIE-R12C28')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong class="queue-card-die-id" style="font-size:15px; font-family:var(--font-mono); color:#123B63; font-weight:800;">DIE-R12C28</strong>
                  <span class="queue-card-lot-badge" style="font-size:13px; font-family:var(--font-mono); color:#1E293B; background:#EAF4FB; border:1px solid #BAE6FD; padding:2px 8px; border-radius:4px; font-weight:700;">LOT-SYN-045</span>
                  <span class="queue-card-desc" style="font-size:13.5px; color:#334155; font-weight:600;">Borderline PAT-MAD • Marginal Drift</span>
                </div>
                <span class="badge warning queue-status-badge" style="font-size:13px; font-weight:800; padding:3px 10px;">MONITOR</span>
              </div>
              <div class="queue-card-evidence-row" style="display:grid; grid-template-columns: repeat(4, 1fr) auto; gap:10px; align-items:center; background:#F8FAFC; border:1px solid #E2E8F0; padding:6px 12px; border-radius:4px; font-size:13.5px;">
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">P(Failure):</span> <strong class="queue-metric-val" style="color: #92400E; font-size:14px; font-weight:700;">24.5%</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Anomaly:</span> <strong class="queue-metric-val" style="font-family:var(--font-mono); font-size:14px; font-weight:700; color:#123B63;">0.52</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Breach:</span> <strong class="queue-metric-val" style="font-family:var(--font-mono); font-size:14px; font-weight:700; color:#123B63;">108.0h</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Evidence:</span> <strong class="queue-metric-val" style="color: #166534; font-size:14px; font-weight:700;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline queue-action-btn" style="font-size:13px; font-weight:700; padding:4px 12px;" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R12C28')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>
            <div class="queue-card warning" data-status="MONITOR" onclick="window.openReliabilityPassport('DIE-R05C05')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong class="queue-card-die-id" style="font-size:15px; font-family:var(--font-mono); color:#123B63; font-weight:800;">DIE-R05C05</strong>
                  <span class="queue-card-lot-badge" style="font-size:13px; font-family:var(--font-mono); color:#1E293B; background:#EAF4FB; border:1px solid #BAE6FD; padding:2px 8px; border-radius:4px; font-weight:700;">LOT-SYN-043</span>
                  <span class="queue-card-desc" style="font-size:13.5px; color:#334155; font-weight:600;">PAT-MAD Elevated Z-Score</span>
                </div>
                <span class="badge warning queue-status-badge" style="font-size:13px; font-weight:800; padding:3px 10px;">MONITOR</span>
              </div>
              <div class="queue-card-evidence-row" style="display:grid; grid-template-columns: repeat(4, 1fr) auto; gap:10px; align-items:center; background:#F8FAFC; border:1px solid #E2E8F0; padding:6px 12px; border-radius:4px; font-size:13.5px;">
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">P(Failure):</span> <strong class="queue-metric-val" style="color: #92400E; font-size:14px; font-weight:700;">16.2%</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Anomaly:</span> <strong class="queue-metric-val" style="font-family:var(--font-mono); font-size:14px; font-weight:700; color:#123B63;">0.38</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Breach:</span> <strong class="queue-metric-val" style="font-family:var(--font-mono); font-size:14px; font-weight:700; color:#123B63;">&gt;168h</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Evidence:</span> <strong class="queue-metric-val" style="color: #166534; font-size:14px; font-weight:700;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline queue-action-btn" style="font-size:13px; font-weight:700; padding:4px 12px;" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R05C05')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>
            <div class="queue-card warning" data-status="MONITOR" onclick="window.openReliabilityPassport('DIE-R16C04')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong class="queue-card-die-id" style="font-size:15px; font-family:var(--font-mono); color:#123B63; font-weight:800;">DIE-R16C04</strong>
                  <span class="queue-card-lot-badge" style="font-size:13px; font-family:var(--font-mono); color:#1E293B; background:#EAF4FB; border:1px solid #BAE6FD; padding:2px 8px; border-radius:4px; font-weight:700;">LOT-SYN-049</span>
                  <span class="queue-card-desc" style="font-size:13.5px; color:#334155; font-weight:600;">Voltage Headroom Sensor Drift</span>
                </div>
                <span class="badge warning queue-status-badge" style="font-size:13px; font-weight:800; padding:3px 10px;">MONITOR</span>
              </div>
              <div class="queue-card-evidence-row" style="display:grid; grid-template-columns: repeat(4, 1fr) auto; gap:10px; align-items:center; background:#F8FAFC; border:1px solid #E2E8F0; padding:6px 12px; border-radius:4px; font-size:13.5px;">
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">P(Failure):</span> <strong class="queue-metric-val" style="color: #92400E; font-size:14px; font-weight:700;">18.9%</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Anomaly:</span> <strong class="queue-metric-val" style="font-family:var(--font-mono); font-size:14px; font-weight:700; color:#123B63;">0.45</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Breach:</span> <strong class="queue-metric-val" style="font-family:var(--font-mono); font-size:14px; font-weight:700; color:#123B63;">156.0h</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Evidence:</span> <strong class="queue-metric-val" style="color: #166534; font-size:14px; font-weight:700;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline queue-action-btn" style="font-size:13px; font-weight:700; padding:4px 12px;" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R16C04')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>
            <div class="queue-card" data-status="INSUFFICIENT" onclick="window.openReliabilityPassport('DIE-R09C11')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong class="queue-card-die-id" style="font-size:15px; font-family:var(--font-mono); color:#123B63; font-weight:800;">DIE-R09C11</strong>
                  <span class="queue-card-lot-badge" style="font-size:13px; font-family:var(--font-mono); color:#1E293B; background:#EAF4FB; border:1px solid #BAE6FD; padding:2px 8px; border-radius:4px; font-weight:700;">LOT-SYN-050</span>
                  <span class="queue-card-desc" style="font-size:13.5px; color:#334155; font-weight:600;">Sensor Telemetry Dropout at 24h</span>
                </div>
                <span class="badge queue-status-badge" style="font-size:13px; font-weight:800; padding:3px 10px; background:#F1F5F9; color:#475569; border:1px solid #CBD5E1;">INSUFFICIENT</span>
              </div>
              <div class="queue-card-evidence-row" style="display:grid; grid-template-columns: repeat(4, 1fr) auto; gap:10px; align-items:center; background:#F8FAFC; border:1px solid #E2E8F0; padding:6px 12px; border-radius:4px; font-size:13.5px;">
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">P(Failure):</span> <strong class="queue-metric-val" style="color:#64748B; font-size:14px; font-weight:700;">N/A</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Anomaly:</span> <strong class="queue-metric-val" style="font-family:var(--font-mono); font-size:14px; font-weight:700; color:#123B63;">0.00</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Breach:</span> <strong class="queue-metric-val" style="font-family:var(--font-mono); font-size:14px; font-weight:700; color:#123B63;">N/A</strong></div>
                <div><span class="queue-metric-label" style="color:#64748B; font-size:13px; font-weight:600;">Evidence:</span> <strong class="queue-metric-val" style="color: #92400E; font-size:14px; font-weight:700;">20%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline queue-action-btn" style="font-size:13px; font-weight:700; padding:4px 12px;" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R09C11')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>
          </div>`;

html = html.substring(0, startIdx) + newQueueGrid + html.substring(gridClose + 6);

fs.writeFileSync('index.html', html, 'utf8');
fs.writeFileSync('frontend/index.html', html, 'utf8');
console.log('✔ Successfully updated investigation-queue-grid.');
