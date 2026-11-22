"""
NPC Studio — posable mobs. Any of these mobs can be an NPC body and is posed part by part like a player.

  python3 npc-studio/tools/make_mobs.py                     (run AFTER make_custom.py: it edits its output)
  python3 npc-studio/tools/make_mobs.py --src <bedrock-samples>/resource_pack
                                                            (re-reads Minecraft's own mob models first)

How it works
  * skin_index 42+ = a mob (0-11 premade skins, 12-31 custom skins, 32-41 custom 3D models).
  * Each mob gets its own copy of Minecraft's model (models/entity/npcstudio_mobs.geo.json) with the
    bones NPC Studio poses renamed to the player names (head, body, rightArm, leftArm, rightLeg, leftLeg)
    and everything under one "root" bone. So the same pose properties, the pose editor, the gizmo,
    the loop animations and presets all work on mobs with no extra code.
  * "body" is a new group bone: turning the body turns the torso and the head together, like a player.
  * Mobs with more legs than an NPC has parts (spiders) move the extra legs with the nearest part
    (small per-mob animations, animation.npcstudio.mobx.<key>).
  * The textures are Minecraft's own (textures/entity/...), so nothing is copied into the pack.
  * Button icons: heads/skin<42+n>.png, the mob's face cut from its texture.
"""
import argparse, json, os, re, glob
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
RP, BP = os.path.join(ROOT, "RP"), os.path.join(ROOT, "BP")
CACHE = os.path.join(ROOT, "art", "vanilla_mobs")  # Minecraft's mob models + faces, read once from bedrock-samples
HEADS = os.path.join(RP, "textures", "ui", "npcstudio", "heads")
FIRST_MOB = 42
BOUNDS = {"visible_bounds_width": 6, "visible_bounds_height": 6, "visible_bounds_offset": [0, 1.5, 0]}

PARTS = ("head", "body", "right_arm", "left_arm", "right_leg", "left_leg")
BONE = {"head": "head", "body": "body", "right_arm": "rightArm", "left_arm": "leftArm", "right_leg": "rightLeg", "left_leg": "leftLeg"}
H = {"head": "head", "body": "body", "right_arm": "rightArm", "left_arm": "leftArm", "right_leg": "rightLeg", "left_leg": "leftLeg"}
LEGS4 = {"right_arm": "Front right leg", "left_arm": "Front left leg", "right_leg": "Back right leg", "left_leg": "Back left leg"}
WINGS = {"right_arm": "Right wing", "left_arm": "Left wing"}

