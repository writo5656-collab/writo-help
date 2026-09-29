from PIL import Image, ImageDraw, ImageFont
T=(0,0,0,0)
def img(): return Image.new("RGBA",(16,16),T)
def put(im,x,y,c):
    if 0<=x<16 and 0<=y<16: im.putpixel((x,y),c+(255,) if len(c)==3 else c)
OUT=(28,22,18)
WOOD=[(150,100,55),(110,70,35),(80,50,25)]   # light, mid, dark
DARK=[(70,70,82),(45,45,55),(28,28,36)]
GOLD=[(255,220,90),(220,165,40),(150,100,20)]
def shaft(im, x0, y0, length, pal, lo=0):
    # diagonal handle bottom-left -> top-right, 2px thick with shading
    for i in range(length):
        x,y=x0+i,y0-i
        put(im,x,y,pal[0]); put(im,x+1,y,pal[1]); put(im,x,y+1,pal[2])
def outline(im):
    src=im.copy(); px=src.load()
    for y in range(16):
        for x in range(16):
            if px[x,y][3]==0:
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    X,Y=x+dx,y+dy
                    if 0<=X<16 and 0<=Y<16 and px[X,Y][3]==255 and px[X,Y][:3]!=(255,255,255) :
                        im.putpixel((x,y),OUT+(255,)); break
def grid(im, x0, y0, rows, pal):
    for dy,row in enumerate(rows):
        for dx,ch in enumerate(row):
            if ch in pal: put(im,x0+dx,y0+dy,pal[ch])

# ---------- WAND A: Crystal Wand (your reference) ----------
def wand_a():
    im=img(); shaft(im,1,14,8,WOOD)
    grid(im,8,1,[
        "...hc..",
        "..hwcc.",
        ".hwccmm",
        "hccccmd",
        ".ccmmd.",
        "..cmd..",
        "...d...",],{"w":(235,255,255),"h":(170,250,255),"c":(80,225,240),"m":(35,170,200),"d":(20,110,140)})
    outline(im)
    for x,y in ((15,1),(7,2),(14,7),(13,0)): put(im,x,y,(200,255,255,210))
    return im
# ---------- WAND B: Director's Baton ----------
def wand_b():
    im=img(); shaft(im,1,14,9,DARK)
    for i in (2,3): put(im,1+i,14-i,GOLD[0]); put(im,2+i,14-i,GOLD[1]); put(im,1+i,15-i,GOLD[2])
    grid(im,9,1,[
        "...y...",
        "..yyy..",
        "yyywyyy",
        ".ycwcy.",
        "..ycy..",
        ".yy.yy.",],{"w":(255,255,255),"y":(120,235,250),"c":(40,190,220)})
    outline(im)
    for x,y in ((15,0),(8,1),(15,6)): put(im,x,y,(200,255,255,200))
    return im

# ---------- CAMERA C1: Clapperboard ----------
def cam_clapper():
    im=img()
    grid(im,1,2,[
        "..wkwkwkwkwk.",
        ".kwkwkwkwkw..",
        "kkkkkkkkkkkkk",
        "ksssssssssssk",
        "kswwwwwwwwwsk",
        "ksssssssssssk",
        "kswwwwwsssssk",
        "ksssssssssssk",
        "kswwwssssssk.",
        "kkkkkkkkkkkkk",],{"w":(240,240,240),"k":(30,30,36),"s":(60,62,72)})
    shaft(im,5,14,2,WOOD)
    outline(im); return im
# ---------- CAMERA C2: Handheld Cine Camera on a grip ----------
def cam_cine():
    im=img(); shaft(im,2,14,4,DARK)
    grid(im,4,1,[
        "..rr.rr...",
        ".rggrrggr.",
        ".rggrrggr.",
        "..rr.rr...",
        "kkkkkkkk..",
        "kbbbbbbkcc",
        "kbbbbbbkcl",
        "kbbbbbbkcc",
        "kkkkkkkk..",],{"r":(40,40,48),"g":(90,90,100),"k":(22,22,28),"b":(55,58,68),"c":(40,40,48),"l":(90,220,240)})
    put(im,6,6,(230,60,60))
    outline(im); return im
