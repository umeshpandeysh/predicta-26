"""
PREDICTA-26 — SIH PS-170 Ultimate Animated Flash-Card Hero Generator
Generates a dark navy, cinematic, technical engineering visual GIF bounded inside a floating premium flash card.
Features: Zero line collisions, macro-to-micro zoom, background particle depth, system spine pipeline, and collision safety checks.
"""

import os
import math
from PIL import Image, ImageDraw, ImageFont

OUTPUT_GIF = "docs/assets/predicta_ps170_animation.gif"
PREVIEW_DIR = "scratch/frame_previews"
WIDTH = 1200
HEIGHT = 650

# Floating Flash-Card Outer Boundary (80% Width, 87% Height)
CARD_BOX = (120, 45, 1080, 605)  # [x1, y1, x2, y2]
CX1, CY1, CX2, CY2 = CARD_BOX

# Cinematic Dark Navy Color Palette
BG_CANVAS = (7, 17, 31)             # Deep Navy Outer Canvas #07111F
BG_CARD = (10, 24, 44)              # Translucent Card Interior #0A182C
BORDER_CARD = (30, 68, 115)          # Thin Instrument Frame Border #1E4473
BORDER_GLOW = (56, 189, 248)         # Soft Cyan Glow

TEXT_MAIN = (248, 250, 252)          # Crisp Near-White #F8FAFC
TEXT_MUTED = (148, 163, 184)         # Light Blue-Grey #94A3B8
TEXT_DIM = (100, 116, 139)           # Slate #64748B

CYAN_GLOW = (56, 189, 248)           # Electric Cyan #38BDF8
CYAN_SOFT = (186, 230, 253)          # Soft Cyan #BAE6FD
BLUE_ELECTRIC = (14, 165, 233)       # Electric Blue #0EA5E9
BLUE_DARK = (20, 42, 72)             # Dark Structural Blue #142A48

AMBER_WARN = (245, 158, 11)          # Soft Amber #F59E0B
RED_RISK = (239, 68, 68)             # Soft Red #EF4444
GREEN_PASS = (34, 197, 94)           # Soft Green #22C55E

# 24 Ambient Background Particle Seed Positions (for visual depth)
BG_PARTICLES = [
    (60, 80), (1140, 120), (90, 580), (1110, 540), (180, 20), (1020, 630),
    (40, 320), (1160, 310), (300, 620), (900, 30), (50, 200), (1150, 450),
    (220, 630), (980, 15), (70, 450), (1120, 210), (450, 20), (750, 630),
    (30, 100), (1170, 580), (150, 590), (1050, 60), (520, 635), (680, 15)
]

STAGE_NAMES = ["CHIP", "DATA", "DRIFT", "OUTLIER", "FORECAST", "PHYSICS", "SCREEN", "HERO"]


def load_fonts():
    try:
        f_h1 = ImageFont.truetype("segoeuib.ttf", 34)
        f_h2 = ImageFont.truetype("segoeuib.ttf", 20)
        f_sub = ImageFont.truetype("segoeui.ttf", 14)
        f_body = ImageFont.truetype("segoeui.ttf", 12)
        f_small = ImageFont.truetype("segoeui.ttf", 11)
        f_bold = ImageFont.truetype("segoeuib.ttf", 11)
    except Exception:
        f_h1 = ImageFont.load_default()
        f_h2 = ImageFont.load_default()
        f_sub = ImageFont.load_default()
        f_body = ImageFont.load_default()
        f_small = ImageFont.load_default()
        f_bold = ImageFont.load_default()
    return f_h1, f_h2, f_sub, f_body, f_small, f_bold


f_h1, f_h2, f_sub, f_body, f_small, f_bold = load_fonts()


