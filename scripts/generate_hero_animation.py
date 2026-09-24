"""
PREDICTA-26 — SIH PS-170 Hero Animation Generator
Generates a light-theme, clean engineering visual GIF for README.md.
"""

import os
from PIL import Image, ImageDraw, ImageFont

OUTPUT_GIF = "docs/assets/predicta_ps170_animation.gif"
PREVIEW_DIR = "scratch/frame_previews"
WIDTH = 1200
HEIGHT = 650

# Light Visual System Palette
BG_COLOR = (248, 250, 252)          # Slate-50 (#F8FAFC)
CARD_BG = (255, 255, 255)           # Pure White (#FFFFFF)
CARD_HEADER_BG = (241, 245, 249)    # Slate-100 (#F1F5F9)
BORDER_COLOR = (226, 232, 240)      # Slate-200 (#E2E8F0)
BORDER_DARK = (203, 213, 225)       # Slate-300 (#CBD5E1)
GRID_LINE = (241, 245, 249)         # Subtle Grid (#F1F5F9)

TEXT_MAIN = (15, 23, 42)            # Slate-900 (#0F172A - Dark Navy)
TEXT_MUTED = (71, 85, 105)          # Slate-600 (#475569 - Muted Slate)
TEXT_LIGHT = (148, 163, 184)        # Slate-400 (#94A3B8)

BLUE_PRIMARY = (37, 99, 235)        # Blue-600 (#2563EB)
BLUE_LIGHT_BG = (239, 246, 255)     # Blue-50 (#EFF6FF)
BLUE_BORDER = (191, 219, 254)       # Blue-200 (#BFDBFE)

CYAN_LIGHT_BG = (240, 249, 255)     # Cyan-50 (#F0F9FF)
CYAN_TEXT = (2, 132, 199)           # Cyan-600 (#0284C7)
CYAN_BORDER = (186, 230, 253)       # Cyan-200 (#BAE6FD)

PASS_BG = (240, 253, 244)           # Green-50 (#F0FDF4)
PASS_TEXT = (21, 128, 61)           # Green-700 (#15803D)
PASS_BORDER = (187, 247, 208)       # Green-200 (#BBF7D0)

WARN_BG = (254, 243, 199)           # Amber-100 (#FEF3C7)
WARN_TEXT = (180, 83, 9)            # Amber-700 (#B45309)
WARN_BORDER = (253, 230, 138)       # Amber-200 (#FDE68A)

REJECT_BG = (254, 226, 226)         # Red-100 (#FEE2E2)
REJECT_TEXT = (185, 28, 28)         # Red-700 (#B91C1C)
REJECT_BORDER = (254, 202, 202)     # Red-200 (#FECACA)


def load_fonts():
    try:
        f_h1 = ImageFont.truetype("segoeuib.ttf", 32)
        f_h2 = ImageFont.truetype("segoeuib.ttf", 20)
        f_h3 = ImageFont.truetype("segoeuib.ttf", 15)
        f_body = ImageFont.truetype("segoeui.ttf", 14)
        f_small = ImageFont.truetype("segoeui.ttf", 12)
        f_tiny = ImageFont.truetype("segoeui.ttf", 11)
        f_bold = ImageFont.truetype("segoeuib.ttf", 13)
    except Exception:
        f_h1 = ImageFont.load_default()
        f_h2 = ImageFont.load_default()
        f_h3 = ImageFont.load_default()
        f_body = ImageFont.load_default()
        f_small = ImageFont.load_default()
        f_tiny = ImageFont.load_default()
        f_bold = ImageFont.load_default()
    return f_h1, f_h2, f_h3, f_body, f_small, f_tiny, f_bold


f_h1, f_h2, f_h3, f_body, f_small, f_tiny, f_bold = load_fonts()


def create_base_canvas():
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # Subtle grid background
    for x in range(0, WIDTH, 40):
        draw.line([(x, 0), (x, HEIGHT)], fill=GRID_LINE, width=1)
    for y in range(0, HEIGHT, 40):
        draw.line([(0, y), (WIDTH, y)], fill=GRID_LINE, width=1)

    return img, draw


