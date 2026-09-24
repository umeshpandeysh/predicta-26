"""
PREDICTA-26 — SIH PS-170 Hero Animation Generator
Generates a deterministic, high-resolution GIF visual for README.md.
"""

import os
import math
from PIL import Image, ImageDraw, ImageFont

OUTPUT_GIF = "docs/assets/predicta_ps170_animation.gif"
WIDTH = 1200
HEIGHT = 680

# Dark Engineering Color Palette
BG_DARK = (11, 15, 25)         # #0B0F19
BG_CARD = (17, 24, 39)         # #111827
BG_CARD_LIGHT = (30, 41, 59)   # #1E293B
BORDER_COLOR = (51, 65, 85)     # #334155
GRID_LINE = (30, 41, 59)        # #1E293B

TEXT_MAIN = (248, 250, 252)    # #F8FAFC
TEXT_MUTED = (148, 163, 184)   # #94A3B8
TEXT_DARK = (100, 116, 139)    # #64748B

COLOR_CYAN = (56, 189, 248)    # #38BDF8
COLOR_EMERALD = (16, 185, 129) # #10B981
COLOR_AMBER = (245, 158, 11)   # #F59E0B
COLOR_ROSE = (244, 63, 94)     # #F43F5E
COLOR_PURPLE = (168, 85, 247)  # #A855F7

def load_fonts():
    try:
        # Load standard Windows TrueType fonts
        font_title = ImageFont.truetype("arialbd.ttf", 22)
        font_sub = ImageFont.truetype("arial.ttf", 13)
        font_bold = ImageFont.truetype("arialbd.ttf", 14)
        font_main = ImageFont.truetype("arial.ttf", 13)
        font_small = ImageFont.truetype("arial.ttf", 11)
        font_tiny = ImageFont.truetype("arial.ttf", 10)
    except Exception:
        font_title = ImageFont.load_default()
        font_sub = ImageFont.load_default()
        font_bold = ImageFont.load_default()
        font_main = ImageFont.load_default()
        font_small = ImageFont.load_default()
        font_tiny = ImageFont.load_default()
    return font_title, font_sub, font_bold, font_main, font_small, font_tiny

f_title, f_sub, f_bold, f_main, f_small, f_tiny = load_fonts()

def create_base_canvas():
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_DARK)
    draw = ImageDraw.Draw(img)
    
    # Draw subtle background grid
    for x in range(0, WIDTH, 40):
        draw.line([(x, 0), (x, HEIGHT)], fill=GRID_LINE, width=1)
    for y in range(0, HEIGHT, 40):
        draw.line([(0, y), (WIDTH, y)], fill=GRID_LINE, width=1)
        
    return img, draw

def draw_header(draw, title_suffix=""):
    # Header bar
    draw.rectangle([(20, 15), (WIDTH - 20, 65)], fill=BG_CARD, outline=BORDER_COLOR, width=1)
    
    # SIH Badge
    draw.rectangle([(30, 25), (110, 55)], fill=(249, 115, 22), outline=None)
    draw.text((38, 32), "SIH 2026", fill=(255, 255, 255), font=f_bold)
    
    # Title
    draw.text((125, 24), "PREDICTA-26", fill=TEXT_MAIN, font=f_title)
    draw.text((275, 28), "·  SIH PS-170: AI-Driven Anomaly Detection in Component Burn-In & Screening", fill=COLOR_CYAN, font=f_sub)
    
    if title_suffix:
        draw.text((125, 48), title_suffix, fill=TEXT_MUTED, font=f_small)

def draw_card(draw, box, title, subtitle=None, bg_color=BG_CARD, border_color=BORDER_COLOR):
    x1, y1, x2, y2 = box
    draw.rectangle([(x1, y1), (x2, y2)], fill=bg_color, outline=border_color, width=1)
    draw.rectangle([(x1, y1), (x2, y1 + 28)], fill=BG_CARD_LIGHT, outline=border_color, width=1)
    draw.text((x1 + 10, y1 + 6), title, fill=TEXT_MAIN, font=f_bold)
    if subtitle:
        draw.text((x2 - 180, y1 + 7), subtitle, fill=TEXT_MUTED, font=f_small)

def draw_chip_diagram(draw, x, y, size=120):
    # Package outline
    draw.rectangle([(x, y), (x + size, y + size)], fill=(30, 41, 59), outline=COLOR_CYAN, width=2)
    # Pins
    for i in range(5):
        pin_offset = 15 + i * 22
        # Top/Bottom pins
        draw.line([(x + pin_offset, y - 8), (x + pin_offset, y)], fill=COLOR_CYAN, width=2)
        draw.line([(x + pin_offset, y + size), (x + pin_offset, y + size + 8)], fill=COLOR_CYAN, width=2)
        # Left/Right pins
        draw.line([(x - 8, y + pin_offset), (x, y + pin_offset)], fill=COLOR_CYAN, width=2)
        draw.line([(x + size, y + pin_offset), (x + size + 8, y + pin_offset)], fill=COLOR_CYAN, width=2)
    # Die center
    draw.rectangle([(x + 25, y + 25), (x + size - 25, y + size - 25)], fill=(15, 23, 42), outline=COLOR_AMBER, width=2)
    draw.text((x + 35, y + 45), "SILICON DIE\n UNDER TEST", fill=TEXT_MAIN, font=f_tiny)

