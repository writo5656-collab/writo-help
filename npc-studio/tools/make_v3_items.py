"""NPC Studio V3 — new tool items (icons + item files). python3 npc-studio/tools/make_v3_items.py"""
import json, os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
PAL = {"K": (20, 24, 32), "D": (43, 50, 64), "M": (70, 80, 106), "L": (138, 150, 176), "C": (58, 208, 240),
       "W": (255, 255, 255), "R": (226, 60, 60), "G": (80, 190, 80), "Y": (240, 200, 70), "P": (150, 80, 220),
       "B": (120, 180, 245), "S": (232, 190, 150)}

ICONS = {
    "monitor": """
................
.KKKKKKKKKKKKKK.
.KDDDDDDDDDDDDK.
.KDBBBBBBBBBBDK.
.KDBBBBBWWBBBDK.
.KDBBBBBBBBBBDK.
.KDBBBBKBBBBBDK.
.KDGGGKSKGGGGDK.
.KDGGGGKGGGGGDK.
.KDDDDDDDDDRDDK.
.KKKKKKKKKKKKKK.
......KMMK......
......KMMK......
....KKKKKKKK....
....KLLLLLLK....
....KKKKKKKK....""",
    "stamp": """
................
......KKKK......
.....KCCCCK.....
.....KCWCCK.....
.....KCCCCK.....
......KMMK......
......KMMK......
......KMMK......
...KKKKKKKKKK...
..KLLLLLLLLLLK..
..KDDDDDDDDDDK..
..KKKKKKKKKKKK..
...KCCCCCCCCK...
....KKKKKKKK....
................
................""",
    "rotator": """
................
.....KKKKKK.....
...KKCCCCCCKK...
..KCCKKKKKKCCK..
..KCK......KCK..
.KCK..KKKK..KK..
.KCK..KSSK......
.KCK..KSSK...K..
.KCK..KKKK..KCK.
..KCK......KCCCK
..KCCKK...KCCCCK
...KKCCCCCKKKKK.
.....KKKKK......
................
................
................""",
    "teleporter": """
................
.....KKKKKK.....
...KKPPPPPPKK...
..KPPCCCCCCPPK..
..KPCCWWCCCCPK..
.KPCCWCCCCCCCPK.
.KPCCCCKKCCCCPK.
.KPCCCKPPKCCCPK.
.KPCCCKPPKCCCPK.
.KPCCCCKKCCCCPK.
..KPCCCCCCCCPK..
..KPPCCCCCCPPK..
...KKPPPPPPKK...
.....KKKKKK.....
................
................""",
}
NAMES = {"monitor": "Preview Viewer", "stamp": "NPC Stamp", "rotator": "NPC Rotator", "teleporter": "Teleporter"}


def draw(art):
    rows = [r for r in art.strip("\n").split("\n")]
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(rows[:16]):
        for x, ch in enumerate(row[:16]):
            if ch in PAL:
                img.putpixel((x, y), PAL[ch] + (255,))
    return img


def main():
    tex_json = os.path.join(ROOT, "RP", "textures", "item_texture.json")
    tj = json.load(open(tex_json))
    for key, art in ICONS.items():
        ident = f"npcstudio_{key}"
        draw(art).save(os.path.join(ROOT, "RP", "textures", "items", f"{ident}.png"))
        tj["texture_data"][ident] = {"textures": f"textures/items/{ident}"}
        item = {"format_version": "1.20.60", "minecraft:item": {
            "description": {"identifier": f"npcstudio:{key}", "menu_category": {"category": "equipment"}},
            "components": {"minecraft:max_stack_size": 1, "minecraft:hand_equipped": False, "minecraft:glint": False,
                           "minecraft:icon": ident, "minecraft:display_name": {"value": "§b" + NAMES[key]}}}}
        with open(os.path.join(ROOT, "BP", "items", f"{ident}.json"), "w") as f:
            json.dump(item, f, indent=2)
    with open(tex_json, "w") as f:
        json.dump(tj, f, indent=2)
    print("items written")


if __name__ == "__main__":
    main()
