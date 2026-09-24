"""
PREDICTA-26 — SIH PS-170 Polished Hero Animation Generator
Generates a dark navy, cinematic, technical engineering visual GIF bounded inside an elegant instrument frame.
"""

import os
import math
from PIL import Image, ImageDraw, ImageFont

OUTPUT_GIF = "docs/assets/predicta_ps170_animation.gif"
PREVIEW_DIR = "scratch/frame_previews"
WIDTH = 1200
HEIGHT = 650

# Outer Canvas & Inner Frame Bounds (80% Width, 75% Height for Dark Breathing Space)
FRAME_BOX = (120, 55, 1080, 585)  # [x1, y1, x2, y2]
FX1, FY1, FX2, FY2 = FRAME_BOX

# Cinematic Dark Navy Color Palette
BG_OUTER = (7, 17, 31)             # Deep Navy Outer Canvas #07111F
BG_FRAME = (10, 22, 40)            # Translucent Frame Interior #0A1628
BORDER_FRAME = (30, 58, 95)        # Thin Instrument Frame Border #1E3A5F
BORDER_GLOW = (56, 189, 248)       # Soft Cyan Glow

TEXT_MAIN = (248, 250, 252)        # Crisp Near-White #F8FAFC
TEXT_MUTED = (148, 163, 184)       # Light Blue-Grey #94A3B8
TEXT_DIM = (100, 116, 139)         # Slate #64748B

CYAN_GLOW = (56, 189, 248)         # Electric Cyan #38BDF8
CYAN_SOFT = (186, 230, 253)        # Soft Cyan #BAE6FD
BLUE_ELECTRIC = (14, 165, 233)     # Electric Blue #0EA5E9
BLUE_DARK = (24, 45, 75)           # Dark Structural Blue

AMBER_WARN = (245, 158, 11)        # Soft Amber #F59E0B
RED_RISK = (239, 68, 68)           # Soft Red #EF4444
GREEN_PASS = (34, 197, 94)         # Soft Green #22C55E


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


def create_base_canvas():
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_OUTER)
    draw = ImageDraw.Draw(img)

    # Ambient center glow on outer canvas
    cx, cy = WIDTH // 2, HEIGHT // 2
    for r in range(300, 0, -30):
        alpha = int(10 * (1 - r / 300))
        glow_col = (BG_OUTER[0] + alpha, BG_OUTER[1] + int(alpha * 1.4), BG_OUTER[2] + alpha * 2)
        draw.ellipse([(cx - r * 1.5, cy - r), (cx + r * 1.5, cy + r)], fill=glow_col)

    # Single Elegant Instrument Boundary (75-80% canvas footprint)
    draw.rectangle([FRAME_BOX[0], FRAME_BOX[1], FRAME_BOX[2], FRAME_BOX[3]], fill=BG_FRAME, outline=BORDER_FRAME, width=2)

    # Subtle cyan top/bottom frame corner accent lines
    draw.line([(FX1 + 20, FY1), (FX1 + 100, FY1)], fill=BORDER_GLOW, width=2)
    draw.line([(FX2 - 100, FY1), (FX2 - 20, FY1)], fill=BORDER_GLOW, width=2)
    draw.line([(FX1 + 20, FY2), (FX1 + 100, FY2)], fill=BORDER_GLOW, width=2)
    draw.line([(FX2 - 100, FY2), (FX2 - 20, FY2)], fill=BORDER_GLOW, width=2)

    return img, draw