def draw_timeline_bar(draw, y_pos, active_stage=1):
    stages = [
        ("0h", "Probe Check"),
        ("24h", "Early Gate"),
        ("96h", "Drift Evaluation"),
        ("168h", "Field Endpoint")
    ]
    total_width = 1120
    start_x = 40
    step = total_width / 3
    
    # Line
    draw.line([(start_x, y_pos), (start_x + total_width, y_pos)], fill=BORDER_COLOR, width=3)
    
    for i, (time_lbl, desc_lbl) in enumerate(stages):
        cx = int(start_x + i * step)
        is_active = (i + 1) <= active_stage
        node_color = COLOR_CYAN if is_active else TEXT_DARK
        fill_color = COLOR_AMBER if (i+1) == active_stage else (BG_DARK if not is_active else COLOR_CYAN)
        
        draw.ellipse([(cx - 10, y_pos - 10), (cx + 10, y_pos + 10)], fill=fill_color, outline=node_color, width=2)
        draw.text((cx - 12, y_pos - 28), time_lbl, fill=node_color, font=f_bold)
        draw.text((cx - 35, y_pos + 14), desc_lbl, fill=TEXT_MUTED if is_active else TEXT_DARK, font=f_small)

def build_frame_01():
    """Frame 1: Static Fallback Frame & System Overview"""
    img, draw = create_base_canvas()
    draw_header(draw, "FULL SYSTEM OVERVIEW · STATIC FALLBACK FRAME")
    
    # 1. Device Under Test Panel
    draw_card(draw, (30, 80, 360, 320), "1. COMPONENT & ATE TELEMETRY", "16 Raw Channels")
    draw_chip_diagram(draw, 50, 130, size=110)
    
    # Telemetry Parameters Box
    draw.rectangle([(190, 125), (345, 305)], fill=BG_DARK, outline=BORDER_COLOR, width=1)
    draw.text((200, 135), "ATE PARAMETRIC CHANNELS", fill=COLOR_CYAN, font=f_tiny)
    params = [
        "Vdd: 1.200 V", "Vout: 1.185 V", "Idd: 44.20 mA",
        "Iddq: 152.4 nA", "Temp: 88.5 °C", "Freq: 3.20 GHz",
        "Tmargin: 42.0 ps", "Ptotal: 53.0 mW"
    ]
    for idx, p in enumerate(params):
        draw.text((200, 153 + idx * 18), p, fill=TEXT_MAIN, font=f_tiny)

    # 2. Module A & B Diagnostic Engines Panel
    draw_card(draw, (380, 80, 810, 320), "2. MODULE A & B DIAGNOSTICS", "Dynamic Outlier & Drift")
    
    # Module A Box
    draw.rectangle([(395, 125), (585, 305)], fill=BG_DARK, outline=BORDER_COLOR, width=1)
    draw.text((405, 135), "MODULE A: DYNAMIC OUTLIER", fill=COLOR_AMBER, font=f_tiny)
    draw.text((405, 155), "• MAD PAT Spatial: Z=5.54", fill=TEXT_MAIN, font=f_tiny)
    draw.text((405, 175), "• COPOD Tail Risk: 8.16", fill=TEXT_MAIN, font=f_tiny)
    draw.text((405, 195), "• Isolation Forest: 0.62", fill=TEXT_MAIN, font=f_tiny)
    draw.rectangle([(405, 225), (575, 290)], fill=BG_CARD_LIGHT, outline=COLOR_AMBER, width=1)
    draw.text((415, 235), "PAT OUTLIER STATUS", fill=COLOR_AMBER, font=f_tiny)
    draw.text((415, 255), "Deviant from Lot Cloud", fill=TEXT_MAIN, font=f_small)

    # Module B Box
    draw.rectangle([(600, 125), (795, 305)], fill=BG_DARK, outline=BORDER_COLOR, width=1)
    draw.text((610, 135), "MODULE B: DRIFT PREDICTION", fill=COLOR_CYAN, font=f_tiny)
    draw.text((610, 155), "• 0h + 24h Baseline Check", fill=TEXT_MAIN, font=f_tiny)
    draw.text((610, 175), "• GPR 168h Trajectory", fill=TEXT_MAIN, font=f_tiny)
    draw.text((610, 195), "• Forecast Iddq: 480 nA", fill=COLOR_ROSE, font=f_tiny)
    draw.rectangle([(610, 225), (785, 290)], fill=BG_CARD_LIGHT, outline=COLOR_ROSE, width=1)
    draw.text((620, 235), "168h RELIABILITY RISK", fill=COLOR_ROSE, font=f_tiny)
    draw.text((620, 255), "Trajectory Breach @ 168h", fill=TEXT_MAIN, font=f_small)

    # 3. Physics & Risk Fusion Panel
    draw_card(draw, (830, 80, 1170, 320), "3. GOVERNED FUSION", "Multi-Layer Gate")
    draw.text((845, 125), "NATIVE XGBOOST MODEL", fill=TEXT_MAIN, font=f_bold)
    draw.text((845, 145), "Calibrated P(FAIL): 0.9969", fill=COLOR_ROSE, font=f_bold)
    draw.text((845, 170), "PHYSICS CONSISTENCY GATE", fill=TEXT_MAIN, font=f_bold)
    draw.text((845, 190), "BTI Shift & Thermal Bounds: OK", fill=COLOR_EMERALD, font=f_small)
    
    # Final Disposition Box
    draw.rectangle([(845, 220), (1155, 305)], fill=(153, 27, 27), outline=COLOR_ROSE, width=2)
    draw.text((860, 230), "DISPOSITION DECISION", fill=TEXT_MUTED, font=f_tiny)
    draw.text((860, 250), "QUALIFICATION: REJECT", fill=TEXT_MAIN, font=f_title)
    draw.text((860, 280), "Action: Scrap / Failure Analysis", fill=TEXT_MAIN, font=f_small)

    # Bottom Timeline Bar
    draw_card(draw, (30, 340, 1170, 520), "4. BURN-IN TIMELINE & EVIDENCE TRAJECTORY", "0h to 168h Screening Window")
    draw_timeline_bar(draw, 440, active_stage=4)

    # Bottom Reliability Twin Ledger
    draw_card(draw, (30, 540, 1170, 650), "5. IMMUTABLE DIGITAL RELIABILITY TWIN LEDGER", "10-Stage Provenance Chain")
    stages_text = [
        "01.Obs", "02.ML P(Fail)", "03.Anomaly", "04.Prognostics", "05.Physics",
        "06.Risk Fusion", "07.Operator", "08.Re-Test", "09.Outcome", "10.Adjudication"
    ]
    for idx, stg in enumerate(stages_text):
        sx = 45 + idx * 112
        draw.rectangle([(sx, 580), (sx + 100, 630)], fill=BG_DARK, outline=COLOR_CYAN if idx in (1, 5, 9) else BORDER_COLOR, width=1)
        draw.text((sx + 8, 595), stg, fill=TEXT_MAIN, font=f_tiny)

    return img