def draw_top_header(draw, step_num, step_title, step_subtitle):
    # Top banner bar
    draw.rectangle([(20, 15), (WIDTH - 20, 65)], fill=CARD_BG, outline=BORDER_COLOR, width=1)
    
    # SIH PS-170 Badge
    draw.rectangle([(32, 25), (122, 55)], fill=BLUE_PRIMARY, outline=None)
    draw.text((40, 32), "SIH PS-170", fill=(255, 255, 255), font=f_bold)
    
    # Step indicator
    draw.text((138, 25), f"STEP {step_num} OF 8", fill=BLUE_PRIMARY, font=f_bold)
    draw.text((240, 25), f"•  {step_title}", fill=TEXT_MAIN, font=f_h2)
    draw.text((138, 46), step_subtitle, fill=TEXT_MUTED, font=f_tiny)


def draw_chip_icon(draw, cx, cy, width=140, height=120, label="DIE 042", highlight=False):
    x1 = cx - width // 2
    y1 = cy - height // 2
    x2 = cx + width // 2
    y2 = cy + height // 2

    # Draw pins
    pin_color = WARN_TEXT if highlight else BORDER_DARK
    for i in range(5):
        px = x1 + 20 + i * 25
        draw.line([(px, y1 - 10), (px, y1)], fill=pin_color, width=2)
        draw.line([(px, y2), (px, y2 + 10)], fill=pin_color, width=2)
    for i in range(4):
        py = y1 + 20 + i * 25
        draw.line([(x1 - 10, py), (x1, py)], fill=pin_color, width=2)
        draw.line([(x2, py), (x2 + 10, py)], fill=pin_color, width=2)

    # Package body
    pkg_fill = WARN_BG if highlight else CARD_HEADER_BG
    pkg_border = WARN_TEXT if highlight else BORDER_DARK
    draw.rectangle([(x1, y1), (x2, y2)], fill=pkg_fill, outline=pkg_border, width=2)

    # Internal silicon die
    die_x1, die_y1 = x1 + 25, y1 + 20
    die_x2, die_y2 = x2 - 25, y2 - 20
    die_fill = BLUE_LIGHT_BG if not highlight else WARN_BG
    die_border = BLUE_PRIMARY if not highlight else WARN_BORDER
    draw.rectangle([(die_x1, die_y1), (die_x2, die_y2)], fill=die_fill, outline=die_border, width=1)

    # Trace lines on die
    draw.line([(die_x1 + 10, die_y1 + 10), (die_x2 - 10, die_y1 + 10)], fill=BLUE_PRIMARY, width=1)
    draw.line([(die_x1 + 10, die_y2 - 10), (die_x2 - 10, die_y2 - 10)], fill=BLUE_PRIMARY, width=1)
    draw.line([(cx, die_y1 + 10), (cx, die_y2 - 10)], fill=BLUE_PRIMARY, width=1)

    # Die label
    draw.text((cx - 24, cy - 6), label, fill=TEXT_MAIN, font=f_bold)


def draw_pill(draw, x1, y1, x2, y2, text, bg_color, text_color, border_color=None):
    draw.rectangle([(x1, y1), (x2, y2)], fill=bg_color, outline=border_color or bg_color, width=1)
    bbox = f_bold.getbbox(text)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = x1 + (x2 - x1 - tw) // 2
    ty = y1 + (y2 - y1 - th) // 2 - 1
    draw.text((tx, ty), text, fill=text_color, font=f_bold)


# -------------------------------------------------------------------------
# SCENE BUILDERS
# -------------------------------------------------------------------------