# key, name, geometry, texture, part -> vanilla bone, options
#   labels: part names shown in the pose editor (default Head/Body/Right arm/...)
#   hide:   bones (and their children) left out (saddles, chests, hats for professions...)
#   kind:   "biped" (legs hang from the root like a player) or "animal" (everything hangs from the body)
#   extra:  more bones that follow a part (spider legs)
#   rest:   rotation added to a bone so the mob stands the way it does in game
#   glow:   the texture's alpha means "glows" (enderman / spider eyes), not "see-through"
#   icon:   the bone whose front is the button picture (default: the head part)
MOBS = [
    ("zombie", "Zombie", "geometry.zombie.v1.8", "textures/entity/zombie/zombie", H, {}),
    ("husk", "Husk", "geometry.zombie.husk.v1.8", "textures/entity/zombie/husk", H, {}),
    ("drowned", "Drowned", "geometry.zombie.drowned.v1.16", "textures/entity/zombie/drowned", H, {}),
    ("skeleton", "Skeleton", "geometry.skeleton.v1.8", "textures/entity/skeleton/skeleton", H, {}),
    ("wither_skeleton", "Wither Skeleton", "geometry.skeleton.wither.v1.8", "textures/entity/skeleton/wither_skeleton", H, {}),
    ("enderman", "Enderman", "geometry.enderman.v1.8", "textures/entity/enderman/enderman", H, {"glow": True}),
    ("creeper", "Creeper", "geometry.creeper.v1.8", "textures/entity/creeper/creeper",
     {"head": "head", "body": "body", "right_arm": "leg2", "left_arm": "leg3", "right_leg": "leg0", "left_leg": "leg1"},
     {"labels": LEGS4, "kind": "animal"}),
    ("wandering_trader", "Wandering Trader", "geometry.villager_v2", "textures/entity/wandering_trader",
     {"head": "head", "body": "body", "right_arm": "arms", "right_leg": "leg0", "left_leg": "leg1"},
     {"labels": {"right_arm": "Arms"}, "hide": ["helmet", "brim"]}),
    ("witch", "Witch", "geometry.villager.witch.v1.8", "textures/entity/witch",
     {"head": "head", "body": "body", "right_arm": "arms", "right_leg": "leg0", "left_leg": "leg1"},
     {"labels": {"right_arm": "Arms"}}),
    ("pillager", "Pillager", "geometry.pillager", "textures/entity/pillager",
     {"head": "head", "body": "body", "right_arm": "rightarm", "left_arm": "leftarm", "right_leg": "rightLeg", "left_leg": "leftLeg"}, {}),
    ("vindicator", "Vindicator", "geometry.vindicator.v1.8", "textures/entity/vindicator",
     {"head": "head", "body": "body", "right_arm": "rightArm", "left_arm": "leftArm", "right_leg": "leg0", "left_leg": "leg1"},
     {"hide": ["arms"]}),
    ("evoker", "Evoker", "geometry.evoker.v1.8", "textures/entity/illager/evoker", H, {"hide": ["arms"]}),
    ("piglin", "Piglin", "geometry.piglin", "textures/entity/piglin/piglin",
     {"head": "head", "body": "body", "right_arm": "rightarm", "left_arm": "leftarm", "right_leg": "rightleg", "left_leg": "leftleg"}, {}),
    ("piglin_brute", "Piglin Brute", "geometry.piglin", "textures/entity/piglin/piglin_brute",
     {"head": "head", "body": "body", "right_arm": "rightarm", "left_arm": "leftarm", "right_leg": "rightleg", "left_leg": "leftleg"}, {}),
    ("zombified_piglin", "Zombified Piglin", "geometry.piglin", "textures/entity/piglin/zombie_piglin",
     {"head": "head", "body": "body", "right_arm": "rightarm", "left_arm": "leftarm", "right_leg": "rightleg", "left_leg": "leftleg"}, {}),
    ("vex", "Vex", "geometry.vex.v1.8", "textures/entity/vex/vex",
     {"head": "head", "body": "body", "right_arm": "rightArm", "left_arm": "leftArm", "right_leg": "rightWing", "left_leg": "leftWing"},
     {"labels": {"right_leg": "Right wing", "left_leg": "Left wing"}}),
    ("iron_golem", "Iron Golem", "geometry.irongolem", "textures/entity/iron_golem",
     {"head": "head", "body": "body", "right_arm": "arm0", "left_arm": "arm1", "right_leg": "leg0", "left_leg": "leg1"}, {}),
    ("warden", "Warden", "geometry.warden", "textures/entity/warden/warden",
     {"head": "head", "body": "body", "right_arm": "right_arm", "left_arm": "left_arm", "right_leg": "right_leg", "left_leg": "left_leg"}, {}),
    ("allay", "Allay", "geometry.allay", "textures/entity/allay/allay",
     {"head": "head", "body": "body", "right_arm": "right_arm", "left_arm": "left_arm", "right_leg": "right_wing", "left_leg": "left_wing"},
     {"labels": {"right_leg": "Right wing", "left_leg": "Left wing"}}),
    ("cow", "Cow", "geometry.cow.v2", "textures/entity/cow/cow_v2",
     {"head": "head", "body": "body", "right_arm": "leg2", "left_arm": "leg3", "right_leg": "leg0", "left_leg": "leg1"}, {"labels": LEGS4, "kind": "animal"}),
    ("mooshroom", "Mooshroom", "geometry.mooshroom.v2", "textures/entity/cow/mooshroom_v2",
     {"head": "head", "body": "body", "right_arm": "leg2", "left_arm": "leg3", "right_leg": "leg0", "left_leg": "leg1"}, {"labels": LEGS4, "kind": "animal"}),
    ("pig", "Pig", "geometry.pig.v3", "textures/entity/pig/pig_v3",
     {"head": "head", "body": "body", "right_arm": "leg2", "left_arm": "leg3", "right_leg": "leg0", "left_leg": "leg1"}, {"labels": LEGS4, "kind": "animal"}),
    ("wolf", "Wolf", "geometry.wolf", "textures/entity/wolf/wolf",
     {"head": "head", "body": "body", "right_arm": "leg2", "left_arm": "leg3", "right_leg": "leg0", "left_leg": "leg1"}, {"labels": LEGS4, "kind": "animal"}),
    ("fox", "Fox", "geometry.fox", "textures/entity/fox/fox",
     {"head": "head", "body": "body", "right_arm": "leg2", "left_arm": "leg3", "right_leg": "leg0", "left_leg": "leg1"},
     {"labels": LEGS4, "kind": "animal", "hide": ["head_sleeping"]}),
    ("horse", "Horse", "geometry.horse.v3", "textures/entity/horse2/horse_brown",
     {"head": "Neck", "body": "Body", "right_arm": "LegFR", "left_arm": "LegFL", "right_leg": "LegBR", "left_leg": "LegBL"},
     {"labels": {"head": "Head & neck", **LEGS4}, "kind": "animal", "icon": "Head",
      "hide": ["MuleEarL", "MuleEarR", "ReinsL", "ReinsR", "Bridle", "BagL", "BagR", "Saddle"]}),
    ("camel", "Camel", "geometry.camel", "textures/entity/camel/camel",
     {"head": "head", "body": "body", "right_arm": "right_front_leg", "left_arm": "left_front_leg", "right_leg": "right_hind_leg", "left_leg": "left_hind_leg"},
     {"labels": LEGS4, "kind": "animal", "hide": ["saddle", "bridle", "reins"]}),
    ("spider", "Spider", "geometry.spider.v1.8", "textures/entity/spider/spider",
     {"head": "head", "body": "body0", "right_arm": "leg6", "left_arm": "leg7", "right_leg": "leg0", "left_leg": "leg1"},
     {"labels": {"right_arm": "Right front legs", "left_arm": "Left front legs", "right_leg": "Right back legs", "left_leg": "Left back legs"},
      "kind": "animal", "glow": True,
      "rest": {"leg0": [0, 45, -45], "leg1": [0, -45, 45], "leg2": [0, 22.5, -33.3], "leg3": [0, -22.5, 33.3],
               "leg4": [0, -22.5, -33.3], "leg5": [0, 22.5, 33.3], "leg6": [0, -45, -45], "leg7": [0, 45, 45]},
      "extra": {"leg4": "right_arm", "leg5": "left_arm", "leg2": "right_leg", "leg3": "left_leg"}}),
    ("axolotl", "Axolotl", "geometry.axolotl", "textures/entity/axolotl/axolotl_lucy",
     {"head": "head", "body": "body", "right_arm": "right_arm", "left_arm": "left_arm", "right_leg": "right_leg", "left_leg": "left_leg"},
     {"labels": LEGS4, "kind": "animal"}),
    ("frog", "Frog", "geometry.frog", "textures/entity/frog/temperate_frog",
     {"head": "head", "body": "body", "right_arm": "right_arm", "left_arm": "left_arm", "right_leg": "right_leg", "left_leg": "left_leg"},
     {"kind": "animal", "hide": ["tongue", "croaking_body"]}),
]
DEFAULT_LABELS = {"head": "Head", "body": "Body", "right_arm": "Right arm", "left_arm": "Left arm", "right_leg": "Right leg", "left_leg": "Left leg"}