def build_frame_02():
    """Frame 2: Scene 1 & 2 - Device & Burn-in Checkpoints"""
    img, draw = create_base_canvas()
    draw_header(draw, "SCENE 1: COMPONENT UNDER TEST & BURN-IN TIMELINE")
    
    # Large Device Under Test Display
    draw_card(draw, (80, 90, 1120, 360), "AUTOMATED TEST EQUIPMENT (ATE) TELEMETRY CELL", "Wafer Probe Ingestion")
    draw_chip_diagram(draw, 140, 150, size=150)
    
    draw.text((330, 150), "COMPONENT IDENTIFIER: DIE_LATENT_042", fill=COLOR_CYAN, font=f_title)
    draw.text((330, 185), "Equipment ID: EQP-101  |  Wafer ID: W-TEST-01  |  Lot ID: LOT-001", fill=TEXT_MUTED, font=f_bold)
    
    # Active Channels Matrix
    draw.rectangle([(330, 220), (1080, 335)], fill=BG_DARK, outline=BORDER_COLOR, width=1)
    draw.text((345, 232), "ACTIVE PARAMETRIC SENSOR CHANNELS (28-FEATURE CONTRACT)", fill=TEXT_MAIN, font=f_bold)
    
    channels = [
        "Supply Voltage (Vdd): 1.20 V", "Leakage Current (Iddq): 152.4 nA", "Propagation Delay (tpd): 45.2 ps",
        "Output Voltage (Vout): 1.18 V", "Operating Temp (T): 88.5 °C", "Timing Margin (Tmarg): 42.0 ps",
        "Total Current (Idd): 44.2 mA", "Total Power (Ptot): 53.0 mW", "Frequency (f): 3.20 GHz"
    ]
    for idx, ch in enumerate(channels):
        row = idx // 3
        col = idx % 3
        draw.text((345 + col * 240, 258 + row * 24), ch, fill=COLOR_CYAN if "Iddq" in ch or "Temp" in ch else TEXT_MUTED, font=f_small)

    # Timeline
    draw_card(draw, (80, 390, 1120, 630), "BURN-IN CHECKPOINT TIMELINE", "0h -> 24h -> 96h -> 168h")
    draw_timeline_bar(draw, 510, active_stage=1)
    
    draw.rectangle([(420, 560), (780, 610)], fill=BG_DARK, outline=COLOR_AMBER, width=1)
    draw.text((435, 575), "CURRENT STATUS: 0h Initial Inspection Passed", fill=COLOR_AMBER, font=f_bold)

    return img

