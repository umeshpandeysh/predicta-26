"""
PREDICTA-26 — SIH PS-170 Premium Animated Flash-Card Hero Generator
Generates a dark navy, cinematic, technical engineering visual GIF bounded inside a floating premium flash card.
"""

import os
import math
from PIL import Image, ImageDraw, ImageFont

OUTPUT_GIF = "docs/assets/predicta_ps170_animation.gif"
PREVIEW_DIR = "scratch/frame_previews"
WIDTH = 1200
HEIGHT = 650

# Floating Flash-Card Outer Boundary (80% Width, 87% Height for Dark Space)
CARD_BOX = (130, 45, 1070, 605)  # [x1, y1, x2, y2]
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


def load_fonts():
    try:
        f_h1 = ImageFont.truetype("segoeuib.ttf", 32)
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
    """Draws a rounded rectangular card with smooth corners and cyan accent corners."""
    x1, y1, x2, y2 = box

    # Main rounded rectangle using polygon + arcs approximation
    # Upper-left
    draw.rectangle([x1 + radius, y1, x2 - radius, y2], fill=fill)
    draw.rectangle([x1, y1 + radius, x2, y2 - radius], fill=fill)
    draw.ellipse([x1, y1, x1 + 2 * radius, y1 + 2 * radius], fill=fill)
    draw.ellipse([x2 - 2 * radius, y1, x2, y1 + 2 * radius], fill=fill)
    draw.ellipse([x1, y2 - 2 * radius, x1 + 2 * radius, y2], fill=fill)
    draw.ellipse([x2 - 2 * radius, y2 - 2 * radius, x2, y2], fill=fill)

    # Outline
    draw.line([(x1 + radius, y1), (x2 - radius, y1)], fill=outline, width=width)
    draw.line([(x1 + radius, y2), (x2 - radius, y2)], fill=outline, width=width)
    draw.line([(x1, y1 + radius), (x1, y2 - radius)], fill=outline, width=width)
    draw.line([(x2, y1 + radius), (x2, y2 - radius)], fill=outline, width=width)
    draw.arc([x1, y1, x1 + 2 * radius, y1 + 2 * radius], 180, 270, fill=outline, width=width)
    draw.arc([x2 - 2 * radius, y1, x2, y1 + 2 * radius], 270, 360, fill=outline, width=width)
    draw.arc([x1, y2 - 2 * radius, x1 + 2 * radius, y2], 90, 180, fill=outline, width=width)
    draw.arc([x2 - 2 * radius, y2 - 2 * radius, x2, y2], 0, 90, fill=outline, width=width)

    # Luminous cyan corner accents
    draw.line([(x1 + radius + 5, y1), (x1 + radius + 65, y1)], fill=BORDER_GLOW, width=width + 1)
    draw.line([(x2 - radius - 65, y1), (x2 - radius - 5, y1)], fill=BORDER_GLOW, width=width + 1)


def create_base_canvas(stage_idx=1):
    """Creates the deep navy outer space canvas with floating card boundary & stage indicator."""
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_CANVAS)
    draw = ImageDraw.Draw(img)

    # Ambient radial background glow
    cx, cy = WIDTH // 2, HEIGHT // 2
    for r in range(320, 0, -35):
        alpha = int(8 * (1 - r / 320))
        glow_col = (BG_CANVAS[0] + alpha, BG_CANVAS[1] + int(alpha * 1.5), BG_CANVAS[2] + alpha * 2)
        draw.ellipse([(cx - r * 1.6, cy - r), (cx + r * 1.6, cy + r)], fill=glow_col)

    # Floating Premium Flash-Card Boundary
    draw_rounded_card(draw, CARD_BOX, radius=14, fill=BG_CARD, outline=BORDER_CARD, width=2)

    # Stage Progress Indicator in top-right corner of card
    # 8 subtle stage dots: ● ─ ● ─ ● ─ ● ─ ● ─ ● ─ ● ─ ●
    sx = CX2 - 165
    sy = CY1 + 25
    draw.text((CX1 + 25, sy - 4), "PREDICTA  |  SIH PS-170", fill=TEXT_DIM, font=f_bold)

    for i in range(1, 9):
        dx = sx + (i - 1) * 18
        if i < 8:
            draw.line([(dx + 3, sy + 3), (dx + 15, sy + 3)], fill=BLUE_DARK, width=1)

        is_active = (i == stage_idx)
        dot_col = CYAN_GLOW if is_active else (TEXT_DIM if i < stage_idx else BLUE_DARK)
        r = 4 if is_active else 2
        draw.ellipse([(dx - r, sy + 3 - r), (dx + r, sy + 3 + r)], fill=dot_col)

    return img, draw


