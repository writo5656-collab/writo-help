"""
NPC Studio — custom slots that a player's own pack can fill (the Pack Builder website makes that pack).

  python3 npc-studio/tools/make_custom.py   (run AFTER make_models.py and make_gizmo.py: it edits their output)

  * 20 custom SKIN slots     textures/entity/npcstudio/custom_slot<n>.png       (placeholder: Steve)
                             head icons heads/skin<11+n>.png                   (Steve face + slot number)
  * 7 custom CAPE slots      textures/entity/npcstudio/capes/custom_cape<n>.png (placeholder: plain grey)
                             cape values 9-15 in npcstudio:flags bits 2-5
  * 10 custom MODEL slots    models/entity/npcstudio_custom_model<n>.geo.json   (placeholder: Steve-shaped)
                             textures/entity/npcstudio/models/model<n>.png     (placeholder: Steve)
                             head icons heads/skin<31+n>.png                   (cube + slot number)
                             skin_index 32-41 = custom model 1-10

A player's pack overrides these files at the SAME paths (a higher pack replaces a file path), so
the geometry identifier inside a custom model file must stay geometry.npcstudio.custom_model<n>.
Custom models have no outline and no cape (both are player-shaped).
"""
import json, os, re, shutil
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
RP, BP = os.path.join(ROOT, "RP"), os.path.join(ROOT, "BP")
TEX = os.path.join(RP, "textures", "entity", "npcstudio")
HEADS = os.path.join(RP, "textures", "ui", "npcstudio", "heads")
SKINS, CAPES, MODELS = 20, 7, 10
JAVA_CAPES = [  # art/capes_java/<file>.png -> cloak 16+
    ("minecon_2011_minecon", "MineCon 2011"), ("minecon_2013_minecon", "MineCon 2013"), ("minecon_pickaxe", "MineCon Pickaxe"),
    ("minecon_enderman", "MineCon Enderman"), ("iron_golem_minecon", "MineCon Golem"), ("creeper_anniversary", "Creeper Bday"),
    ("minecraft_anniversary", "15th Anniversary"), ("minecraft_creeper", "Creeper"), ("tiktok_creeper", "TikTok Creeper"),
    ("birthday_cake", "Birthday Cake"), ("pink_cherry_blossom", "Cherry Blossom"), ("oxeye_daisy_heart", "Oxeye Daisy"),
    ("oxeye_black", "Oxeye Black"), ("common_grass", "Common"), ("green_2025", "Green 2025"), ("2025_home", "Home 2025"),
    ("copper_exclusive", "Copper"), ("menace_nether", "Menace"), ("prismarine_drullkus", "Prismarine"),
    ("turtle_suggestion", "Turtle"), ("crown_event", "Crown"), ("event_a_minecraft_movie", "Movie"),
    ("vanilla_cape_vanilla", "Vanilla"), ("java_edition_free", "Java Free"), ("microsoft_migration", "Migrator"),
    ("millionth_customer_lucky", "Millionth"), ("realms_mapmaker", "Realms Maker"), ("snowman_julianclark", "Snowman"),
    ("db_music_composer", "dB Composer"), ("spade_black_spade", "Spade"), ("blue_scroll", "Blue Scroll"),
    ("scrolls_scrolls_champion", "Scrolls Champ"), ("cobalt_cobalt_league_tournaments", "Cobalt"),
    ("translator_minecraft_translator", "Translator"), ("translator_japanese", "Translator JP"),
    ("chinese_translator", "Translator CN"), ("mojira_moderator_bug_tracker", "Mojira Mod"),
    ("mojang_official", "Mojang"), ("mojang_classic_mojang", "Mojang Classic"), ("mojang_studios_new_mojang", "Mojang Studios"),
    ("mojang_mojang_staff", "Mojang Staff"), ("mojang_unique", "Mojang Unique"), ("mojang_minecraft_experience", "Experience"),
]
PREMADE_CAPES = ["Studio Cyan", "Crimson", "Shadow", "Snow", "Royal", "Gold", "Forest", "Ocean"]
FIRST_JAVA = 16  # cloak values: 0 none, 1-8 premade, 9-15 custom slots, 16+ Java capes (6-bit index)
FIRST_SKIN, FIRST_MODEL, FIRST_CAPE = 12, 32, 9
OUTLINE = (20, 24, 30, 255)
ACCENT = (39, 211, 245, 255)

