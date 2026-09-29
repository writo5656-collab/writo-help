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


# ---------------------------------------------------------------- feature icons (v3.3)
SKIN_C, SHIRT_C, PANTS_C = (225, 170, 130), (60, 190, 215), (70, 75, 160)


def person_layers(ox=0, oy=0, sc=1.0, arms="down", shirt=SHIRT_C):
    """Steve-coloured blocky figure -> list of (mask, colour) layers"""
    def R(d, x0, y0, x1, y1):
        d.rectangle([ox + x0 * sc, oy + y0 * sc, ox + x1 * sc, oy + y1 * sc], fill=255)
    head, dh = mask(); R(dh, 11, 1, 20, 9)
    hair, dr = mask(); R(dr, 11, 1, 20, 3)
    body, db = mask(); R(db, 11, 11, 20, 19)
    arm, da = mask()
    if arms == "down": R(da, 6, 11, 9, 19); R(da, 22, 11, 25, 19)
    elif arms == "up": R(da, 6, 1, 9, 11); R(da, 22, 1, 25, 11)
    elif arms == "wave": R(da, 6, 11, 9, 19); R(da, 22, 0, 25, 10)
    legs, dl = mask(); R(dl, 11, 21, 15, 30); R(dl, 16, 21, 20, 30)
    return [(ImageChops.subtract(head, hair), SKIN_C), (hair, (100, 65, 35)), (body, shirt), (arm, SKIN_C), (legs, PANTS_C)]


@icon
def pose_manual():
    g, dg = mask(); dg.ellipse([19, 17, 31, 29], fill=255)
    h, dh = mask(); dh.ellipse([23, 21, 27, 25], fill=255)
    finish(person_layers(ox=-3, arms="wave") + [(ImageChops.subtract(g, h), PAL["yellow"])], "pose_manual")


@icon
def pose_preset():
    st, ds = mask(); ds.polygon([(25, 13), (27, 18), (32, 18), (28, 21), (30, 27), (25, 23), (20, 27), (22, 21), (18, 18), (23, 18)], fill=255)
    finish(person_layers(ox=-5, arms="up") + [(st, PAL["yellow"])], "pose_preset")


@icon
def spawn():
    pl, dp = mask(); dp.rectangle([23, 17, 26, 30], fill=255); dp.rectangle([18, 22, 31, 25], fill=255)
    finish(person_layers(ox=-5) + [(pl, PAL["green"])], "spawn")


@icon
def manage():
    g, dg = mask()
    dg.ellipse([18, 16, 31, 29], fill=255)
    for a in range(0, 360, 45):
        x = 24.5 + math.cos(math.radians(a)) * 7; y = 22.5 + math.sin(math.radians(a)) * 7
        dg.rectangle([x - 1.5, y - 1.5, x + 1.5, y + 1.5], fill=255)
    h, dh = mask(); dh.ellipse([22, 20, 27, 25], fill=255)
    finish(person_layers(ox=-5) + [(ImageChops.subtract(g, h), PAL["gray"])], "manage")


@icon
def bulkequip():
    finish(person_layers(ox=-8, oy=5, sc=0.75, shirt=PAL["gray"]) + person_layers(ox=10, oy=5, sc=0.75, shirt=PAL["gray"]) + person_layers(ox=1, oy=0, sc=0.75), "bulkequip")


@icon
def skin():
    face, d = mask(); d.rectangle([5, 5, 26, 26], fill=255)
    hair, dh = mask(); dh.rectangle([5, 5, 26, 11], fill=255); dh.rectangle([5, 5, 7, 15], fill=255); dh.rectangle([24, 5, 26, 15], fill=255)
    eyes, de = mask(); de.rectangle([9, 15, 12, 17], fill=255); de.rectangle([19, 15, 22, 17], fill=255)
    mouth, dm = mask(); dm.rectangle([12, 21, 19, 22], fill=255)
    skinm = ImageChops.subtract(ImageChops.subtract(ImageChops.subtract(face, hair), eyes), mouth)
    finish([(skinm, (225, 170, 130)), (hair, (110, 70, 40)), (eyes, PAL["blue"]), (mouth, (150, 90, 70))], "skin")


