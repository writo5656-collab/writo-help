"""
NPC Studio V3 — generates the new entity models + their textures.

  python3 npc-studio/tools/make_models.py

Writes:
  RP/models/entity/npcstudio_camera.geo.json    pyramid camera (lens point -> 16:9 frame), pixel-line style
  RP/models/entity/npcstudio_outline.geo.json   selection outline (classic + slim), wireframe boxes around each limb
  RP/models/entity/npcstudio_cape.geo.json      cape
  RP/models/entity/npcstudio_backdrop.geo.json  green-screen box (rendered from the inside)
  RP/textures/entity/npcstudio/...              matching textures

Model space: forward is -Z (same as vanilla mobs), 16 units = 1 block.
"""
import json, math, os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), "..")
RP = os.path.join(ROOT, "RP")
MODELS = os.path.join(RP, "models", "entity")
TEX = os.path.join(RP, "textures", "entity", "npcstudio")


def save_geo(name, geos):
    os.makedirs(MODELS, exist_ok=True)
    with open(os.path.join(MODELS, name), "w") as f:
        json.dump({"format_version": "1.16.0", "minecraft:geometry": geos}, f, indent=1)


def r(v):
    return round(v, 3)


# ----------------------------------------------------------------------------------------------
# Pyramid camera. Lines are rows of small cubes (no cube rotations, so nothing depends on
# Bedrock's rotation order). FOV changes the frame size through a bone scale in the animation.
# ----------------------------------------------------------------------------------------------
CAM_DEPTH = 11.0          # lens -> frame distance (units)
CAM_HALF_W = 7.0          # frame half width at the reference FOV (70°)
CAM_HALF_H = CAM_HALF_W * 9 / 16
LINE = 0.55               # line thickness
STEP = 0.32               # spacing of the cubes along a line


def line_cubes(a, b, t=LINE):
    """Cubes along the segment a->b."""
    dx, dy, dz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    length = math.sqrt(dx * dx + dy * dy + dz * dz)
    n = max(1, int(math.ceil(length / STEP)))
    out = []
    for i in range(n + 1):
        k = i / n
        x, y, z = a[0] + dx * k, a[1] + dy * k, a[2] + dz * k
        out.append({"origin": [r(x - t / 2), r(y - t / 2), r(z - t / 2)], "size": [t, t, t], "uv": [0, 0]})
    return out


def box_edge(a, b, t=LINE):
    """One straight axis-aligned edge as a single long cube."""
    lo = [min(a[i], b[i]) - t / 2 for i in range(3)]
    hi = [max(a[i], b[i]) + t / 2 for i in range(3)]
    return {"origin": [r(v) for v in lo], "size": [r(hi[i] - lo[i]) for i in range(3)], "uv": [0, 0]}


def make_camera():
    apex = (0.0, 0.0, 0.0)
    z = -CAM_DEPTH
    w, h = CAM_HALF_W, CAM_HALF_H
    corners = [(-w, -h, z), (w, -h, z), (w, h, z), (-w, h, z)]
    diag = []
    for c in corners:
        diag += line_cubes(apex, c)
    frame = [box_edge(corners[i], corners[(i + 1) % 4]) for i in range(4)]
    # "this way up" triangle above the frame, like a real viewfinder
    tri = []
    tw, th, base = 2.6, 2.4, h + 1.2
    tri += line_cubes((-tw, base, z), (tw, base, z))
    tri += line_cubes((-tw, base, z), (0, base + th, z))
    tri += line_cubes((tw, base, z), (0, base + th, z))
    lens = [{"origin": [-1.0, -1.0, -1.0], "size": [2, 2, 2], "uv": [0, 0]}]
    save_geo("npcstudio_camera.geo.json", [{
        "description": {
            "identifier": "geometry.npcstudio.camera",
            "texture_width": 4, "texture_height": 4,
            "visible_bounds_width": 3, "visible_bounds_height": 3, "visible_bounds_offset": [0, 0, 0]
        },
        "bones": [
            {"name": "root", "pivot": [0, 0, 0]},
            {"name": "aim", "parent": "root", "pivot": [0, 0, 0], "cubes": lens},
            {"name": "frustum", "parent": "aim", "pivot": [0, 0, 0], "cubes": diag + frame + tri}
        ]
    }])
    os.makedirs(TEX, exist_ok=True)
    for name, col in {"cam_blue": (54, 168, 255), "cam_green": (61, 255, 110), "cam_grey": (150, 158, 170)}.items():
        Image.new("RGBA", (4, 4), col + (255,)).save(os.path.join(TEX, f"{name}.png"))