DIGITS = {  # 3x5 pixel digits
    "0": ["###", "#.#", "#.#", "#.#", "###"], "1": [".#.", "##.", ".#.", ".#.", "###"],
    "2": ["###", "..#", "###", "#..", "###"], "3": ["###", "..#", ".##", "..#", "###"],
    "4": ["#.#", "#.#", "###", "..#", "..#"], "5": ["###", "#..", "###", "..#", "###"],
    "6": ["###", "#..", "###", "#.#", "###"], "7": ["###", "..#", ".#.", ".#.", ".#."],
    "8": ["###", "#.#", "###", "#.#", "###"], "9": ["###", "#.#", "###", "..#", "###"],
}


def text(img, s, x, y, col):
    for k, ch in enumerate(s):
        for dy, row in enumerate(DIGITS[ch]):
            for dx, c in enumerate(row):
                if c == "#":
                    img.putpixel((x + k * 4 + dx, y + dy), col)


def badge(icon, n):
    """Slot number in a dark tag at the bottom right of a 32x32 icon."""
    s = str(n)
    w = len(s) * 4 + 1
    x, y = 31 - w - 1, 31 - 7 - 1
    ImageDraw.Draw(icon).rectangle([x, y, x + w, y + 6], fill=(10, 12, 16, 235))
    text(icon, s, x + 1, y + 1, ACCENT)


def head_icon(skin, n):
    sk = Image.open(skin).convert("RGBA")
    face = sk.crop((8, 8, 16, 16))
    face.alpha_composite(sk.crop((40, 8, 48, 16)))
    icon = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    icon.alpha_composite(Image.new("RGBA", (28, 28), (0, 0, 0, 90)), (3, 4))
    icon.alpha_composite(Image.new("RGBA", (28, 28), OUTLINE), (2, 2))
    solid = Image.new("RGBA", (8, 8), (0, 0, 0, 255))
    solid.alpha_composite(face)
    icon.alpha_composite(solid.resize((24, 24), Image.NEAREST), (4, 4))
    badge(icon, n)
    return icon.resize((64, 64), Image.NEAREST)


def model_icon(n):
    """Empty custom model slot: a cyan wireframe cube."""
    icon = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    icon.alpha_composite(Image.new("RGBA", (28, 28), (0, 0, 0, 90)), (3, 4))
    icon.alpha_composite(Image.new("RGBA", (28, 28), OUTLINE), (2, 2))
    g = ImageDraw.Draw(icon)
    g.rectangle([4, 4, 27, 27], fill=(28, 34, 44, 255))
    front, back = (7, 12, 19, 24), (12, 7, 24, 19)
    g.rectangle(back, outline=(30, 120, 140, 255))
    for (ax, ay), (bx, by) in zip([(7, 12), (19, 12), (7, 24), (19, 24)], [(12, 7), (24, 7), (12, 19), (24, 19)]):
        g.line([(ax, ay), (bx, by)], fill=(30, 120, 140, 255))
    g.rectangle(front, outline=ACCENT)
    badge(icon, n)
    return icon.resize((64, 64), Image.NEAREST)


