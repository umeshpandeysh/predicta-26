"""
PREDICTA-26 — SIH PS-170 Cinematic Hero Animation Generator
Generates a dark navy, cinematic, technical engineering visual GIF for README.md.
"""

import os
import math
from PIL import Image, ImageDraw, ImageFont

OUTPUT_GIF = "docs/assets/predicta_ps170_animation.gif"
PREVIEW_DIR = "scratch/frame_previews"
WIDTH = 1200
HEIGHT = 650

# Cinematic Dark Navy Color Palette
BG_DARK = (7, 17, 31)             # Deep Navy #07111F
BG_GLOW = (11, 25, 44)            # Ambient Glow #0B192C
LINE_SUBTLE = (20, 38, 62)        # Subtle Grid / Structure Line

TEXT_MAIN = (248, 250, 252)       # Crisp Near-White #F8FAFC
TEXT_MUTED = (148, 163, 184)      # Light Blue-Grey #94A3B8
TEXT_DIM = (100, 116, 139)        # Slate #64748B

CYAN_GLOW = (56, 189, 248)        # Electric Cyan #38BDF8
CYAN_SOFT = (186, 230, 253)       # Soft Cyan #BAE6FD
BLUE_ELECTRIC = (14, 165, 233)    # Electric Blue #0EA5E9
BLUE_DARK = (30, 58, 95)          # Dark Structural Blue

AMBER_WARN = (245, 158, 11)       # Soft Amber #F59E0B
RED_RISK = (239, 68, 68)          # Soft Red #EF4444
GREEN_PASS = (34, 197, 94)        # Soft Green #22C55E


def load_fonts():
    try:
        f_h1 = ImageFont.truetype("segoeuib.ttf", 36)
        f_h2 = ImageFont.truetype("segoeuib.ttf", 22)
        f_sub = ImageFont.truetype("segoeui.ttf", 15)
        f_body = ImageFont.truetype("segoeui.ttf", 13)
        f_small = ImageFont.truetype("segoeui.ttf", 11)
        f_bold = ImageFont.truetype("segoeuib.ttf", 12)
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
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_DARK)
    draw = ImageDraw.Draw(img)

    # Subtle radial/linear ambient glow in center
    cx, cy = WIDTH // 2, HEIGHT // 2
    for r in range(350, 0, -25):
        alpha = int(12 * (1 - r / 350))
        glow_col = (BG_DARK[0] + alpha, BG_DARK[1] + int(alpha * 1.5), BG_DARK[2] + alpha * 2)
        draw.ellipse([(cx - r * 1.6, cy - r), (cx + r * 1.6, cy + r)], fill=glow_col)

    # Subtle horizontal & vertical optical axis lines
    draw.line([(0, cy), (WIDTH, cy)], fill=LINE_SUBTLE, width=1)
    draw.line([(cx, 0), (cx, HEIGHT)], fill=LINE_SUBTLE, width=1)

    return img, draw


def draw_chip_package(draw, cx, cy, progress=1.0, glow_color=CYAN_GLOW):
    """Draws a clean semiconductor die/package with illuminating circuit traces."""
    w, h = 180, 140
    x1, y1 = cx - w // 2, cy - h // 2
    x2, y2 = cx + w // 2, cy + h // 2

    # Outer pins / pads
    for i in range(6):
        px = x1 + 25 + i * 26
        draw.line([(px, y1 - 12), (px, y1)], fill=BLUE_DARK, width=2)
        draw.line([(px, y2), (px, y2 + 12)], fill=BLUE_DARK, width=2)
    for i in range(4):
        py = y1 + 25 + i * 30
        draw.line([(x1 - 12, py), (x1, py)], fill=BLUE_DARK, width=2)
        draw.line([(x2, py), (x2 + 12, py)], fill=BLUE_DARK, width=2)

    # Semiconductor Package Body
    draw.rectangle([(x1, y1), (x2, y2)], fill=BG_DARK, outline=glow_color, width=2)

    # Internal Silicon Die
    dw, dh = 110, 80
    dx1, dy1 = cx - dw // 2, cy - dh // 2
    dx2, dy2 = cx + dw // 2, cy + dh // 2
    draw.rectangle([(dx1, dy1), (dx2, dy2)], fill=(12, 30, 52), outline=BLUE_ELECTRIC, width=1)

    # Microscopic illuminated circuit traces
    t_len = int(35 * progress)
    draw.line([(dx1 + 15, cy - 15), (dx1 + 15 + t_len, cy - 15)], fill=glow_color, width=1)
    draw.line([(dx2 - 15 - t_len, cy + 15), (dx2 - 15, cy + 15)], fill=glow_color, width=1)
    draw.line([(cx, dy1 + 10), (cx, dy1 + 10 + int(t_len * 0.8))], fill=glow_color, width=1)

    # Micro die label
    draw.text((cx - 22, cy - 6), "SILICON DIE", fill=TEXT_MUTED, font=f_small)


