import re
import sys
import shutil

sys.stdout.reconfigure(encoding='utf-8')

print("=== APPLYING HERO CHIP POSITIONING & MOTION ===")

# 1. Update style.css
with open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()

chip_css = """
/* ─── HERO CHIP CENTERING & SUBTLE FLOATING MOTION ─── */
.hero-chip-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.hero-chip-illustration-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  margin: 0 auto 14px auto;
  text-align: center;
}

.hero-chip-svg-wrap {
  display: block;
  margin: 0 auto;
  max-width: 100%;
  height: auto;
  overflow: visible;
}

@keyframes heroChipFloating {
  0% {
    transform: translateY(0px) rotate(0deg);
  }
  50% {
    transform: translateY(-8px) rotate(0.8deg);
  }
  100% {
    transform: translateY(0px) rotate(0deg);
  }
}

@keyframes heroChipShadow {
  0% {
    transform: scale(1);
    opacity: 0.18;
  }
  50% {
    transform: scale(0.92);
    opacity: 0.12;
  }
  100% {
    transform: scale(1);
    opacity: 0.18;
  }
}

.hero-chip-floating-group {
  animation: heroChipFloating 5s ease-in-out infinite;
  transform-origin: 130px 90px;
  will-change: transform;
}

.hero-chip-shadow {
  animation: heroChipShadow 5s ease-in-out infinite;
  transform-origin: 130px 148px;
  will-change: transform, opacity;
}

@media (prefers-reduced-motion: reduce) {
  .hero-chip-floating-group,
  .hero-chip-shadow {
    animation: none !important;
    transform: none !important;
  }
}

@media (max-width: 768px) {
  .hero-chip-card {
    margin-top: 18px;
  }
  .hero-chip-svg-wrap {
    width: 200px;
  }
}
"""

if ".hero-chip-illustration-container" not in css:
    css += "\n" + chip_css
    print("✔ Added hero chip motion & centering CSS to style.css")

with open('style.css', 'w', encoding='utf-8') as f:
    f.write(css)

# 2. Update index.html
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace shadow ellipse and wrap chip body in floating group
old_shadow = '<ellipse cx="130" cy="148" rx="96" ry="18" fill="#091428" opacity="0.18" />'
new_shadow = '<ellipse class="hero-chip-shadow" cx="130" cy="148" rx="96" ry="18" fill="#091428" opacity="0.18" />\n\n                <!-- Floating Chip Body -->\n                <g class="hero-chip-floating-group">'

old_svg_close = '</svg>'

chip_start_idx = html.find('class="hero-chip-card"')
if chip_start_idx != -1:
    svg_start_idx = html.find('<svg width="240"', chip_start_idx)
    svg_close_idx = html.find('</svg>', svg_start_idx)
    
    if svg_start_idx != -1 and svg_close_idx != -1:
        svg_content = html[svg_start_idx:svg_close_idx+6]
        
        # Replace shadow and add </g> before </svg>
        if old_shadow in svg_content:
            svg_content_mod = svg_content.replace(old_shadow, new_shadow)
            svg_content_mod = svg_content_mod.replace('</svg>', '  </g>\n              </svg>')
            
            # Wrap in hero-chip-illustration-container
            new_illustration_wrapper = f'<div class="hero-chip-illustration-container">\n                {svg_content_mod}\n              </div>'
            
            html = html[:svg_start_idx] + new_illustration_wrapper + html[svg_close_idx+6:]
            print("✔ Wrapped SVG in illustration container and floating group in index.html")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

shutil.copy('index.html', 'frontend/index.html')
shutil.copy('style.css', 'frontend/style.css')
print("✔ Re-synchronized frontend/index.html and frontend/style.css")
print("=== APPLIED HERO CHIP MOTION & CENTERING ===")
