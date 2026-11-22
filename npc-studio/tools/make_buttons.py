"""
NPC Studio — link buttons for the CurseForge description (Discord, YouTube, Pack Builder), in the banner's look.

  python3 npc-studio/tools/make_buttons.py

Writes curseforge/promo/desc/<name>.png at 2x (840 px wide) so they stay sharp; the description shows them
at half size. Logos: art/brand/logos.json (simple-icons, CC0). Needs Playwright + Chromium.
"""
import json, os, subprocess, tempfile

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DESC = os.path.join(ROOT, "curseforge", "promo", "desc")
LOGOS = json.load(open(os.path.join(ROOT, "art", "brand", "logos.json")))
CUBE = "M12 1 22 6.5v11L12 23 2 17.5v-11L12 1Zm0 2.3L4.6 7.4 12 11.5l7.4-4.1L12 3.3ZM4 9.1v7.3l7 3.9v-7.3L4 9.1Zm16 0-7 3.9v7.3l7-3.9V9.1Z"

# name, small line, big word, logo path, logo tile colour
BUTTONS = [
    ("discord", "Chat with us on", "Discord", LOGOS["discord"], "#5865F2"),
    ("youtube", "Watch on", "YouTube", LOGOS["youtube"], "#FF0033"),
    ("packbuilder", "Free website", "Pack Builder", CUBE, "#27d3f5"),
]

PAGE = """<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@1,900&family=Inter:wght@600;700&display=swap">
<style>
html,body{margin:0;background:transparent}
.b{width:420px;height:110px;box-sizing:border-box;border-radius:22px;position:relative;overflow:hidden;margin:10px;
  display:flex;align-items:center;gap:20px;padding:0 26px;
  background:radial-gradient(120% 140% at 0% 0%,#2a47e8 0%,#1630b8 45%,#0b1a6e 100%);
  border:2px solid rgba(160,180,255,.55);box-shadow:inset 0 1px 0 rgba(255,255,255,.35)}
.b::before{content:"";position:absolute;inset:0;background-image:
  linear-gradient(rgba(255,255,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.07) 1px,transparent 1px);
  background-size:22px 22px}
.px{position:absolute;width:6px;height:6px;background:#a9b6ff;opacity:.7}
.logo{position:relative;flex:none;width:74px;height:74px;border-radius:18px;display:grid;place-items:center;
  box-shadow:0 6px 16px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.3)}
.logo svg{width:44px;height:44px;fill:#fff}
.t{position:relative;color:#fff;line-height:1;white-space:nowrap}
.t small{display:block;font:600 21px Inter,sans-serif;opacity:.88;letter-spacing:-.01em;margin-bottom:6px}
.t b{font:italic 900 44px "Inter Tight",sans-serif;letter-spacing:-.03em;text-transform:uppercase}
.arrow{position:relative;margin-left:auto;font:700 30px Inter,sans-serif;color:#fff;opacity:.85}
</style></head><body>__BUTTONS__</body></html>"""


def button(name, small, big, path, colour):
    size = 33 if len(big) > 8 else 44  # "Pack Builder" is longer
    return (f'<div class="b" id="{name}"><i class="px" style="left:356px;top:16px"></i><i class="px" style="left:384px;top:86px"></i>'
            f'<i class="px" style="left:395px;top:30px;opacity:.4"></i>'
            f'<div class="logo" style="background:{colour}"><svg viewBox="0 0 24 24"><path d="{path}"/></svg></div>'
            f'<div class="t"><small>{small}</small><b style="font-size:{size}px">{big}</b></div><div class="arrow">&rarr;</div></div>')


def main():
    tmp = tempfile.mkdtemp()
    page = os.path.join(tmp, "buttons.html")
    open(page, "w").write(PAGE.replace("__BUTTONS__", "".join(button(*b) for b in BUTTONS)))
    js = os.path.join(tmp, "shoot.js")
    open(js, "w").write(f"""
const {{ chromium }} = require("playwright");
(async () => {{
  const b = await chromium.launch(); const p = await b.newPage({{ viewport: {{ width: 460, height: 420 }}, deviceScaleFactor: 2 }});
  await p.goto("file://{page}", {{ waitUntil: "networkidle" }}); await p.evaluate(() => document.fonts.ready);
  for (const n of {json.dumps([b[0] for b in BUTTONS])}) await (await p.$("#" + n)).screenshot({{ path: "{DESC}/" + n + ".png", omitBackground: true }});
  await b.close();
}})();""")
    env = dict(os.environ, NODE_PATH=subprocess.check_output(["npm", "root", "-g"], text=True).strip())
    subprocess.run(["node", js], check=True, env=env)
    print("buttons:", ", ".join(b[0] + ".png" for b in BUTTONS))


if __name__ == "__main__":
    main()