def render_scene_1():
    """Scene 1: Standalone Hero Frame (First Frame Requirement)."""
    img, draw = create_base_canvas()

    # Header Badge
    draw_pill(draw, 470, 45, 730, 75, "SIH 2026 • PROBLEM STATEMENT 170", BLUE_LIGHT_BG, BLUE_PRIMARY, BLUE_BORDER)

    # Main Title
    draw.text((430, 95), "PREDICTA", fill=TEXT_MAIN, font=f_h1)
    draw.text((275, 145), "Semiconductor Burn-In Telemetry & Latent Defect Screening", fill=TEXT_MUTED, font=f_h2)

    # Chip Icon Center
    draw_chip_icon(draw, 600, 275, width=160, height=130, label="DIE 042")

    # Horizontal Flow Bar
    flow_box_y = 380
    draw.rectangle([(120, flow_box_y), (380, flow_box_y + 70)], fill=CARD_BG, outline=BORDER_DARK, width=1)
    draw.text((150, flow_box_y + 15), "1. COMPONENT", fill=TEXT_MAIN, font=f_h3)
    draw.text((150, flow_box_y + 40), "ATE Burn-In Setup & Telemetry", fill=TEXT_MUTED, font=f_tiny)

    # Arrow 1
    draw.line([(390, flow_box_y + 35), (450, flow_box_y + 35)], fill=BLUE_PRIMARY, width=2)
    draw.polygon([(445, flow_box_y + 30), (455, flow_box_y + 35), (445, flow_box_y + 40)], fill=BLUE_PRIMARY)

    draw.rectangle([(460, flow_box_y), (740, flow_box_y + 70)], fill=CARD_BG, outline=BORDER_DARK, width=1)
    draw.text((490, flow_box_y + 15), "2. EARLY SIGNAL & DRIFT", fill=TEXT_MAIN, font=f_h3)
    draw.text((490, flow_box_y + 40), "Module A Outlier + Module B Drift", fill=TEXT_MUTED, font=f_tiny)

    # Arrow 2
    draw.line([(750, flow_box_y + 35), (810, flow_box_y + 35)], fill=BLUE_PRIMARY, width=2)
    draw.polygon([(805, flow_box_y + 30), (815, flow_box_y + 35), (805, flow_box_y + 40)], fill=BLUE_PRIMARY)

    draw.rectangle([(820, flow_box_y), (1080, flow_box_y + 70)], fill=CARD_BG, outline=BORDER_DARK, width=1)
    draw.text((845, flow_box_y + 15), "3. QUALIFICATION", fill=TEXT_MAIN, font=f_h3)
    draw.text((845, flow_box_y + 40), "PASS / MONITOR / REJECT Decision", fill=TEXT_MUTED, font=f_tiny)

    # Bottom Summary Box
    draw.rectangle([(120, 480), (1080, 580)], fill=CYAN_LIGHT_BG, outline=CYAN_BORDER, width=1)
    draw.text((140, 500), "CORE ENGINEERING OBJECTIVE", fill=CYAN_TEXT, font=f_bold)
    draw.text(
        (140, 528),
        "Observe early 24h ATE telemetry → detect population outliers & predict 168h trajectory → screen latent defects early.",
        fill=TEXT_MAIN,
        font=f_body,
    )

    return img


def render_scene_2():
    """Scene 2: Burn-In Telemetry."""
    img, draw = create_base_canvas()
    draw_top_header(draw, 2, "BURN-IN TELEMETRY", "Ingesting Multi-Channel ATE Parametric Telemetry Across Burn-In Checkpoints")

    # Left Panel: Timeline Track
    draw.rectangle([(40, 85), (420, 600)], fill=CARD_BG, outline=BORDER_COLOR, width=1)
    draw.text((60, 105), "BURN-IN TIMELINE CHECKPOINTS", fill=TEXT_MAIN, font=f_h3)

    draw_chip_icon(draw, 230, 210, width=140, height=110, label="DIE 042")

    # Timeline vertical track
    draw.line([(230, 280), (230, 550)], fill=BLUE_PRIMARY, width=3)
    checkpoints = [
        ("0h Checkpoint", "Baseline ATE Test", 320, PASS_BG, PASS_TEXT),
        ("24h Checkpoint", "Early Telemetry Window", 390, BLUE_LIGHT_BG, BLUE_PRIMARY),
        ("96h Checkpoint", "Intermediate Verification", 460, CARD_HEADER_BG, TEXT_MUTED),
        ("168h Checkpoint", "Final Qualification Limit", 530, CARD_HEADER_BG, TEXT_MUTED),
    ]
    for label, desc, cy, bg, tc in checkpoints:
        draw.ellipse([(222, cy - 8), (238, cy + 8)], fill=CARD_BG, outline=BLUE_PRIMARY, width=2)
        draw.ellipse([(226, cy - 4), (234, cy + 4)], fill=BLUE_PRIMARY)
        draw.text((70, cy - 10), label, fill=tc, font=f_bold)
        draw.text((255, cy - 10), desc, fill=TEXT_MUTED, font=f_small)

    # Right Panel: Telemetry Streams
    draw.rectangle([(440, 85), (1160, 600)], fill=CARD_BG, outline=BORDER_COLOR, width=1)
    draw.text((470, 105), "PARAMETRIC TELEMETRY CHANNELS (0h → 24h)", fill=TEXT_MAIN, font=f_h3)

    # 3 Channels Plot
    channels = [
        ("Iddq (Quiescent Current)", "Nominal baseline: 12.4 mA", 160, [(470, 220), (620, 218), (800, 222), (1050, 219)], PASS_TEXT),
        ("Leakage Current", "Nominal baseline: 8.1 uA", 300, [(470, 360), (620, 358), (800, 361), (1050, 359)], PASS_TEXT),
        ("Tpd (Propagation Delay)", "Nominal baseline: 41.2 ns", 440, [(470, 500), (620, 498), (800, 502), (1050, 499)], PASS_TEXT),
    ]
    for name, stat, y_top, pts, col in channels:
        draw.rectangle([(470, y_top), (1130, y_top + 110)], fill=BG_COLOR, outline=BORDER_COLOR, width=1)
        draw.text((485, y_top + 10), name, fill=TEXT_MAIN, font=f_bold)
        draw.text((850, y_top + 10), stat, fill=TEXT_MUTED, font=f_small)

        # Draw plot line
        for i in range(len(pts) - 1):
            draw.line([pts[i], pts[i + 1]], fill=col, width=2)
            draw.ellipse([(pts[i][0] - 4, pts[i][1] - 4), (pts[i][0] + 4, pts[i][1] + 4)], fill=col)
        draw.ellipse([(pts[-1][0] - 4, pts[-1][1] - 4), (pts[-1][0] + 4, pts[-1][1] + 4)], fill=col)

    return img