def chestplate(d, ox=0, oy=0):
    d.polygon([(ox + 4, oy + 5), (ox + 11, oy + 3), (ox + 16, oy + 7), (ox + 21, oy + 3), (ox + 28, oy + 5), (ox + 28, oy + 13),
               (ox + 24, oy + 13), (ox + 24, oy + 28), (ox + 8, oy + 28), (ox + 8, oy + 13), (ox + 4, oy + 13)], fill=255)


@icon
def equip():
    m, d = mask(); chestplate(d)
    finish([(m, PAL["cyan"])], "equip")


@icon
def armor_set():
    h, dh = mask(); dh.rectangle([10, 1, 21, 5], fill=255); dh.rectangle([8, 3, 11, 9], fill=255); dh.rectangle([20, 3, 23, 9], fill=255)
    c, dc = mask(); dc.polygon([(5, 11), (11, 10), (16, 13), (21, 10), (27, 11), (27, 17), (24, 17), (24, 30), (8, 30), (8, 17), (5, 17)], fill=255)
    finish([(h, PAL["purple"]), (c, PAL["purple"])], "armor_set")


@icon
def trim():
    m, d = mask(); chestplate(d)
    pat, dp = mask()
    dp.polygon([(16, 11), (21, 16), (16, 21), (11, 16)], fill=255)
    dp.rectangle([10, 24, 22, 25], fill=255)
    finish([(ImageChops.subtract(m, pat), PAL["gray"]), (pat, PAL["gold"])], "trim")


@icon
def copy_outfit():
    back_, db = mask(); chestplate(db, ox=-3, oy=-2)
    front, df = mask(); chestplate(df, ox=3, oy=2)
    finish([(back_, PAL["gray"]), (front, PAL["cyan"])], "copy_outfit")


@icon
def enchant():
    b, db = mask(); db.rectangle([5, 8, 24, 28], fill=255)
    pg, dp = mask(); dp.rectangle([8, 10, 24, 26], fill=255)
    sp, ds = mask()
    for cx, cy, r in [(24, 7, 5), (11, 17, 3), (18, 21, 2)]:
        ds.polygon([(cx, cy - r), (cx + r / 3, cy - r / 3), (cx + r, cy), (cx + r / 3, cy + r / 3), (cx, cy + r), (cx - r / 3, cy + r / 3), (cx - r, cy), (cx - r / 3, cy - r / 3)], fill=255)
    finish([(ImageChops.subtract(b, pg), PAL["purple"]), (ImageChops.subtract(pg, sp), PAL["white"]), (sp, PAL["purple"])], "enchant")


@icon
def custom():
    m, d = mask(); d.polygon([(3, 16), (11, 7), (28, 7), (28, 25), (11, 25)], fill=255)
    h, dh = mask(); dh.ellipse([9, 14, 13, 18], fill=255)
    finish([(ImageChops.subtract(m, h), PAL["yellow"])], "custom")


@icon
def rename():
    pen, dp = mask(); dp.polygon([(6, 22), (22, 6), (27, 11), (11, 27), (5, 28)], fill=255)
    tip, dt = mask(); dt.polygon([(6, 22), (11, 27), (5, 28)], fill=255)
    er, de = mask(); de.polygon([(22, 6), (25, 3), (30, 8), (27, 11)], fill=255)
    finish([(ImageChops.subtract(pen, tip), PAL["yellow"]), (tip, PAL["white"]), (er, (240, 120, 150))], "rename")


@icon
def save():
    m, d = mask(); d.rectangle([4, 4, 27, 27], fill=255)
    lab, dl = mask(); dl.rectangle([8, 4, 23, 12], fill=255)
    slot, ds = mask(); ds.rectangle([18, 6, 21, 10], fill=255)
    bot, db = mask(); db.rectangle([8, 17, 23, 27], fill=255)
    finish([(ImageChops.subtract(ImageChops.subtract(m, lab), bot), PAL["blue"]), (ImageChops.subtract(lab, slot), PAL["white"]), (bot, PAL["gray"])], "save")