def cape_png(n):
    dark, light = (74, 78, 88), (150, 155, 166)
    img = Image.new("RGBA", (64, 32), dark + (255,))
    g = ImageDraw.Draw(img)
    for fx in (1, 12):  # front face u 1..10, back face u 12..21 (see make_models.make_capes)
        g.rectangle([fx, 1, fx + 9, 16], fill=(96, 100, 110, 255), outline=light + (255,))
    s = str(n)
    for fx in (1, 12):  # number on both sides (the outside of a Java cape is u 1..10)
        text(img, s, fx + (10 - (len(s) * 4 - 1)) // 2, 6, (220, 224, 232, 255))
    return img


def cape_icon(cape_path):
    """Picker icon: the outside of the cape (u 1..10, v 1..16) in the head-icon frame."""
    cp = Image.open(cape_path).convert("RGBA")
    k = cp.width // 64
    front = cp.crop((1 * k, 1 * k, 11 * k, 17 * k)).resize((10, 16), Image.NEAREST)
    icon = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    icon.alpha_composite(Image.new("RGBA", (28, 28), (0, 0, 0, 90)), (3, 4))
    icon.alpha_composite(Image.new("RGBA", (28, 28), OUTLINE), (2, 2))
    icon.alpha_composite(Image.new("RGBA", (24, 24), (28, 34, 44, 255)), (4, 4))
    big = front.resize((15, 24), Image.NEAREST)
    icon.alpha_composite(big, (9, 4))
    return icon.resize((64, 64), Image.NEAREST)


def player_geo(identifier):
    """Steve-shaped model with the bone names the pose animations use (root, body, head, arms, legs)."""
    uv = {"body": ([16, 16], [16, 32], 0.25), "head": ([0, 0], [32, 0], 0.5), "rightArm": ([40, 16], [40, 32], 0.25),
          "leftArm": ([32, 48], [48, 48], 0.25), "rightLeg": ([0, 16], [0, 32], 0.25), "leftLeg": ([16, 48], [0, 48], 0.25)}
    bones = [{"name": "root", "pivot": [0, 0, 0]}, {"name": "waist", "parent": "root", "pivot": [0, 12, 0]},
             {"name": "body", "parent": "waist", "pivot": [0, 24, 0], "cubes": [[-4, 12, -2], [8, 12, 4]]},
             {"name": "head", "parent": "body", "pivot": [0, 24, 0], "cubes": [[-4, 24, -4], [8, 8, 8]]},
             {"name": "rightArm", "parent": "body", "pivot": [-5, 22, 0], "cubes": [[-8, 12, -2], [4, 12, 4]]},
             {"name": "leftArm", "parent": "body", "pivot": [5, 22, 0], "cubes": [[4, 12, -2], [4, 12, 4]]},
             {"name": "rightLeg", "parent": "root", "pivot": [-1.9, 12, 0], "cubes": [[-3.9, 0, -2], [4, 12, 4]]},
             {"name": "leftLeg", "parent": "root", "pivot": [1.9, 12, 0], "cubes": [[-0.1, 0, -2], [4, 12, 4]]}]
    for b in bones:
        if "cubes" in b:
            o, s = b["cubes"]
            base, over, inf = uv[b["name"]]
            b["cubes"] = [{"origin": o, "size": s, "uv": base}, {"origin": o, "size": s, "uv": over, "inflate": inf}]
    return {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": identifier, "texture_width": 64, "texture_height": 64,
                        "visible_bounds_width": 3, "visible_bounds_height": 3, "visible_bounds_offset": [0, 1.5, 0]},
        "bones": bones}]}