# ---------------------------------------------------------------------------------------------- reading
def _load(p):
    return json.loads(re.sub(r'^\s*//.*$', '', open(p, encoding="utf-8").read(), flags=re.M))


def read_vanilla(src):
    raw = {}
    for f in [os.path.join(src, "models", "mobs.json")] + glob.glob(os.path.join(src, "models", "entity", "*.json")):
        try:
            d = _load(f)
        except Exception:
            continue
        if "minecraft:geometry" in d:
            for g in d["minecraft:geometry"]:
                de = g["description"]
                raw[de["identifier"]] = {"parent": None, "tw": de.get("texture_width"), "th": de.get("texture_height"), "bones": g.get("bones", [])}
        else:
            for k, v in d.items():
                if k.startswith("geometry."):
                    name, _, par = k.partition(":")
                    raw[name] = {"parent": par or None, "tw": v.get("texturewidth"), "th": v.get("textureheight"), "bones": v.get("bones", [])}

    def resolve(gid):
        g = raw[gid]
        if not g["parent"]:
            return {"tw": g["tw"] or 64, "th": g["th"] or 64, "bones": json.loads(json.dumps(g["bones"]))}
        base = resolve(g["parent"])
        bones = {b["name"]: b for b in base["bones"]}
        order = [b["name"] for b in base["bones"]]
        for b in g["bones"]:
            if b["name"] in bones:
                bones[b["name"]] = {**bones[b["name"]], **b}
            else:
                bones[b["name"]] = dict(b)
                order.append(b["name"])
        return {"tw": g["tw"] or base["tw"], "th": g["th"] or base["th"], "bones": [bones[n] for n in order]}

    os.makedirs(os.path.join(CACHE, "tex"), exist_ok=True)
    for key, _, gid, tex, *_ in MOBS:
        with open(os.path.join(CACHE, f"{key}.json"), "w") as f:
            json.dump({"source": gid, **resolve(gid)}, f, indent=1)
        path = next(p for p in (os.path.join(src, tex + e) for e in (".png", ".tga")) if os.path.exists(p))
        Image.open(path).convert("RGBA").save(os.path.join(CACHE, "tex", f"{key}.png"))
    print("read", len(MOBS), "mob models from", src)