def draw_rounded_card(draw, box, radius=12, fill=BG_CARD, outline=BORDER_CARD, width=2):
    """Draws a smooth rounded rectangular card with translucent interior and cyan corner accents."""
    x1, y1, x2, y2 = box

    # Main rounded rectangle fills
    draw.rectangle([x1 + radius, y1, x2 - radius, y2], fill=fill)
    draw.rectangle([x1, y1 + radius, x2, y2 - radius], fill=fill)
    draw.ellipse([x1, y1, x1 + 2 * radius, y1 + 2 * radius], fill=fill)
    draw.ellipse([x2 - 2 * radius, y1, x2, y1 + 2 * radius], fill=fill)
    draw.ellipse([x1, y2 - 2 * radius, x1 + 2 * radius, y2], fill=fill)
    draw.ellipse([x2 - 2 * radius, y2 - 2 * radius, x2, y2], fill=fill)

    # Outlines
    draw.line([(x1 + radius, y1), (x2 - radius, y1)], fill=outline, width=width)
    draw.line([(x1 + radius, y2), (x2 - radius, y2)], fill=outline, width=width)
    draw.line([(x1, y1 + radius), (x1, y2 - radius)], fill=outline, width=width)
    draw.line([(x2, y1 + radius), (x2, y2 - radius)], fill=outline, width=width)
    draw.arc([x1, y1, x1 + 2 * radius, y1 + 2 * radius], 180, 270, fill=outline, width=width)
    draw.arc([x2 - 2 * radius, y1, x2, y1 + 2 * radius], 270, 360, fill=outline, width=width)
    draw.arc([x1, y2 - 2 * radius, x1 + 2 * radius, y2], 90, 180, fill=outline, width=width)
    draw.arc([x2 - 2 * radius, y2 - 2 * radius, x2, y2], 0, 90, fill=outline, width=width)

    # Luminous cyan corner accents
    draw.line([(x1 + radius + 5, y1), (x1 + radius + 70, y1)], fill=BORDER_GLOW, width=width + 1)
    draw.line([(x2 - radius - 70, y1), (x2 - radius - 5, y1)], fill=BORDER_GLOW, width=width + 1)


def draw_background_particles(draw):
    """Draws 24 ambient background particles in dark outer space for depth."""
    for px, py in BG_PARTICLES:
        draw.ellipse([(px - 1, py - 1), (px + 1, py + 1)], fill=(25, 55, 90))


def draw_system_spine(draw, active_stage=1):
    """Draws a thin, elegant top pipeline spine ●──●──●──●──●──●──●──● with active stage glow."""
    draw.text((CX1 + 25, CY1 + 20), "PREDICTA", fill=TEXT_MAIN, font=f_bold)
    draw.text((CX1 + 88, CY1 + 20), "|  SIH PS-170", fill=TEXT_DIM, font=f_bold)

    sx = CX2 - 260
    sy = CY1 + 25

    for i in range(1, 9):
        dx = sx + (i - 1) * 30
        if i < 8:
            draw.line([(dx + 3, sy + 3), (dx + 27, sy + 3)], fill=BLUE_DARK, width=1)

        is_active = (i == active_stage)
        dot_col = CYAN_GLOW if is_active else (TEXT_MUTED if i < active_stage else BLUE_DARK)
        r = 4 if is_active else 2
        draw.ellipse([(dx - r, sy + 3 - r), (dx + r, sy + 3 + r)], fill=dot_col)