# ---------- CAMERA C3: Lens Staff ----------
def cam_lens():
    im=img(); shaft(im,1,14,8,WOOD)
    grid(im,8,0,[
        "..ggg..",
        ".glllg.",
        "gllwllg",
        "glllllg",
        "gllllgg",
        ".glllg.",
        "..ggg..",],{"g":GOLD[1],"l":(90,200,235),"w":(235,255,255)})
    outline(im); return im

# ---------- MOB M1: Shepherd's Crook ----------
def mob_crook():
    im=img(); shaft(im,1,14,8,WOOD)
    grid(im,7,0,[
        "...www..",
        "..w...w.",
        ".......w",
        ".......w",
        "......w.",
        "..e...w.",
        ".eEe.w..",
        "..e.w...",],{"w":WOOD[1],"e":(40,180,80),"E":(140,255,160)})
    outline(im); return im
# ---------- MOB M2: Tamer's Lead Staff (saddle charm) ----------
def mob_lead():
    im=img(); shaft(im,1,14,7,WOOD)
    grid(im,7,1,[
        "..LLLL..",
        ".L....L.",
        "L......L",
        "L...ss.L",
        ".L.sSSs.",
        "..Lssss.",
        "....ss..",],{"L":(200,170,120),"s":(120,70,30),"S":(170,110,50)})
    outline(im); return im
# ---------- MOB M3: Beast Bone Whistle ----------
def mob_whistle():
    im=img()
    grid(im,2,4,[
        "..bb.......",
        ".bBBbbbbbbb",
        "bBBBBBBBBBBb",
        "bBBhBBBhBBBb",
        ".bBBbbbbbbb.",
        "..bb........",],{"b":(190,180,150),"B":(235,228,200),"h":(60,50,40)})
    grid(im,11,10,["ll","l.","l."],{"l":(200,170,120)})
    outline(im); return im

# ---------- GUIDE BOOK ----------
def guide_book():
    im=img()
    grid(im,2,1,[
        "bbbbbbbbbbb.",
        "bBBBBBBBBBpw",
        "bBBBBhBBBBpw",
        "bBBBhwcBBBpw",
        "bBBhwccmBBpw",
        "bBBBccmBBBpw",
        "bBBBBmBBBBpw",
        "bBBBBBBBBBpw",
        "bBggggggBBpw",
        "bBBBBBBBBBpw",
        "bBBggggBBBpw",
        "bbbbbbbbbbpw",
        ".wwwwwwwwwww",],{"b":(25,60,110),"B":(45,100,170),"c":(80,225,240),"h":(170,250,255),"m":(35,170,200),"w":(240,236,220),"p":(210,205,190),"g":GOLD[0]})
    outline(im); return im

designs=[
 ("NPC STUDIO WAND",[("A  Crystal Wand",wand_a()),("B  Director's Baton",wand_b())]),
 ("CAMERA TOOL",[("C1  Clapperboard",cam_clapper()),("C2  Handheld Cine Cam",cam_cine()),("C3  Lens Staff",cam_lens())]),
 ("MOB TOOL",[("M1  Shepherd's Crook",mob_crook()),("M2  Tamer's Lead Staff",mob_lead()),("M3  Beast Whistle",mob_whistle())]),
 ("GUIDE BOOK (new)",[("Studio Handbook",guide_book())]),
]
for _,opts in designs:
    for name,im in opts: im.save(name.split()[0].lower().replace("'","")+".png")
Z=10; cell=16*Z+40
W=3*cell+40; H=len(designs)*(cell+70)+20
sheet=Image.new("RGBA",(W,H),(34,37,44,255)); d=ImageDraw.Draw(sheet)
try: f=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",18); f2=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",15)
except: f=f2=ImageFont.load_default()
y=15
for title,opts in designs:
    d.text((20,y),title,fill=(120,220,240),font=f); y+=30
    for i,(name,im) in enumerate(opts):
        x=20+i*cell
        d.rectangle([x,y,x+16*Z+20,y+16*Z+20],fill=(58,62,72))
        sheet.alpha_composite(im.resize((16*Z,16*Z),Image.NEAREST),(x+10,y+10))
        # hotbar-size preview
        slot=Image.new("RGBA",(40,40),(139,139,139,255)); slot.alpha_composite(im.resize((32,32),Image.NEAREST),(4,4))
        sheet.alpha_composite(slot,(x+16*Z-22,y+16*Z-22))
        d.text((x,y+16*Z+24),name,fill=(235,235,235),font=f2)
    y+=cell+40
sheet.save("item_concepts.png"); print(sheet.size)