def render_scene_3():
    """Scene 3: Something Changes — Early Drift."""
    img, draw = create_base_canvas()
    draw_top_header(draw, 3, "EARLY DRIFT DETECTION", "Subtle Parametric Shift Uncovered Post 24h Checkpoint")

    # Graph Card
    draw.rectangle([(40, 85), (1160, 600)], fill=CARD_BG, outline=BORDER_COLOR, width=1)

    draw_pill(draw, 60, 105, 240, 135, "EARLY DRIFT DETECTED", WARN_BG, WARN_TEXT, WARN_BORDER)
    draw.text((260, 110), "Component passes static ATE limits at 24h, but shows accelerating degradation.", fill=TEXT_MAIN, font=f_body)

    # Plot Canvas
    px1, py1, px2, py2 = 80, 160, 1120, 560
    draw.rectangle([(px1, py1), (px2, py2)], fill=BG_COLOR, outline=BORDER_COLOR, width=1)

    # Axes & Grid
    for x_val, label in [(150, "0h"), (400, "24h (Observed Window)"), (750, "96h"), (1050, "168h")]:
        draw.line([(x_val, py1), (x_val, py2)], fill=BORDER_COLOR, width=1)
        draw.text((x_val - 15, py2 + 10), label, fill=TEXT_MUTED, font=f_bold)

    # Horizontal Static Limit Line
    draw.line([(px1, py1 + 60), (px2, py1 + 60)], fill=REJECT_TEXT, width=1)
    draw.text((px1 + 10, py1 + 40), "Static Upper ATE Limit (Traditional Screening)", fill=REJECT_TEXT, font=f_small)

    # Normal Die Trajectory (Flat Blue Line)
    normal_pts = [(150, py2 - 80), (400, py2 - 85), (750, py2 - 82), (1050, py2 - 84)]
    for i in range(len(normal_pts) - 1):
        draw.line([normal_pts[i], normal_pts[i + 1]], fill=BLUE_PRIMARY, width=2)
    draw.text((1060, py2 - 90), "Normal Dies", fill=BLUE_PRIMARY, font=f_bold)

    # Drifting Die Trajectory (Observed up to 24h, then subtle amber upward drift)
    drift_pts = [(150, py2 - 80), (400, py2 - 110), (750, py1 + 160), (1050, py1 + 80)]

    # 0h to 24h solid
    draw.line([drift_pts[0], drift_pts[1]], fill=WARN_TEXT, width=3)

    # Post 24h drift highlighted line
    draw.line([drift_pts[1], drift_pts[2]], fill=WARN_TEXT, width=3)
    draw.line([drift_pts[2], drift_pts[3]], fill=WARN_TEXT, width=3)

    # Highlight point at 24h
    draw.ellipse([(400 - 8, py2 - 110 - 8), (400 + 8, py2 - 110 + 8)], fill=WARN_BG, outline=WARN_TEXT, width=2)
    draw.text((415, py2 - 135), "Subtle 24h Shift (+32mV Vth)", fill=WARN_TEXT, font=f_bold)

    return img