def build_frame_03():
    """Frame 3: Scene 3 - Early Telemetry & Subtle Drift"""
    img, draw = create_base_canvas()
    draw_header(draw, "SCENE 2: EARLY TELEMETRY (0h & 24h OBSERVATIONS)")
    
    draw_card(draw, (60, 90, 1140, 420), "PARAMETRIC WAVEFORM TRACE (0h to 24h)", "Subtle Parametric Shift Detected")
    
    # Graph Box
    gx1, gy1, gx2, gy2 = 90, 140, 1110, 390
    draw.rectangle([(gx1, gy1), (gx2, gy2)], fill=BG_DARK, outline=BORDER_COLOR, width=1)
    
    # Graph Grid & Axes
    draw.line([(gx1, gy2 - 40), (gx2, gy2 - 40)], fill=GRID_LINE, width=1) # Baseline
    draw.line([(gx1, gy1 + 60), (gx2, gy1 + 60)], fill=(244, 63, 94), width=1) # Upper Limit Line
    draw.text((gx2 - 140, gy1 + 45), "Static 24h Spec Limit (300 nA)", fill=COLOR_ROSE, font=f_tiny)
    
    # Checkpoint markers
    for idx, (lbl, xoff) in enumerate([("0h Probe", gx1 + 40), ("12h Burn-in", gx1 + 350), ("24h Checkpoint", gx1 + 650), ("168h Target", gx2 - 60)]):
        draw.line([(xoff, gy1), (xoff, gy2)], fill=GRID_LINE, width=1)
        draw.text((xoff + 5, gy2 - 20), lbl, fill=TEXT_MUTED, font=f_tiny)
        
    # Plot Iddq Curve (Solid up to 24h)
    pts = [(gx1 + 40, gy2 - 80), (gx1 + 200, gy2 - 82), (gx1 + 350, gy2 - 95), (gx1 + 500, gy2 - 110), (gx1 + 650, gy2 - 130)]
    for i in range(len(pts) - 1):
        draw.line([pts[i], pts[i+1]], fill=COLOR_CYAN, width=3)
        
    # Draw point at 24h
    draw.ellipse([(gx1 + 650 - 6, gy2 - 130 - 6), (gx1 + 650 + 6, gy2 - 130 + 6)], fill=COLOR_AMBER, outline=TEXT_MAIN, width=2)
    draw.text((gx1 + 665, gy2 - 150), "24h Measured Iddq = 152.4 nA\n(PASSES Static 300 nA Limit)", fill=COLOR_AMBER, font=f_small)

    # Narrative Card
    draw_card(draw, (60, 440, 1140, 630), "KEY RELIABILITY INSIGHT", "Static Gate vs Latent Degradation")
    draw.text((80, 480), "• At 24h inspection, the device passes static voltage & current thresholds (152.4 nA < 300 nA limit).", fill=TEXT_MAIN, font=f_bold)
    draw.text((80, 510), "• However, subtle Iddq leakage elevation (+15%) and Vth shift (+32 mV) indicate underlying dielectric degradation.", fill=COLOR_AMBER, font=f_bold)
    draw.text((80, 540), "• Traditional ATE gates PASS this die — creating a potential 168h field escape risk.", fill=COLOR_ROSE, font=f_bold)

    return img

def build_frame_04():
    """Frame 4: Scene 4 - Module A: Dynamic Outlier Detection"""
    img, draw = create_base_canvas()
    draw_header(draw, "SCENE 3: MODULE A — DYNAMIC OUTLIER DETECTION")
    
    # Left: Outlier Engines Box
    draw_card(draw, (50, 90, 570, 630), "MODULE A: MULTI-METHOD ANOMALY ENGINES", "Spatial & Peer Outlier Screening")
    
    engines = [
        ("1. Robust MAD / Part Average Testing (PAT)", "Measures median absolute deviation across lot coordinates.", "Z-Score: 5.54 (STATUS: MONITOR)", COLOR_AMBER),
        ("2. COPOD Copula Outlier Engine", "Empirical copula tail probability for multivariate risk.", "Copula Tail Score: 8.16 (MONITOR)", COLOR_AMBER),
        ("3. Isolation Forest Outlier Guard", "Tree isolation distance across 16 raw channels.", "Isolation Score: 0.62 (PASS)", COLOR_EMERALD)
    ]
    
    for idx, (title, desc, res, res_col) in enumerate(engines):
        yoff = 135 + idx * 155
        draw.rectangle([(70, yoff), (550, yoff + 135)], fill=BG_DARK, outline=BORDER_COLOR, width=1)
        draw.text((85, yoff + 12), title, fill=COLOR_CYAN, font=f_bold)
        draw.text((85, yoff + 40), desc, fill=TEXT_MUTED, font=f_small)
        
        draw.rectangle([(85, yoff + 75), (535, yoff + 115)], fill=BG_CARD_LIGHT, outline=res_col, width=1)
        draw.text((100, yoff + 87), res, fill=res_col, font=f_bold)

    # Right: Population Lot Cloud Scatter Plot
    draw_card(draw, (600, 90, 1150, 630), "PAT SPATIAL LOT CLOUD COMPARISON", "Lot Population vs Deviant Die")
    
    px1, py1, px2, py2 = 630, 140, 1120, 530
    draw.rectangle([(px1, py1), (px2, py2)], fill=BG_DARK, outline=BORDER_COLOR, width=1)
    draw.text((px1 + 15, py1 + 15), "Lot Normal Cluster (1,000 Dies) vs Outlier Die", fill=TEXT_MUTED, font=f_small)
    
    # Draw Lot Normal Cluster (Green dots)
    cx, cy = px1 + 200, py1 + 220
    for r in range(15, 120, 15):
        n_dots = int(r * 1.5)
        for d in range(n_dots):
            angle = d * (2 * math.pi / n_dots)
            dx = int(cx + r * math.cos(angle) + (d % 5))
            dy = int(cy + r * math.sin(angle) + (d % 3))
            draw.ellipse([(dx - 2, dy - 2), (dx + 2, dy + 2)], fill=(16, 185, 129, 180))
            
    # Draw Outlier Die (Red/Amber pulsing dot)
    ox, oy = px1 + 410, py1 + 90
    draw.ellipse([(ox - 15, oy - 15), (ox + 15, oy + 15)], fill=None, outline=COLOR_ROSE, width=2)
    draw.ellipse([(ox - 8, oy - 8), (ox + 8, oy + 8)], fill=COLOR_ROSE)
    draw.line([(ox, oy), (ox - 40, oy + 60)], fill=COLOR_ROSE, width=1)
    
    draw.rectangle([(ox - 160, oy + 60), (ox + 40, oy + 110)], fill=BG_CARD_LIGHT, outline=COLOR_ROSE, width=1)
    draw.text((ox - 150, oy + 70), "DEVIANT DIE #042\nZ-Score = 5.54 (PAT Breach)", fill=COLOR_ROSE, font=f_small)

    draw.rectangle([(630, 550), (1120, 610)], fill=BG_CARD_LIGHT, outline=COLOR_AMBER, width=1)
    draw.text((645, 565), "KEY CONCEPT: Device passes absolute static limit, but shows", fill=TEXT_MAIN, font=f_small)
    draw.text((645, 585), "statistically significant spatial deviation from its lot peers.", fill=COLOR_AMBER, font=f_bold)

    return img