@icon
def paste():
    board, db = mask(); db.rectangle([6, 5, 25, 29], fill=255)
    paper, dp = mask(); dp.rectangle([9, 9, 22, 26], fill=255)
    clip, dc = mask(); dc.rectangle([11, 2, 20, 7], fill=255)
    lines, dl = mask()
    for y in (13, 17, 21): dl.rectangle([11, y, 20, y], fill=255)
    finish([(ImageChops.subtract(board, paper), PAL["orange"]), (ImageChops.subtract(paper, lines), PAL["white"]), (clip, PAL["gray"])], "paste")


@icon
def animate():
    strip, ds = mask(); ds.rectangle([2, 6, 29, 25], fill=255)
    holes, dh = mask()
    for x in range(4, 29, 5): dh.rectangle([x, 8, x + 2, 9], fill=255); dh.rectangle([x, 22, x + 2, 23], fill=255)
    tri, dt = mask(); dt.polygon([(12, 11), (21, 15.5), (12, 20)], fill=255)
    finish([(ImageChops.subtract(ImageChops.subtract(strip, holes), tri), PAL["dark"]), (tri, PAL["green"])], "animate")


@icon
def fov():
    ring, dr = mask(); dr.ellipse([3, 3, 22, 22], fill=255)
    glass, dg = mask(); dg.ellipse([7, 7, 18, 18], fill=255)
    hnd, dh = mask(); dh.polygon([(18, 21), (21, 18), (30, 27), (27, 30)], fill=255)
    finish([(ImageChops.subtract(ring, glass), PAL["gray"]), (glass, PAL["cyan"]), (hnd, PAL["orange"])], "fov")


@icon
def waypoint():
    m, d = mask(); d.ellipse([7, 3, 25, 21], fill=255); d.polygon([(9, 16), (23, 16), (16, 30)], fill=255)
    h, dh = mask(); dh.ellipse([12, 8, 20, 16], fill=255)
    finish([(ImageChops.subtract(m, h), PAL["red"]), (h, PAL["white"])], "waypoint")


@icon
def shake():
    m, d = mask(); d.line([(2, 16), (7, 8), (12, 24), (17, 6), (22, 26), (27, 10), (30, 16)], fill=255, width=3)
    finish([(m, PAL["orange"])], "shake")


@icon
def ride():
    m, d = mask()
    d.polygon([(8, 29), (8, 16), (12, 8), (18, 4), (22, 2), (21, 6), (27, 12), (27, 17), (23, 18), (19, 14), (15, 18), (16, 29)], fill=255)
    mane, dm = mask(); dm.polygon([(8, 16), (12, 8), (18, 4), (17, 8), (13, 12), (11, 20)], fill=255)
    eye, de = mask(); de.rectangle([20, 8, 21, 9], fill=255)
    finish([(ImageChops.subtract(ImageChops.subtract(m, mane), eye), (170, 110, 60)), (mane, (70, 45, 25)), (eye, PAL["dark"])], "ride")


@icon
def dismount():
    door, dd = mask(); dd.rectangle([4, 3, 16, 29], outline=255, width=3)
    ar, da = mask(); da.polygon(arrow_poly(12, 16, 0, 18, shaft=4, head=10), fill=255)
    finish([(door, PAL["gray"]), (ar, PAL["orange"])], "dismount")


@icon
def exit():
    door, dd = mask(); dd.rectangle([4, 3, 16, 29], outline=255, width=3)
    ar, da = mask(); da.polygon(arrow_poly(12, 16, 0, 18, shaft=4, head=10), fill=255)
    finish([(door, PAL["gray"]), (ar, PAL["red"])], "exit")


@icon
def freeze():
    m, d = mask()
    for a in (0, 60, 120):
        r = math.radians(a)
        d.line([(16 - 13 * math.cos(r), 16 - 13 * math.sin(r)), (16 + 13 * math.cos(r), 16 + 13 * math.sin(r))], fill=255, width=3)
    for a in range(0, 360, 60):
        r = math.radians(a); x, y = 16 + 9 * math.cos(r), 16 + 9 * math.sin(r)
        d.ellipse([x - 2.5, y - 2.5, x + 2.5, y + 2.5], fill=255)
    finish([(m, (160, 220, 250))], "freeze")