# ----------------------------------------------------------------------------------------------
# Selection outline: the humanoid skeleton (same bone names + pivots, so the pose animations move
# it too) with every cube slightly bigger than armor. Each face shows only a thin frame, so you see
# a cyan wireframe box around every body part.
# ----------------------------------------------------------------------------------------------
OUT_INFLATE = 1.15
K = 2  # texels per unit on the outline texture


def humanoid(slim):
    aw = 3 if slim else 4
    return [
        ("root", None, [0, 0, 0], []),
        ("waist", "root", [0, 12, 0], []),
        ("body", "waist", [0, 24, 0], [([-4, 12, -2], [8, 12, 4])]),
        ("head", "body", [0, 24, 0], [([-4, 24, -4], [8, 8, 8])]),
        ("rightArm", "body", [-5, 22 if not slim else 21.5, 0], [([-4 - aw, 12 if not slim else 11.5, -2], [aw, 12, 4])]),
        ("leftArm", "body", [5, 22 if not slim else 21.5, 0], [([4, 12 if not slim else 11.5, -2], [aw, 12, 4])]),
        ("rightLeg", "root", [-1.9, 12, 0], [([-3.9, 0, -2], [4, 12, 4])]),
        ("leftLeg", "root", [1.9, 12, 0], [([-0.1, 0, -2], [4, 12, 4])]),
    ]


def outline_atlas():
    dims = set()
    for slim in (False, True):
        for _, _, _, cubes in humanoid(slim):
            for _, (sx, sy, sz) in cubes:
                dims |= {(sx, sy), (sz, sy), (sx, sz)}
    # pack rows left to right
    pos, x, y, row_h, W = {}, 0, 0, 0, 64
    for d in sorted(dims, key=lambda d: -d[1]):
        w, h = d[0] * K, d[1] * K
        if x + w > W:
            x, y, row_h = 0, y + row_h, 0
        pos[d] = (x, y)
        x += w
        row_h = max(row_h, h)
    H = 64
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(img)
    cy = (39, 211, 245, 255)
    for (w, h), (px, py) in pos.items():
        g.rectangle([px, py, px + w * K - 1, py + h * K - 1], outline=cy, width=1)
    img.save(os.path.join(TEX, "outline.png"))
    return pos


def make_outline():
    pos = outline_atlas()
    geos = []
    for slim in (False, True):
        bones = []
        for name, parent, pivot, cubes in humanoid(slim):
            b = {"name": name, "pivot": pivot}
            if parent:
                b["parent"] = parent
            cs = []
            for origin, (sx, sy, sz) in cubes:
                def face(w, h):
                    px, py = pos[(w, h)]
                    return {"uv": [px, py], "uv_size": [w * K, h * K]}
                cs.append({
                    "origin": origin, "size": [sx, sy, sz], "inflate": OUT_INFLATE,
                    "uv": {
                        "north": face(sx, sy), "south": face(sx, sy),
                        "east": face(sz, sy), "west": face(sz, sy),
                        "up": face(sx, sz), "down": face(sx, sz)
                    }
                })
            if cs:
                b["cubes"] = cs
            bones.append(b)
        geos.append({
            "description": {
                "identifier": "geometry.npcstudio.outline" + ("_slim" if slim else ""),
                "texture_width": 64, "texture_height": 64,
                "visible_bounds_width": 2, "visible_bounds_height": 3, "visible_bounds_offset": [0, 1.5, 0]
            },
            "bones": bones
        })
    save_geo("npcstudio_outline.geo.json", geos)


# ----------------------------------------------------------------------------------------------
# Cape (vanilla cape layout: 64x32 texture, 10x16x1 cube)
# ----------------------------------------------------------------------------------------------
CAPES = [
    ("studio", (16, 120, 200), (39, 211, 245)),
    ("crimson", (120, 16, 24), (220, 40, 52)),
    ("shadow", (14, 14, 18), (60, 60, 72)),
    ("snow", (200, 206, 214), (255, 255, 255)),
    ("royal", (60, 20, 110), (150, 80, 230)),
    ("gold", (150, 100, 10), (250, 200, 50)),
    ("forest", (20, 70, 30), (70, 170, 70)),
    ("ocean", (10, 40, 90), (40, 120, 220)),
]


