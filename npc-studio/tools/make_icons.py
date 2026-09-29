"""
NPC Studio v3.2 icon set: 32x32 pixel-art glyphs with a dark outline, top highlight and drop
shadow (Minecraft UI style), saved at 64x64. Icons that map to a real Minecraft item use the
vanilla texture instead (see VANILLA_ICONS in BP/scripts/core.js).
"""
import math, os
from PIL import Image, ImageDraw, ImageFilter, ImageChops

OUT = os.path.join(os.path.dirname(__file__), "..", "RP", "textures", "ui", "npcstudio")
S = 32
OUTLINE = (20, 24, 30, 255)
PAL = {
    "cyan": (70, 205, 235), "green": (95, 205, 90), "red": (230, 75, 70), "yellow": (250, 205, 60),
    "white": (235, 238, 242), "orange": (240, 150, 55), "purple": (175, 110, 235), "blue": (80, 130, 245),
    "gray": (150, 160, 172), "dark": (55, 62, 72), "gold": (235, 180, 50),
}


def canvas():
    return Image.new("RGBA", (S, S), (0, 0, 0, 0))


def finish(layers, name):
    """layers: list of (mask_image_L, color). Adds shading, outline, shadow."""
    base = canvas()
    union = Image.new("L", (S, S), 0)
    for mask, col in layers:
        # vertical shading: lighter top, darker bottom
        grad = Image.new("RGBA", (S, S))
        px = grad.load()
        for y in range(S):
            k = 1.18 - 0.36 * (y / (S - 1))
            c = tuple(max(0, min(255, int(v * k))) for v in col)
            for x in range(S):
                px[x, y] = c + (255,)
        base.paste(grad, (0, 0), mask)
        union = ImageChops.lighter(union, mask)
    # 1px inner highlight on the top edge of each shape
    up = ImageChops.offset(union, 0, 1)
    edge = ImageChops.subtract(union, up)
    hl = Image.new("RGBA", (S, S), (255, 255, 255, 110))
    base.paste(hl, (0, 0), edge)
    # outline + shadow
    outline_mask = union.filter(ImageFilter.MaxFilter(3))
    shadow_mask = ImageChops.offset(outline_mask, 1, 2)
    out = canvas()
    out.paste(Image.new("RGBA", (S, S), (0, 0, 0, 90)), (0, 0), shadow_mask)
    out.paste(Image.new("RGBA", (S, S), OUTLINE), (0, 0), outline_mask)
    out.alpha_composite(base)
    out.resize((64, 64), Image.NEAREST).save(os.path.join(OUT, f"icon_{name}.png"))


def mask():
    m = Image.new("L", (S, S), 0)
    return m, ImageDraw.Draw(m)


def arrow_poly(cx, cy, angle, length, shaft=3, head=8):
    a = math.radians(angle)
    dx, dy = math.cos(a), math.sin(a)
    px, py = -dy, dx
    tipx, tipy = cx + dx * length, cy + dy * length
    bx, by = cx + dx * (length - head), cy + dy * (length - head)
    return [
        (cx + px * shaft / 2, cy + py * shaft / 2), (bx + px * shaft / 2, by + py * shaft / 2),
        (bx + px * head / 2, by + py * head / 2), (tipx, tipy), (bx - px * head / 2, by - py * head / 2),
        (bx - px * shaft / 2, by - py * shaft / 2), (cx - px * shaft / 2, cy - py * shaft / 2),
    ]


def arc_arrow(clockwise=True):
    m, d = mask()
    d.arc([6, 7, 26, 27], 200 if clockwise else -20, 520 - 180 if clockwise else 160, fill=255, width=4)
    return m, d


ICONS = {}


def icon(fn):
    ICONS[fn.__name__] = fn
    return fn


@icon
def back():
    m, d = mask()
    d.polygon(arrow_poly(26, 16, 180, 21, shaft=6, head=14), fill=255)
    finish([(m, PAL["white"])], "back")


@icon
def plus():
    m, d = mask()
    d.rectangle([13, 5, 18, 26], fill=255)
    d.rectangle([5, 13, 26, 18], fill=255)
    finish([(m, PAL["green"])], "plus")


