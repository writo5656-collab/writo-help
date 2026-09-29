"""
NPC Studio build script.

  python3 tools/build.py

1. Copies BP/ and RP/ into build/
2. Generates the armor-trim / glint loot tables from BP/scripts/trimdata.js
   (one tiny table per item + pattern + material; the Trim Studio calls them with
   `/loot replace entity @s slot.armor.* 0 loot "npcstudio/trim/..."`)
3. Validates every JSON file and syntax-checks every script (needs node)
4. Writes dist/NPCStudio-v<version>.mcaddon
"""
import json, os, re, shutil, subprocess, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BUILD = os.path.join(ROOT, "build")
DIST = os.path.join(ROOT, "..", "dist")


def trim_data():
    src = open(os.path.join(ROOT, "BP", "scripts", "trimdata.js"), encoding="utf-8").read()
    m = re.search(r"/\*JSON-START\*/(.*?)/\*JSON-END\*/", src, re.S)
    return json.loads(m.group(1))


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"))


def table(item, functions):
    return {"pools": [{"rolls": 1, "entries": [{"type": "item", "name": item, "weight": 1, "functions": functions}]}]}


GLINT = {"function": "specific_enchants", "enchants": [{"id": "unbreaking", "level": 3}]}


def gen_loot(bp):
    d = trim_data()
    items = [f"minecraft:{t}_{p}" for t in d["tiers"] for p in d["pieces"].values()] + d["extraTrimmable"]
    base = os.path.join(bp, "loot_tables", "npcstudio")
    n = 0
    for item in items:
        short = item.split(":")[1]
        for pat in d["patterns"]:
            for mat in d["materials"]:
                trim = {"function": "set_armor_trim", "material": mat, "pattern": pat}
                write_json(os.path.join(base, "trim", short, f"{pat}_{mat}.json"), table(item, [trim]))
                write_json(os.path.join(base, "trim_glint", short, f"{pat}_{mat}.json"), table(item, [trim, GLINT]))
                n += 2
    for item in d["glintItems"]:
        write_json(os.path.join(base, "glint", f"{item.split(':')[1]}.json"), table(item, [GLINT]))
        n += 1
    return n


def validate(folder):
    bad = 0
    for dp, _, files in os.walk(folder):
        for f in files:
            p = os.path.join(dp, f)
            if f.endswith(".json"):
                try:
                    json.load(open(p, encoding="utf-8"))
                except Exception as e:
                    print("BAD JSON", p, e)
                    bad += 1
            elif f.endswith(".js") and shutil.which("node"):
                r = subprocess.run(["node", "--check", p], capture_output=True, text=True)
                if r.returncode:
                    print("BAD JS", p, r.stderr)
                    bad += 1
    return bad


def main():
    shutil.rmtree(BUILD, ignore_errors=True)
    bp = os.path.join(BUILD, "NPCStudio_BP")
    rp = os.path.join(BUILD, "NPCStudio_RP")
    shutil.copytree(os.path.join(ROOT, "BP"), bp)
    shutil.copytree(os.path.join(ROOT, "RP"), rp)
    n = gen_loot(bp)
    print(f"generated {n} loot tables")
    if validate(BUILD):
        sys.exit("validation failed")
    ver = ".".join(map(str, json.load(open(os.path.join(bp, "manifest.json")))["header"]["version"]))
    os.makedirs(DIST, exist_ok=True)
    out = os.path.abspath(os.path.join(DIST, "NPCStudio-V2.mcaddon"))  # public name; manifest keeps counting ({ver})
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for folder in (bp, rp):
            for dp, _, files in os.walk(folder):
                for f in sorted(files):
                    full = os.path.join(dp, f)
                    z.write(full, os.path.relpath(full, BUILD))
        for extra in ("LICENSE.md", "README.md"):
            p = os.path.join(ROOT, extra)
            if os.path.exists(p):
                z.write(p, extra)
    print(f"wrote {out} ({os.path.getsize(out) // 1024} KB)")


if __name__ == "__main__":
    main()