def build_frame_05():
    """Frame 5: Scene 5 - Module B: Time-Series Drift Prediction"""
    img, draw = create_base_canvas()
    draw_header(draw, "SCENE 4: MODULE B — TIME-SERIES DRIFT PREDICTION")
    
    draw_card(draw, (50, 90, 1150, 630), "168-HOUR DEGRADATION TRAJECTORY FORECASTING", "Gaussian Process Regression (GPR RBF Kernel)")
    
    gx1, gy1, gx2, gy2 = 80, 140, 1120, 530
    draw.rectangle([(gx1, gy1), (gx2, gy2)], fill=BG_DARK, outline=BORDER_COLOR, width=1)
    
    # Graph Grid
    draw.line([(gx1, gy2 - 40), (gx2, gy2 - 40)], fill=GRID_LINE, width=1)
    draw.line([(gx1, gy1 + 70), (gx2, gy1 + 70)], fill=COLOR_ROSE, width=2) # Safety Threshold
    draw.text((gx2 - 240, gy1 + 50), "Critical Safety Limit (450 nA)", fill=COLOR_ROSE, font=f_bold)
    
    # Checkpoints X
    cp_x = {
        "0h": gx1 + 60,
        "24h": gx1 + 220,
        "48h": gx1 + 380,
        "72h": gx1 + 540,
        "96h": gx1 + 700,
        "144h": gx1 + 860,
        "168h": gx1 + 1000
    }
    for k, v in cp_x.items():
        draw.line([(v, gy1), (v, gy2)], fill=GRID_LINE, width=1)
        draw.text((v - 12, gy2 - 25), k, fill=TEXT_MUTED, font=f_small)
        
    # Solid Measured Trajectory (0h to 24h)
    pts_measured = [(cp_x["0h"], gy2 - 80), (cp_x["24h"], gy2 - 130)]
    draw.line([pts_measured[0], pts_measured[1]], fill=COLOR_CYAN, width=3)
    draw.ellipse([(cp_x["24h"]-5, gy2-130-5), (cp_x["24h"]+5, gy2-130+5)], fill=COLOR_CYAN)
    draw.text((cp_x["24h"] - 40, gy2 - 160), "24h Measured (152.4 nA)", fill=COLOR_CYAN, font=f_small)
    
    # Dashed Forecast Trajectory (24h to 168h)
    pts_forecast = [
        (cp_x["24h"], gy2 - 130),
        (cp_x["48h"], gy2 - 180),
        (cp_x["72h"], gy2 - 230),
        (cp_x["96h"], gy2 - 275),
        (cp_x["144h"], gy2 - 340),
        (cp_x["168h"], gy2 - 380) # Crosses limit
    ]
    
    # Draw dashed line
    for i in range(len(pts_forecast) - 1):
        x_a, y_a = pts_forecast[i]
        x_b, y_b = pts_forecast[i+1]
        draw.line([(x_a, y_a), (x_b, y_b)], fill=COLOR_AMBER, width=3)
        
    # Highlight Breach @ 168h
    draw.ellipse([(cp_x["168h"]-8, gy2-380-8), (cp_x["168h"]+8, gy2-380+8)], fill=COLOR_ROSE, outline=TEXT_MAIN, width=2)
    
    draw.rectangle([(cp_x["168h"] - 220, gy2 - 420), (cp_x["168h"] - 10, gy2 - 360)], fill=BG_CARD_LIGHT, outline=COLOR_ROSE, width=1)
    draw.text((cp_x["168h"] - 210, gy2 - 410), "GPR 168h FORECAST: 480 nA\nCRITICAL SAFETY BREACH", fill=COLOR_ROSE, font=f_bold)

    # Narrative
    draw.rectangle([(80, 550), (1120, 610)], fill=BG_CARD_LIGHT, outline=COLOR_CYAN, width=1)
    draw.text((95, 565), "MODULE B MECHANICS: Solid line = Measured 24h burn-in telemetry.", fill=TEXT_MAIN, font=f_small)
    draw.text((95, 585), "Dashed curve = GPR RBF degradation forecast extending to 168h endpoint.", fill=COLOR_CYAN, font=f_bold)

    return img

