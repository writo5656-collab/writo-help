#!/usr/bin/env python3
"""Regenerate the parts of Featherlight that are copied from Mojang's vanilla
resource pack. Run this after every Minecraft update, then rebuild the .mcpack.

    python3 tools/sync_vanilla.py

Generates:
  pack/biomes_client.json                             every biome -> our fog
  pack/subpacks/ultralow/textures/flipbook_textures.json  all block animations frozen
  pack/subpacks/{lowend,ultralow}/entity/*.entity.json    distance-gated mob animations
"""
import json, os, re, urllib.request

SAMPLES = "https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/"
PACK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "pack")

# Mobs whose client entity file uses the 1.10.0 "animate" format. Newer-format
# files (zombie, husk, ...) are left alone: they would stop loading on any game
# version older than the one they were copied from.
LOD_MOBS = ["cow", "pig", "sheep", "chicken", "creeper", "drowned", "iron_golem",
            "squid", "glow_squid"]
# Purely cosmetic motion. Attack, charging, holding, riding and creeper swelling
# are never gated because they tell the player what a mob is about to do.
GATED = {"look_at_target", "look_at_target_controller", "move", "move_controller",
         "walk", "bob", "bob_controller", "arm_controller", "squid_rotate",
         "creeper_head_controller", "creeper_legs_controller"}
LOD_DISTANCE = {"lowend": 32, "ultralow": 24}
NETHER_END = {"hell", "warped_forest", "crimson_forest", "soulsand_valley",
              "basalt_deltas", "the_end"}


def fetch(path):
    with urllib.request.urlopen(SAMPLES + path) as r:
        text = r.read().decode("utf-8-sig")
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    text = re.sub(r"^\s*//.*$", "", text, flags=re.M)
    return json.loads(text)


def dump(rel, obj):
    path = os.path.join(PACK, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write("\n")


def biomes():
    out = {}
    for key, entry in fetch("biomes_client.json")["biomes"].items():
        short = key.split(":")[-1]
        entry["fog_identifier"] = ("noxeelmc:fog_" + short) if short in NETHER_END else "noxeelmc:fog_default"
        out[key] = entry
    for short in sorted(NETHER_END):  # legacy un-prefixed keys
        out.setdefault(short, {"fog_identifier": "noxeelmc:fog_" + short})
    dump("biomes_client.json", {"biomes": out})


def frozen_flipbooks():
    # Keep every vanilla field (atlas_index, atlas_tile_variant, frames) so each
    # variant still points at its own slot; only stop the clock.
    out = []
    for entry in fetch("textures/flipbook_textures.json"):
        if "ticks_per_frame" in entry:
            entry["ticks_per_frame"] = 999999
        entry["blend_frames"] = False
        out.append(entry)
    dump("subpacks/ultralow/textures/flipbook_textures.json", out)


def gate(item, dist):
    near = f"q.distance_from_camera < {dist}"
    if isinstance(item, str):
        return {item: near} if item in GATED else item
    (name, cond), = item.items()
    # vanilla conditions double as blend weights (e.g. move speed), so multiply
    # rather than && to keep the weight intact when the mob is close
    return {name: f"({cond}) * ({near})"} if name in GATED else item


def entity_lod():
    for mob in LOD_MOBS:
        data = fetch(f"entity/{mob}.entity.json")
        desc = data["minecraft:client_entity"]["description"]
        animate = desc.get("scripts", {}).get("animate")
        if data.get("format_version") != "1.10.0" or not animate:
            print(f"skip {mob}: format {data.get('format_version')}")
            continue
        if not any((a if isinstance(a, str) else next(iter(a))) in GATED for a in animate):
            print(f"skip {mob}: nothing cosmetic to gate")
            continue
        for sub, dist in LOD_DISTANCE.items():
            copy = json.loads(json.dumps(data))
            copy["minecraft:client_entity"]["description"]["scripts"]["animate"] = [gate(a, dist) for a in animate]
            dump(f"subpacks/{sub}/entity/{mob}.entity.json", copy)


if __name__ == "__main__":
    biomes()
    frozen_flipbooks()
    entity_lod()
    print("done")
