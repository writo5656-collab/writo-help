"""
NPC Studio — promo pictures for CurseForge / MCPEDL (1920x1080), drawn from the pack's own skins and capes.

  python3 npc-studio/tools/make_promo.py <website screenshot.png> <share code file> <out dir>

Writes promo.html next to the template (assets inlined) and screenshots each slide with Playwright.
"""
import base64, json, os, subprocess, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
TEX = os.path.join(ROOT, "RP", "textures", "entity", "npcstudio")
ICONS = os.path.join(ROOT, "RP", "textures", "ui", "npcstudio", "capes")
SLIDES = ["banner", "cover", "pose", "live", "capes", "share", "packs",
          "h_pose", "h_live", "h_cloaks", "h_custom", "h_share", "h_camera", "h_install"]


def uri(path):
    return "data:image/png;base64," + base64.b64encode(open(path, "rb").read()).decode()


def uri_jpg(path):
    return "data:image/jpeg;base64," + base64.b64encode(open(path, "rb").read()).decode()


def main(shot, code_file, out):
    a = {k: uri(os.path.join(TEX, k + ".png")) for k in ("knight", "assassin", "soldier", "scientist", "steve")}
    a.update(capeCrimson=uri(os.path.join(TEX, "capes", "cape2.png")), capeStudio=uri(os.path.join(TEX, "capes", "cape1.png")),
             capeMinecon=uri(os.path.join(TEX, "capes", "java", "minecon_2011_minecon.png")),
             capeCherry=uri(os.path.join(TEX, "capes", "java", "pink_cherry_blossom.png")),
             logo=uri(os.path.join(ROOT, "curseforge", "logo-512.png")), shot=uri(shot),
             capeIcons=[uri(os.path.join(ICONS, f"cape{c}.png")) for c in list(range(1, 9)) + list(range(16, 59))][:45],
             code=open(code_file).read().split()[0],
             panelA=uri_jpg(os.path.join(os.path.dirname(shot), "panel_a.jpg")), panelB=uri_jpg(os.path.join(os.path.dirname(shot), "panel_b.jpg")))
    tpl = open(os.path.join(ROOT, "curseforge", "promo", "promo.template.html"), encoding="utf-8").read()
    page = os.path.join(out, "promo.html")
    os.makedirs(out, exist_ok=True)
    open(page, "w", encoding="utf-8").write(tpl.replace("__ASSETS__", json.dumps(a)))
    js = f"""
const {{ chromium }} = require("playwright");
(async () => {{
  const b = await chromium.launch({{ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] }});
  const p = await b.newPage({{ viewport: {{ width: 2000, height: 1080 }} }});
  p.on("pageerror", (e) => console.log("PAGE ERROR", String(e)));
  for (const s of {json.dumps(SLIDES)}) {{
    await p.goto("file://{page}#" + s); await p.reload();
    await p.waitForSelector("body[data-done]", {{ timeout: 30000 }});
    await p.waitForTimeout(400);
    const [w, h] = await p.evaluate(() => [W, H]);
    await p.screenshot({{ path: "{out}/npc-studio-" + s + ".png", clip: {{ x: 0, y: 0, width: w, height: h }}, omitBackground: s === "banner" }});
    console.log("slide", s);
  }}
  await b.close();
}})();
"""
    runner = os.path.join(out, "shoot.js")
    open(runner, "w").write(js)
    env = dict(os.environ, NODE_PATH=subprocess.check_output(["npm", "root", "-g"], text=True).strip())
    subprocess.run(["node", runner], check=True, env=env)


if __name__ == "__main__":
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    main(*sys.argv[1:4])