# ---------------------------------------------------------------------------------------------- converting
def cube_box(c):
    o, s = c.get("origin", [0, 0, 0]), c.get("size", [0, 0, 0])
    return o, [o[i] + s[i] for i in range(3)]


def bone_box(bones, name):
    lo, hi = [1e9] * 3, [-1e9] * 3
    for b in bones:
        if b["name"] != name:
            continue
        for c in b.get("cubes", []):
            a, z = cube_box(c)
            lo = [min(lo[i], a[i]) for i in range(3)]
            hi = [max(hi[i], z[i]) for i in range(3)]
    return (lo, hi) if lo[0] < 1e9 else None


def convert(key, vanilla, parts, opt):
    bones = json.loads(json.dumps(vanilla["bones"]))
    low = lambda s: (s or "").lower()
    # drop hidden bones with their children
    hide = {low(h) for h in opt.get("hide", [])}
    changed = True
    while changed:
        changed = False
        for b in list(bones):
            if low(b["name"]) in hide or low(b.get("parent")) in hide:
                if low(b["name"]) not in hide:
                    hide.add(low(b["name"]))
                bones.remove(b)
                changed = True
    out = []
    for b in bones:
        nb = {k: v for k, v in b.items() if k in ("name", "parent", "pivot", "rotation", "cubes", "locators")}
        if "rotation" not in nb and b.get("bind_pose_rotation"):
            nb["rotation"] = b["bind_pose_rotation"]
        cubes = [] if b.get("neverRender") else [dict(c) for c in b.get("cubes", [])]
        for c in cubes:  # bone-wide mirror / inflate go onto each cube
            if b.get("mirror") and "mirror" not in c:
                c["mirror"] = True
            if b.get("inflate") and "inflate" not in c:
                c["inflate"] = b["inflate"]
        nb["cubes"] = cubes
        if not nb["cubes"]:
            del nb["cubes"]
        out.append(nb)
    bones = out

    # rename: the posed bones get the player names; anything already called that steps aside
    src_to_part = {low(v): p for p, v in parts.items()}
    targets = {low(BONE[p]) for p in parts} | {"root", "torso_v"}
    rename = {}
    for b in bones:
        n = low(b["name"])
        if n in src_to_part:
            rename[n] = BONE[src_to_part[n]]
        elif n in targets:
            rename[n] = b["name"] + "_v"
    for b in bones:
        b["name"] = rename.get(low(b["name"]), b["name"])
        if b.get("parent"):
            b["parent"] = rename.get(low(b["parent"]), b["parent"])
    by = {low(b["name"]): b for b in bones}
    missing = [p for p in parts if low(BONE[p]) not in by]
    if missing:
        raise SystemExit(f"{key}: no bone for {missing} ({[b['name'] for b in bones]})")

    def ancestors(name):
        seen, b = [], by.get(low(name))
        while b and b.get("parent"):
            seen.append(low(b["parent"]))
            b = by.get(low(b["parent"]))
        return seen

    # pivots the pose turns around: missing ones go to the top centre of the part; arms that turn
    # around the middle of the model (iron golem) get their own shoulder
    for p in parts:
        b = by[low(BONE[p])]
        box = bone_box(bones, b["name"])
        if box and (not b.get("pivot")):
            lo, hi = box
            b["pivot"] = [(lo[0] + hi[0]) / 2, hi[1], (lo[2] + hi[2]) / 2]
        if box and p in ("right_arm", "left_arm") and abs(b["pivot"][0]) < 0.5 and abs((box[0][0] + box[1][0]) / 2) > 2:
            b["pivot"] = [(box[0][0] + box[1][0]) / 2, b["pivot"][1], b["pivot"][2]]
        b.setdefault("pivot", [0, 0, 0])

    # body = a group around the torso, so the head (and a biped's arms) turn with it
    torso = by["body"]
    torso["name"] = "torso_v"
    for b in bones:
        if low(b.get("parent")) == "body":
            b["parent"] = "torso_v"
    group = {"name": "body", "pivot": list(torso["pivot"])}
    if torso.get("parent"):
        group["parent"] = torso["parent"]
    torso["parent"] = "body"
    bones.insert(0, group)
    by = {low(b["name"]): b for b in bones}
    biped = opt.get("kind", "biped") == "biped"
    attach = ["head"] + (["rightArm", "leftArm"] if biped else [])
    for n in attach:
        if low(n) in by and "body" not in ancestors(n):
            by[low(n)]["parent"] = "body"
    if biped:  # legs hang from the root, like a player's (bending the body doesn't drag them along)
        for n in ("rightLeg", "leftLeg"):
            if low(n) in by and "body" in ancestors(n):
                by[low(n)]["parent"] = "root"

    for name, rot in opt.get("rest", {}).items():
        b = by[low(rename.get(low(name), name))]
        b["rotation"] = [a + c for a, c in zip(b.get("rotation", [0, 0, 0]), rot)]

    # one root for the whole mob (NPC Studio moves / turns the root)
    for b in bones:
        if not b.get("parent"):
            b["parent"] = "root"
    bones.insert(0, {"name": "root", "pivot": [0, 0, 0]})
    extra = {rename.get(low(k), k): v for k, v in opt.get("extra", {}).items()}
    return {"description": {"identifier": f"geometry.npcstudio.mob.{key}", "texture_width": vanilla["tw"], "texture_height": vanilla["th"], **BOUNDS},
            "bones": bones}, extra