def render_scene_4():
    """Scene 4: Module A — Dynamic Outlier Detection."""
    img, draw = create_base_canvas()
    draw_top_header(draw, 4, "MODULE A — DYNAMIC OUTLIER DETECTION", "Population-Relative Screening Identifies Off-Trend Components")

    # Main Card
    draw.rectangle([(40, 85), (1160, 600)], fill=CARD_BG, outline=BORDER_COLOR, width=1)

    # Header & Subtitle
    draw.text((60, 105), "POPULATION FEATURE PLANE (LOT L8402)", fill=TEXT_MAIN, font=f_h3)
    draw.text((60, 130), "Most components behave similarly → Component DIE 042 is a lot-relative outlier.", fill=TEXT_MUTED, font=f_small)

    # Scatter Plot Canvas
    sx1, sy1, sx2, sy2 = 60, 160, 720, 570
    draw.rectangle([(sx1, sy1), (sx2, sy2)], fill=BG_COLOR, outline=BORDER_COLOR, width=1)

    # Normal Cluster Ellipse / Circle
    draw.ellipse([(180, 260), (480, 480)], fill=BLUE_LIGHT_BG, outline=BLUE_BORDER, width=2)
    draw.text((260, 275), "Nominal Lot Population (98%)", fill=BLUE_PRIMARY, font=f_bold)

    # Normal dots inside cluster
    normal_dots = [
        (220, 320), (250, 360), (290, 310), (330, 380), (370, 340), (410, 390), (440, 330),
        (240, 410), (280, 430), (320, 450), (360, 420), (400, 440), (300, 350), (350, 320)
    ]
    for dx, dy in normal_dots:
        draw.ellipse([(dx - 6, dy - 6), (dx + 6, dy + 6)], fill=BLUE_PRIMARY, outline=CARD_BG, width=1)

    # Outlier Dot (DIE 042)
    ox, oy = 610, 230
    draw.ellipse([(ox - 20, oy - 20), (ox + 20, oy + 20)], fill=REJECT_BG, outline=REJECT_TEXT, width=2)
    draw.ellipse([(ox - 8, oy - 8), (ox + 8, oy + 8)], fill=REJECT_TEXT)
    draw.text((ox - 35, oy + 25), "DIE 042 (Outlier)", fill=REJECT_TEXT, font=f_bold)

    # Right Panel: Algorithm Indicators
    rx1, ry1, rx2, ry2 = 750, 160, 1140, 570
    draw.rectangle([(rx1, ry1), (rx2, ry2)], fill=CARD_HEADER_BG, outline=BORDER_COLOR, width=1)
    draw.text((rx1 + 20, ry1 + 20), "OUTLIER SCREENING ENGINES", fill=TEXT_MAIN, font=f_h3)

    algos = [
        ("MAD (Part Average Testing)", "Z-Score = 5.54 (Threshold >= 3.0)", WARN_BG, WARN_TEXT, WARN_BORDER),
        ("COPOD (Tail Probability)", "Score = 8.16 (Extreme Tail Risk)", REJECT_BG, REJECT_TEXT, REJECT_BORDER),
        ("ISOLATION FOREST", "Isolation Score = 0.62 (Anomaly)", REJECT_BG, REJECT_TEXT, REJECT_BORDER),
    ]

    ay = ry1 + 60
    for name, score, bg, tc, bc in algos:
        draw.rectangle([(rx1 + 15, ay), (rx2 - 15, ay + 110)], fill=CARD_BG, outline=BORDER_COLOR, width=1)
        draw.text((rx1 + 30, ay + 15), name, fill=TEXT_MAIN, font=f_h3)
        draw_pill(draw, rx1 + 30, ay + 50, rx2 - 30, ay + 90, score, bg, tc, bc)
        ay += 130

    return img