def build_frame_06():
    """Frame 6: Scene 6 - Reliability & Physics Evidence Gates"""
    img, draw = create_base_canvas()
    draw_header(draw, "SCENE 5: RELIABILITY & PHYSICS CONSISTENCY EVIDENCE")
    
    draw_card(draw, (50, 90, 1150, 630), "PHYSICAL RELIABILITY DEGRADATION PRIMITIVES", "Thermal & Bias Temperature Instability Bounds")
    
    primitives = [
        ("1. BTI / NBTI GATE SHIFT", "Evaluates threshold voltage drift ΔVth over burn-in duration.", "Measured: ΔVth = +32.0 mV", "Status: BTI AGING DETECTED", COLOR_AMBER),
        ("2. ARRHENIUS THERMAL ACCELERATION", "Calculates junction temperature excursion Tj = Tamb + Ptot * Rth.", "Measured: Tj = 106.5 °C (ΔT = +18°C)", "Status: ELEVATED JUNCTION TEMP", COLOR_AMBER),
        ("3. SUBTHRESHOLD LEAKAGE EXPANSION", "Monitors subthreshold leakage current proportion Ileak / Itot.", "Measured: 1.29x Baseline Ratio", "Status: JUNCTION DRIFT DETECTED", COLOR_AMBER),
        ("4. PHYSICAL LAWS SANITY GATE", "Validates Vdd, Temp, and Timing against physical operating bounds.", "Bounds Check: Vdd=1.20V, Temp=88.5°C", "Status: PHYSICS_CONSISTENT (1.0)", COLOR_EMERALD)
    ]
    
    for idx, (title, desc, val, stat, col) in enumerate(primitives):
        row = idx // 2
        c_idx = idx % 2
        bx1 = 80 + c_idx * 530
        by1 = 140 + row * 230
        bx2 = bx1 + 500
        by2 = by1 + 200
        
        draw.rectangle([(bx1, by1), (bx2, by2)], fill=BG_DARK, outline=BORDER_COLOR, width=1)
        draw.text((bx1 + 15, by1 + 15), title, fill=COLOR_CYAN, font=f_bold)
        draw.text((bx1 + 15, by1 + 45), desc, fill=TEXT_MUTED, font=f_small)
        
        draw.rectangle([(bx1 + 15, by1 + 80), (bx2 - 15, by1 + 125)], fill=BG_CARD_LIGHT, outline=BORDER_COLOR, width=1)
        draw.text((bx1 + 25, by1 + 95), val, fill=TEXT_MAIN, font=f_bold)
        
        draw.rectangle([(bx1 + 15, by1 + 135), (bx2 - 15, by1 + 180)], fill=BG_CARD_LIGHT, outline=col, width=1)
        draw.text((bx1 + 25, by1 + 150), stat, fill=col, font=f_bold)

    return img

