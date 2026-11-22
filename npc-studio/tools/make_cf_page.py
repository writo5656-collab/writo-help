"""
NPC Studio — CurseForge description + a preview page that looks like the project page.

  python3 npc-studio/tools/make_cf_page.py

  curseforge/DESCRIPTION.html            paste into CurseForge's description editor (Source / HTML view).
                                         Images point at IMG/<file>: upload each file from curseforge/promo/desc
                                         in the editor (or replace IMG/ with your own image host).
  curseforge/promo/curseforge-preview.html  the same description inside a CurseForge-style page, images built in.
Only plain tags CurseForge keeps: h2/h3, p (centered with style="text-align: center;"), img, ul/li, a, strong, em, hr.
"""
import base64, os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DESC = os.path.join(ROOT, "curseforge", "promo", "desc")
WEBSITE = "https://noxeelmc-art.github.io/npc-studio-skins/"
YOUTUBE = "https://youtube.com/@NoxeelMC"
DISCORD = "DISCORD_LINK_HERE"

C = 'style="text-align: center;"'


def img(name, alt, width=None):
    w = f' width="{width}"' if width else ""
    return f'<p {C}><img src="IMG/{name}" alt="{alt}"{w} /></p>'


BODY = f"""
{img("npc-studio-banner.png", "NPC Studio Bedrock banner")}
<p {C}><strong>Pose, dress and film NPCs like a real studio.</strong><br />Cameras, 58 capes, custom skins and 3D models, a live editor and shareable presets. Made for phones and PC.</p>
<p {C}><a href="{WEBSITE}"><strong>Pack Builder website</strong></a> &nbsp;|&nbsp; <a href="{YOUTUBE}"><strong>YouTube</strong></a> &nbsp;|&nbsp; <a href="{DISCORD}"><strong>Discord</strong></a></p>
<p {C}><em>Minecraft Bedrock 26.30+ &middot; no experimental toggles &middot; phone and PC</em></p>
<hr />
{img("npc-studio-cover.jpg", "NPC Studio overview")}
{img("npc-studio-h_pose.jpg", "Pose Mode")}
<p {C}>Look at a body part and rotate or move it with the red, green and blue gizmo. Walk around while you pose, so you can check it from every side. 45+ ready poses and 19 looping animations, with undo, redo and mirror.</p>
{img("npc-studio-pose.jpg", "Pose Mode gizmo")}
{img("npc-studio-h_live.jpg", "Live Editor")}
<p {C}>The <strong>Studio panel</strong> sits on the left with six tabs: Display, Pose, Presets, World, Camera, Layers. The <strong>Live Editor</strong> is one screen that never reloads: every toggle, slider and list changes the NPC the moment you touch it.</p>
<ul>
<li><strong>Display:</strong> model (classic, slim, mobs), skin, cloak, nametag, sneak, living, animation, rotation X/Y/Z, scale, look at me, flip, on fire, bright</li>
<li><strong>World:</strong> time, weather, gamerules, world bright, depth fog</li>
<li><strong>Layers:</strong> hide NPCs, cameras, outlines or name tags for clean shots</li>
</ul>
{img("npc-studio-studio.jpg", "The Studio panel in game")}
{img("npc-studio-live.jpg", "Studio panel and Live Editor")}
{img("npc-studio-h_cloaks.jpg", "58 Cloaks")}
<p {C}>8 studio capes, 43 Minecraft capes and 7 slots for your own. Pick them from pictures in <strong>Display &rarr; Cloak</strong>.</p>
{img("npc-studio-capes.jpg", "Cape picker")}
{img("npc-studio-h_custom.jpg", "Your skins and models")}
<p {C}>Open the free <a href="{WEBSITE}"><strong>Pack Builder</strong></a> on your phone or PC. Get any Java player's skin by name, add capes and Blockbench 3D models, preview them in 3D and download one small pack. Nothing is uploaded: the pack is built in your browser.</p>
{img("npc-studio-packs.jpg", "Pack Builder website")}
{img("npc-studio-h_share.jpg", "Share presets")}
<p {C}>Save an NPC as a preset and send it as a code (<strong>Presets &rarr; Share Code</strong>). Your friend taps <strong>Import Code</strong> and pastes it. Or turn codes into a preset pack file on the website, and PC players can share exact copies as <em>.mcstructure</em> files.</p>
{img("npc-studio-share.jpg", "Share presets as codes")}
{img("npc-studio-h_camera.jpg", "Cameras and photo")}
<p {C}>Place cameras, fly a camera with the joystick, preview any camera in one tap and run 30 cinematic shots. Thirds and cross guides, green screen backdrops and Photo Mode.</p>
{img("npc-studio-camera.jpg", "Cameras in game")}
{img("npc-studio-h_install.jpg", "Install")}
<ol>
<li>Download the <strong>.mcaddon</strong> file and open it. Minecraft imports all packs.</li>
<li>Create a world (or edit one) and turn on <strong>NPC Studio</strong> in Behavior Packs. The resource pack comes with it.</li>
<li>In game, use the <strong>Director's Baton</strong> from your hotbar: tap an NPC to edit it, or open the panel to spawn one.</li>
</ol>
<p {C}><em>Updating? Delete the old NPC Studio packs first, then make a new world. The version number shows at the top of the panel.</em></p>
<hr />
<h3>Questions</h3>
<p><strong>Do I need experiments?</strong> No. NPC Studio uses only the stable script API.</p>
<p><strong>Does it work on phone?</strong> Yes. Everything is built for touch first, and tested on Android.</p>
<p><strong>Can I use my own skins?</strong> Yes: 20 custom skin slots, 7 cape slots and 10 3D model slots, filled with the Pack Builder website.</p>
<p><strong>Found a bug or have an idea?</strong> Tell us on <a href="{DISCORD}">Discord</a> or in the comments. This is a beta: your feedback decides what comes next.</p>
<hr />
<p {C}><em>Inspired by the NPC Studio mod for Minecraft Java Edition. Made for Bedrock by NoxeelMC. Not affiliated with Mojang or Microsoft.</em></p>
""".strip()