def draw_scene_header(draw, title, subtitle=None, pos_y=CY1 + 22):
    """Draws concise title and subtitle inside the card header."""
    bbox = f_h2.getbbox(title)
    tw = bbox[2] - bbox[0]
    draw.text(((WIDTH - tw) // 2, pos_y), title, fill=TEXT_MAIN, font=f_h2)

    if subtitle:
        s_bbox = f_sub.getbbox(subtitle)
        sw = s_bbox[2] - s_bbox[0]
        draw.text(((WIDTH - sw) // 2, pos_y + 26), subtitle, fill=CYAN_GLOW, font=f_sub)


def draw_evidence_particle(draw, px, py, color=CYAN_GLOW):
    """Draws the traveling luminous evidence particle with outer glow ring."""
    draw.ellipse([(px - 8, py - 8), (px + 8, py + 8)], fill=None, outline=color, width=2)
    draw.ellipse([(px - 3, py - 3), (px + 3, py + 3)], fill=color)


def draw_semiconductor_chip(draw, cx, cy, scale=1.0, glow_color=CYAN_GLOW):
    """Draws a clean semiconductor package with die, pins, and micro-traces."""
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

    # Silicon Die Inside
    dw, dh = int(80 * scale), int(55 * scale)
    dx1, dy1 = cx - dw // 2, cy - dh // 2
    dx2, dy2 = cx + dw // 2, cy + dh // 2
    draw.rectangle([(dx1, dy1), (dx2, dy2)], fill=(12, 32, 56), outline=BLUE_ELECTRIC, width=1)

    # Sub-gate traces
    draw.line([(dx1 + 10, cy - 8), (dx1 + 35, cy - 8)], fill=glow_color, width=1)
    draw.line([(dx2 - 35, cy + 8), (dx2 - 10, cy + 8)], fill=glow_color, width=1)

    # Text
    draw.text((cx - 24, cy - 6), "SILICON DIE", fill=TEXT_MUTED, font=f_small)


# =========================================================================
# 16 POLISHED FLASH-CARD SCENES (2 Frames per Scene, ~10s Total Loop)
# =========================================================================

def render_frame_1(f_idx):
    """Scene 1: What is being tested? (Semiconductor package in burn-in environment)."""
    img, draw = create_base_canvas(stage_idx=1)
    draw_scene_header(draw, "PREDICTA", "SEMICONDUCTOR BURN-IN SCREENING", pos_y=CY1 + 45)

    # Burn-In Chamber Environment Box
    bx1, by1, bx2, by2 = WIDTH // 2 - 180, 210, WIDTH // 2 + 180, 470
    draw.rectangle([(bx1, by1), (bx2, by2)], fill=None, outline=BLUE_DARK, width=1)
    draw.text((bx1 + 15, by1 + 12), "BURN-IN CHAMBER: 125°C / STRESS VOLTAGE", fill=TEXT_DIM, font=f_small)

    # Hero Chip Center
    draw_semiconductor_chip(draw, WIDTH // 2, 340, glow_color=CYAN_GLOW)

    # Evidence particle entering chip from left
    px = bx1 + 30 + (f_idx % 2) * 50
    draw.line([(bx1, 340), (WIDTH // 2 - 70, 340)], fill=BORDER_CARD, width=1)
    draw_evidence_particle(draw, px, 340, color=CYAN_GLOW)

    # Leader Line Callout
    draw.line([(WIDTH // 2 + 70, 310), (WIDTH // 2 + 140, 270)], fill=BORDER_GLOW, width=1)
    draw.ellipse([(WIDTH // 2 + 68, 308), (WIDTH // 2 + 72, 312)], fill=BORDER_GLOW)
    draw.text((WIDTH // 2 + 145, 262), "DUT TELEMETRY NODE", fill=CYAN_SOFT, font=f_bold)

    return img


def render_frame_2(f_idx):
    """Scene 2: What does the system observe? (3 Synchronized Parametric Streams)."""
    img, draw = create_base_canvas(stage_idx=2)
    draw_scene_header(draw, "TELEMETRY OBSERVATION", "SYNCHRONIZED PARAMETRIC STREAMS OVER BURN-IN")

    # Chip at Left
    draw_semiconductor_chip(draw, CX1 + 100, 330, scale=0.85, glow_color=CYAN_GLOW)

    # Timeline Line & Nodes
    tx1, ty, tx2 = CX1 + 220, 330, CX2 - 70
    draw.line([(tx1, ty), (tx2, ty)], fill=BORDER_CARD, width=2)

    nodes = [
        (CX1 + 260, "0h"),
        (CX1 + 470, "24h"),
        (CX1 + 680, "96h"),
        (CX1 + 870, "168h")
    ]
    for nx, label in nodes:
        draw.ellipse([(nx - 5, ty - 5), (nx + 5, ty + 5)], fill=BG_CARD, outline=BLUE_ELECTRIC, width=2)
        draw.text((nx - 10, ty + 15), label, fill=TEXT_MUTED, font=f_bold)

    # 3 Wave Streams (Iddq, Leakage, Tpd)
    off = (f_idx % 2) * 8
    pts_iddq = [(CX1 + 260, ty - 45), (CX1 + 470, ty - 47 + off), (CX1 + 680, ty - 43), (CX1 + 870, ty - 45)]
    pts_leak = [(CX1 + 260, ty), (CX1 + 470, ty + 2 - off), (CX1 + 680, ty - 2), (CX1 + 870, ty)]
    pts_tpd = [(CX1 + 260, ty + 45), (CX1 + 470, ty + 43 + off), (CX1 + 680, ty + 47), (CX1 + 870, ty + 45)]

    for pts, col in [(pts_iddq, CYAN_GLOW), (pts_leak, BLUE_ELECTRIC), (pts_tpd, CYAN_SOFT)]:
        for i in range(len(pts) - 1):
            draw.line([pts[i], pts[i + 1]], fill=col, width=2)

    # Evidence particle arriving at 24h node on Iddq stream
    part_x = CX1 + 470 + (f_idx % 2) * 15
    draw_evidence_particle(draw, part_x, ty - 47, color=CYAN_GLOW)

    # Leader callout at 24h
    draw.line([(CX1 + 470, ty - 55), (CX1 + 470, ty - 85)], fill=BORDER_GLOW, width=1)
    draw.text((CX1 + 430, ty - 102), "EARLY WINDOW (24h)", fill=CYAN_SOFT, font=f_bold)

    # Stream Labels
    draw.text((CX2 - 55, ty - 52), "Iddq", fill=TEXT_MUTED, font=f_small)
    draw.text((CX2 - 55, ty - 7), "Leakage", fill=TEXT_MUTED, font=f_small)
    draw.text((CX2 - 55, ty + 38), "Tpd", fill=TEXT_MUTED, font=f_small)

    return img


def render_frame_3(f_idx):
    """Scene 3: Show the problem visually (Early Drift & Magnification Lens)."""
    img, draw = create_base_canvas(stage_idx=3)
    draw_scene_header(draw, "EARLY DRIFT", "SUBTLE PARAMETRIC SEPARATION IDENTIFIED AT 24h")

    # Timeline Line & Nodes
    tx1, ty, tx2 = CX1 + 90, 350, CX2 - 80
    draw.line([(tx1, ty), (tx2, ty)], fill=BORDER_CARD, width=2)

    for nx, label in [(CX1 + 150, "0h"), (CX1 + 410, "24h"), (CX1 + 670, "96h"), (CX1 + 890, "168h")]:
        draw.ellipse([(nx - 5, ty - 5), (nx + 5, ty + 5)], fill=BG_CARD, outline=BLUE_ELECTRIC, width=2)
        draw.text((nx - 10, ty + 15), label, fill=TEXT_MUTED, font=f_bold)

    # Normal Signal Path (Cyan)
    draw.line([(CX1 + 150, ty - 30), (CX1 + 410, ty - 30), (CX1 + 670, ty - 30), (CX1 + 890, ty - 30)], fill=CYAN_GLOW, width=2)

    # Drifting Signal Path (Amber separating upward after 24h)
    draw.line([(CX1 + 150, ty - 30), (CX1 + 410, ty - 30)], fill=CYAN_GLOW, width=2)
    draw.line([(CX1 + 410, ty - 30), (CX1 + 670, ty - 85), (CX1 + 890, ty - 130)], fill=AMBER_WARN, width=3)

    # Magnification Lens Effect around 24h divergence point
    lx, ly = CX1 + 410, ty - 30
    draw.ellipse([(lx - 55, ly - 55), (lx + 55, ly + 55)], fill=(12, 35, 62), outline=BORDER_GLOW, width=2)
    draw.ellipse([(lx - 50, ly - 50), (lx + 50, ly + 50)], fill=None, outline=BLUE_ELECTRIC, width=1)

    # Zoomed vector lines inside lens
    draw.line([(lx - 45, ly), (lx - 10, ly)], fill=CYAN_GLOW, width=2)
    draw.line([(lx - 10, ly), (lx + 45, ly)], fill=CYAN_GLOW, width=2)  # Normal continuation
    draw.line([(lx - 10, ly), (lx + 45, ly - 35)], fill=AMBER_WARN, width=3)  # Zoomed drift

    # Lens Annotations
    draw.text((lx + 10, ly + 10), "NORMAL", fill=CYAN_GLOW, font=f_small)
    draw.text((lx + 15, ly - 45), "DRIFT", fill=AMBER_WARN, font=f_bold)

    # Evidence particle moving along drifting path
    px = lx + (30 if f_idx == 5 else 60)
    py = ly - (15 if f_idx == 5 else 32)
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

    draw.text((cx - 40, cy + 80), "POPULATION CLUSTER", fill=TEXT_DIM, font=f_bold)

    # Outlier Point separating to the right
    sep_x = CX2 - 220 + (f_idx % 2) * 12
    sep_y = CY1 + 190 - (f_idx % 2) * 8
    draw.line([(cx + 40, cy - 20), (sep_x, sep_y)], fill=BORDER_CARD, width=1)

    # Expanding Ring around Outlier
    ring_r = 16 + (f_idx % 2) * 5
    draw.ellipse([(sep_x - ring_r, sep_y - ring_r), (sep_x + ring_r, sep_y + ring_r)], fill=None, outline=AMBER_WARN, width=2)
    draw_evidence_particle(draw, sep_x, sep_y, color=AMBER_WARN)
    draw.text((sep_x + 22, sep_y - 8), "OUTLIER", fill=AMBER_WARN, font=f_bold)

    # 3 Instrument Labels pointing toward Outlier
    instruments = [
        ("MAD", CX1 + 160, 220),
        ("COPOD", CX1 + 160, 340),
        ("ISOLATION FOREST", CX1 + 160, 460)
    ]
    for label, ix, iy in instruments:
        draw.rectangle([(ix - 55, iy - 14), (ix + 55, iy + 14)], fill=BG_CANVAS, outline=BORDER_CARD, width=1)
        draw.text((ix - 45, iy - 6), label, fill=TEXT_MUTED, font=f_bold)
        draw.line([(ix + 55, iy), (sep_x - ring_r, sep_y)], fill=BLUE_DARK, width=1)

    return img


def render_frame_5(f_idx):
    """Scene 5: Module B — 168h Trajectory Forecast & Uncertainty Envelope."""
    img, draw = create_base_canvas(stage_idx=5)
    draw_scene_header(draw, "MODULE B", "168h DEGRADATION FORECAST & UNCERTAINTY ENVELOPE")

    # Trajectory Line Coordinates
    x0, y0 = CX1 + 110, 440
    x24, y24 = CX1 + 370, 390
    x168, y168 = CX2 - 130, 200

    # Vertical Timeline Guides
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
    draw.text((x24 - 25, y24 + 15), "OBSERVED", fill=CYAN_GLOW, font=f_bold)

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

    draw.text((x168 - 110, y168 - 60), "168h PROJECTED DRIFT", fill=AMBER_WARN, font=f_bold)

    # Traveling Evidence Particle along trajectory
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
    gy = 330

    # Central Illuminated Circular Gate
    r_gate = 65
    draw.ellipse([(gx - r_gate, gy - r_gate), (gx + r_gate, gy + r_gate)], fill=BG_CANVAS, outline=CYAN_GLOW, width=3)
    draw.ellipse([(gx - r_gate + 8, gy - r_gate + 8), (gx + r_gate - 8, gy + r_gate - 8)], fill=None, outline=BLUE_ELECTRIC, width=1)
    draw.text((gx - 42, gy - 8), "RELIABILITY\n    GATE", fill=TEXT_MAIN, font=f_bold)

    # Trajectory passing through gate
    draw.line([(CX1 + 100, 420), (gx - r_gate, gy)], fill=CYAN_GLOW, width=3)
    draw.line([(gx + r_gate, gy), (CX2 - 100, 240)], fill=AMBER_WARN, width=3)

    # Evidence particle passing gate
    px = gx + (-20 if f_idx == 11 else 30)
    py = gy + (5 if f_idx == 11 else -12)
    draw_evidence_particle(draw, px, py, color=AMBER_WARN)

    # 4 Floating Evidence Markers pointing inward
    markers = [
        ("BTI (V_shift)", gx - 160, 200),
        ("TIMING (T_delay)", gx + 160, 200),
        ("LEAKAGE (I_leak)", gx - 160, 460),
        ("THERMAL (T_stress)", gx + 160, 460),
    ]
    for label, mx, my in markers:
        draw.rectangle([(mx - 65, my - 14), (mx + 65, my + 14)], fill=BG_CANVAS, outline=BORDER_CARD, width=1)
        draw.text((mx - 55, my - 6), label, fill=TEXT_MUTED, font=f_bold)
        draw.line([(mx + (65 if mx < gx else -65), my), (gx + (-r_gate if mx < gx else r_gate), gy)], fill=BORDER_GLOW, width=1)

    return img


def render_frame_7(f_idx):
    """Scene 7: Screening Gate & Traditional vs PREDICTA Comparison."""
    img, draw = create_base_canvas(stage_idx=7)
    draw_scene_header(draw, "SCREENING DISPOSITION", "AUTOMATED EARLY SCREENING VS TRADITIONAL TESTING")

    # Left: Screening Gate Portal
    sx, sy = CX1 + 220, 330
    draw.line([(CX1 + 80, sy), (sx, sy)], fill=CYAN_GLOW, width=3)
    draw.ellipse([(sx - 8, sy - 8), (sx + 8, sy + 8)], fill=CYAN_GLOW)

    # 3 Outcome Paths (PASS, MONITOR, REJECT)
    outcomes = [
        ("PASS", CX1 + 420, 210, GREEN_PASS),
        ("MONITOR", CX1 + 420, 330, AMBER_WARN),
        ("REJECT", CX1 + 420, 450, RED_RISK),
    ]

    for label, ox, oy, col in outcomes:
        is_sel = (label == "REJECT")
        draw.line([(sx, sy), (ox, oy)], fill=col if is_sel else BORDER_CARD, width=3 if is_sel else 1)
        draw.rectangle([(ox, oy - 14), (ox + 100, oy + 14)], fill=BG_CANVAS, outline=col if is_sel else BORDER_CARD, width=2 if is_sel else 1)
        draw.text((ox + 20, oy - 6), label, fill=col if is_sel else TEXT_DIM, font=f_bold)

        if is_sel:
            # Evidence particle reaching REJECT box
            draw_evidence_particle(draw, ox + 10, oy, color=col)

    # Right: Traditional vs PREDICTA Miniature Visual Comparison Box
    vx1, vy1, vx2, vy2 = CX2 - 400, 160, CX2 - 20, 520
    draw.rectangle([(vx1, vy1), (vx2, vy2)], fill=BG_CANVAS, outline=BORDER_CARD, width=1)
    draw.text((vx1 + 15, vy1 + 12), "WHY PREDICTA MATTERS", fill=CYAN_SOFT, font=f_bold)

    # Traditional Row
    draw.text((vx1 + 15, vy1 + 45), "TRADITIONAL TEST", fill=TEXT_MUTED, font=f_bold)
    draw.line([(vx1 + 15, vy1 + 90), (vx2 - 60, vy1 + 90)], fill=CYAN_GLOW, width=2)
    draw.line([(vx2 - 60, vy1 + 90), (vx2 - 20, vy1 + 130)], fill=RED_RISK, width=2)
    draw.text((vx1 + 15, vy1 + 105), "Early check: LOOKS NORMAL → Late Field Escape", fill=TEXT_DIM, font=f_small)

    # PREDICTA Row
    draw.text((vx1 + 15, vy1 + 185), "PREDICTA SCREENING", fill=CYAN_GLOW, font=f_bold)
    draw.line([(vx1 + 15, vy1 + 230), (vx1 + 140, vy1 + 230)], fill=CYAN_GLOW, width=2)
    draw.line([(vx1 + 140, vy1 + 230), (vx1 + 240, vy1 + 270)], fill=AMBER_WARN, width=3)
    draw.rectangle([(vx1 + 240, vy1 + 256), (vx2 - 20, vy1 + 284)], fill=(40, 15, 15), outline=RED_RISK, width=1)
    draw.text((vx1 + 250, vy1 + 264), "SCREENED AT 24h", fill=RED_RISK, font=f_bold)
    draw.text((vx1 + 15, vy1 + 290), "Early drift: DETECTED → Defect Intercepted", fill=CYAN_SOFT, font=f_small)

    return img


def render_frame_8(f_idx):
    """Scene 8: Final Hero Tagline & Seamless Loop."""
    img, draw = create_base_canvas(stage_idx=8)

    # Floating Chip Center
    draw_semiconductor_chip(draw, WIDTH // 2, 230, scale=1.1, glow_color=CYAN_GLOW)

    # Luminous signal line passing through chip
    draw.line([(CX1 + 100, 230), (CX2 - 100, 230)], fill=CYAN_GLOW, width=2)
    part_x = CX1 + 250 + (f_idx % 2) * 300
    draw_evidence_particle(draw, part_x, 230, color=CYAN_GLOW)

    # Main Hero Title
    draw.text((WIDTH // 2 - 190, CY1 + 290), "FIND THE PROBLEM EARLIER", fill=TEXT_MAIN, font=f_h1)

    # Subtitle Bar
    draw.text((WIDTH // 2 - 165, CY1 + 345), "TELEMETRY   →   DRIFT   →   SCREENING", fill=CYAN_GLOW, font=f_sub)

    # Final Tagline
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
    print(f"\n[SUCCESS] Generated Flash-Card Hero {OUTPUT_GIF}")
    print(f"Size: {size_mb:.2f} MB | Frames: {len(frames)} | Dimensions: {WIDTH}x{HEIGHT}")


if __name__ == "__main__":
    main()
