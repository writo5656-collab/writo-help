"""
NPC Studio — Pose Mode gizmo (V3.3 look), built from scratch.

  python3 npc-studio/tools/make_gizmo.py

One entity (npcstudio:gizmo), four looks picked by the gmode property:
  0 move    three arrows on the selected body part
  1 rotate  three solid rings on the selected body part
  2 select  corner brackets
  3 feet    red X / green Y / blue Z arrows at the NPC's feet (like the Java editor)
gaxis: 0 free (all three in colour), 1 X, 2 Y, 3 Z (that one in colour, the others grey).
Every visibility rule includes its own mode check: a rule on a child bone overrides its parent, so a
"rings: gmode == 1" on the parent alone did NOT hide the lit rings (V3.3 first try: yellow mess).
"""
import json, math, os
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
GEO = os.path.join(ROOT, "RP", "models", "entity", "npcstudio_gizmo.geo.json")
RC = os.path.join(ROOT, "RP", "render_controllers", "npcstudio_gizmo.rc.json")
TEX = os.path.join(ROOT, "RP", "textures", "entity", "npcstudio", "gizmo.png")
BP = os.path.join(ROOT, "BP", "entities", "gizmo.json")
COL = {"x": (235, 64, 64), "y": (80, 210, 90), "z": (70, 120, 245), "dim": (120, 122, 132), "white": (245, 245, 245), "cyan": (39, 211, 245)}
UV = {"x": [1, 1], "y": [5, 1], "z": [9, 1], "dim": [13, 1], "white": [17, 1], "cyan": [21, 1]}


def texture():
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    for k, (u, v) in UV.items():
        for x in range(u - 1, u + 3):
            for y in range(v - 1, v + 3):
                im.putpixel((x, y), COL[k] + (255,))
    im.save(TEX)


def cube(origin, size, colour):
    face = {"uv": UV[colour], "uv_size": [1, 1]}
    return {"origin": [round(v, 3) for v in origin], "size": [round(v, 3) for v in size],
            "uv": {k: dict(face) for k in ("north", "south", "east", "west", "up", "down")}}


def arrow(axis, start, length, thick, colour):
    """Shaft plus a stepped tip along +axis (pixels)."""
    i = "xyz".index(axis)

    def box(a, th, along):
        o = [-th / 2] * 3
        s = [th] * 3
        o[i] = a
        s[i] = along
        return cube(o, s, colour)
    out = [box(start, thick, length)]
    for k, th in enumerate((thick * 3.6, thick * 2.6, thick * 1.6)):
        out.append(box(start + length + k * thick * 1.3, th, thick * 1.3))
    return out


def ring(axis, radius, thick, colour, n=96):
    """A solid ring around `axis` from many small overlapping cubes (no cube rotation needed)."""
    out = []
    for k in range(n):
        a = 2 * math.pi * k / n
        c, s = radius * math.cos(a), radius * math.sin(a)
        p = {"x": (0, c, s), "y": (c, 0, s), "z": (c, s, 0)}[axis]
        out.append(cube([p[0] - thick / 2, p[1] - thick / 2, p[2] - thick / 2], [thick] * 3, colour))
    return out


def bone(name, parent, cubes):
    b = {"name": name, "parent": parent, "pivot": [0, 0, 0]}
    if cubes:
        b["cubes"] = cubes
    return b


def main():
    texture()
    old = json.load(open(GEO))["minecraft:geometry"][0]
    select = next(b for b in old["bones"] if b["name"] == "select")
    for c in select.get("cubes", []):
        c["uv"] = {k: {"uv": UV["cyan"], "uv_size": [1, 1]} for k in ("north", "south", "east", "west", "up", "down")}
    bones = [{"name": "root", "pivot": [0, 0, 0]}, bone("center", "root", [cube([-1.2, -1.2, -1.2], [2.4, 2.4, 2.4], "white")])]
    for ax in "xyz":
        bones.append(bone(f"move_{ax}", "root", arrow(ax, 1.2, 11, 0.8, ax)))
        bones.append(bone(f"move_{ax}_dim", "root", arrow(ax, 1.2, 11, 0.8, "dim")))
        bones.append(bone(f"rot_{ax}", "root", ring(ax, 9.5, 0.75, ax)))
        bones.append(bone(f"rot_{ax}_dim", "root", ring(ax, 9.5, 0.75, "dim")))
    select["parent"] = "root"
    bones.append(select)
    bones.append(bone("feet", "root", [cube([-1.4, -0.2, -1.4], [2.8, 2.8, 2.8], "white")]
                      + arrow("x", 1.4, 15, 1.0, "x") + arrow("y", 1.4, 18, 1.0, "y") + arrow("z", 1.4, 15, 1.0, "z")))
    geo = {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": "geometry.npcstudio.gizmo", "texture_width": 32, "texture_height": 32,
                        "visible_bounds_width": 4, "visible_bounds_height": 4, "visible_bounds_offset": [0, 0, 0]},
        "bones": bones}]}
    json.dump(geo, open(GEO, "w"), indent=1)

    m = "query.property('npcstudio:gmode')"
    a = "query.property('npcstudio:gaxis')"
    lit = {"x": f"({a} == 0 || {a} == 1)", "y": f"({a} == 0 || {a} == 2)", "z": f"({a} == 0 || {a} == 3)"}
    vis = [{"*": False}, {"root": True}, {"center": f"{m} == 0 || {m} == 1"}, {"select": f"{m} == 2"}, {"feet": f"{m} == 3"}]
    for ax in "xyz":
        vis += [{f"move_{ax}": f"{m} == 0 && {lit[ax]}"}, {f"move_{ax}_dim": f"{m} == 0 && !{lit[ax]}"},
                {f"rot_{ax}": f"{m} == 1 && {lit[ax]}"}, {f"rot_{ax}_dim": f"{m} == 1 && !{lit[ax]}"}]
    rc = json.load(open(RC))
    rc["render_controllers"]["controller.render.npcstudio.gizmo"]["part_visibility"] = vis
    json.dump(rc, open(RC, "w"), indent=1)

    bp = json.load(open(BP))
    bp["minecraft:entity"]["description"]["properties"]["npcstudio:gmode"]["range"] = [0, 3]
    json.dump(bp, open(BP, "w"), indent=2)
    print(f"gizmo: {sum(len(b.get('cubes', [])) for b in bones)} cubes, {len(vis)} visibility rules")


if __name__ == "__main__":
    main()
