"""Generates NPC Studio's new UI icons and placeholder custom-skin PNGs (run once; outputs are committed)."""
import colorsys, os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), "..", "RP", "textures")
UI = os.path.join(ROOT, "ui", "npcstudio")
C = {".": None, "d": (32, 38, 48, 255), "c": (63, 208, 232, 255), "w": (235, 240, 245, 255), "g": (140, 150, 160, 255),
     "p": (190, 90, 230, 255), "y": (250, 210, 60, 255), "r": (230, 70, 70, 255), "o": (240, 150, 50, 255), "k": (90, 220, 120, 255)}

ICONS = {
 "back": ["................","................","......c.........",".....cc.........","....ccc.........","...cccccccccc...","..ccccccccccc...","...cccccccccc...","....ccc.........",".....cc.........","......c.........","................","................","................","................","................"],
 "copy_outfit": ["................","...gggg..gggg...","..gcccg..gcccg..","..gccccggccccg..","..gccccccccccg..","...gccccccccg...","...gccccccccg...","...gccccccccg...","...gccccccccg...","...gccccccccg...","...gggggggggg...","................","..kkkkk.........","..k...k.kkkkk...","..kkkkk.k...k...","........kkkkk..."],
 "trim": ["................","...dddd..dddd...","..dcccd..dcccd..","..dcpcddddcpcd..","..dccpcccpccd...","...dccpcpccd....","...dcccpcccd....","...dccpcpccd....","...dcpcccpcd....","...dpcccccpd....","...dddddddddd...","................","................","................","................","................"],
 "armor_set": ["................",".....dddddd.....","....dccccccd....","....dcddddcd....","....dcd..dcd....","................","..ddd.dddd.ddd..","..dccdccccdccd..","..dcccccccccd...","...dcccccccd....","...dcccccccd....","...ddddddddd....","....dcd..dcd....","....dcd..dcd....","....ddd..ddd....","................"],
 "enchant": ["................","......p.........",".....ppp........","......p.....p...","...........ppp..","..p..........p..",".ppp..cccc......","..p..cwwwwc.....",".....cwccwc.....",".....cwccwc...p.",".....cwwwwc..ppp",".....cccccc...p.","......cccc......","....p...........","...ppp..........","....p..........."],
 "gizmo": ["................",".......y........","......yyy.......",".......y........",".......y........",".......y........",".......y........",".......dddd.....","....r..dccd..k..","...rrrrdccdkkkk.","....r..dddd..k..","................","................","................","................","................"],
 "sliders": ["................","..g.............","..g......c......","..g.....ccc.....","..gggggggcgggg..","................","..g..c..........","..g.ccc.........","..ggggcggggggg..","................","..g.........c...","..g........ccc..","..gggggggggggc..","................","................","................"],
 "mirror": ["................","........g.......","..cc....g....cc.","..ccc...g...ccc.","..cccc..g..cccc.","..ccccc.g.ccccc.","..cccccc.cccccc.","..ccccc.g.ccccc.","..cccc..g..cccc.","..ccc...g...ccc.","..cc....g....cc.","........g.......","................","................","................","................"],
 "paste": ["................",".....gggggg.....","..ggggwwwwgggg..","..gdddddddddd...","..gdwwwwwwwwd...","..gdwccccccwd...","..gdwwwwwwwwd...","..gdwccccccwd...","..gdwwwwwwwwd...","..gdwccccwwwd...","..gdwwwwwwwwd...","..gdddddddddd...","................","................","................","................"],
 "undo": ["................","................",".....c..........","....cc..........","...cccccccc.....","..ccccccccccc...","...cccccccccc...","....cc.....cc...",".....c.....cc...","...........cc...","..........ccc...","........cccc....","................","................","................","................"],
 "redo": ["................","................","..........c.....","..........cc....",".....cccccccc...","...ccccccccccc..","...cccccccccc...","...cc.....cc....","...cc.....c.....","...cc...........","...ccc..........","....cccc........","................","................","................","................"],
 "scale": ["................","..cccccc........","..cc............","..c.c...........","..c..c..........","..c...c.........",".......c........","........c.......",".........c...c..","..........c..c..","...........c.c..","............cc..","........cccccc..","................","................","................"],
 "animate": ["................","..dddddddddddd..","..dwdwdwdwdwdd..","..dddddddddddd..","..dccccccccccd..","..dcccyyccccd...","..dcccyyyyccd...","..dcccyyyyyycd..","..dcccyyyyccd...","..dcccyyccccd...","..dccccccccccd..","..dddddddddddd..","..dwdwdwdwdwdd..","..dddddddddddd..","................","................"],
 "record": ["................","................",".....rrrrrr.....","....rrrrrrrr....","...rrrrrrrrrr...","...rrrrrrrrrr...","...rrrrrrrrrr...","...rrrrrrrrrr...","...rrrrrrrrrr...","....rrrrrrrr....",".....rrrrrr.....","................","................","................","................","................"],
 "refresh": ["................",".....ccccc......","...cc.....cc.c..","..c.........cc..","..c.......ccc...","..c.............",".c..............",".c.............c",".c.............c","...............c","...ccc.......c..","..cc.........c..","..c.cc.....cc...","......ccccc.....","................","................"],
 "eye": ["................","................","................",".....dddddd.....","...ddwwwwwwdd...","..dwwwccccwwwd..",".dwwwcddddcwwwd.",".dwwwcddddcwwwd.","..dwwwccccwwwd..","...ddwwwwwwdd...",".....dddddd.....","................","................","................","................","................"],
 "film": ["................","................","..dddddddddd....","..dccccccccdd.y.","..dccccccccddyy.","..dccccccccdyyy.","..dccccccccdyyy.","..dccccccccddyy.","..dccccccccdd.y.","..dddddddddd....","...dd....dd.....","..dd......dd....","................","................","................","................"],
 "sequence": ["................","................",".dddd.dddd.dddd.",".dccd.dyyd.dkkd.",".dccd.dyyd.dkkd.",".dddd.dddd.dddd.","................","..cccccccccccc..","..............c.","..cccccccccccc..","..c.............","..cccccccccccc..","................","................","................","................"],
}

def icon(name, rows):
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row[:16]):
            col = C.get(ch)
            if col: im.putpixel((x, y), col)
    im.resize((64, 64), Image.NEAREST).save(os.path.join(UI, f"icon_{name}.png"))

for n, r in ICONS.items():
    assert len(r) == 16, n
    icon(n, r)

# placeholder skins for custom slots 4..20: hue-shifted copies of slot 1
base = Image.open(os.path.join(ROOT, "entity", "npcstudio", "custom_slot1.png")).convert("RGBA")
for i in range(4, 21):
    shift = (i * 0.137) % 1.0
    im = base.copy()
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0: continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            r2, g2, b2 = colorsys.hsv_to_rgb((h + shift) % 1.0, max(s, 0.35), v)
            px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)
    im.save(os.path.join(ROOT, "entity", "npcstudio", f"custom_slot{i}.png"))
print("ok")