@icon
def done():
    m, d = mask()
    d.line([(6, 17), (13, 24), (26, 8)], fill=255, width=5)
    finish([(m, PAL["green"])], "done")


@icon
def clear_x():
    m, d = mask()
    d.line([(8, 8), (24, 24)], fill=255, width=5)
    d.line([(24, 8), (8, 24)], fill=255, width=5)
    finish([(m, PAL["red"])], "clear_x")


@icon
def delete():
    m, d = mask()
    d.rectangle([9, 11, 22, 27], fill=255)
    d.rectangle([7, 7, 24, 9], fill=255)
    d.rectangle([13, 4, 18, 6], fill=255)
    lines, dl = mask()
    for x in (12, 16, 20):
        dl.rectangle([x - 1, 13, x, 25], fill=255)
    body = ImageChops.subtract(m, lines)
    finish([(body, PAL["red"])], "delete")


@icon
def undo():
    m, d = mask()
    d.arc([7, 8, 27, 28], 180, 360 + 60, fill=255, width=4)
    d.polygon([(2, 17), (13, 17), (7.5, 25)], fill=255)
    finish([(m, PAL["cyan"])], "undo")


@icon
def redo():
    m, d = mask()
    d.arc([5, 8, 25, 28], 120, 360, fill=255, width=4)
    d.polygon([(19, 17), (30, 17), (24.5, 25)], fill=255)
    finish([(m, PAL["cyan"])], "redo")


@icon
def refresh():
    m, d = mask()
    d.arc([6, 6, 26, 26], 20, 160, fill=255, width=4)
    d.arc([6, 6, 26, 26], 200, 340, fill=255, width=4)
    d.polygon([(22, 3), (29, 10), (21, 12)], fill=255)
    d.polygon([(10, 29), (3, 22), (11, 20)], fill=255)
    finish([(m, PAL["cyan"])], "refresh")


@icon
def clear():
    # reset: circular arrow around a dot
    m, d = mask()
    d.arc([5, 5, 27, 27], 60, 360, fill=255, width=4)
    d.polygon([(22, 1), (29, 9), (19, 11)], fill=255)
    dot, dd = mask()
    dd.ellipse([13, 13, 19, 19], fill=255)
    finish([(m, PAL["orange"]), (dot, PAL["white"])], "clear")


@icon
def play():
    m, d = mask()
    d.polygon([(9, 5), (27, 16), (9, 27)], fill=255)
    finish([(m, PAL["green"])], "play")


@icon
def record():
    ring, dr = mask()
    dr.ellipse([4, 4, 28, 28], fill=255)
    inner, di = mask()
    di.ellipse([9, 9, 23, 23], fill=255)
    finish([(ImageChops.subtract(ring, inner), PAL["white"]), (inner, PAL["red"])], "record")


@icon
def lock():
    shackle, ds = mask()
    ds.arc([9, 3, 23, 19], 180, 360, fill=255, width=4)
    ds.rectangle([9, 10, 12, 15], fill=255)
    ds.rectangle([20, 10, 23, 15], fill=255)
    body, db = mask()
    db.rectangle([6, 14, 26, 28], fill=255)
    hole, dh = mask()
    dh.rectangle([15, 18, 17, 24], fill=255)
    finish([(shackle, PAL["gray"]), (ImageChops.subtract(body, hole), PAL["gold"])], "lock")


@icon
def move():
    m, d = mask()
    d.rectangle([14, 6, 17, 25], fill=255)
    d.rectangle([6, 14, 25, 17], fill=255)
    d.polygon([(15.5, 0), (22, 7), (9, 7)], fill=255)
    d.polygon([(15.5, 31), (22, 24), (9, 24)], fill=255)
    d.polygon([(0, 15.5), (7, 9), (7, 22)], fill=255)
    d.polygon([(31, 15.5), (24, 9), (24, 22)], fill=255)
    finish([(m, PAL["white"])], "move")


@icon
def turn():
    m, d = mask()
    d.arc([5, 5, 27, 27], 300, 600, fill=255, width=4)
    d.polygon([(20, 1), (29, 8), (18, 12)], fill=255)
    finish([(m, PAL["yellow"])], "turn")