def render_scene_5():
    """Scene 5: Module B — Time-Series Drift."""
    img, draw = create_base_canvas()
    draw_top_header(draw, 5, "MODULE B — TIME-SERIES DRIFT PREDICTOR", "Extrapolating 0h + 24h Observations to 168h Trajectory")

    # Main Card
    draw.rectangle([(40, 85), (1160, 600)], fill=CARD_BG, outline=BORDER_COLOR, width=1)

    draw_pill(draw, 60, 105, 240, 135, "FUTURE DRIFT PREDICTION", CYAN_LIGHT_BG, CYAN_TEXT, CYAN_BORDER)
    draw.text((260, 110), "GPR model projects 24h observed drift through 168h burn-in horizon.", fill=TEXT_MAIN, font=f_body)

    # Trajectory Canvas
    px1, py1, px2, py2 = 80, 160, 1120, 560
    draw.rectangle([(px1, py1), (px2, py2)], fill=BG_COLOR, outline=BORDER_COLOR, width=1)

    # Checkpoint Grid Lines
    x_0h = px1 + 100
    x_24h = px1 + 350
    x_96h = px1 + 700
    x_168h = px1 + 980

    for x_val, label in [(x_0h, "0h Baseline"), (x_24h, "24h (Observed End)"), (x_96h, "96h Projected"), (x_168h, "168h Horizon")]:
        draw.line([(x_val, py1), (x_val, py2)], fill=BORDER_COLOR, width=1)
        draw.text((x_val - 35, py2 + 10), label, fill=TEXT_MUTED, font=f_bold)

    # Safety Slope Limit Line
    safety_y = py1 + 100
    draw.line([(px1, safety_y), (px2, safety_y)], fill=REJECT_TEXT, width=2)
    draw.text((px1 + 15, safety_y - 25), "CRITICAL SAFETY SLOPE THRESHOLD", fill=REJECT_TEXT, font=f_bold)

    # Solid Line: Observed (0h to 24h)
    obs_p1 = (x_0h, py2 - 80)
    obs_p2 = (x_24h, py2 - 130)
    draw.line([obs_p1, obs_p2], fill=BLUE_PRIMARY, width=4)
    draw.ellipse([(obs_p1[0] - 6, obs_p1[1] - 6), (obs_p1[0] + 6, obs_p1[1] + 6)], fill=BLUE_PRIMARY)
    draw.ellipse([(obs_p2[0] - 6, obs_p2[1] - 6), (obs_p2[0] + 6, obs_p2[1] + 6)], fill=BLUE_PRIMARY)
    draw.text((obs_p1[0] + 10, obs_p1[1] + 15), "Observed (0h → 24h)", fill=BLUE_PRIMARY, font=f_bold)

    # Dashed Line: Projected (24h to 168h crossing threshold)
    proj_p3 = (x_96h, py1 + 180)
    proj_p4 = (x_168h, py1 + 60)  # Breaches threshold

    # Simulate dashed line for projection
    dash_pts = []
    steps = 40
    for s in range(steps + 1):
        t = s / steps
        if t <= 0.5:
            # 24h to 96h
            sub_t = t / 0.5
            x = obs_p2[0] + sub_t * (proj_p3[0] - obs_p2[0])
            y = obs_p2[1] + sub_t * (proj_p3[1] - obs_p2[1])
        else:
            # 96h to 168h
            sub_t = (t - 0.5) / 0.5
            x = proj_p3[0] + sub_t * (proj_p4[0] - proj_p3[0])
            y = proj_p3[1] + sub_t * (proj_p4[1] - proj_p3[1])
        dash_pts.append((x, y))

    for i in range(0, len(dash_pts) - 1, 2):
        draw.line([dash_pts[i], dash_pts[i + 1]], fill=WARN_TEXT, width=3)

    # Threshold Breach Point Highlight
    breach_x = x_96h + 120
    breach_y = safety_y
    draw.ellipse([(breach_x - 12, breach_y - 12), (breach_x + 12, breach_y + 12)], fill=REJECT_BG, outline=REJECT_TEXT, width=2)
    draw.text((breach_x + 20, breach_y - 10), "SAFETY SLOPE BREACH AT 112h", fill=REJECT_TEXT, font=f_bold)

    return img