def uri(name):
    path = os.path.join(DESC, name)
    kind = "png" if name.endswith(".png") else "jpeg"
    return f"data:image/{kind};base64," + base64.b64encode(open(path, "rb").read()).decode()


PAGE = """<title>NPC Studio CurseForge Preview</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
<style>
/* Layout: a close copy of a CurseForge project page (header, tabs, description column, sidebar) so the description can be judged in place. */
:root { --bg: #0d0d10; --surface: #17171c; --surface-2: #1f1f26; --line: #2c2c35; --ink: #f2f2f5; --muted: #9a9aa8; --orange: #f16436; --link: #f58a5f;
  color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.6 "Inter", system-ui, sans-serif; }
.top { background: #111116; border-bottom: 1px solid var(--line); padding-block: 12px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.top .in { max-width: 1240px; margin: 0 auto; display: flex; gap: 18px; align-items: center; color: var(--muted); font-weight: 600; font-size: 14px; flex-wrap: wrap; }
.top b { color: var(--orange); font-weight: 800; font-size: 18px; }
.wrap { max-width: 1240px; margin: 0 auto; padding-block: 28px 80px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 24px; }
.head { display: flex; gap: 22px; align-items: center; flex-wrap: wrap; }
.head img { width: 96px; height: 96px; border-radius: 12px; }
.head h1 { margin: 0; font-size: 30px; font-weight: 800; }
.head .meta { color: var(--muted); font-size: 14px; display: flex; gap: 16px; flex-wrap: wrap; }
.head .grow { flex: 1 1 300px; min-width: 0; }
.dl { background: var(--orange); color: #fff; border: 0; border-radius: 8px; font: 700 15px "Inter"; padding: 12px 26px; }
.tabs { display: flex; gap: 6px; border-bottom: 1px solid var(--line); overflow-x: auto; }
.tabs span { padding: 10px 16px; color: var(--muted); font-weight: 600; white-space: nowrap; }
.tabs span.on { color: var(--ink); border-bottom: 2px solid var(--orange); }
.cols { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 28px; align-items: start; }
@media (max-width: 900px) { .cols { grid-template-columns: 1fr; } }
.desc { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 24px; min-width: 0; }
.desc img { max-width: 100%; height: auto; border-radius: 6px; }
.desc a { color: var(--link); }
.desc hr { border: 0; border-top: 1px solid var(--line); margin: 22px 0; }
.desc h3 { font-size: 20px; }
.side { display: grid; gap: 16px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 18px; display: grid; gap: 10px; }
.card h4 { margin: 0; font-size: 15px; }
.row { display: flex; justify-content: space-between; color: var(--muted); font-size: 14px; gap: 10px; }
.row span:last-child { color: var(--ink); font-weight: 600; text-align: right; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tags span { background: var(--surface-2); border: 1px solid var(--line); border-radius: 999px; padding: 4px 10px; font-size: 13px; color: var(--muted); }
.note { background: #2a1a12; border: 1px solid #5a3420; color: #ffd2bd; border-radius: 10px; padding: 12px 16px; font-size: 14px; }
</style>
<div class="top"><div class="in"><b>CurseForge</b><span>Minecraft Bedrock</span><span>Add-ons</span><span>Maps</span><span>Texture Packs</span></div></div>
<div class="wrap">
  <div class="note">Preview only: this is how the NPC Studio page should look after the update. Fonts and spacing on the real site differ a little.</div>
  <div class="head">
    <img src="LOGO" alt="">
    <div class="grow"><h1>NPC Studio Bedrock</h1><div class="meta"><span>By NoxeelMC</span><span>Add-ons</span><span>Updated today</span><span>Game version 26.30+</span></div></div>
    <button class="dl" type="button">Download</button>
  </div>
  <div class="tabs"><span class="on">Description</span><span>Files</span><span>Images</span><span>Relations</span><span>Comments</span></div>
  <div class="cols">
    <article class="desc">BODY</article>
    <aside class="side">
      <div class="card"><h4>About Project</h4>
        <div class="row"><span>Created</span><span>2026</span></div>
        <div class="row"><span>Updated</span><span>today</span></div>
        <div class="row"><span>Project ID</span><span>&mdash;</span></div>
        <div class="row"><span>License</span><span>All Rights Reserved</span></div>
      </div>
      <div class="card"><h4>Categories</h4><div class="tags"><span>Add-ons</span><span>Utility</span><span>Cosmetics</span><span>Roleplay</span></div></div>
      <div class="card"><h4>Links</h4><div class="row"><span>Website</span><span>Pack Builder</span></div><div class="row"><span>YouTube</span><span>@NoxeelMC</span></div><div class="row"><span>Discord</span><span>add link</span></div></div>
    </aside>
  </div>
</div>
"""


def main():
    with open(os.path.join(ROOT, "curseforge", "DESCRIPTION.html"), "w", encoding="utf-8") as f:
        f.write(BODY + "\n")
    body = BODY
    for name in sorted(os.listdir(DESC)):
        body = body.replace(f"IMG/{name}", uri(name))
    logo = "data:image/png;base64," + base64.b64encode(open(os.path.join(ROOT, "curseforge", "logo-512.png"), "rb").read()).decode()
    page = PAGE.replace("BODY", body).replace("LOGO", logo)
    out = os.path.join(ROOT, "curseforge", "promo", "curseforge-preview.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(page)
    print("wrote DESCRIPTION.html and", out, len(page) // 1024, "KB")


if __name__ == "__main__":
    main()