def draw_scene_text(draw, title, subtitle=None, pos_y=60):
    """Draws minimalistic scene text: 1 heading + 1 supporting label."""
    bbox = f_h2.getbbox(title)
    tw = bbox[2] - bbox[0]
    draw.text(((WIDTH - tw) // 2, pos_y), title, fill=TEXT_MAIN, font=f_h2)

    if subtitle:
        s_bbox = f_sub.getbbox(subtitle)
        sw = s_bbox[2] - s_bbox[0]
        draw.text(((WIDTH - sw) // 2, pos_y + 32), subtitle, fill=TEXT_MUTED, font=f_sub)


# =========================================================================
# 16 CINEMATIC FRAMES (2 FRAMES PER SCENE FOR FLUID MOTION)
# =========================================================================

def render_frame_1(f_idx):
    """Scene 1: Hero Chip Appearance (Frame 1 & 2)."""
    img, draw = create_base_canvas()
    progress = 0.6 if f_idx == 1 else 1.0

    # Large Main Title
    draw.text((WIDTH // 2 - 80, 100), "PREDICTA", fill=TEXT_MAIN, font=f_h1)
    draw.text((WIDTH // 2 - 145, 150), "SEMICONDUCTOR BURN-IN SCREENING", fill=CYAN_GLOW, font=f_sub)

    # Hero Chip Center
    draw_chip_package(draw, WIDTH // 2, 360, progress=progress)

    # Footer
    draw.text((WIDTH // 2 - 50, 570), "SIH PS-170", fill=TEXT_DIM, font=f_small)
    return img


def render_frame_2(f_idx):
    """Scene 2: Burn-In Timeline & Signals (Frame 3 & 4)."""
    img, draw = create_base_canvas()
    draw_scene_text(draw, "BURN-IN", "TELEMETRY", pos_y=50)

    # Chip moved to left
    draw_chip_package(draw, 180, 320, progress=1.0)

    # Horizontal Timeline
    tx1, ty, tx2 = 340, 320, 1100
    draw.line([(tx1, ty), (tx2, ty)], fill=LINE_SUBTLE, width=2)

    checkpoints = [
        (380, "0h"),
        (600, "24h"),
        (820, "96h"),
        (1040, "168h")
    ]
    for cx_val, label in checkpoints:
        draw.ellipse([(cx_val - 6, ty - 6), (cx_val + 6, ty + 6)], fill=BG_DARK, outline=BLUE_ELECTRIC, width=2)
        draw.text((cx_val - 12, ty + 18), label, fill=TEXT_MUTED, font=f_bold)

    # Moving Signal Traces (Iddq, Leakage, Tpd)
    offset = (f_idx % 2) * 15
    pts_iddq = [(380, ty - 40), (600, ty - 42 + offset), (820, ty - 38), (1040, ty - 40)]
    pts_leak = [(380, ty), (600, ty + 2 - offset), (820, ty - 2), (1040, ty)]
    pts_tpd = [(380, ty + 40), (600, ty + 38 + offset), (820, ty + 42), (1040, ty + 40)]

    for pts in [pts_iddq, pts_leak, pts_tpd]:
        for i in range(len(pts) - 1):
            draw.line([pts[i], pts[i + 1]], fill=CYAN_GLOW, width=2)

    # Signal Labels
    draw.text((1055, ty - 48), "Iddq", fill=TEXT_MUTED, font=f_small)
    draw.text((1055, ty - 8), "Leakage", fill=TEXT_MUTED, font=f_small)
    draw.text((1055, ty + 32), "Tpd", fill=TEXT_MUTED, font=f_small)

    return img


def render_frame_3(f_idx):
    """Scene 3: Something Changes — Early Drift (Frame 5 & 6)."""
    img, draw = create_base_canvas()
    draw_scene_text(draw, "EARLY DRIFT", pos_y=50)

    # Horizontal Timeline
    tx1, ty, tx2 = 200, 320, 1050
    draw.line([(tx1, ty), (tx2, ty)], fill=LINE_SUBTLE, width=2)

    for cx_val, label in [(250, "0h"), (500, "24h"), (780, "96h"), (1000, "168h")]:
        draw.ellipse([(cx_val - 6, ty - 6), (cx_val + 6, ty + 6)], fill=BG_DARK, outline=BLUE_ELECTRIC, width=2)
        draw.text((cx_val - 12, ty + 18), label, fill=TEXT_MUTED, font=f_bold)

    # Stable Signals (Green / Blue)
    draw.line([(250, ty + 30), (500, ty + 30), (780, ty + 32), (1000, ty + 28)], fill=GREEN_PASS, width=2)
    draw.line([(250, ty - 30), (500, ty - 30), (780, ty - 28), (1000, ty - 32)], fill=CYAN_GLOW, width=2)

    # Diverging Signal (Amber Highlight after 24h)
    drift_y = (ty - 30) - (f_idx % 2) * 8
    draw.line([(250, ty - 30), (500, ty - 30)], fill=CYAN_GLOW, width=2)
    draw.line([(500, ty - 30), (780, ty - 90), (1000, ty - 140)], fill=AMBER_WARN, width=3)

    # Subtle Amber Pulse Ring at 24h Divergence Point
    draw.ellipse([(500 - 12, ty - 30 - 12), (500 + 12, ty - 30 + 12)], fill=None, outline=AMBER_WARN, width=2)
    draw.ellipse([(500 - 4, ty - 30 - 4), (500 + 4, ty - 30 + 4)], fill=AMBER_WARN)

    return img


def render_frame_4(f_idx):
    """Scene 4: Module A — Particle Population & Outlier (Frame 7 & 8)."""
    img, draw = create_base_canvas()
    draw_scene_text(draw, "MODULE A", "OUTLIER", pos_y=50)

    # Particle Population Cluster
    cx, cy = 520, 340

    # Cluster of normal dots
    dots = [
        (-80, -40), (-50, 30), (-20, -60), (10, 40), (40, -30), (70, 20),
        (-110, 10), (-30, -20), (30, -50), (60, 60), (-70, -70), (0, 0),
        (50, 10), (-40, 50), (20, -10), (80, -20), (-90, 40), (10, -70)
    ]
    for dx, dy in dots:
        px, py = cx + dx, cy + dy
        draw.ellipse([(px - 4, py - 4), (px + 4, py + 4)], fill=BLUE_ELECTRIC)

    # Isolated Outlier Point separating from cluster
    sep_x = 840 + (f_idx % 2) * 15
    sep_y = 260 - (f_idx % 2) * 10
    draw.line([(cx + 40, cy - 20), (sep_x, sep_y)], fill=LINE_SUBTLE, width=1)

    # Outlier Point + Ring Highlight
    draw.ellipse([(sep_x - 14, sep_y - 14), (sep_x + 14, sep_y + 14)], fill=None, outline=AMBER_WARN, width=2)
    draw.ellipse([(sep_x - 5, sep_y - 5), (sep_x + 5, sep_y + 5)], fill=AMBER_WARN)

    # Compact Tags Below
    draw.text((WIDTH // 2 - 55, 540), "MAD  •  COPOD  •  IF", fill=TEXT_MUTED, font=f_small)

    return img


def render_frame_5(f_idx):
    """Scene 5: Module B — 168h Forecast (Frame 9 & 10)."""
    img, draw = create_base_canvas()
    draw_scene_text(draw, "MODULE B", "168h FORECAST", pos_y=50)

    # Trajectory Line Points
    x0, y0 = 200, 440
    x24, y24 = 460, 380
    x168, y168 = 1000, 160

    # Timeline Checkpoints
    for x_val, label in [(x0, "0h"), (x24, "24h"), (x168, "168h")]:
        draw.line([(x_val, 120), (x_val, 520)], fill=LINE_SUBTLE, width=1)
        draw.text((x_val - 12, 530), label, fill=TEXT_MUTED, font=f_bold)

    # Transparent / Soft Confidence Band around forecast
    band_pts = [
        (x24, y24 - 10), (x168, y168 - 45), (x168, y168 + 45), (x24, y24 + 10)
    ]
    draw.polygon(band_pts, fill=(15, 45, 75))

    # Solid Line: 0h to 24h Observed
    draw.line([(x0, y0), (x24, y24)], fill=CYAN_GLOW, width=3)
    draw.ellipse([(x0 - 5, y0 - 5), (x0 + 5, y0 + 5)], fill=CYAN_GLOW)
    draw.ellipse([(x24 - 5, y24 - 5), (x24 + 5, y24 + 5)], fill=CYAN_GLOW)

    # Light Dashed Line: 24h to 168h Projected
    steps = 25
    for s in range(0, steps, 2):
        t1 = s / steps
        t2 = min((s + 1) / steps, 1.0)
        px1 = x24 + t1 * (x168 - x24)
        py1 = y24 + t1 * (y168 - y24)
        px2 = x24 + t2 * (x168 - x24)
        py2 = y24 + t2 * (y168 - y24)
        draw.line([(px1, py1), (px2, py2)], fill=CYAN_SOFT, width=2)

    return img


def render_frame_6(f_idx):
    """Scene 6: Reliability Check Gate & Markers (Frame 11 & 12)."""
    img, draw = create_base_canvas()
    draw_scene_text(draw, "RELIABILITY CHECK", pos_y=50)

    # Vertical Glowing Reliability Gate in Center
    gx = 600
    draw.line([(gx, 140), (gx, 500)], fill=CYAN_GLOW, width=3)

    # Trajectory passing through gate
    draw.line([(200, 420), (gx, 320)], fill=CYAN_GLOW, width=3)
    draw.line([(gx, 320), (1000, 220)], fill=AMBER_WARN, width=3)

    # 4 Floating Evidence Markers around gate
    markers = [
        ("BTI", 440, 220),
        ("TIMING", 760, 220),
        ("LEAKAGE", 440, 420),
        ("THERMAL", 760, 420),
    ]

    for label, mx, my in markers:
        draw.ellipse([(mx - 6, my - 6), (mx + 6, my + 6)], fill=BG_DARK, outline=CYAN_GLOW, width=2)
        draw.line([(mx, my), (gx, 320)], fill=LINE_SUBTLE, width=1)
        draw.text((mx - 22, my - 24), label, fill=TEXT_MUTED, font=f_bold)

    return img


def render_frame_7(f_idx):
    """Scene 7: Screening Gate & Decision (Frame 13 & 14)."""
    img, draw = create_base_canvas()
    draw_scene_text(draw, "SCREENING", pos_y=50)

    # Bright line reaching screening decision point
    sx = 450
    sy = 320
    draw.line([(150, sy), (sx, sy)], fill=CYAN_GLOW, width=3)
    draw.ellipse([(sx - 6, sy - 6), (sx + 6, sy + 6)], fill=CYAN_GLOW)

    # 3 Clean Outcome Choices
    outcomes = [
        ("PASS", 650, 220, GREEN_PASS),
        ("MONITOR", 650, 320, AMBER_WARN),
        ("REJECT", 650, 420, RED_RISK),
    ]

    for label, ox, oy, col in outcomes:
        is_selected = (label == "REJECT")
        draw.line([(sx, sy), (ox, oy)], fill=col if is_selected else LINE_SUBTLE, width=2 if is_selected else 1)
        draw.text((ox + 20, oy - 10), label, fill=col if is_selected else TEXT_DIM, font=f_h2)

        if is_selected:
            draw.ellipse([(ox - 6, oy - 6), (ox + 6, oy + 6)], fill=col)

    return img


def render_frame_8(f_idx):
    """Scene 8: Final Hero Tagline & Smooth Loop (Frame 15 & 16)."""
    img, draw = create_base_canvas()

    # Semiconductor Outline Center
    draw_chip_package(draw, WIDTH // 2, 250, progress=1.0)

    # Large Centered Title
    draw.text((WIDTH // 2 - 210, 400), "FIND THE PROBLEM EARLIER", fill=TEXT_MAIN, font=f_h1)

    # Supporting Subtitle
    draw.text((WIDTH // 2 - 145, 460), "TELEMETRY  →  DRIFT  →  SCREENING", fill=CYAN_GLOW, font=f_sub)

    # Footer
    draw.text((WIDTH // 2 - 70, 560), "PREDICTA • SIH PS-170", fill=TEXT_DIM, font=f_small)

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
    durations = [600] * 16  # 16 frames * 600ms = 9.6s loop duration

    for i, renderer in enumerate(RENDERERS, 1):
        frame_img = renderer(i)
        preview_path = os.path.join(PREVIEW_DIR, f"frame_{i:02d}.png")
        frame_img.save(preview_path)
        frames.append(frame_img)
        print(f"[SUCCESS] Rendered Frame {i:02d}/16 -> {preview_path}")

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
