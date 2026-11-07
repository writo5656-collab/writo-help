"""
NPC Studio — Pose Mode gizmo, V3.3 look.

  python3 npc-studio/tools/make_gizmo.py

Adds to the existing gizmo model (RP/models/entity/npcstudio_gizmo.geo.json):
  * "feet": red X, green Y and blue Z arrows with tips and a white hub. A second gizmo entity with
    gmode 3 stands at the NPC's feet during Pose Mode (like the Java editor), while the first one
    shows rings (rotate) or arrows (move) on the selected body part.
and fixes the render controller (the blue Z parts never lit up: "!q == 3" is always false).
Run it again any time: it replaces the feet bone and rewrites the controller.
"""
import json, os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
GEO = os.path.join(ROOT, "RP", "models", "entity", "npcstudio_gizmo.geo.json")
RC = os.path.join(ROOT, "RP", "render_controllers", "npcstudio_gizmo.rc.json")
BP = os.path.join(ROOT, "BP", "entities", "gizmo.json")
# colours already in textures/entity/npcstudio/gizmo.png
UV = {"x": [3, 3], "y": [11, 3], "z": [19, 3], "white": [27, 3]}


def cube(origin, size, colour):
    face = {"uv": UV[colour], "uv_size": [1, 1]}
    return {"origin": origin, "size": size, "uv": {k: dict(face) for k in ("north", "south", "east", "west", "up", "down")}}


def arrow(axis, length, colour):
    """Shaft from the hub plus a 3-step tip, along +axis (pixels)."""
    t = 0.9
    out = []
    i = "xyz".index(axis)

    def box(start, thick, size_along):
        o = [-thick / 2] * 3
        s = [thick] * 3
        o[i] = start
        s[i] = size_along
        return cube(o, s, colour)
    out.append(box(1.2, t, length))
    for k, th in enumerate((3.0, 2.0, 1.0)):
        out.append(box(length + 1.2 + k * 1.2, th, 1.2))
    return out


def main():
    geo = json.load(open(GEO))
    g = geo["minecraft:geometry"][0]
    g["bones"] = [b for b in g["bones"] if b["name"] != "feet"]
    feet = {"name": "feet", "parent": "root", "pivot": [0, 0, 0],
            "cubes": [cube([-1.4, -1.4, -1.4], [2.8, 2.8, 2.8], "white")]
                     + arrow("x", 16, "x") + arrow("y", 20, "y") + arrow("z", 16, "z")}
    g["bones"].append(feet)
    g["description"]["visible_bounds_width"] = 4
    g["description"]["visible_bounds_height"] = 4
    json.dump(geo, open(GEO, "w"), indent=1)

    m = "query.property('npcstudio:gmode')"
    a = "query.property('npcstudio:gaxis')"
    lit = {"x": f"({a} == 0 || {a} == 1)", "y": f"({a} == 0 || {a} == 2)", "z": f"({a} == 0 || {a} == 3)"}
    vis = [{"*": True}, {"center": f"{m} != 3"}, {"feet": f"{m} == 3"},
           {"arrows": f"{m} == 0"}, {"rings": f"{m} == 1"}, {"select": f"{m} == 2"}]
    for ax in "xyz":
        for kind in ("move", "rot"):
            vis.append({f"{kind}_{ax}": f"!{lit[ax]}"})
            vis.append({f"{kind}_{ax}_on": lit[ax]})
    rc = json.load(open(RC))
    rc["render_controllers"]["controller.render.npcstudio.gizmo"]["part_visibility"] = vis
    json.dump(rc, open(RC, "w"), indent=1)

    bp = json.load(open(BP))
    bp["minecraft:entity"]["description"]["properties"]["npcstudio:gmode"]["range"] = [0, 3]
    json.dump(bp, open(BP, "w"), indent=2)
    print("gizmo: feet axes added, render controller fixed, gmode 0-3")


if __name__ == "__main__":
    main()