def build_frame_07():
    """Frame 7: Scene 7 - Failure-Risk Model & Evidence Fusion"""
    img, draw = create_base_canvas()
    draw_header(draw, "SCENE 6: FAILURE-RISK MODEL & MULTI-LAYER EVIDENCE FUSION")
    
    draw_card(draw, (50, 90, 1150, 630), "MULTI-LAYER GOVERNED EVIDENCE CONVERGENCE", "Synthesizing ML, Anomaly, Prognostic & Physics Layers")
    
    # 4 Input Evidence Streams
    streams = [
        ("NATIVE XGBOOST MODEL", "Calibrated P(FAIL) = 0.9969", COLOR_ROSE),
        ("MODULE A: ANOMALY ENGINE", "PAT MAD Spatial Outlier (MONITOR)", COLOR_AMBER),
        ("MODULE B: 168h PROGNOSTICS", "GPR Trajectory Breach @ 168h", COLOR_ROSE),
        ("PHYSICS CONSISTENCY GATE", "BTI & Thermal Bounds Validated", COLOR_EMERALD)
    ]
    
    for idx, (title, val, col) in enumerate(streams):
        sy = 140 + idx * 110
        draw.rectangle([(80, sy), (420, sy + 85)], fill=BG_DARK, outline=col, width=2)
        draw.text((95, sy + 15), title, fill=TEXT_MAIN, font=f_bold)
        draw.text((95, sy + 45), val, fill=col, font=f_small)
        
        # Connectors to Fusion Gate
        draw.line([(420, sy + 42), (580, 340)], fill=col, width=2)
        
    # Central Governed Risk Fusion Gate
    draw.ellipse([(540, 240), (740, 440)], fill=BG_CARD_LIGHT, outline=COLOR_CYAN, width=3)
    draw.text((575, 310), "GOVERNED RISK\nFUSION GATE", fill=TEXT_MAIN, font=f_title)
    draw.text((570, 360), "src/risk_fusion/gate.py", fill=COLOR_CYAN, font=f_tiny)
    
    # Output to Decision
    draw.line([(740, 340), (840, 340)], fill=COLOR_ROSE, width=4)
    
    # Right Final Risk Evaluation Box
    draw.rectangle([(840, 220), (1120, 460)], fill=(153, 27, 27), outline=COLOR_ROSE, width=2)
    draw.text((860, 240), "SYNTHESIZED RISK SCORE", fill=TEXT_MUTED, font=f_tiny)
    draw.text((860, 270), "CRITICAL RISK", fill=TEXT_MAIN, font=f_title)
    draw.text((860, 310), "Calibrated P = 0.9969", fill=TEXT_MAIN, font=f_bold)
    draw.text((860, 335), "Operating Threshold = 0.20", fill=COLOR_AMBER, font=f_small)
    draw.text((860, 370), "Primary Factor:\nCALIBRATED_PROBABILITY_BREACH", fill=TEXT_MAIN, font=f_small)

    return img

def build_frame_08():
    """Frame 8: Scene 8 - Qualification Decision (PASS / MONITOR / REJECT)"""
    img, draw = create_base_canvas()
    draw_header(draw, "SCENE 7: QUALIFICATION DECISION & COUNTERFACTUAL GUIDANCE")
    
    draw_card(draw, (50, 90, 1150, 630), "FAB OPERATIONAL DISPOSITION ROUTING", "Tri-State Qualification Output")
    
    # 3 Tri-State Disposition Cards
    # PASS
    draw.rectangle([(80, 140), (400, 320)], fill=BG_DARK, outline=BORDER_COLOR, width=1)
    draw.text((100, 160), "PASS DISPOSITION", fill=TEXT_MUTED, font=f_bold)
    draw.text((100, 190), "Approved for Assembly", fill=TEXT_DARK, font=f_small)
    draw.text((100, 230), "Condition: P(FAIL) < 0.10\n& Nominal Telemetry", fill=TEXT_MUTED, font=f_tiny)

    # MONITOR
    draw.rectangle([(440, 140), (760, 320)], fill=BG_DARK, outline=BORDER_COLOR, width=1)
    draw.text((460, 160), "MONITOR DISPOSITION", fill=TEXT_MUTED, font=f_bold)
    draw.text((460, 190), "Route to Extended 168h", fill=TEXT_DARK, font=f_small)
    draw.text((460, 230), "Condition: 0.10 <= P < 0.20\nOR Unseen Equipment", fill=TEXT_MUTED, font=f_tiny)

    # REJECT (Emphasized & Selected)
    draw.rectangle([(800, 130), (1120, 330)], fill=(153, 27, 27), outline=COLOR_ROSE, width=3)
    draw.rectangle([(800, 130), (1120, 165)], fill=COLOR_ROSE, outline=COLOR_ROSE, width=1)
    draw.text((820, 138), "SELECTED DISPOSITION", fill=(255, 255, 255), font=f_bold)
    draw.text((820, 180), "QUALIFICATION: REJECT", fill=TEXT_MAIN, font=f_title)
    draw.text((820, 220), "Action: Scrap / Failure Analysis", fill=TEXT_MAIN, font=f_small)
    draw.text((820, 250), "Trigger: P = 0.9969 >= 0.20", fill=(254, 202, 202), font=f_bold)

    # Bottom: Actionable Counterfactual Explanation Box
    draw_card(draw, (80, 360, 1120, 600), "ACTIONABLE COUNTERFACTUAL EXPLANATION ENGINE", "src/explainability/counterfactual.py")
    
    draw.rectangle([(100, 410), (1100, 570)], fill=BG_DARK, outline=BORDER_COLOR, width=1)
    draw.text((120, 425), "MINIMUM ACTIONABLE PARAMETER ADJUSTMENTS FOR PASS DISPOSITION:", fill=COLOR_CYAN, font=f_bold)
    
    adjustments = [
        "• Leakage Current (Iddq): Current = 195.4 nA  -->  Target = 152.1 nA  (Delta = -43.3 nA)",
        "• Operating Temp (T):     Current = 88.5 °C   -->  Target = 75.0 °C   (Delta = -13.5 °C)",
        "• Physical Feasibility Status: FEASIBLE_FAB_ADJUSTMENT (Valid Fab Parameter Range)"
    ]
    for idx, adj in enumerate(adjustments):
        draw.text((120, 460 + idx * 32), adj, fill=TEXT_MAIN if "FEASIBLE" not in adj else COLOR_EMERALD, font=f_main)

    return img