@icon
def debug():
    m, d = mask(); d.arc([8, 3, 24, 19], 180, 90, fill=255, width=4); d.rectangle([14, 17, 18, 22], fill=255); d.rectangle([14, 25, 18, 29], fill=255)
    finish([(m, PAL["yellow"])], "debug")


@icon
def preset():
    m, d = mask(); d.polygon([(7, 3), (25, 3), (25, 29), (16, 22), (7, 29)], fill=255)
    st, ds = mask(); ds.polygon([(16, 7), (18, 11), (22, 11), (19, 14), (20, 18), (16, 16), (12, 18), (13, 14), (10, 11), (14, 11)], fill=255)
    finish([(ImageChops.subtract(m, st), PAL["red"]), (st, PAL["yellow"])], "preset")


@icon
def world():
    g, dg = mask(); dg.ellipse([3, 3, 28, 28], fill=255)
    land, dl = mask()
    dl.polygon([(8, 8), (15, 6), (17, 12), (12, 17), (7, 14)], fill=255)
    dl.polygon([(18, 16), (26, 15), (25, 24), (19, 26)], fill=255)
    land = ImageChops.multiply(land, g)
    finish([(ImageChops.subtract(g, land), PAL["blue"]), (land, PAL["green"])], "world")


def sun_mask(r_core=6, rays=True):
    m, d = mask(); d.ellipse([16 - r_core, 16 - r_core, 16 + r_core, 16 + r_core], fill=255)
    if rays:
        for a in range(0, 360, 45):
            r = math.radians(a); d.line([(16 + 9 * math.cos(r), 16 + 9 * math.sin(r)), (16 + 14 * math.cos(r), 16 + 14 * math.sin(r))], fill=255, width=3)
    return m


@icon
def day():
    finish([(sun_mask(), PAL["yellow"])], "day")


@icon
def sun():
    finish([(sun_mask(7), PAL["yellow"])], "sun")


@icon
def sunset():
    s_ = sun_mask(7)
    cut, dc = mask(); dc.rectangle([0, 19, 31, 31], fill=255)
    hz, dh = mask(); dh.rectangle([2, 21, 29, 23], fill=255); dh.rectangle([7, 26, 24, 27], fill=255)
    finish([(ImageChops.subtract(s_, cut), PAL["orange"]), (hz, PAL["red"])], "sunset")


def moon():
    m, d = mask(); d.ellipse([5, 4, 27, 26], fill=255)
    c, dc = mask(); dc.ellipse([11, 1, 31, 21], fill=255)
    return ImageChops.subtract(m, c)


@icon
def night():
    finish([(moon(), (225, 225, 170))], "night")


@icon
def midnight():
    st, ds = mask()
    for x, y in [(24, 6), (27, 18), (19, 26)]: ds.rectangle([x - 1, y - 1, x + 1, y + 1], fill=255)
    finish([(moon(), (190, 190, 240)), (st, PAL["white"])], "midnight")


def cloud(d, oy=0):
    d.ellipse([4, 8 + oy, 16, 20 + oy], fill=255); d.ellipse([11, 4 + oy, 25, 18 + oy], fill=255); d.ellipse([19, 9 + oy, 29, 19 + oy], fill=255); d.rectangle([8, 13 + oy, 25, 19 + oy], fill=255)


@icon
def rain():
    c, dc = mask(); cloud(dc)
    r, dr = mask()
    for x in (9, 16, 23): dr.line([(x, 22), (x - 2, 29)], fill=255, width=2)
    finish([(c, PAL["gray"]), (r, PAL["blue"])], "rain")


@icon
def thunder():
    c, dc = mask(); cloud(dc, -2)
    b, db = mask(); db.polygon([(17, 14), (11, 23), (15, 23), (12, 31), (21, 20), (17, 20), (20, 14)], fill=255)
    finish([(c, PAL["dark"]), (b, PAL["yellow"])], "thunder")


@icon
def eye():
    m, d = mask(); d.ellipse([2, 8, 29, 24], fill=255)
    iris, di = mask(); di.ellipse([10, 8, 21, 24], fill=255)
    pup, dp = mask(); dp.ellipse([13, 12, 18, 19], fill=255)
    finish([(ImageChops.subtract(m, iris), PAL["white"]), (ImageChops.subtract(iris, pup), PAL["green"]), (pup, PAL["dark"])], "eye")


