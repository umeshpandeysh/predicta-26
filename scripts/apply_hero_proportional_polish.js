const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

const oldHeroRegex = /<!-- 1\. HERO \/ MAIN INTRO -->[\s\S]*?<!-- 2\. ACTIVE WAFER SPATIAL HEALTH \+ RECENT ACTIVITY -->/;

const polishedHeroHtml = `<!-- 1. HERO / MAIN INTRO -->
        <div class="hero-card" style="padding:34px 38px; margin-bottom:24px; border-radius:10px;">
          <div class="grid-hero" style="display:grid; grid-template-columns: 1.15fr 0.85fr; gap:32px; align-items:center;">
            <!-- Hero Left Column: Proportional Text, Trust Pillars & Primary Actions -->
            <div>
              <div class="technical-overline" style="font-size:11.5px; font-weight:700; color:#1976B8; text-transform:uppercase; letter-spacing:1.2px; display:block; margin-bottom:8px;">
                PREDICTA AI • SEMICONDUCTOR QUALITY ASSURANCE
              </div>
              <h1 class="page-title" style="font-size: 38px; color: #144A75; margin-bottom: 12px; font-weight: 800; line-height: 1.18; letter-spacing: -0.5px;">
                Predictive Semiconductor<br>Qualification Intelligence
              </h1>
              <p class="page-subtitle" style="font-size: 14.5px; color: #2B618E; line-height: 1.55; margin-bottom: 18px; max-width: 600px; font-weight: 500;">
                Transforming qualification telemetry into explainable reliability evidence and actionable operational decisions before failure reaches production.
              </p>
              
              <!-- 3 Trust Pillars -->
              <div style="display:flex; gap:10px; flex-wrap:wrap; font-size:12.5px; font-weight:600; color:#144A75; margin-bottom:22px;">
                <span style="display:inline-flex; align-items:center; gap:6px; background:#FFFFFF; padding:5px 12px; border-radius:16px; border:1px solid #C5DEF0; box-shadow:0 1px 3px rgba(20,74,117,0.06);">
                  <span style="color: #15803D; font-weight:800;">✓</span> Explainable AI
                </span>
                <span style="display:inline-flex; align-items:center; gap:6px; background:#FFFFFF; padding:5px 12px; border-radius:16px; border:1px solid #C5DEF0; box-shadow:0 1px 3px rgba(20,74,117,0.06);">
                  <span style="color: #15803D; font-weight:800;">✓</span> Multi-Evidence Reliability
                </span>
                <span style="display:inline-flex; align-items:center; gap:6px; background:#FFFFFF; padding:5px 12px; border-radius:16px; border:1px solid #C5DEF0; box-shadow:0 1px 3px rgba(20,74,117,0.06);">
                  <span style="color: #15803D; font-weight:800;">✓</span> Actionable Decisions
                </span>
              </div>

              <!-- Action Buttons -->
              <div style="display:flex; gap:12px; flex-wrap:wrap;">
                <button class="btn btn-primary" id="btn-home-start-screening" onclick="window.switchPage('page-screening')" style="background:#1976B8; border-color:#1976B8; font-weight:600; font-size:14px; padding:10px 22px; cursor:pointer; border-radius:6px; box-shadow:0 2px 6px rgba(25,118,184,0.25);">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:16px;height:16px;margin-right:6px;display:inline-block;vertical-align:middle;">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                  </svg>
                  Run Screening
                </button>
                <button class="btn btn-outline" id="btn-home-view-components" onclick="window.switchPage('page-component')" style="border:1px solid #C5DEF0; color:#144A75; font-weight:600; font-size:14px; padding:10px 22px; background:#FFFFFF; cursor:pointer; border-radius:6px; box-shadow:0 1px 3px rgba(20,74,117,0.06);">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:16px;height:16px;margin-right:6px;display:inline-block;vertical-align:middle;">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 8.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                  </svg>
                  Components
                </button>
              </div>
            </div>

            <!-- Hero Right Column: Ultra-Realistic 3D Semiconductor BGA Package Card -->
            <div class="hero-chip-card" id="hero-chip-3d-card" style="display:flex; justify-content:center; align-items:center;">
              <div class="hero-chip-illustration-container" style="display:flex; justify-content:center; align-items:center;">
                <svg width="340" height="222" viewBox="0 0 260 170" fill="none" xmlns="http://www.w3.org/2000/svg" class="hero-chip-svg-wrap" id="hero-chip-svg">
                <defs>
                  <!-- Package Base Gradients -->
                  <linearGradient id="pkg-top-sub" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#1E3A8A" />
                    <stop offset="45%" stop-color="#172554" />
                    <stop offset="100%" stop-color="#0F172A" />
                  </linearGradient>
                  <linearGradient id="pkg-left-side" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#0F172A" />
                    <stop offset="100%" stop-color="#020617" />
                  </linearGradient>
                  <linearGradient id="pkg-right-side" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#1E293B" />
                    <stop offset="100%" stop-color="#0F172A" />
                  </linearGradient>
                  
                  <!-- Die Mirror Silicon Gradient -->
                  <linearGradient id="die-silicon-face" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#D8EAF6" />
                    <stop offset="20%" stop-color="#BAE6FD" />
                    <stop offset="60%" stop-color="#0284C7" />
                    <stop offset="100%" stop-color="#0369A1" />
                  </linearGradient>
                  <linearGradient id="die-silicon-left" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#0369A1" />
                    <stop offset="100%" stop-color="#075985" />
                  </linearGradient>
                  <linearGradient id="die-silicon-right" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#075985" />
                    <stop offset="100%" stop-color="#0C4A6E" />
                  </linearGradient>

                  <!-- Core Active Prognostic Glow -->
                  <radialGradient id="core-quantum-glow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.95" />
                    <stop offset="40%" stop-color="#0284C7" stop-opacity="0.6" />
                    <stop offset="100%" stop-color="#0369A1" stop-opacity="0" />
                  </radialGradient>

                  <!-- Metallic Specular Pin Gradients -->
                  <linearGradient id="metal-solder-ball" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#F5F9FD" />
                    <stop offset="30%" stop-color="#CBD5E1" />
                    <stop offset="70%" stop-color="#64748B" />
                    <stop offset="100%" stop-color="#334155" />
                  </linearGradient>
                  <linearGradient id="gold-wire" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#FCD34D" />
                    <stop offset="50%" stop-color="#F59E0B" />
                    <stop offset="100%" stop-color="#B45309" />
                  </linearGradient>
                </defs>

                <!-- Soft Ambient Shadow -->
                <ellipse class="hero-chip-shadow" cx="130" cy="148" rx="96" ry="18" fill="#091428" opacity="0.18" />

                <!-- Floating Chip Body -->
                <g class="hero-chip-floating-group">

                <!-- Metallic BGA Solder Balls (Bottom Left Perimeter) -->
                <g opacity="0.95">
                  <path d="M 44,92 L 34,97 L 34,102 L 44,97 Z" fill="url(#metal-solder-ball)" stroke="#334155" stroke-width="0.5" />
                  <path d="M 58,100 L 48,105 L 48,110 L 58,105 Z" fill="url(#metal-solder-ball)" stroke="#334155" stroke-width="0.5" />
                  <path d="M 72,108 L 62,113 L 62,118 L 72,113 Z" fill="url(#metal-solder-ball)" stroke="#334155" stroke-width="0.5" />
                  <path d="M 86,116 L 76,121 L 76,126 L 86,121 Z" fill="url(#metal-solder-ball)" stroke="#334155" stroke-width="0.5" />
                  <path d="M 100,124 L 90,129 L 90,134 L 100,129 Z" fill="url(#metal-solder-ball)" stroke="#334155" stroke-width="0.5" />

                  <!-- Metallic BGA Solder Balls (Bottom Right Perimeter) -->
                  <path d="M 160,124 L 170,129 L 170,134 L 160,129 Z" fill="url(#metal-solder-ball)" stroke="#334155" stroke-width="0.5" />
                  <path d="M 174,116 L 184,121 L 184,126 L 174,121 Z" fill="url(#metal-solder-ball)" stroke="#334155" stroke-width="0.5" />
                  <path d="M 188,108 L 198,113 L 198,118 L 188,113 Z" fill="url(#metal-solder-ball)" stroke="#334155" stroke-width="0.5" />
                  <path d="M 202,100 L 212,105 L 212,110 L 202,105 Z" fill="url(#metal-solder-ball)" stroke="#334155" stroke-width="0.5" />
                  <path d="M 216,92 L 226,97 L 226,102 L 216,97 Z" fill="url(#metal-solder-ball)" stroke="#334155" stroke-width="0.5" />
                </g>

                <!-- Multi-Layer Substrate Base Layer (Thick Organic Interposer) -->
                <polygon points="36,88 130,138 130,147 36,97" fill="url(#pkg-left-side)" stroke="#020617" stroke-width="0.8" />
                <polygon points="130,138 224,88 224,97 130,147" fill="url(#pkg-right-side)" stroke="#0F172A" stroke-width="0.8" />
                <polygon points="36,88 130,38 224,88 130,138" fill="url(#pkg-top-sub)" stroke="#1E3A8A" stroke-width="1.5" />

                <!-- Substrate High-Density Micro-Traces (Cyan/Sky-Blue Routing) -->
                <g opacity="0.65" stroke-linecap="round">
                  <polyline points="60,75 105,99 130,85" stroke="#38BDF8" stroke-width="1.2" />
                  <polyline points="200,75 155,99 130,85" stroke="#38BDF8" stroke-width="1.2" />
                  <polyline points="75,110 110,92" stroke="#7DD3FC" stroke-width="1" />
                  <polyline points="185,110 150,92" stroke="#7DD3FC" stroke-width="1" />
                  <circle cx="105" cy="99" r="1.8" fill="#38BDF8" />
                  <circle cx="155" cy="99" r="1.8" fill="#38BDF8" />
                </g>

                <!-- Beveled Cavity Step (Die Pad Step) -->
                <polygon points="68,85 130,118 192,85 130,52" fill="#0B1329" stroke="#1E293B" stroke-width="1" />

                <!-- Gold Wirebonds (Connecting Substrate Lead Fingers to Die Pads) -->
                <g stroke="url(#gold-wire)" stroke-width="1.2" fill="none" opacity="0.9">
                  <path d="M 64,83 Q 74,78 84,82" />
                  <path d="M 80,97 Q 88,90 96,93" />
                  <path d="M 196,83 Q 186,78 176,82" />
                  <path d="M 180,97 Q 172,90 164,93" />
                </g>

                <!-- Elevated Silicon Die Layer (Polished Specular Surface) -->
                <polygon points="76,83 130,112 130,118 76,89" fill="url(#die-silicon-left)" />
                <polygon points="130,112 184,83 184,89 130,118" fill="url(#die-silicon-right)" />
                <polygon points="76,83 130,54 184,83 130,112" fill="url(#die-silicon-face)" stroke="#38BDF8" stroke-width="1.4" />

                <!-- Silicon Active Core Glow & Micro-Pattern -->
                <ellipse cx="130" cy="83" rx="38" ry="20" fill="url(#core-quantum-glow)" />

                <!-- Central Integrated Micro-Core -->
                <polygon points="100,81 130,97 130,101 100,85" fill="#0369A1" />
                <polygon points="130,97 160,81 160,85 130,101" fill="#075985" />
                <polygon points="100,81 130,65 160,81 130,97" fill="#0284C7" stroke="#BAE6FD" stroke-width="1.2" />

                <!-- Generic Silicon Active Node Marker -->
                <circle cx="130" cy="81" rx="6" ry="3.5" fill="#FFFFFF" opacity="0.8" />
                <circle cx="130" cy="81" rx="2.5" ry="1.5" fill="#38BDF8" />
                </g>
              </svg>
              </div>
            </div>
          </div>
        </div>`;

if (oldHeroRegex.test(html)) {
  html = html.replace(oldHeroRegex, polishedHeroHtml + '\n\n        <!-- 2. ACTIVE WAFER SPATIAL HEALTH + RECENT ACTIVITY -->');
  fs.writeFileSync('index.html', html, 'utf8');
  fs.writeFileSync('frontend/index.html', html, 'utf8');
  console.log('✔ Replaced hero with polished layout in index.html and frontend/index.html');
} else {
  console.error('❌ Could not match oldHeroRegex');
}