def make_capes():
    save_geo("npcstudio_cape.geo.json", [{
        "description": {"identifier": "geometry.npcstudio.cape", "texture_width": 64, "texture_height": 32,
                        "visible_bounds_width": 2, "visible_bounds_height": 3, "visible_bounds_offset": [0, 1.5, 0]},
        "bones": [
            {"name": "root", "pivot": [0, 0, 0]},
            {"name": "waist", "parent": "root", "pivot": [0, 12, 0]},
            {"name": "body", "parent": "waist", "pivot": [0, 24, 0]},
            {"name": "cape", "parent": "body", "pivot": [0, 24, 3.2], "rotation": [0, 180, 0],
             "cubes": [{"origin": [-5, 8, 3.2], "size": [10, 16, 1], "uv": [0, 0]}]}
        ]
    }])
    d = os.path.join(TEX, "capes")
    os.makedirs(d, exist_ok=True)
    for i, (name, dark, light) in enumerate(CAPES):
        img = Image.new("RGBA", (64, 32), dark + (255,))
        g = ImageDraw.Draw(img)
        # back face of the cube (what you see from behind) is at u 12..22, v 1..17; front at 1..11
        for fx in (1, 12):
            for yy in range(1, 17):
                k = yy / 16
                col = tuple(int(dark[c] + (light[c] - dark[c]) * (1 - k) * 0.8) for c in range(3))
                g.line([(fx, yy), (fx + 9, yy)], fill=col + (255,))
            g.rectangle([fx, 1, fx + 9, 16], outline=light + (255,))
        if name == "studio":
            # small blocky figure from the logo on the back
            c = (255, 255, 255, 255)
            g.rectangle([16, 4, 17, 5], fill=c)
            g.rectangle([15, 6, 18, 9], fill=c)
            g.rectangle([15, 10, 15, 12], fill=c)
            g.rectangle([18, 10, 18, 12], fill=c)
        img.save(os.path.join(d, f"cape{i + 1}.png"))


# ----------------------------------------------------------------------------------------------
# Backdrop: a 1-block box drawn from the inside, scaled up by the entity (green screen etc.)
# ----------------------------------------------------------------------------------------------
def make_backdrop():
    save_geo("npcstudio_backdrop.geo.json", [{
        "description": {"identifier": "geometry.npcstudio.backdrop", "texture_width": 4, "texture_height": 4,
                        "visible_bounds_width": 8, "visible_bounds_height": 8, "visible_bounds_offset": [0, 0, 0]},
        "bones": [{"name": "box", "pivot": [0, 0, 0],
                   "cubes": [{"origin": [-8, 0, -8], "size": [16, 16, 16], "uv": [0, 0]}]}]
    }])
    for name, col in {"backdrop_green": (0, 255, 0), "backdrop_black": (0, 0, 0), "backdrop_white": (255, 255, 255),
                      "backdrop_blue": (0, 71, 187)}.items():
        Image.new("RGBA", (4, 4), col + (255,)).save(os.path.join(TEX, f"{name}.png"))


# ----------------------------------------------------------------------------------------------
# Depth Fog presets: far things fade into a colour, close things stay sharp (per player, /fog push)
# ----------------------------------------------------------------------------------------------
FOG_PRESETS = {
    "white": "#FFFFFF", "black": "#000000", "haze": "#C9DCF2", "sunset": "#F39A5B",
    "night": "#16244A", "horror": "#3A0D0D", "dream": "#F5B8E8", "smoke": "#7A7F87",
}
FOG_DISTANCES = [6, 10, 16, 24, 32, 48, 64, 96, 128]


# Depth Map fogs (like DMS): white until Gradient Start, then a straight fade to black over Max Distance.
# Blocks (1 chunk = 16 blocks).
DEPTH_STARTS = [0, 8, 16, 32, 48, 64, 96, 128]
DEPTH_LENGTHS = [16, 32, 48, 64, 96, 128, 192, 256]


def make_depth_fogs():
    d = os.path.join(RP, "fogs")
    for st in DEPTH_STARTS:
        for ln in DEPTH_LENGTHS:
            layer = {"fog_start": float(st), "fog_end": float(st + ln), "fog_color": "#000000", "render_distance_type": "fixed"}
            data = {"format_version": "1.16.100", "minecraft:fog_settings": {
                "description": {"identifier": f"npcstudio:depth_{st}_{ln}"},
                "distance": {"air": layer, "weather": dict(layer), "water": dict(layer)}}}
            with open(os.path.join(d, f"npcstudio_depth_{st}_{ln}.json"), "w") as f:
                json.dump(data, f, indent=1)