def render_scene_6():
    """Scene 6: Reliability Check."""
    img, draw = create_base_canvas()
    draw_top_header(draw, 6, "PHYSICS & RELIABILITY CONSISTENCY GATE", "Verifying Parametric Drift Against Physical Failure Mechanisms")

    # Main Card
    draw.rectangle([(40, 85), (1160, 600)], fill=CARD_BG, outline=BORDER_COLOR, width=1)

    draw.text((60, 105), "PHYSICAL RELIABILITY EVIDENCE MARKERS", fill=TEXT_MAIN, font=f_h3)
    draw.text((60, 130), "Drift evidence is validated against physical degradation bounds.", fill=TEXT_MUTED, font=f_small)

    # 4 Clean Evidence Box Cards
    evidences = [
        ("BTI SHIFT", "Bias Temperature Instability", "dVth = +32.0 mV", "PHYSICS CONSISTENT", PASS_BG, PASS_TEXT, PASS_BORDER),
        ("TIMING DEGRADATION", "Propagation Delay Shift", "dTpd = +4.2 ns", "BOUND EXCEEDED", WARN_BG, WARN_TEXT, WARN_BORDER),
        ("THERMAL ACCELERATION", "Arrhenius Acceleration", "Ea = 0.75 eV Validated", "PHYSICS CONSISTENT", PASS_BG, PASS_TEXT, PASS_BORDER),
        ("JUNCTION LEAKAGE", "Dielectric / Junction Drift", "Ileak = 1.29x Baseline", "ELEVATED DRIFT", REJECT_BG, REJECT_TEXT, REJECT_BORDER),
    ]

    boxes = [
        (60, 170, 580, 360),
        (620, 170, 1140, 360),
        (60, 380, 580, 570),
        (620, 380, 1140, 570),
    ]

    for (title, sub, val, status, bg, tc, bc), (bx1, by1, bx2, by2) in zip(evidences, boxes):
        draw.rectangle([(bx1, by1), (bx2, by2)], fill=CARD_HEADER_BG, outline=BORDER_COLOR, width=1)
        draw.text((bx1 + 20, by1 + 20), title, fill=TEXT_MAIN, font=f_h3)
        draw.text((bx1 + 20, by1 + 45), sub, fill=TEXT_MUTED, font=f_small)
        draw.text((bx1 + 20, by1 + 80), val, fill=TEXT_MAIN, font=f_h2)
        draw_pill(draw, bx1 + 20, by1 + 125, bx2 - 20, by1 + 165, status, bg, tc, bc)

    return img


def render_scene_7():
    """Scene 7: Screening Decision."""
    img, draw = create_base_canvas()
    draw_top_header(draw, 7, "QUALIFICATION SCREENING DECISION", "Synthesizing Multilayer Evidence into Final Disposition")

    # Main Card
    draw.rectangle([(40, 85), (1160, 600)], fill=CARD_BG, outline=BORDER_COLOR, width=1)

    draw.text((60, 105), "QUALIFICATION DECISION PATHWAYS", fill=TEXT_MAIN, font=f_h3)
    draw.text((60, 130), "Governed XGBoost decision model (Threshold theta* = 0.20) assigns final disposition.", fill=TEXT_MUTED, font=f_small)

    # 3 Outcome Cards
    outcomes = [
        ("PASS", "Evidence within nominal operating region", "P(Fail) < 0.20", PASS_BG, PASS_TEXT, PASS_BORDER, 60, 170, 400, 500),
        ("MONITOR", "Elevated risk requiring re-test / 96h check", "0.20 <= P(Fail) < 0.65", WARN_BG, WARN_TEXT, WARN_BORDER, 440, 170, 760, 500),
        ("REJECT", "Threshold breach — early latent defect scrap", "P(Fail) >= 0.65 or Safety Breach", REJECT_BG, REJECT_TEXT, REJECT_BORDER, 800, 170, 1120, 500),
    ]

    for title, desc, cond, bg, tc, bc, ox1, oy1, ox2, oy2 in outcomes:
        is_selected = (title == "REJECT")
        card_fill = bg if is_selected else CARD_HEADER_BG
        card_border = tc if is_selected else BORDER_COLOR
        draw.rectangle([(ox1, oy1), (ox2, oy2)], fill=card_fill, outline=card_border, width=2 if is_selected else 1)

        draw_pill(draw, ox1 + 20, oy1 + 30, ox2 - 20, oy1 + 80, title, bg, tc, bc)
        draw.text((ox1 + 20, oy1 + 110), desc, fill=TEXT_MAIN if is_selected else TEXT_MUTED, font=f_body)
        draw.text((ox1 + 20, oy1 + 200), cond, fill=tc if is_selected else TEXT_MUTED, font=f_bold)

        if is_selected:
            draw_pill(draw, ox1 + 20, oy2 - 60, ox2 - 20, oy2 - 20, "DIE 042 → REJECTED", REJECT_BG, REJECT_TEXT, REJECT_BORDER)

    # Bottom Banner
    draw.rectangle([(60, 520), (1120, 570)], fill=REJECT_BG, outline=REJECT_BORDER, width=1)
    draw.text((80, 535), "RESULT FOR DIE 042: REJECTED (P(Fail) = 0.9969 >= 0.20 Threshold Breach)", fill=REJECT_TEXT, font=f_bold)

    return img


