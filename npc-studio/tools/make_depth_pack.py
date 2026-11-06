"""
NPC Studio — Depth Map resource pack (DEPTH_RP/), a stand-in for Java depth shaders.

  python3 npc-studio/tools/make_depth_pack.py <path to Mojang bedrock-samples/resource_pack>

Bedrock add-ons can't run shader code, so the depth look is built from things a resource pack can do:
  * every block, mob, armor and NPC Studio texture becomes plain white (each keeps its own transparency,
    so leaves, flowers and grass keep their shape)
  * grass / foliage colour maps become white (no green tint), water surface white
  * sun, moon, clouds and rain become invisible
Turn on Layers > Depth map in the Studio panel: noon, clear weather, black distance fog
(near = white, far = black), outlines / name tags / cameras hidden. Turn it off to go back.

The pack goes in the .mcaddon as a 3rd pack. Activate it (global resources or the world's resource
packs, above NPC Studio) only while you take depth shots.
"""
import json, os, sys, uuid
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "DEPTH_RP")
OWN_RP = os.path.join(ROOT, "RP")
# fixed ids so the pack updates in place
HEADER_UUID = "6b1f0d2e-3c84-4b8e-9a51-2f0c7d9e4a61"
MODULE_UUID = "a3c95e70-1d2b-4f6a-8e3c-5b7d9f1a2c84"


# never whitened: the depth map's own black sky box and the coloured backdrops
KEEP = ("textures/entity/npcstudio/depth_sky", "textures/entity/npcstudio/backdrop_")
# Bedrock uses these textures' alpha as a TINT mask (opaque pixels get the biome colour), not as holes:
# fully transparent = no tint at all, and the solid block still draws every pixel
TINT_MASKS = ("textures/blocks/grass_side",)
# solid white: leaves read as clean shapes like DMS (their holes showed the black sky as speckles)
SOLID = ("textures/blocks/leaves", "textures/blocks/azalea_leaves", "textures/blocks/mangrove_leaves",
         "textures/blocks/cherry_leaves", "textures/blocks/pale_oak_leaves")


def white_like(src, dst, no_tint=False, solid=False):
    """Same size, every pixel white, alpha kept (fully transparent stays transparent)."""
    try:
        im = Image.open(src).convert("RGBA")
    except Exception as e:
        print("skip", src, e)
        return False
    out = Image.new("RGBA", im.size, (255, 255, 255, 0 if no_tint else 255))
    if not no_tint and not solid:
        out.putalpha(im.getchannel("A"))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    out.save(dst, optimize=True)
    return True


def solid(dst, size, rgba):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    Image.new("RGBA", size, rgba).save(dst, optimize=True)


def main(vanilla):
    n = 0
    # 1. block / entity / armor textures (png and tga), and NPC Studio's own entity textures
    for base in (vanilla, OWN_RP):
        for sub in ("textures/blocks", "textures/entity", "textures/models"):
            src_dir = os.path.join(base, sub)
            if not os.path.isdir(src_dir):
                continue
            for dp, _, files in os.walk(src_dir):
                for f in files:
                    if not f.lower().endswith((".png", ".tga")):
                        continue
                    rel = os.path.relpath(os.path.join(dp, f), base).replace(os.sep, "/")
                    stem = os.path.splitext(rel)[0]
                    if stem.startswith(KEEP) or stem.endswith("_mers") or stem.endswith("_normal"):
                        continue
                    dst = os.path.join(OUT, stem + ".png")
                    n += white_like(os.path.join(dp, f), dst, no_tint=stem.startswith(TINT_MASKS), solid=stem.startswith(SOLID))
    # 2. no tint: white colour maps
    for cm in ("grass", "foliage", "birch", "evergreen", "swamp_grass", "swamp_foliage", "mangrove_swamp_foliage", "dry_foliage"):
        solid(os.path.join(OUT, "textures/colormap", cm + ".png"), (256, 256), (255, 255, 255, 255))
    # 3. empty sky: sun, moon, clouds, rain / snow invisible
    for env, size in (("sun", (32, 32)), ("sun_vv", (32, 32)), ("moon_phases", (128, 64)), ("clouds", (256, 256)),
                      ("weather", (64, 256)), ("end_sky", (128, 128))):
        solid(os.path.join(OUT, "textures/environment", env + ".png"), size, (0, 0, 0, 0))
    # 4. white water surface in every biome (keeps each biome's own fog id)
    bdir = os.path.join(vanilla, "biomes")
    nb = 0
    for f in sorted(os.listdir(bdir)) if os.path.isdir(bdir) else []:
        if not f.endswith(".client_biome.json"):
            continue
        src = json.load(open(os.path.join(bdir, f), encoding="utf-8"))
        cb = src["minecraft:client_biome"]
        comps = {"minecraft:water_appearance": {"surface_color": "#FFFFFF"}}
        if "minecraft:fog_appearance" in cb.get("components", {}):
            comps["minecraft:fog_appearance"] = cb["components"]["minecraft:fog_appearance"]
        data = {"format_version": src.get("format_version", "1.21.120"), "minecraft:client_biome": {
            "description": cb["description"], "components": comps}}
        os.makedirs(os.path.join(OUT, "biomes"), exist_ok=True)
        with open(os.path.join(OUT, "biomes", f), "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=1)
        nb += 1
    # 4b. the older biome colour file too (Bedrock still reads it): white water everywhere
    legacy = {"biomes": {"default": {"water_surface_color": "#FFFFFF", "water_surface_transparency": 0.65,
                                     "fog_identifier": "minecraft:fog_default"}}}
    old = os.path.join(os.path.dirname(vanilla.rstrip("/")), "resource_pack", "biomes_client.json")
    for path in (os.path.join(vanilla, "biomes_client.json"), old):
        if os.path.exists(path):
            import re
            src = json.loads(re.sub(r"/\*.*?\*/", "", open(path, encoding="utf-8").read(), flags=re.S))
            for name, b in src.get("biomes", {}).items():
                legacy["biomes"][name] = {**b, "water_surface_color": "#FFFFFF"}
            break
    with open(os.path.join(OUT, "biomes_client.json"), "w", encoding="utf-8") as fh:
        json.dump(legacy, fh, indent=1)
    # 5. manifest + icon
    ver = json.load(open(os.path.join(ROOT, "RP", "manifest.json")))["header"]["version"]
    manifest = {
        "format_version": 2,
        "header": {"name": "NPC Studio V3 Depth Map [RP]",
                   "description": "Depth pass for NPC Studio: everything white, near = white, far = black. "
                                  "Turn on only while filming depth shots (Studio panel > Layers > Depth map).",
                   "uuid": HEADER_UUID, "version": ver, "min_engine_version": [1, 21, 0]},
        "modules": [{"type": "resources", "uuid": MODULE_UUID, "version": ver}]
    }
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
    icon = Image.new("RGBA", (128, 128), (0, 0, 0, 255))
    for y in range(128):  # white at the bottom (near) to black at the top (far)
        v = int(255 * y / 127)
        for x in range(128):
            icon.putpixel((x, y), (v, v, v, 255))
    icon.save(os.path.join(OUT, "pack_icon.png"))
    print(f"depth pack: {n} white textures, {nb} biomes -> {OUT}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])