@icon
def gizmo():
    # the classic 3-axis transform gizmo
    x, dx = mask(); dx.polygon(arrow_poly(12, 20, 0, 18, shaft=3, head=8), fill=255)
    y, dy = mask(); dy.polygon(arrow_poly(12, 20, -90, 18, shaft=3, head=8), fill=255)
    z, dz = mask(); dz.polygon(arrow_poly(12, 20, 140, 11, shaft=3, head=7), fill=255)
    c, dc = mask(); dc.rectangle([10, 18, 14, 22], fill=255)
    finish([(z, PAL["blue"]), (x, PAL["red"]), (y, PAL["green"]), (c, PAL["white"])], "gizmo")


@icon
def scale():
    m, d = mask()
    d.polygon(arrow_poly(16, 16, -45, 15, shaft=4, head=10), fill=255)
    d.polygon(arrow_poly(16, 16, 135, 15, shaft=4, head=10), fill=255)
    box, db = mask()
    db.rectangle([3, 3, 28, 28], outline=255, width=2)
    finish([(box, PAL["gray"]), (m, PAL["purple"])], "scale")


@icon
def mirror():
    l, dl = mask(); dl.polygon([(3, 16), (13, 6), (13, 26)], fill=255)
    r, dr = mask(); dr.polygon([(29, 16), (19, 6), (19, 26)], fill=255)
    c, dc = mask()
    for y in range(3, 30, 5):
        dc.rectangle([15, y, 16, y + 2], fill=255)
    finish([(l, PAL["cyan"]), (r, PAL["orange"]), (c, PAL["white"])], "mirror")


@icon
def clone():
    a, da = mask(); da.rectangle([4, 4, 19, 19], fill=255)
    b, db = mask(); db.rectangle([12, 12, 27, 27], fill=255)
    finish([(a, PAL["gray"]), (b, PAL["cyan"])], "clone")


@icon
def sliders():
    tracks, dt = mask()
    knobs, dk = mask()
    for i, (y, kx) in enumerate([(7, 20), (16, 10), (25, 17)]):
        dt.rectangle([4, y - 1, 27, y], fill=255)
        dk.rectangle([kx - 3, y - 4, kx + 3, y + 3], fill=255)
    finish([(tracks, PAL["gray"]), (knobs, PAL["yellow"])], "sliders")


@icon
def camera():
    body, db = mask()
    db.rectangle([3, 10, 28, 26], fill=255)
    db.rectangle([9, 6, 17, 10], fill=255)
    lens, dl = mask()
    dl.ellipse([10, 11, 22, 23], fill=255)
    inner, di = mask()
    di.ellipse([13, 14, 19, 20], fill=255)
    finish([(ImageChops.subtract(body, lens), PAL["dark"]), (ImageChops.subtract(lens, inner), PAL["cyan"]), (inner, PAL["white"])], "camera")


@icon
def film():
    board, db = mask()
    db.rectangle([4, 13, 27, 27], fill=255)
    top, dtp = mask()
    dtp.polygon([(3, 6), (26, 2), (27, 8), (4, 12)], fill=255)
    stripes, ds = mask()
    for x in range(6, 26, 6):
        ds.polygon([(x, 6), (x + 3, 5), (x + 5, 9), (x + 2, 10)], fill=255)
    finish([(board, PAL["dark"]), (ImageChops.subtract(top, stripes), PAL["white"]), (stripes, PAL["dark"])], "film")


@icon
def sequence():
    cols = [PAL["cyan"], PAL["yellow"], PAL["green"]]
    layers = []
    for i, col in enumerate(cols):
        m, d = mask()
        d.rectangle([2 + i * 10, 9, 9 + i * 10, 22], fill=255)
        layers.append((m, col))
    finish(layers, "sequence")


@icon
def item_shield():
    m, d = mask()
    d.polygon([(6, 4), (26, 4), (26, 16), (16, 29), (6, 16)], fill=255)
    cross, dc = mask()
    dc.rectangle([15, 6, 17, 25], fill=255)
    dc.rectangle([8, 11, 24, 13], fill=255)
    finish([(ImageChops.subtract(m, cross), PAL["blue"]), (cross, PAL["gold"])], "item_shield")


if __name__ == "__main__":
    for fn in ICONS.values():
        fn()
    print(f"{len(ICONS)} icons")