def face_icon(key, vanilla, parts, opt):
    """The front of the head cube, scaled up crisp (the same look as the NPC skin head icons)."""
    tex = Image.open(os.path.join(CACHE, "tex", f"{key}.png")).convert("RGBA")
    sx, sy = tex.width / vanilla["tw"], tex.height / vanilla["th"]
    hide = {h.lower() for h in opt.get("hide", [])}
    names = {opt.get("icon", parts["head"]).lower()}
    if not any(b["name"].lower() in names and b.get("cubes") for b in vanilla["bones"]):
        for _ in range(3):  # a head drawn by a child bone (allay)
            names |= {b["name"].lower() for b in vanilla["bones"] if (b.get("parent") or "").lower() in names}
    best = None
    for b in vanilla["bones"]:
        if b["name"].lower() not in names or b["name"].lower() in hide or b.get("neverRender"):
            continue
        for c in b.get("cubes", []):
            w, h, d = c["size"]
            uv = c.get("uv", [0, 0])
            if isinstance(uv, dict):
                n = uv.get("north")
                if not n:
                    continue
                rect = (n["uv"][0], n["uv"][1], n["uv_size"][0], n["uv_size"][1])
            else:
                rect = (uv[0] + d, uv[1] + d, w, h)
            if best is None or w * h > best[2] * best[3]:
                best = rect
    if best is None:
        raise SystemExit(f"{key}: no head cube for the icon")
    x, y, w, h = best
    if w < 0:
        x, w = x + w, -w
    face = tex.crop((round(x * sx), round(y * sy), round((x + w) * sx), round((y + h) * sy)))
    side = 64
    k = max(1, min(side // max(1, face.width), side // max(1, face.height)))
    face = face.resize((face.width * k, face.height * k), Image.NEAREST)
    icon = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    icon.paste(face, ((side - face.width) // 2, (side - face.height) // 2))
    return icon


# ---------------------------------------------------------------------------------------------- writing
def pose_rot(part):
    return [f"query.property('npcstudio:{part}_x')", f"query.property('npcstudio:{part}_y')", f"query.property('npcstudio:{part}_z')"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", help="bedrock-samples resource_pack folder (re-reads Minecraft's mob models)")
    a = ap.parse_args()
    if a.src:
        read_vanilla(a.src)

    geos, js, extras = [], [], {}
    for i, (key, name, gid, tex, parts, opt) in enumerate(MOBS):
        vanilla = json.load(open(os.path.join(CACHE, f"{key}.json")))
        geo, extra = convert(key, vanilla, parts, opt)
        geos.append(geo)
        if extra:
            extras[key] = extra
        face_icon(key, vanilla, parts, opt).save(os.path.join(HEADS, f"skin{FIRST_MOB + i}.png"))
        labels = {p: opt.get("labels", {}).get(p, DEFAULT_LABELS[p]) for p in PARTS if p in parts}
        js.append({"key": key, "name": name, "parts": labels})
    with open(os.path.join(RP, "models", "entity", "npcstudio_mobs.geo.json"), "w") as f:
        json.dump({"format_version": "1.16.0", "minecraft:geometry": geos}, f, indent=1)

    # extra bones that follow a part (spider legs)
    anims = {}
    for key, extra in extras.items():
        anims[f"animation.npcstudio.mobx.{key}"] = {"loop": True, "bones": {b: {"rotation": pose_rot(p)} for b, p in extra.items()}}
    with open(os.path.join(RP, "animations", "npcstudio.mobs.json"), "w") as f:
        json.dump({"format_version": "1.10.0", "animations": anims}, f, indent=1)

    # client entity: geometry + textures + render controllers + the extra animations
    skin = "query.property('npcstudio:skin_index')"
    ep = os.path.join(RP, "entity", "npc_studio.json")
    ent = json.load(open(ep))
    d = ent["minecraft:client_entity"]["description"]
    for k in [k for k in d["geometry"] if k.startswith("mob_")]:
        del d["geometry"][k]
    for k in [k for k in d["textures"] if k.startswith("mob_")]:
        del d["textures"][k]
    for key, _, _, tex, *_ in MOBS:
        d["geometry"][f"mob_{key}"] = f"geometry.npcstudio.mob.{key}"
        d["textures"][f"mob_{key}"] = tex
    d["animations"] = {k: v for k, v in d["animations"].items() if not k.startswith("mobx_")}
    d["scripts"]["animate"] = [a for a in d["scripts"]["animate"] if not (isinstance(a, dict) and next(iter(a)).startswith("mobx_"))]
    for i, (key, *_) in enumerate(MOBS):
        if key in extras:
            d["animations"][f"mobx_{key}"] = f"animation.npcstudio.mobx.{key}"
            d["scripts"]["animate"].append({f"mobx_{key}": f"{skin} == {FIRST_MOB + i}"})
    bright = "math.mod(math.floor(query.property('npcstudio:flags') / 2), 2)"
    prop = "math.mod(math.floor(query.property('npcstudio:flags') / 64), 2) == 0"
    rcs = [rc for rc in d["render_controllers"] if not (isinstance(rc, dict) and ".mob" in next(iter(rc)))]
    rcs.insert(4, {"controller.render.npcstudio.mob": f"({skin} >= {FIRST_MOB}) && {prop} && {bright} == 0"})
    rcs.insert(5, {"controller.render.npcstudio.mob_bright": f"({skin} >= {FIRST_MOB}) && {prop} && {bright} == 1"})
    d["render_controllers"] = rcs
    d["materials"]["mob_glow"] = "entity_emissive_alpha"
    json.dump(ent, open(ep, "w"), indent=2)

    glows = [FIRST_MOB + i for i, m in enumerate(MOBS) if m[5].get("glow")]
    glow = "(" + " || ".join(f"{skin} == {k}" for k in glows) + ")" if glows else "0"
    rp = os.path.join(RP, "render_controllers", "npcstudio.rc.json")
    rc = json.load(open(rp))
    for name, lit in (("mob", False), ("mob_bright", True)):
        rc["render_controllers"][f"controller.render.npcstudio.{name}"] = {
            "arrays": {"textures": {"Array.tex": [f"Texture.mob_{m[0]}" for m in MOBS]},
                       "geometries": {"Array.geo": [f"Geometry.mob_{m[0]}" for m in MOBS]}},
            "geometry": f"Array.geo[{skin} - {FIRST_MOB}]",
            "materials": [{"*": f"Array.mat[{glow}]"}],
            "textures": [f"Array.tex[{skin} - {FIRST_MOB}]"],
            **({"ignore_lighting": True} if lit else {})}
        rc["render_controllers"][f"controller.render.npcstudio.{name}"]["arrays"]["materials"] = {"Array.mat": ["Material.default", "Material.mob_glow"]}
    json.dump(rc, open(rp, "w"), indent=2)

    bp = os.path.join(BP, "entities", "npc_studio.json")
    e = json.load(open(bp))
    e["minecraft:entity"]["description"]["properties"]["npcstudio:skin_index"]["range"] = [0, FIRST_MOB + len(MOBS) - 1]
    json.dump(e, open(bp, "w"), indent=2)

    with open(os.path.join(BP, "scripts", "mobdata.js"), "w") as f:
        f.write("// Generated by tools/make_mobs.py — do not edit by hand.\n")
        f.write("// Posable mobs: skin_index MOB_FIRST + n. parts = the pose editor's names for this mob's parts.\n")
        f.write(f"export const MOB_FIRST = {FIRST_MOB};\n")
        f.write("export const MOBS = " + json.dumps(js, indent=1) + ";\n")
    print(f"{len(MOBS)} posable mobs (skin_index {FIRST_MOB}-{FIRST_MOB + len(MOBS) - 1}), {len(extras)} with extra legs")


if __name__ == "__main__":
    main()