def build_frame_09():
    """Frame 9: Scene 9 - Traceability & 10-Stage Digital Reliability Twin"""
    img, draw = create_base_canvas()
    draw_header(draw, "SCENE 8: TRACEABILITY & 10-STAGE DIGITAL RELIABILITY TWIN")
    
    draw_card(draw, (50, 90, 1150, 630), "IMMUTABLE DIGITAL RELIABILITY TWIN EVIDENCE CHAIN", "src/reliability_twin/twin.py")
    
    stages = [
        ("Stage 01", "Manufacturing Observation", "Wafer W-TEST-01, Die (12, 8), EQP-101", COLOR_CYAN),
        ("Stage 02", "ML Evaluation", "Raw 28 features, Native XGB P=0.9969", COLOR_CYAN),
        ("Stage 03", "Anomaly Evidence", "MAD PAT Z=5.54, COPOD Score=8.16", COLOR_AMBER),
        ("Stage 04", "Prognostic Evidence", "GPR 168h Forecast Iddq=480nA Breach", COLOR_ROSE),
        ("Stage 05", "Physics Evidence", "BTI Shift ΔVth=+32mV, Temp Tj=106.5°C", COLOR_AMBER),
        ("Stage 06", "Risk Fusion", "Synthesized Disposition: REJECT", COLOR_ROSE),
        ("Stage 07", "Operator Disposition", "Recommended Action: SCRAP", COLOR_ROSE),
        ("Stage 08", "Secondary Test", "ATE Re-test Telemetry Verified", COLOR_CYAN),
        ("Stage 09", "Outcome Evidence", "Retrospective 168h Failure Confirmed", COLOR_ROSE),
        ("Stage 10", "Adjudication Sign-Off", "Final Immutable Audit Record Saved", COLOR_EMERALD)
    ]
    
    for idx, (stg_num, title, desc, col) in enumerate(stages):
        row = idx // 2
        col_idx = idx % 2
        bx1 = 80 + col_idx * 530
        by1 = 140 + row * 92
        bx2 = bx1 + 500
        by2 = by1 + 78
        
        draw.rectangle([(bx1, by1), (bx2, by2)], fill=BG_DARK, outline=col, width=1)
        draw.rectangle([(bx1, by1), (bx1 + 90, by2)], fill=BG_CARD_LIGHT, outline=col, width=1)
        draw.text((bx1 + 12, by1 + 28), stg_num, fill=col, font=f_bold)
        
        draw.text((bx1 + 105, by1 + 12), title, fill=TEXT_MAIN, font=f_bold)
        draw.text((bx1 + 105, by1 + 42), desc, fill=TEXT_MUTED, font=f_tiny)

    # Bottom Core Takeaway
    draw.rectangle([(80, 595), (1110, 625)], fill=BG_CARD_LIGHT, outline=COLOR_EMERALD, width=1)
    draw.text((220, 603), "EARLY EVIDENCE  -->  EARLIER SCREENING  -->  TRACEABLE DECISION", fill=COLOR_EMERALD, font=f_bold)

    return img

def main():
    print("Generating PREDICTA-26 SIH PS-170 Hero Animation GIF frames...")
    
    # Build frames with duplicate holds for proper scene timing
    frames_spec = [
        (build_frame_01(), 2500), # Frame 1 Static Fallback (2.5s)
        (build_frame_02(), 1800), # Frame 2 Device & Checkpoints (1.8s)
        (build_frame_03(), 2000), # Frame 3 Early Telemetry & Drift (2.0s)
        (build_frame_04(), 2200), # Frame 4 Module A Outliers (2.2s)
        (build_frame_05(), 2200), # Frame 5 Module B 168h Prognostics (2.2s)
        (build_frame_06(), 2000), # Frame 6 Physics Evidence (2.0s)
        (build_frame_07(), 2000), # Frame 7 Risk Fusion (2.0s)
        (build_frame_08(), 2200), # Frame 8 Qualification Decision (2.2s)
        (build_frame_09(), 2500), # Frame 9 Traceability Ledger (2.5s)
    ]
    
    images = [item[0] for item in frames_spec]
    durations = [item[1] for item in frames_spec]
    
    os.makedirs(os.path.dirname(OUTPUT_GIF), exist_ok=True)
    
    # Save optimized looping GIF
    images[0].save(
        OUTPUT_GIF,
        save_all=True,
        append_images=images[1:],
        duration=durations,
        loop=0,
        optimize=True
    )
    
    size_mb = os.path.getsize(OUTPUT_GIF) / (1024 * 1024)
    print(f"[SUCCESS] GIF successfully created: {OUTPUT_GIF}")
    print(f"   Dimensions: {images[0].size[0]}x{images[0].size[1]} px")
    print(f"   Frame count: {len(images)} frames")
    print(f"   Total duration: {sum(durations)/1000:.1f} seconds")
    print(f"   File size: {size_mb:.2f} MB")

if __name__ == "__main__":
    main()