@icon
def flycam():
    body, db = mask(); db.rectangle([10, 13, 21, 19], fill=255)
    arms, da = mask(); da.line([(5, 9), (26, 23)], fill=255, width=2); da.line([(26, 9), (5, 23)], fill=255, width=2)
    props, dp = mask()
    for x, y in [(5, 8), (26, 8), (5, 24), (26, 24)]: dp.ellipse([x - 5, y - 2, x + 5, y + 2], fill=255)
    lens, dl = mask(); dl.rectangle([14, 19, 17, 22], fill=255)
    finish([(arms, PAL["gray"]), (props, PAL["cyan"]), (body, PAL["dark"]), (lens, PAL["red"])], "flycam")


# ---------------------------------------------------------------- hotbar tool items (32x32)
@icon
def tool_select():
    m, d = mask(); d.polygon([(8, 3), (8, 26), (13, 21), (17, 30), (21, 28), (17, 19), (24, 19)], fill=255)
    finish([(m, PAL["white"])], "tool_select")


@icon
def tool_axis():
    x, dx = mask(); dx.rectangle([4, 4, 12, 12], fill=255)
    y, dy = mask(); dy.rectangle([20, 4, 28, 12], fill=255)
    z, dz = mask(); dz.rectangle([12, 19, 20, 27], fill=255)
    finish([(x, PAL["red"]), (y, PAL["green"]), (z, PAL["blue"])], "tool_axis")


ITEM_ICONS = {  # hotbar tool item -> icon it reuses
    "tool_select": "tool_select", "tool_rotate": "turn", "tool_move": "move", "tool_axis": "tool_axis",
    "tool_undo": "undo", "tool_reset": "clear", "tool_done": "done",
}

SKIN_FILES = ["steve", "alex", "dream", "technoblade", "warden", "soldier", "knight", "mage", "assassin", "noxeelmc", "mercenary", "scientist"] + [f"custom_slot{i}" for i in range(1, 21)]


def make_head(skin_png, out_png):
    """Head icon from a skin: face + hat layer, outlined, with a drop shadow (64x64)."""
    sk = Image.open(skin_png).convert("RGBA")
    k = sk.width // 64
    face = sk.crop((8 * k, 8 * k, 16 * k, 16 * k)).resize((8, 8), Image.NEAREST)
    hat = sk.crop((40 * k, 8 * k, 48 * k, 16 * k)).resize((8, 8), Image.NEAREST)
    face.alpha_composite(hat)
    icon = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    icon.alpha_composite(Image.new("RGBA", (28, 28), (0, 0, 0, 90)), (3, 4))
    icon.alpha_composite(Image.new("RGBA", (28, 28), OUTLINE), (2, 2))
    solid = Image.new("RGBA", (8, 8), (0, 0, 0, 255))
    solid.alpha_composite(face)
    icon.alpha_composite(solid.resize((24, 24), Image.NEAREST), (4, 4))
    icon.resize((64, 64), Image.NEAREST).save(out_png)


def make_heads():
    src = os.path.join(OUT, "..", "..", "entity", "npcstudio")
    dst = os.path.join(OUT, "heads")
    os.makedirs(dst, exist_ok=True)
    for i, name in enumerate(SKIN_FILES):
        make_head(os.path.join(src, f"{name}.png"), os.path.join(dst, f"skin{i}.png"))


if __name__ == "__main__":
    make_heads()
    for fn in ICONS.values():
        fn()
    items = os.path.join(OUT, "..", "..", "items")
    for item, src in ITEM_ICONS.items():
        Image.open(os.path.join(OUT, f"icon_{src}.png")).resize((32, 32), Image.NEAREST).save(os.path.join(items, f"npcstudio_{item}.png"))
    blank = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    blank.save(os.path.join(items, "npcstudio_cam_exit.png"))
    blank.save(os.path.join(items, "npcstudio_cam_lock.png"))
    print(f"{len(ICONS)} icons, {len(ITEM_ICONS)} tool items")