def make_fogs():
    d = os.path.join(RP, "fogs")
    os.makedirs(d, exist_ok=True)
    for f in os.listdir(d):
        if f.startswith("npcstudio_"):
            os.remove(os.path.join(d, f))
    for name, col in FOG_PRESETS.items():
        for dist in FOG_DISTANCES:
            air = {"fog_start": round(dist * 0.08, 2), "fog_end": float(dist), "fog_color": col, "render_distance_type": "fixed"}
            data = {"format_version": "1.16.100", "minecraft:fog_settings": {
                "description": {"identifier": f"npcstudio:fog_{name}_{dist}"},
                "distance": {"air": air, "weather": dict(air)}}}
            with open(os.path.join(d, f"npcstudio_{name}_{dist}.json"), "w") as fh:
                json.dump(data, fh, indent=1)


def make_prop():
    """Same skeleton as the player, no cubes: only the item in the right hand is drawn."""
    save_geo("npcstudio_prop.geo.json", [{
        "description": {"identifier": "geometry.npcstudio.prop", "texture_width": 64, "texture_height": 64,
                        "visible_bounds_width": 3, "visible_bounds_height": 3, "visible_bounds_offset": [0, 1, 0]},
        "bones": [
            {"name": "root", "pivot": [0, 0, 0]},
            {"name": "waist", "parent": "root", "pivot": [0, 12, 0]},
            {"name": "body", "parent": "waist", "pivot": [0, 24, 0]},
            {"name": "head", "parent": "body", "pivot": [0, 24, 0]},
            {"name": "rightArm", "parent": "body", "pivot": [-5, 22, 0]},
            {"name": "rightItem", "parent": "rightArm", "pivot": [-6, 15, 1]},
            {"name": "leftArm", "parent": "body", "pivot": [5, 22, 0]},
            {"name": "leftItem", "parent": "leftArm", "pivot": [6, 15, 1]},
            {"name": "rightLeg", "parent": "root", "pivot": [-1.9, 12, 0]},
            {"name": "leftLeg", "parent": "root", "pivot": [1.9, 12, 0]}
        ]
    }])


# ----------------------------------------------------------------------------------------------
# Silhouette outline (V3.1): a slightly bigger copy of the NPC drawn with inverted culling, so only
# its far side shows around the edges, like the Java NPC Studio outline. 3 thicknesses, classic/slim,
# and an "armored" set that sits outside armor.
# ----------------------------------------------------------------------------------------------
SIL_THICK = [0.15, 0.3, 0.55]  # V3.2: thin by default, just enough to notice
ARMOR_EXTRA = 1.0


def make_silhouette():
    geos = []
    for ti, t in enumerate(SIL_THICK):
        for slim in (False, True):
            for armored in (False, True):
                extra = ARMOR_EXTRA if armored else 0.0
                bones = []
                for name, parent, pivot, cubes in humanoid(slim):
                    b = {"name": name, "pivot": pivot}
                    if parent:
                        b["parent"] = parent
                    layer = 0.5 if name == "head" else 0.25  # hat / sleeve layers
                    cs = [{"origin": o, "size": sz, "inflate": round(max(layer, extra) + t, 3), "uv": [0, 0]} for o, sz in cubes]
                    if cs:
                        b["cubes"] = cs
                    bones.append(b)
                geos.append({"description": {
                    "identifier": f"geometry.npcstudio.sil_{ti}{'_slim' if slim else ''}{'_armor' if armored else ''}",
                    "texture_width": 4, "texture_height": 4,
                    "visible_bounds_width": 2, "visible_bounds_height": 3, "visible_bounds_offset": [0, 1.5, 0]},
                    "bones": bones})
    save_geo("npcstudio_silhouette.geo.json", geos)
    Image.new("RGBA", (4, 4), (64, 228, 255, 255)).save(os.path.join(TEX, "outline_sil.png"))
    mats = os.path.join(RP, "materials")
    os.makedirs(mats, exist_ok=True)
    with open(os.path.join(mats, "entity.material"), "w") as f:
        json.dump({"materials": {"version": "1.0.0",
                                 "npcstudio_outline:entity": {"+states": ["InvertCulling"], "-states": ["DisableCulling"]}}}, f, indent=2)


if __name__ == "__main__":
    make_silhouette()
    make_prop()
    make_fogs()
    make_depth_fogs()
    make_camera()
    make_outline()
    make_capes()
    make_backdrop()
    print("models + textures written")