def draw_scene_text(draw, title, subtitle=None, pos_y=FY1 + 25):
    """Draws minimalistic scene text inside the instrument frame."""
    bbox = f_h2.getbbox(title)
    tw = bbox[2] - bbox[0]
    draw.text(((WIDTH - tw) // 2, pos_y), title, fill=TEXT_MAIN, font=f_h2)

    if subtitle:
        s_bbox = f_sub.getbbox(subtitle)
        sw = s_bbox[2] - s_bbox[0]
        draw.text(((WIDTH - sw) // 2, pos_y + 28), subtitle, fill=TEXT_MUTED, font=f_sub)


def draw_chip_package(draw, cx, cy, progress=1.0, glow_color=CYAN_GLOW):
    """Draws a clean semiconductor die/package with illuminating pins & traces."""
    w, h = 150, 115
    x1, y1 = cx - w // 2, cy - h // 2
    x2, y2 = cx + w // 2, cy + h // 2

    # Pins
    for i in range(5):
        px = x1 + 20 + i * 26
        draw.line([(px, y1 - 10), (px, y1)], fill=BLUE_DARK, width=2)
        draw.line([(px, y2), (px, y2 + 10)], fill=BLUE_DARK, width=2)
    for i in range(3):
        py = y1 + 25 + i * 32
        draw.line([(x1 - 10, py), (x1, py)], fill=BLUE_DARK, width=2)
        draw.line([(x2, py), (x2 + 10, py)], fill=BLUE_DARK, width=2)

    # Semiconductor Package Body
    draw.rectangle([(x1, y1), (x2, y2)], fill=BG_OUTER, outline=glow_color, width=2)

    # Internal Silicon Die
    dw, dh = 90, 65
    dx1, dy1 = cx - dw // 2, cy - dh // 2
    dx2, dy2 = cx + dw // 2, cy + dh // 2
    draw.rectangle([(dx1, dy1), (dx2, dy2)], fill=(12, 30, 52), outline=BLUE_ELECTRIC, width=1)

    # Circuit traces
    t_len = int(30 * progress)
    draw.line([(dx1 + 12, cy - 12), (dx1 + 12 + t_len, cy - 12)], fill=glow_color, width=1)
    draw.line([(dx2 - 12 - t_len, cy + 12), (dx2 - 12, cy + 12)], fill=glow_color, width=1)

    # Micro die label
    draw.text((cx - 20, cy - 6), "SILICON DIE", fill=TEXT_MUTED, font=f_small)


def draw_evidence_particle(draw, px, py, color=CYAN_GLOW):
    """Draws the traveling luminous evidence particle."""
    draw.ellipse([(px - 7, py - 7), (px + 7, py + 7)], fill=None, outline=color, width=2)
    draw.ellipse([(px - 3, py - 3), (px + 3, py + 3)], fill=color)


# =========================================================================
# 16 POLISHED CINEMATIC FRAMES inside the 80% Canvas Boundary
# =========================================================================

def render_frame_1(f_idx):
    """Scene 1: Hero Chip & Illumination (Frame 1 & 2)."""
    img, draw = create_base_canvas()
    progress = 0.6 if f_idx == 1 else 1.0

    # Large Main Title
    draw.text((WIDTH // 2 - 70, FY1 + 45), "PREDICTA", fill=TEXT_MAIN, font=f_h1)
    draw.text((WIDTH // 2 - 145, FY1 + 95), "SEMICONDUCTOR BURN-IN SCREENING", fill=CYAN_GLOW, font=f_sub)

    # Hero Chip Center
    draw_chip_package(draw, WIDTH // 2, 330, progress=progress)

    # Pulse traveling into right path
    pulse_x = WIDTH // 2 + 85 + (15 if f_idx == 2 else 0)
    draw_evidence_particle(draw, pulse_x, 330, color=CYAN_GLOW)

    # Footer
    draw.text((WIDTH // 2 - 45, FY2 - 35), "SIH PS-170", fill=TEXT_DIM, font=f_small)
    return img


def render_frame_2(f_idx):
    """Scene 2: Burn-In Timeline & Signals (Frame 3 & 4)."""
    img, draw = create_base_canvas()
    draw_scene_text(draw, "BURN-IN", "TELEMETRY", pos_y=FY1 + 25)

    # Chip at left
    draw_chip_package(draw, FX1 + 110, 320, progress=1.0)

    # Horizontal Timeline
    tx1, ty, tx2 = FX1 + 230, 320, FX2 - 60
    draw.line([(tx1, ty), (tx2, ty)], fill=BORDER_FRAME, width=2)

    checkpoints = [
        (FX1 + 260, "0h"),
        (FX1 + 450, "24h"),
        (FX1 + 650, "96h"),
        (FX1 + 840, "168h")
    ]
    for cx_val, label in checkpoints:
        draw.ellipse([(cx_val - 5, ty - 5), (cx_val + 5, ty + 5)], fill=BG_OUTER, outline=BLUE_ELECTRIC, width=2)
        draw.text((cx_val - 10, ty + 15), label, fill=TEXT_MUTED, font=f_bold)

    # Moving Signal Traces (Iddq, Leakage, Tpd)
    offset = (f_idx % 2) * 12
    pts_iddq = [(FX1 + 260, ty - 35), (FX1 + 450, ty - 37 + offset), (FX1 + 650, ty - 33), (FX1 + 840, ty - 35)]
    pts_leak = [(FX1 + 260, ty), (FX1 + 450, ty + 2 - offset), (FX1 + 650, ty - 2), (FX1 + 840, ty)]
    pts_tpd = [(FX1 + 260, ty + 35), (FX1 + 450, ty + 33 + offset), (FX1 + 650, ty + 37), (FX1 + 840, ty + 35)]

    for pts in [pts_iddq, pts_leak, pts_tpd]:
        for i in range(len(pts) - 1):
            draw.line([pts[i], pts[i + 1]], fill=CYAN_GLOW, width=2)

    # Evidence particle travelling along 24h
    part_x = FX1 + 450 + (f_idx % 2) * 20
    draw_evidence_particle(draw, part_x, ty - 37, color=CYAN_GLOW)

    # Labels
    draw.text((FX1 + 855, ty - 42), "Iddq", fill=TEXT_MUTED, font=f_small)
    draw.text((FX1 + 855, ty - 7), "Leakage", fill=TEXT_MUTED, font=f_small)
    draw.text((FX1 + 855, ty + 28), "Tpd", fill=TEXT_MUTED, font=f_small)

    return img


def render_frame_3(f_idx):
    """Scene 3: Something Changes — Early Drift (Frame 5 & 6)."""
    img, draw = create_base_canvas()
    draw_scene_text(draw, "EARLY DRIFT", pos_y=FY1 + 25)

    # Horizontal Timeline
    tx1, ty, tx2 = FX1 + 100, 330, FX2 - 80
    draw.line([(tx1, ty), (tx2, ty)], fill=BORDER_FRAME, width=2)

    for cx_val, label in [(FX1 + 160, "0h"), (FX1 + 400, "24h"), (FX1 + 660, "96h"), (FX1 + 880, "168h")]:
        draw.ellipse([(cx_val - 5, ty - 5), (cx_val + 5, ty + 5)], fill=BG_OUTER, outline=BLUE_ELECTRIC, width=2)
        draw.text((cx_val - 10, ty + 15), label, fill=TEXT_MUTED, font=f_bold)

    # Normal Signal (Blue)
    draw.line([(FX1 + 160, ty - 25), (FX1 + 400, ty - 25), (FX1 + 660, ty - 23), (FX1 + 880, ty - 25)], fill=CYAN_GLOW, width=2)

    # Drifting Signal (Amber path separating at 24h)
    draw.line([(FX1 + 160, ty - 25), (FX1 + 400, ty - 25)], fill=CYAN_GLOW, width=2)
    draw.line([(FX1 + 400, ty - 25), (FX1 + 660, ty - 75), (FX1 + 880, ty - 120)], fill=AMBER_WARN, width=3)

    # Separation Point Marker
    draw.ellipse([(FX1 + 400 - 10, ty - 25 - 10), (FX1 + 400 + 10, ty - 25 + 10)], fill=None, outline=AMBER_WARN, width=2)
    draw.ellipse([(FX1 + 400 - 4, ty - 25 - 4), (FX1 + 400 + 4, ty - 25 + 4)], fill=AMBER_WARN)

    # Evidence particle travelling along drifting path
    px = FX1 + 400 + (60 if f_idx == 6 else 30)
    py = (ty - 25) - (15 if f_idx == 6 else 8)
    draw_evidence_particle(draw, px, py, color=AMBER_WARN)

    return img


def render_frame_4(f_idx):
    """Scene 4: Module A — Population & Outlier (Frame 7 & 8)."""
    img, draw = create_base_canvas()
    draw_scene_text(draw, "MODULE A", "OUTLIER", pos_y=FY1 + 25)

    cx, cy = WIDTH // 2 - 60, 330

    # Cluster of normal dots
    dots = [
        (-70, -35), (-45, 25), (-15, -50), (10, 35), (35, -25), (60, 15),
        (-95, 10), (-25, -15), (25, -45), (50, 50), (-60, -60), (0, 0),
        (45, 10), (-35, 45), (15, -10), (70, -15), (-80, 35), (10, -60)
    ]
    for dx, dy in dots:
        px, py = cx + dx, cy + dy
        draw.ellipse([(px - 4, py - 4), (px + 4, py + 4)], fill=BLUE_ELECTRIC)

    # Separating Outlier Point
    sep_x = FX2 - 200 + (f_idx % 2) * 12
    sep_y = FY1 + 180 - (f_idx % 2) * 8
    draw.line([(cx + 35, cy - 15), (sep_x, sep_y)], fill=BORDER_FRAME, width=1)

    # Outlier Point + Expanding Ring Highlight
    ring_r = 14 + (f_idx % 2) * 4
    draw.ellipse([(sep_x - ring_r, sep_y - ring_r), (sep_x + ring_r, sep_y + ring_r)], fill=None, outline=AMBER_WARN, width=2)
    draw_evidence_particle(draw, sep_x, sep_y, color=AMBER_WARN)

    # Compact Tags Below
    draw.text((WIDTH // 2 - 55, FY2 - 40), "MAD  •  COPOD  •  IF", fill=TEXT_MUTED, font=f_bold)

    return img


def render_frame_5(f_idx):
    """Scene 5: Module B — 168h Forecast & Uncertainty Band (Frame 9 & 10)."""
    img, draw = create_base_canvas()
    draw_scene_text(draw, "MODULE B", "168h FORECAST", pos_y=FY1 + 25)

    # Trajectory Line Points
    x0, y0 = FX1 + 100, 420
    x24, y24 = FX1 + 340, 370
    x168, y168 = FX2 - 120, 180

    # Timeline Lines
    for x_val, label in [(x0, "0h"), (x24, "24h"), (x168, "168h")]:
        draw.line([(x_val, FY1 + 75), (x_val, FY2 - 50)], fill=BORDER_FRAME, width=1)
        draw.text((x_val - 10, FY2 - 40), label, fill=TEXT_MUTED, font=f_bold)

    # Subtle Transparent Blue Uncertainty Band widening into future
    band_pts = [
        (x24, y24 - 8), (x168, y168 - 40), (x168, y168 + 40), (x24, y24 + 8)
    ]
    draw.polygon(band_pts, fill=(15, 42, 70))

    # Solid Line: 0h to 24h Observed
    draw.line([(x0, y0), (x24, y24)], fill=CYAN_GLOW, width=3)
    draw.ellipse([(x0 - 4, y0 - 4), (x0 + 4, y0 + 4)], fill=CYAN_GLOW)
    draw.ellipse([(x24 - 4, y24 - 4), (x24 + 4, y24 + 4)], fill=CYAN_GLOW)

    # Soft Dashed Line: 24h to 168h Projected
    steps = 20
    for s in range(0, steps, 2):
        t1 = s / steps
        t2 = min((s + 1) / steps, 1.0)
        px1 = x24 + t1 * (x168 - x24)
        py1 = y24 + t1 * (y168 - y24)
        px2 = x24 + t2 * (x168 - x24)
        py2 = y24 + t2 * (y168 - y24)
        draw.line([(px1, py1), (px2, py2)], fill=CYAN_SOFT, width=2)

    # Traveling Evidence Particle along trajectory
    part_t = 0.3 if f_idx == 9 else 0.7
    px = x24 + part_t * (x168 - x24)
    py = y24 + part_t * (y168 - y24)
    draw_evidence_particle(draw, px, py, color=CYAN_GLOW)

    return img


def render_frame_6(f_idx):
    """Scene 6: Reliability Check Gate (Frame 11 & 12)."""
    img, draw = create_base_canvas()
    draw_scene_text(draw, "RELIABILITY CHECK", pos_y=FY1 + 25)

    # Vertical Reliability Gate Center
    gx = WIDTH // 2
    draw.line([(gx, FY1 + 80), (gx, FY2 - 50)], fill=CYAN_GLOW, width=3)

    # Trajectory passing through gate
    draw.line([(FX1 + 100, 400), (gx, 310)], fill=CYAN_GLOW, width=3)
    draw.line([(gx, 310), (FX2 - 100, 220)], fill=AMBER_WARN, width=3)

    # Evidence particle passing gate
    px = gx + (-15 if f_idx == 11 else 25)
    py = 310 + (6 if f_idx == 11 else -10)
    draw_evidence_particle(draw, px, py, color=AMBER_WARN)

    # 4 Floating Evidence Markers
    markers = [
        ("BTI", gx - 140, 210),
        ("TIMING", gx + 140, 210),
        ("LEAKAGE", gx - 140, 410),
        ("THERMAL", gx + 140, 410),
    ]
    for label, mx, my in markers:
        draw.ellipse([(mx - 5, my - 5), (mx + 5, my + 5)], fill=BG_OUTER, outline=CYAN_GLOW, width=2)
        draw.line([(mx, my), (gx, 310)], fill=BORDER_FRAME, width=1)
        draw.text((mx - 18, my - 22), label, fill=TEXT_MUTED, font=f_bold)

    return img


def render_frame_7(f_idx):
    """Scene 7: Screening Gate & Outcome Destinations (Frame 13 & 14)."""
    img, draw = create_base_canvas()
    draw_scene_text(draw, "SCREENING", pos_y=FY1 + 25)

    # Single bright line reaching screening gate
    sx = FX1 + 350
    sy = 320
    draw.line([(FX1 + 100, sy), (sx, sy)], fill=CYAN_GLOW, width=3)
    draw.ellipse([(sx - 5, sy - 5), (sx + 5, sy + 5)], fill=CYAN_GLOW)

    # 3 Destination Endpoints (PASS, MONITOR, REJECT)
    outcomes = [
        ("PASS", FX2 - 250, 210, GREEN_PASS),
        ("MONITOR", FX2 - 250, 320, AMBER_WARN),
        ("REJECT", FX2 - 250, 430, RED_RISK),
    ]

    for label, ox, oy, col in outcomes:
        is_selected = (label == "REJECT")
        draw.line([(sx, sy), (ox, oy)], fill=col if is_selected else BORDER_FRAME, width=2 if is_selected else 1)
        draw.text((ox + 20, oy - 10), label, fill=col if is_selected else TEXT_DIM, font=f_h2)

        if is_selected:
            draw.ellipse([(ox - 7, oy - 7), (ox + 7, oy + 7)], fill=col)
            # Evidence particle reaching REJECT destination
            draw_evidence_particle(draw, ox, oy, color=col)

    return img


def render_frame_8(f_idx):
    """Scene 8: Final Hero Tagline & Smooth Loop (Frame 15 & 16)."""
    img, draw = create_base_canvas()

    # Semiconductor Outline Center
    draw_chip_package(draw, WIDTH // 2, 240, progress=1.0)

    # Single signal line passing through
    draw.line([(FX1 + 120, 240), (FX2 - 120, 240)], fill=CYAN_GLOW, width=2)
    part_x = FX1 + 300 + (f_idx % 2) * 250
    draw_evidence_particle(draw, part_x, 240, color=CYAN_GLOW)

    # Large Centered Title
    draw.text((WIDTH // 2 - 180, FY1 + 320), "FIND THE PROBLEM EARLIER", fill=TEXT_MAIN, font=f_h1)

    # Supporting Subtitle
    draw.text((WIDTH // 2 - 145, FY1 + 375), "TELEMETRY  →  DRIFT  →  SCREENING", fill=CYAN_GLOW, font=f_sub)

    # Footer
    draw.text((WIDTH // 2 - 70, FY2 - 35), "PREDICTA • SIH PS-170", fill=TEXT_DIM, font=f_small)

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
        print(f"[SUCCESS] Rendered Polished Frame {i:02d}/16 -> {preview_path}")

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
    print(f"\n[SUCCESS] Generated Polished {OUTPUT_GIF}")
    print(f"Size: {size_mb:.2f} MB | Frames: {len(frames)} | Dimensions: {WIDTH}x{HEIGHT}")


if __name__ == "__main__":
    main()
