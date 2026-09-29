"""Builds site/index.html (for GitHub Pages) from skin-pack-builder.html (the Claude artifact source)."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, "skin-pack-builder.html"), encoding="utf-8").read()
cut = src.index("</style>") + len("</style>")
head, body = src[:cut], src[cut:]
html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Put your own skins on NPC Studio V2 NPCs: drop in PNG skins, preview them in 3D, and download a Minecraft resource pack.">
<meta property="og:title" content="NPC Studio V2 Skin Pack Builder">
<meta property="og:description" content="Drop in skins, preview them in 3D, download a .mcpack for NPC Studio V2.">
<meta name="theme-color" content="#0c121c">
{head}
</head>
<body>
{body}
</body>
</html>
"""
os.makedirs(os.path.join(HERE, "site"), exist_ok=True)
open(os.path.join(HERE, "site", "index.html"), "w", encoding="utf-8").write(html)
print("wrote site/index.html", len(html))