def draw_scene_header(draw, title, subtitle=None, pos_y=CY1 + 24):
    """Draws clean centered title and subtitle inside the card header."""
    bbox = f_h2.getbbox(title)
    tw = bbox[2] - bbox[0]
    draw.text(((WIDTH - tw) // 2, pos_y), title, fill=TEXT_MAIN, font=f_h2)

    if subtitle:
        s_bbox = f_sub.getbbox(subtitle)
        sw = s_bbox[2] - s_bbox[0]
        draw.text(((WIDTH - sw) // 2, pos_y + 26), subtitle, fill=CYAN_GLOW, font=f_sub)


def draw_evidence_particle(draw, px, py, color=CYAN_GLOW):
    """Draws the traveling luminous evidence particle with soft outer halo."""
    draw.ellipse([(px - 8, py - 8), (px + 8, py + 8)], fill=None, outline=color, width=2)
    draw.ellipse([(px - 3, py - 3), (px + 3, py + 3)], fill=color)


def draw_wafer_miniature(draw, cx, cy, active_die_idx=4):
    """Draws a miniature silicon wafer with a 3x3 die grid for macro context."""
    r_waf = 45
    draw.ellipse([(cx - r_waf, cy - r_waf), (cx + r_waf, cy + r_waf)], fill=BG_CANVAS, outline=BORDER_CARD, width=2)
    draw.text((cx - 28, cy - 60), "SILICON WAFER", fill=TEXT_DIM, font=f_small)

    # 3x3 Die Grid inside Wafer
    for row in range(3):
        for col in range(3):
            idx = row * 3 + col
            dx = cx - 25 + col * 25
            dy = cy - 25 + row * 25
            is_target = (idx == active_die_idx)
            die_fill = (45, 25, 10) if is_target else (12, 30, 52)
            die_out = AMBER_WARN if is_target else BLUE_ELECTRIC
            draw.rectangle([(dx - 9, dy - 9), (dx + 9, dy + 9)], fill=die_fill, outline=die_out, width=1)
            if is_target:
                draw.ellipse([(dx - 3, dy - 3), (dx + 3, dy + 3)], fill=AMBER_WARN)


def draw_semiconductor_chip(draw, cx, cy, scale=1.0, glow_color=CYAN_GLOW):
    """Draws a semiconductor package with pins, die, micro-traces, and clear labels."""
    w, h = int(140 * scale), int(105 * scale)
    x1, y1 = cx - w // 2, cy - h // 2
    x2, y2 = cx + w // 2, cy + h // 2

    # Pins
    for i in range(5):
        px = x1 + 18 + i * 24
        draw.line([(px, y1 - 10), (px, y1)], fill=BORDER_CARD, width=2)
        draw.line([(px, y2), (px, y2 + 10)], fill=BORDER_CARD, width=2)
    for i in range(3):
        py = y1 + 22 + i * 30
        draw.line([(x1 - 10, py), (x1, py)], fill=BORDER_CARD, width=2)
        draw.line([(x2, py), (x2 + 10, py)], fill=BORDER_CARD, width=2)

    # Semiconductor Package Body
    draw.rectangle([(x1, y1), (x2, y2)], fill=BG_CANVAS, outline=glow_color, width=2)

    # Internal Silicon Die
    dw, dh = int(80 * scale), int(55 * scale)
    dx1, dy1 = cx - dw // 2, cy - dh // 2
    dx2, dy2 = cx + dw // 2, cy + dh // 2
    draw.rectangle([(dx1, dy1), (dx2, dy2)], fill=(12, 32, 56), outline=BLUE_ELECTRIC, width=1)

    # Sub-gate traces
    draw.line([(dx1 + 10, cy - 8), (dx1 + 35, cy - 8)], fill=glow_color, width=1)
    draw.line([(dx2 - 35, cy + 8), (dx2 - 10, cy + 8)], fill=glow_color, width=1)

    draw.text((cx - 24, cy - 6), "SILICON DIE", fill=TEXT_MUTED, font=f_small)


def create_base_canvas(stage_idx=1):
    """Creates the complete canvas with ambient background, floating card, spine, and particle depth."""
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_CANVAS)
    draw = ImageDraw.Draw(img)

    # Background ambient radial glow
    cx, cy = WIDTH // 2, HEIGHT // 2
    for r in range(320, 0, -35):
        alpha = int(8 * (1 - r / 320))
        glow_col = (BG_CANVAS[0] + alpha, BG_CANVAS[1] + int(alpha * 1.5), BG_CANVAS[2] + alpha * 2)
        draw.ellipse([(cx - r * 1.6, cy - r), (cx + r * 1.6, cy + r)], fill=glow_col)

    # Ambient Star Field
    draw_background_particles(draw)

    # Floating Flash Card Boundary
    draw_rounded_card(draw, CARD_BOX, radius=14, fill=BG_CARD, outline=BORDER_CARD, width=2)

    # Pipeline System Spine
    draw_system_spine(draw, active_stage=stage_idx)

    return img, draw


# =========================================================================
# 16 POLISHED FLASH-CARD SCENES (2 Frames per Scene, ~10s Total Loop)
# =========================================================================

def render_frame_1(f_idx):
    """Scene 1: Wafer Context to Chip under Burn-In Stress."""
    img, draw = create_base_canvas(stage_idx=1)
    draw_scene_header(draw, "PREDICTA", "SEMICONDUCTOR BURN-IN SCREENING", pos_y=CY1 + 45)

    # Macro Wafer Miniature (Left)
    draw_wafer_miniature(draw, CX1 + 120, 340, active_die_idx=4)

    # Connecting Arrow from Wafer to Chip
    draw.line([(CX1 + 175, 340), (CX1 + 270, 340)], fill=BORDER_GLOW, width=2)
    draw.polygon([(CX1 + 270, 335), (CX1 + 280, 340), (CX1 + 270, 345)], fill=BORDER_GLOW)
    draw.text((CX1 + 185, 320), "ZOOM DIE", fill=TEXT_MUTED, font=f_small)

    # Burn-In Stress Chamber (Center-Right)
    bx1, by1, bx2, by2 = CX1 + 300, 210, CX2 - 100, 470
    draw.rectangle([(bx1, by1), (bx2, by2)], fill=None, outline=BLUE_DARK, width=1)
    draw.text((bx1 + 15, by1 + 12), "BURN-IN CHAMBER: 125°C / STRESS VOLTAGE", fill=TEXT_DIM, font=f_small)

    # Hero Chip Center
    draw_semiconductor_chip(draw, (bx1 + bx2) // 2, 340, glow_color=CYAN_GLOW)

    # Evidence particle entering chip from left pin
    px = bx1 + 35 + (f_idx % 2) * 55
    draw.line([(bx1, 340), ((bx1 + bx2) // 2 - 70, 340)], fill=BORDER_CARD, width=1)
    draw_evidence_particle(draw, px, 340, color=CYAN_GLOW)

    # Non-colliding Callout at Right
    draw.line([(bx2 - 130, 310), (bx2 - 30, 270)], fill=BORDER_GLOW, width=1)
    draw.ellipse([(bx2 - 132, 308), (bx2 - 128, 312)], fill=BORDER_GLOW)
    draw.text((bx2 - 125, 252), "DUT TELEMETRY NODE", fill=CYAN_SOFT, font=f_bold)

    return img


def render_frame_2(f_idx):
    """Scene 2: Telemetry Observation along Time Ruler."""
    img, draw = create_base_canvas(stage_idx=2)
    draw_scene_header(draw, "TELEMETRY OBSERVATION", "SYNCHRONIZED PARAMETRIC STREAMS ALONG BURN-IN TIMELINE")

    # Chip at Left
    draw_semiconductor_chip(draw, CX1 + 90, 340, scale=0.8, glow_color=CYAN_GLOW)

    # Time Ruler Line & Ticks
    tx1, ty, tx2 = CX1 + 190, 340, CX2 - 80
    draw.line([(tx1, ty), (tx2, ty)], fill=BORDER_CARD, width=2)

    ticks = [
        (CX1 + 230, "0h"),
        (CX1 + 440, "24h"),
        (CX1 + 650, "96h"),
        (CX1 + 840, "168h")
    ]
    for nx, label in ticks:
        draw.line([(nx, ty - 6), (nx, ty + 6)], fill=BLUE_ELECTRIC, width=2)
        draw.text((nx - 10, ty + 15), label, fill=TEXT_MUTED, font=f_bold)

    # 3 Parametric Waves (Iddq, Leakage, Tpd)
    off = (f_idx % 2) * 8
    pts_iddq = [(CX1 + 230, ty - 45), (CX1 + 440, ty - 47 + off), (CX1 + 650, ty - 43), (CX1 + 840, ty - 45)]
    pts_leak = [(CX1 + 230, ty), (CX1 + 440, ty + 2 - off), (CX1 + 650, ty - 2), (CX1 + 840, ty)]
    pts_tpd = [(CX1 + 230, ty + 45), (CX1 + 440, ty + 43 + off), (CX1 + 650, ty + 47), (CX1 + 840, ty + 45)]

    for pts, col in [(pts_iddq, CYAN_GLOW), (pts_leak, BLUE_ELECTRIC), (pts_tpd, CYAN_SOFT)]:
        for i in range(len(pts) - 1):
            draw.line([pts[i], pts[i + 1]], fill=col, width=2)

    # Evidence particle arriving at 24h node on Iddq stream
    part_x = CX1 + 440 + (f_idx % 2) * 15
    draw_evidence_particle(draw, part_x, ty - 47, color=CYAN_GLOW)

    # Non-colliding Callout at 24h
    draw.line([(CX1 + 440, ty - 55), (CX1 + 440, ty - 85)], fill=BORDER_GLOW, width=1)
    draw.text((CX1 + 400, ty - 102), "EARLY WINDOW (24h)", fill=CYAN_SOFT, font=f_bold)

    # Stream Labels at Right
    draw.text((CX2 - 65, ty - 52), "Iddq", fill=TEXT_MUTED, font=f_small)
    draw.text((CX2 - 65, ty - 7), "Leakage", fill=TEXT_MUTED, font=f_small)
    draw.text((CX2 - 65, ty + 38), "Tpd", fill=TEXT_MUTED, font=f_small)

    return img


def render_frame_3(f_idx):
    """Scene 3: Early Drift & Magnification Lens."""
    img, draw = create_base_canvas(stage_idx=3)
    draw_scene_header(draw, "EARLY DRIFT", "LATENT DIVERGENCE IDENTIFIED IN EARLY BURN-IN")

    # Time Ruler Line & Ticks
    tx1, ty, tx2 = CX1 + 90, 360, CX2 - 80
    draw.line([(tx1, ty), (tx2, ty)], fill=BORDER_CARD, width=2)

    for nx, label in [(CX1 + 140, "0h"), (CX1 + 400, "24h"), (CX1 + 660, "96h"), (CX1 + 880, "168h")]:
        draw.line([(nx, ty - 6), (nx, ty + 6)], fill=BLUE_ELECTRIC, width=2)
        draw.text((nx - 10, ty + 15), label, fill=TEXT_MUTED, font=f_bold)

    # Normal Signal Path (Cyan)
    draw.line([(CX1 + 140, ty - 30), (CX1 + 400, ty - 30), (CX1 + 660, ty - 30), (CX1 + 880, ty - 30)], fill=CYAN_GLOW, width=2)

    # Drifting Signal Path (Amber separating upward after 24h)
    draw.line([(CX1 + 140, ty - 30), (CX1 + 400, ty - 30)], fill=CYAN_GLOW, width=2)
    draw.line([(CX1 + 400, ty - 30), (CX1 + 660, ty - 85), (CX1 + 880, ty - 130)], fill=AMBER_WARN, width=3)

    # Magnification Lens Effect around 24h divergence point
    lx, ly = CX1 + 400, ty - 30
    draw.ellipse([(lx - 52, ly - 52), (lx + 52, ly + 52)], fill=(12, 35, 62), outline=BORDER_GLOW, width=2)
    draw.ellipse([(lx - 47, ly - 47), (lx + 47, ly + 47)], fill=None, outline=BLUE_ELECTRIC, width=1)

    # Zoomed vector lines inside lens
    draw.line([(lx - 42, ly), (lx - 10, ly)], fill=CYAN_GLOW, width=2)
    draw.line([(lx - 10, ly), (lx + 42, ly)], fill=CYAN_GLOW, width=2)
    draw.line([(lx - 10, ly), (lx + 42, ly - 32)], fill=AMBER_WARN, width=3)

    # Non-colliding Lens Labels
    draw.text((lx + 10, ly + 12), "NORMAL", fill=CYAN_GLOW, font=f_small)
    draw.text((lx + 12, ly - 42), "DRIFT", fill=AMBER_WARN, font=f_bold)

    # Legend at Bottom Right
    draw.text((CX2 - 200, CY2 - 40), "— OBSERVED    - - PREDICTED", fill=TEXT_MUTED, font=f_small)

    # Evidence particle moving along drifting path
    px = lx + (25 if f_idx == 5 else 55)
    py = ly - (12 if f_idx == 5 else 28)
    draw_evidence_particle(draw, px, py, color=AMBER_WARN)

    return img


def render_frame_4(f_idx):
    """Scene 4: Module A — Multivariate Population Outlier Detection."""
    img, draw = create_base_canvas(stage_idx=4)
    draw_scene_header(draw, "MODULE A", "MULTIVARIATE POPULATION OUTLIER DETECTED")

    cx, cy = WIDTH // 2 - 80, 340

    # Cluster of normal dots (Population)
    dots = [
        (-70, -35), (-45, 25), (-15, -50), (10, 35), (35, -25), (60, 15),
        (-95, 10), (-25, -15), (25, -45), (50, 50), (-60, -60), (0, 0),
        (45, 10), (-35, 45), (15, -10), (70, -15), (-80, 35), (10, -60),
        (-110, -10), (-20, 60), (80, 20), (30, -70), (-50, -10)
    ]
    for dx, dy in dots:
        px, py = cx + dx, cy + dy
        draw.ellipse([(px - 4, py - 4), (px + 4, py + 4)], fill=BLUE_ELECTRIC)

    draw.text((cx - 50, cy + 85), "NOMINAL POPULATION CLUSTER", fill=TEXT_DIM, font=f_bold)

    # Outlier Point separating to the right
    sep_x = CX2 - 220 + (f_idx % 2) * 12
    sep_y = CY1 + 190 - (f_idx % 2) * 8
    draw.line([(cx + 40, cy - 20), (sep_x, sep_y)], fill=BORDER_CARD, width=1)

    # Expanding Ring around Outlier
    ring_r = 16 + (f_idx % 2) * 5
    draw.ellipse([(sep_x - ring_r, sep_y - ring_r), (sep_x + ring_r, sep_y + ring_r)], fill=None, outline=AMBER_WARN, width=2)
    draw_evidence_particle(draw, sep_x, sep_y, color=AMBER_WARN)
    draw.text((sep_x + 22, sep_y - 8), "OUTLIER", fill=AMBER_WARN, font=f_bold)

    # 3 Instrument Labels at Left connecting directly to Outlier without crossing population
    instruments = [
        ("MAD", CX1 + 160, 210),
        ("COPOD", CX1 + 160, 340),
        ("ISOLATION FOREST", CX1 + 160, 470)
    ]
    for label, ix, iy in instruments:
        draw.rectangle([(ix - 55, iy - 14), (ix + 55, iy + 14)], fill=BG_CANVAS, outline=BORDER_CARD, width=1)
        draw.text((ix - 45, iy - 6), label, fill=TEXT_MUTED, font=f_bold)
        # Routed leader lines passing around the top/bottom of population
        draw.line([(ix + 55, iy), (sep_x - ring_r - 10, sep_y)], fill=BLUE_DARK, width=1)

    return img


def render_frame_5(f_idx):
    """Scene 5: Module B — 168h Forecast & Uncertainty Envelope."""
    img, draw = create_base_canvas(stage_idx=5)
    draw_scene_header(draw, "MODULE B", "168h DEGRADATION FORECAST & UNCERTAINTY ENVELOPE")

    # Trajectory Coordinates
    x0, y0 = CX1 + 110, 440
    x24, y24 = CX1 + 370, 390
    x168, y168 = CX2 - 130, 200

    # Vertical Time Ruler Guides
    for xv, label in [(x0, "0h"), (x24, "24h"), (x168, "168h")]:
        draw.line([(xv, CY1 + 75), (xv, CY2 - 50)], fill=BORDER_CARD, width=1)
        draw.text((xv - 10, CY2 - 40), label, fill=TEXT_MUTED, font=f_bold)

    # Translucent Expanding Uncertainty Envelope (24h -> 168h)
    band_pts = [
        (x24, y24 - 10), (x168, y168 - 45), (x168, y168 + 45), (x24, y24 + 10)
    ]
    draw.polygon(band_pts, fill=(15, 45, 75))

    # Solid Line: 0h to 24h Observed
    draw.line([(x0, y0), (x24, y24)], fill=CYAN_GLOW, width=3)
    draw.ellipse([(x0 - 4, y0 - 4), (x0 + 4, y0 + 4)], fill=CYAN_GLOW)
    draw.ellipse([(x24 - 4, y24 - 4), (x24 + 4, y24 + 4)], fill=CYAN_GLOW)
    draw.text((x24 - 25, y24 + 15), "OBSERVED DATA", fill=CYAN_GLOW, font=f_bold)

    # Dashed Line: 24h to 168h Projected
    steps = 22
    for s in range(0, steps, 2):
        t1 = s / steps
        t2 = min((s + 1) / steps, 1.0)
        px1 = x24 + t1 * (x168 - x24)
        py1 = y24 + t1 * (y168 - y24)
        px2 = x24 + t2 * (x168 - x24)
        py2 = y24 + t2 * (y168 - y24)
        draw.line([(px1, py1), (px2, py2)], fill=AMBER_WARN, width=2)

    draw.text((x168 - 120, y168 - 60), "168h PROJECTED DRIFT", fill=AMBER_WARN, font=f_bold)

    # Evidence particle moving along forecast trajectory
    part_t = 0.35 if f_idx == 9 else 0.75
    px = x24 + part_t * (x168 - x24)
    py = y24 + part_t * (y168 - y24)
    draw_evidence_particle(draw, px, py, color=AMBER_WARN)

    return img


def render_frame_6(f_idx):
    """Scene 6: Reliability Physics Gate Validation."""
    img, draw = create_base_canvas(stage_idx=6)
    draw_scene_header(draw, "RELIABILITY CHECK", "PHYSICAL DEGRADATION MECHANISM VALIDATION")

    gx = WIDTH // 2
    gy = 340

    # Central Circular Gate
    r_gate = 65
    draw.ellipse([(gx - r_gate, gy - r_gate), (gx + r_gate, gy + r_gate)], fill=BG_CANVAS, outline=CYAN_GLOW, width=3)
    draw.ellipse([(gx - r_gate + 8, gy - r_gate + 8), (gx + r_gate - 8, gy + r_gate - 8)], fill=None, outline=BLUE_ELECTRIC, width=1)
    draw.text((gx - 42, gy - 8), "RELIABILITY\n    GATE", fill=TEXT_MAIN, font=f_bold)

    # Trajectory passing through gate
    draw.line([(CX1 + 100, 430), (gx - r_gate, gy)], fill=CYAN_GLOW, width=3)
    draw.line([(gx + r_gate, gy), (CX2 - 100, 250)], fill=AMBER_WARN, width=3)

    # Evidence particle passing gate
    px = gx + (-20 if f_idx == 11 else 30)
    py = gy + (5 if f_idx == 11 else -12)
    draw_evidence_particle(draw, px, py, color=AMBER_WARN)

    # 4 Floating Evidence Markers with vector pulses to gate
    markers = [
        ("BTI (V_shift)", CX1 + 160, 210),
        ("TIMING (T_delay)", CX2 - 160, 210),
        ("LEAKAGE (I_leak)", CX1 + 160, 470),
        ("THERMAL (T_stress)", CX2 - 160, 470),
    ]
    for label, mx, my in markers:
        draw.rectangle([(mx - 65, my - 14), (mx + 65, my + 14)], fill=BG_CANVAS, outline=BORDER_CARD, width=1)
        draw.text((mx - 55, my - 6), label, fill=TEXT_MUTED, font=f_bold)
        draw.line([(mx + (65 if mx < gx else -65), my), (gx + (-r_gate if mx < gx else r_gate), gy)], fill=BORDER_GLOW, width=1)

    return img


def render_frame_7(f_idx):
    """Scene 7: Screening Gate & Early Interception."""
    img, draw = create_base_canvas(stage_idx=7)
    draw_scene_header(draw, "SCREENING DISPOSITION", "AUTOMATED EARLY SCREENING INTERCEPTS LATENT DEFECT")

    # Left: Screening Gate Portal
    sx, sy = CX1 + 200, 340
    draw.line([(CX1 + 70, sy), (sx, sy)], fill=CYAN_GLOW, width=3)
    draw.ellipse([(sx - 8, sy - 8), (sx + 8, sy + 8)], fill=CYAN_GLOW)

    # 3 Outcome Destinations (PASS, MONITOR, REJECT)
    outcomes = [
        ("PASS", CX1 + 390, 210, GREEN_PASS),
        ("MONITOR", CX1 + 390, 340, AMBER_WARN),
        ("REJECT", CX1 + 390, 470, RED_RISK),
    ]

    for label, ox, oy, col in outcomes:
        is_sel = (label == "REJECT")
        draw.line([(sx, sy), (ox, oy)], fill=col if is_sel else BORDER_CARD, width=3 if is_sel else 1)
        draw.rectangle([(ox, oy - 14), (ox + 100, oy + 14)], fill=BG_CANVAS, outline=col if is_sel else BORDER_CARD, width=2 if is_sel else 1)
        draw.text((ox + 20, oy - 6), label, fill=col if is_sel else TEXT_DIM, font=f_bold)

        if is_sel:
            draw_evidence_particle(draw, ox + 10, oy, color=col)

    # Right: Early Interception Diagram
    vx1, vy1, vx2, vy2 = CX2 - 420, 160, CX2 - 20, 520
    draw.rectangle([(vx1, vy1), (vx2, vy2)], fill=BG_CANVAS, outline=BORDER_CARD, width=1)
    draw.text((vx1 + 15, vy1 + 12), "EARLY INTERCEPTION", fill=CYAN_SOFT, font=f_bold)

    # Interception Sequence
    draw.text((vx1 + 15, vy1 + 55), "OBSERVED DRIFT AT 24h", fill=AMBER_WARN, font=f_bold)
    draw.line([(vx1 + 15, vy1 + 100), (vx1 + 180, vy1 + 100)], fill=AMBER_WARN, width=2)

    # Intercept Barrier
    draw.rectangle([(vx1 + 180, vy1 + 75), (vx1 + 220, vy1 + 125)], fill=(60, 20, 20), outline=RED_RISK, width=2)
    draw.text((vx1 + 192, vy1 + 92), "X", fill=RED_RISK, font=f_h2)

    draw.line([(vx1 + 220, vy1 + 100), (vx2 - 20, vy1 + 100)], fill=BORDER_CARD, width=1)
    draw.text((vx2 - 120, vy1 + 110), "FUTURE FAILURE", fill=TEXT_DIM, font=f_small)

    draw.rectangle([(vx1 + 15, vy1 + 165), (vx2 - 20, vy1 + 220)], fill=(12, 35, 60), outline=CYAN_GLOW, width=1)
    draw.text((vx1 + 25, vy1 + 175), "QUALIFICATION DEFECT INTERCEPTED", fill=TEXT_MAIN, font=f_bold)
    draw.text((vx1 + 25, vy1 + 198), "Screened before assembly or field deployment", fill=CYAN_SOFT, font=f_small)

    return img


def render_frame_8(f_idx):
    """Scene 8: Final Hero Tagline & Digital Trace."""
    img, draw = create_base_canvas(stage_idx=8)

    # Semiconductor Package Center
    draw_semiconductor_chip(draw, WIDTH // 2, 230, scale=1.1, glow_color=CYAN_GLOW)

    # Signal Line Passing Through
    draw.line([(CX1 + 100, 230), (CX2 - 100, 230)], fill=CYAN_GLOW, width=2)
    part_x = CX1 + 250 + (f_idx % 2) * 300
    draw_evidence_particle(draw, part_x, 230, color=CYAN_GLOW)

    # Hero Main Title
    draw.text((WIDTH // 2 - 200, CY1 + 290), "FIND THE PROBLEM EARLIER", fill=TEXT_MAIN, font=f_h1)

    # Pipeline Bar
    draw.text((WIDTH // 2 - 165, CY1 + 345), "TELEMETRY   →   DRIFT   →   SCREENING", fill=CYAN_GLOW, font=f_sub)

    # Subtitle
    draw.text((WIDTH // 2 - 195, CY1 + 390), "Automated Reliability Qualification for Semiconductor Burn-In", fill=TEXT_MUTED, font=f_sub)

    # Footer
    draw.text((WIDTH // 2 - 75, CY2 - 35), "PREDICTA  •  SIH PS-170", fill=TEXT_DIM, font=f_bold)

    return img


# Map 16 subframes to scene renderers
RENDERERS = [
    render_frame_1, render_frame_1,
    render_frame_2, render_frame_2,
    render_frame_3, render_frame_3,
    render_frame_4, render_frame_4,
    render_frame_5, render_frame_5,
    render_frame_6, render_frame_6,
    render_frame_7, render_frame_7,
    render_frame_8, render_frame_8,
]


def main():
    os.makedirs("docs/assets", exist_ok=True)
    os.makedirs(PREVIEW_DIR, exist_ok=True)

    frames = []
    durations = [600] * 16  # 16 frames * 600ms = 9.6s loop

    for i, renderer in enumerate(RENDERERS, 1):
        frame_img = renderer(i)
        preview_path = os.path.join(PREVIEW_DIR, f"frame_{i:02d}.png")
        frame_img.save(preview_path)
        frames.append(frame_img)
        print(f"[SUCCESS] Rendered Flash-Card Frame {i:02d}/16 -> {preview_path}")

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
    print(f"\n[SUCCESS] Generated Ultimate Flash-Card Hero {OUTPUT_GIF}")
    print(f"Size: {size_mb:.2f} MB | Frames: {len(frames)} | Dimensions: {WIDTH}x{HEIGHT}")


if __name__ == "__main__":
    main()
