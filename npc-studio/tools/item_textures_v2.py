exec(open('items.py').read().split("designs=[")[0])
def cam_cine2():
    im=img()
    shaft(im,2,14,3,DARK)                     # pistol grip
    grid(im,3,1,[
        ".RRR..RRR...",
        "RrwrR.RrwrR.",
        "RwkwR.RwkwR.",
        "RrwrR.RrwrR.",
        ".RRR..RRR...",
        "kkkkkkkkkk..",
        "kbbbbbbbbkGG",
        "kbrbbbbbbkGL",
        "kbbbbbbbbkGL",
        "kbbbbbbbbkGG",
        "kkkkkkkkkk..",],{
        "R":(120,125,140),"r":(170,175,190),"w":(220,225,235),"k":(24,24,30),"b":(62,66,80),
        "G":(40,40,48),"L":(90,220,245)})
    put(im,5,8,(235,60,60)); put(im,5,9,(235,60,60))
    outline(im); return im
def mob_whistle2():
    im=img()
    grid(im,1,5,[
        "mm..........",
        "mMbbbbbbbbb.",
        "mMBBBBBBBBBb",
        "mMBoBBoBBoBb",
        "mMBBBBBBBBBb",
        "mMbbbbbbbbb.",
        "mm..........",],{"m":(150,110,60),"M":(200,160,90),"b":(185,175,145),"B":(240,232,205),"o":(55,45,35)})
    # cord loop hanging from the end
    grid(im,12,6,[".c.","c.c","c.c",".cc","..c","..g"],{"c":(200,60,60),"g":GOLD[0]})
    outline(im); return im
items=[("B  Director's Baton",wand_b()),("C2  Cine Cam (new)",cam_cine2()),("M3  Beast Whistle (new)",mob_whistle2()),("Handbook",guide_book())]
Z=10; cell=16*Z+40
sheet=Image.new("RGBA",(4*cell+20,cell+60),(34,37,44,255)); d=ImageDraw.Draw(sheet)
f2=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",14)
for i,(name,im) in enumerate(items):
    x=15+i*cell; y=15
    d.rectangle([x,y,x+16*Z+20,y+16*Z+20],fill=(58,62,72))
    sheet.alpha_composite(im.resize((16*Z,16*Z),Image.NEAREST),(x+10,y+10))
    slot=Image.new("RGBA",(40,40),(139,139,139,255)); slot.alpha_composite(im.resize((32,32),Image.NEAREST),(4,4))
    sheet.alpha_composite(slot,(x+16*Z-22,y+16*Z-22))
    d.text((x,y+16*Z+24),name,fill=(235,235,235),font=f2)
    im.save(["wand","camera","mob","book"][i]+"_final.png")
sheet.save("item_set_v2.png")