def render_scene_8():
    """Scene 8: Final Message & Loop."""
    img, draw = create_base_canvas()

    # Center Hero Box
    draw.rectangle([(100, 100), (1100, 550)], fill=CARD_BG, outline=BORDER_DARK, width=2)

    # Header Badge
    draw_pill(draw, 450, 140, 750, 175, "PREDICTA • SIH PS-170", BLUE_LIGHT_BG, BLUE_PRIMARY, BLUE_BORDER)

    # Large Tagline
    draw.text((310, 210), "FIND THE PROBLEM EARLIER", fill=TEXT_MAIN, font=f_h1)

    # Subtitle
    draw.text((380, 270), "Burn-in telemetry  →  drift  →  screening", fill=TEXT_MUTED, font=f_h2)

    # 3 Summary Pills
    flow_steps = [
        ("1. TELEMETRY", "24h ATE Parametric Streams", 180),
        ("2. DRIFT PREDICTION", "Module A Outlier + Module B GPR", 480),
        ("3. SCREENING", "Latent Defect Screened Early", 780),
    ]

    for title, sub, x_pos in flow_steps:
        draw.rectangle([(x_pos, 330), (x_pos + 240, 420)], fill=CYAN_LIGHT_BG, outline=CYAN_BORDER, width=1)
        draw.text((x_pos + 15, 350), title, fill=CYAN_TEXT, font=f_bold)
        draw.text((x_pos + 15, 380), sub, fill=TEXT_MAIN, font=f_small)

    # Footer
    draw.text((345, 485), "Governed Semiconductor Reliability Engine • Zero Unreachable Failure", fill=TEXT_MUTED, font=f_small)

    return img


# -------------------------------------------------------------------------
# MAIN GENERATOR
# -------------------------------------------------------------------------

def main():
    os.makedirs("docs/assets", exist_ok=True)
    os.makedirs(PREVIEW_DIR, exist_ok=True)

    scenes = [
        (render_scene_1(), 2500),   # Scene 1: Intro (2.5s)
        (render_scene_2(), 2500),   # Scene 2: Burn-in (2.5s)
        (render_scene_3(), 2500),   # Scene 3: Early Drift (2.5s)
        (render_scene_4(), 2500),   # Scene 4: Module A (2.5s)
        (render_scene_5(), 2500),   # Scene 5: Module B (2.5s)
        (render_scene_6(), 2500),   # Scene 6: Reliability Check (2.5s)
        (render_scene_7(), 2500),   # Scene 7: Screening Decision (2.5s)
        (render_scene_8(), 2500),   # Scene 8: Final Message (2.5s)
    ]

    frames = []
    durations = []

    for i, (frame_img, duration) in enumerate(scenes, 1):
        # Save preview PNG for visual validation
        preview_path = os.path.join(PREVIEW_DIR, f"scene_{i}.png")
        frame_img.save(preview_path)
        frames.append(frame_img)
        durations.append(duration)
        print(f"[SUCCESS] Rendered Scene {i}/8 -> {preview_path}")

    # Save animated GIF
    frames[0].save(
        OUTPUT_GIF,
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        optimize=True,
    )

    size_mb = os.path.getsize(OUTPUT_GIF) / (1024 * 1024)
    print(f"\n[SUCCESS] Generated {OUTPUT_GIF}")
    print(f"Size: {size_mb:.2f} MB | Frames: {len(frames)} | Dimensions: {WIDTH}x{HEIGHT}")


if __name__ == "__main__":
    main()