def main():
    steve = os.path.join(TEX, "steve.png")
    os.makedirs(HEADS, exist_ok=True)
    # skins
    for n in range(1, SKINS + 1):
        shutil.copyfile(steve, os.path.join(TEX, f"custom_slot{n}.png"))
        head_icon(steve, n).save(os.path.join(HEADS, f"skin{FIRST_SKIN + n - 1}.png"))
    # capes
    os.makedirs(os.path.join(TEX, "capes"), exist_ok=True)
    for n in range(1, CAPES + 1):
        cape_png(n).save(os.path.join(TEX, "capes", f"custom_cape{n}.png"))
    # Java capes + one picker icon per cloak value
    jdir = os.path.join(TEX, "capes", "java")
    os.makedirs(jdir, exist_ok=True)
    for f, _ in JAVA_CAPES:
        shutil.copyfile(os.path.join(ROOT, "art", "capes_java", f + ".png"), os.path.join(jdir, f + ".png"))
    idir = os.path.join(RP, "textures", "ui", "npcstudio", "capes")
    os.makedirs(idir, exist_ok=True)
    paths = [os.path.join(TEX, "capes", f"cape{i}.png") for i in range(1, 9)] + \
            [os.path.join(TEX, "capes", f"custom_cape{n}.png") for n in range(1, CAPES + 1)] + \
            [os.path.join(jdir, f + ".png") for f, _ in JAVA_CAPES]
    for c, path in enumerate(paths, start=1):
        cape_icon(path).save(os.path.join(idir, f"cape{c}.png"))
    with open(os.path.join(BP, "scripts", "capes.js"), "w") as fh:
        fh.write("// written by tools/make_custom.py: cloak names by value (0 none, 1-8 studio, 9-15 your pack, 16+ Java capes)\n")
        fh.write(f"export const CAPE_COUNT = {FIRST_JAVA + len(JAVA_CAPES)};\n")
        fh.write(f"export const FIRST_CUSTOM_CAPE = {FIRST_CAPE}, FIRST_JAVA_CAPE = {FIRST_JAVA};\n")
        fh.write("export const CAPE_LIST = " + json.dumps(["None"] + PREMADE_CAPES + [None] * CAPES + [n for _, n in JAVA_CAPES]) + ";\n")
    # models
    os.makedirs(os.path.join(TEX, "models"), exist_ok=True)
    for n in range(1, MODELS + 1):
        geo = player_geo(f"geometry.npcstudio.custom_model{n}")
        with open(os.path.join(RP, "models", "entity", f"npcstudio_custom_model{n}.geo.json"), "w") as f:
            json.dump(geo, f, indent=1)
        shutil.copyfile(steve, os.path.join(TEX, "models", f"model{n}.png"))
        model_icon(n).save(os.path.join(HEADS, f"skin{FIRST_MODEL + n - 1}.png"))

    # client entity: textures, geometry, which render controller draws when
    ep = os.path.join(RP, "entity", "npc_studio.json")
    ent = json.load(open(ep))
    d = ent["minecraft:client_entity"]["description"]
    for n in range(1, CAPES + 1):
        d["textures"][f"custom_cape{n}"] = f"textures/entity/npcstudio/capes/custom_cape{n}"
    for i, (f, _) in enumerate(JAVA_CAPES):
        d["textures"][f"jcape{i + 1}"] = f"textures/entity/npcstudio/capes/java/{f}"
    for n in range(1, MODELS + 1):
        d["textures"][f"custom_model{n}"] = f"textures/entity/npcstudio/models/model{n}"
        d["geometry"][f"custom_model{n}"] = f"geometry.npcstudio.custom_model{n}"
    skin = "query.property('npcstudio:skin_index')"
    player, model = f"{skin} < {FIRST_MODEL}", f"{skin} >= {FIRST_MODEL} && {skin} < {FIRST_MODEL + MODELS}"  # 42+ = posable mobs (make_mobs.py)
    bright = "math.mod(math.floor(query.property('npcstudio:flags') / 2), 2)"
    prop = "math.mod(math.floor(query.property('npcstudio:flags') / 64), 2) == 0"
    out = []
    for rc in d["render_controllers"]:
        (name, cond), = rc.items() if isinstance(rc, dict) else ((rc, "1"),)
        if "custom_model" in name:
            continue
        cond = cond.replace(f"({player}) && ", "")  # re-running stays clean
        if name.endswith(".cape"):
            cond = ("(math.mod(math.floor(query.property('npcstudio:flags') / 4), 16) + "
                    "math.mod(math.floor(query.property('npcstudio:flags') / 65536), 4) * 16 > 0) && "
                    "math.mod(math.floor(query.property('npcstudio:flags') / 64), 2) == 0")
        if name.split(".")[-1] in ("default", "bright", "outline", "outline_sil", "cape"):
            cond = f"({player}) && {cond}"
        out.append({name: cond})
    out.insert(2, {"controller.render.npcstudio.custom_model": f"({model}) && {prop} && {bright} == 0"})
    out.insert(3, {"controller.render.npcstudio.custom_model_bright": f"({model}) && {prop} && {bright} == 1"})
    d["render_controllers"] = out
    json.dump(ent, open(ep, "w"), indent=2)

    rp = os.path.join(RP, "render_controllers", "npcstudio.rc.json")
    rcs = json.load(open(rp))
    c = rcs["render_controllers"]
    c["controller.render.npcstudio.cape"]["arrays"]["textures"]["Array.capes"] = (
        [f"Texture.cape{i}" for i in range(1, 9)] + [f"Texture.custom_cape{n}" for n in range(1, CAPES + 1)] +
        [f"Texture.jcape{i + 1}" for i in range(len(JAVA_CAPES))])
    # cloak value: low 4 bits in flags bits 2-5, high 2 bits in flags bits 16-17
    fl = "query.property('npcstudio:flags')"
    c["controller.render.npcstudio.cape"]["textures"] = [
        f"Array.capes[math.mod(math.floor({fl} / 4), 16) + math.mod(math.floor({fl} / 65536), 4) * 16 - 1]"]
    for name, lit in (("custom_model", False), ("custom_model_bright", True)):
        c[f"controller.render.npcstudio.{name}"] = {
            "arrays": {"textures": {"Array.tex": [f"Texture.custom_model{n}" for n in range(1, MODELS + 1)]},
                       "geometries": {"Array.geo": [f"Geometry.custom_model{n}" for n in range(1, MODELS + 1)]}},
            "geometry": f"Array.geo[{skin} - {FIRST_MODEL}]",
            "materials": [{"*": "Material.default"}],
            "textures": [f"Array.tex[{skin} - {FIRST_MODEL}]"],
            **({"ignore_lighting": True} if lit else {})}
    json.dump(rcs, open(rp, "w"), indent=2)

    # behavior side: skin_index now also picks a custom model
    bp = os.path.join(BP, "entities", "npc_studio.json")
    e = json.load(open(bp))
    e["minecraft:entity"]["description"]["properties"]["npcstudio:skin_index"]["range"] = [0, FIRST_MODEL + MODELS - 1]
    e["minecraft:entity"]["description"]["properties"]["npcstudio:flags"]["range"] = [0, 262143]  # 18 bits (cloak high bits 16-17)
    json.dump(e, open(bp, "w"), indent=2)

    # default names (a player's pack replaces them)
    lp = os.path.join(RP, "texts", "en_US.lang")
    lines = [l for l in open(lp, encoding="utf-8").read().splitlines()
             if not re.match(r"npcstudio\.(skin\.(3[2-9]|4[0-9])|cape\.\d+)=", l)]
    lines += [f"npcstudio.skin.{FIRST_MODEL + n - 1}=Custom model {n}" for n in range(1, MODELS + 1)]
    lines += [f"npcstudio.cape.{FIRST_CAPE + n - 1}=Custom cape {n}" for n in range(1, CAPES + 1)]
    open(lp, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print(f"custom slots: {SKINS} skins, {CAPES} capes, {MODELS} models")


if __name__ == "__main__":
    main()


# ----------------------------------------------------------------------------------------------
# View box (visible bounds): Bedrock skips drawing a model whose box is off-screen. The vanilla
# player model's box is only 1 x 2 blocks, the outline / cape 2 x 3, so a lying, posed or scaled
# NPC lost parts at some camera angles ("things stop rendering"). Every NPC model now uses our own
# copy of the player model and one shared, roomy box.
# ----------------------------------------------------------------------------------------------
BOUNDS = {"visible_bounds_width": 6, "visible_bounds_height": 6, "visible_bounds_offset": [0, 1.5, 0]}


def fix_bounds():
    ref = os.path.join(ROOT, "art", "vanilla_ref")
    base = json.load(open(os.path.join(ref, "humanoid.custom.geo.json")))["minecraft:geometry"][0]
    slim_arms = json.load(open(os.path.join(ref, "customSlim_arms.json")))["slim_arm_bones"]
    geos = []
    for ident, slim in (("geometry.npcstudio.player", False), ("geometry.npcstudio.player_slim", True)):
        g = json.loads(json.dumps(base))
        g["description"] = {**g["description"], "identifier": ident, "texture_width": 64, "texture_height": 64, **BOUNDS}
        if slim:
            g["bones"] = [({**b, **{k: v for k, v in slim_arms[b["name"]].items() if k in ("pivot", "cubes")}}
                           if b["name"] in slim_arms else b) for b in g["bones"]]
        geos.append(g)
    with open(os.path.join(RP, "models", "entity", "npcstudio_player.geo.json"), "w") as f:
        json.dump({"format_version": "1.12.0", "minecraft:geometry": geos}, f, indent=1)
    ep = os.path.join(RP, "entity", "npc_studio.json")
    ent = json.load(open(ep))
    g = ent["minecraft:client_entity"]["description"]["geometry"]
    g["default"], g["slim"] = "geometry.npcstudio.player", "geometry.npcstudio.player_slim"
    json.dump(ent, open(ep, "w"), indent=2)
    for name in ("npcstudio_silhouette", "npcstudio_outline", "npcstudio_cape", "npcstudio_prop") + tuple(f"npcstudio_custom_model{n}" for n in range(1, MODELS + 1)):
        p = os.path.join(RP, "models", "entity", name + ".geo.json")
        d = json.load(open(p))
        for geo in d["minecraft:geometry"]:
            geo["description"].update(BOUNDS)
        with open(p, "w") as f:
            json.dump(d, f, indent=1)
    print("view boxes: 6 x 6 blocks on every NPC model")


if __name__ == "__main__":
    fix_bounds()
