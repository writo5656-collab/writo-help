"""
NPC Studio V3.1 — editor UI (RP/ui/server_form.json + textures).

  python3 npc-studio/tools/make_ui.py

NPC Studio's menus put an invisible colour-code tag at the start of the title. Forms with that
tag are drawn as a dark panel docked on the left (tabs, icon list or icon grid); every other
form (other add-ons, Yes/No boxes) keeps the normal Minecraft look.

Title tags (invisible colour codes):
  §n§p§s§r  list           §n§p§t§r  list + tabs
  §n§p§g§r  grid           §n§p§h§r  grid + tabs
Tab buttons are the first 6 buttons; their labels start with §u§r (active tab: §u§r§b).

Ideas for the form hook and zero-length menu animations come from SjnExe/AddonExe (MIT) and
Cookiesmuch/MinUI (MIT); the explicit collection_index tab row follows Mojang's own store filter UI.
"""
import json, os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), "..")
UI = os.path.join(ROOT, "RP", "ui")
TEX = os.path.join(ROOT, "RP", "textures", "ui", "npcstudio", "panel")

TABS = 6
GRID_COLS = 5
GRID_ROWS = 14

TITLE = "#title_text"
HAS_PANEL = f"(not (({TITLE} - '§n§p') = {TITLE}))"
NO_PANEL = f"(({TITLE} - '§n§p') = {TITLE})"
HAS_TABS = f"((not (({TITLE} - '§n§p§t') = {TITLE})) or (not (({TITLE} - '§n§p§h') = {TITLE})))"
IS_GRID = f"((not (({TITLE} - '§n§p§g') = {TITLE})) or (not (({TITLE} - '§n§p§h') = {TITLE})))"
CLEAN_TITLE = f"(((({TITLE} - '§n§p§s§r') - '§n§p§t§r') - '§n§p§g§r') - '§n§p§h§r')"
BTN = "#form_button_text"
TAB_MARK = "§u§r"

TXT = [0.93, 0.93, 0.93]
SUB = [0.63, 0.63, 0.65]
CYAN = [0.15, 0.83, 0.96]
CAP = [0.80, 0.80, 0.82]


def coll(name, override=None):
    b = {"binding_name": name, "binding_type": "collection", "binding_collection_name": "form_buttons"}
    if override:
        b["binding_name_override"] = override
    return b


def view(expr, target="#visible"):
    return {"binding_type": "view", "source_property_name": expr, "target_property_name": target}


def global_title():
    return {"binding_name": TITLE}


def btn(texture, size=("100%", "100%"), mapping="button.form_button_click", collection=True):
    """A plain button: three images (default / hover / pressed)."""
    b = {
        "size": list(size),
        "$pressed_button_name": mapping,
        "layer": 1,
        "controls": [
            {"default": {"type": "image", "texture": f"textures/ui/npcstudio/panel/{texture}", "size": ["100%", "100%"]}},
            {"hover": {"type": "image", "texture": f"textures/ui/npcstudio/panel/{texture}_hover", "size": ["100%", "100%"]}},
            {"pressed": {"type": "image", "texture": f"textures/ui/npcstudio/panel/{texture}_pressed", "size": ["100%", "100%"]}}
        ]
    }
    if collection:
        b["$button_bindings"] = [{"binding_type": "collection_details", "binding_collection_name": "form_buttons"}]
    return b


def icon(size, offset, anchor):
    return {"type": "image", "layer": 5, "size": size, "offset": offset, "anchor_from": anchor, "anchor_to": anchor,
            "bindings": [coll("#form_button_texture", "#texture"), coll("#form_button_texture_file_system", "#texture_file_system"),
                         view("(not ((#texture = '') or (#texture = 'loading')))")]}


def label_from_button(size, offset, anchor, align, scale=1.0, strip_tab=False):
    expr = f"({BTN} - '{TAB_MARK}')" if strip_tab else BTN
    return {"type": "label", "layer": 6, "size": size, "offset": offset, "anchor_from": anchor, "anchor_to": anchor,
            "text": "#text", "text_alignment": align, "color": TXT, "shadow": False, "font_scale_factor": scale,
            "bindings": [coll(BTN), view(expr, "#text")]}


# ---------- V3.2 editor layout (the website editor, Java NPC Studio rows) ----------
# Every NPC Studio form has the same fixed button layout, so nothing depends on the title except
# "is this ours" (the §n§p tag, proven to work in game):
#   0-5     tabs                    (top of the left panel)
#   6-29    NPC heads               (right rail, scrolls; first slot = Spawn; empty label = hidden)
#   30-37   tools                   (bottom bar: 4 left, 4 right, empty label = hidden)
#   38-229  rows, 4 buttons each    (left panel, scrolling; empty label = hidden)
# A row is [main, a, b, c]; the tag at the start of each label picks its look (see core.js):
#   main: (none) button · §h§r/§i§r section · §w§r checkbox · §f§r field · §s§r slider · §t§r stepper
#   a: §k§r small (minus / previous)   b: §p§r small (plus) · §y§r wide value   c: §v§r value · §m§r small · §z§r Choose
TAB0, RAIL0, RAILN, BAR0, BARN, ROW0, ROWN = 0, 6, 24, 30, 8, 38, 48
PLAIN, HDR, HDR_OPEN, HDR_SHUT, TILE = "§o§r", "§j§r", "§h§r", "§i§r", "§e§r"
CAP, CHECK, FIELD, SLIDE, STEP = "§q§r", "§w§r", "§f§r", "§s§r", "§t§r"
A_SMALL, B_SMALL, B_WIDE, C_VALUE, C_SMALL, C_CHOOSE = "§k§r", "§p§r", "§y§r", "§v§r", "§m§r", "§z§r"
PANEL_W = "34%"
BAR_H = 24
RAIL_W = 32
LABEL_COL = "38%"          # caption column (Java NPC Studio: label column, then the control)
CTRL_COL = "62%"


def has(mark):
    return f"(not (({BTN} - '{mark}') = {BTN}))"


def lacks(mark):
    return f"(({BTN} - '{mark}') = {BTN})"


def shown():
    return f"(not ({BTN} = ''))"


def details():
    return {"binding_type": "collection_details", "binding_collection_name": "form_buttons"}


def strip(marks):
    e = BTN
    for m in marks:
        e = f"({e} - '{m}')"
    return e


HAS_TEX = "(not ((#texture = '') or (#texture = 'loading')))"


def tex_bindings(cond):
    return [coll("#form_button_texture", "#texture"), coll("#form_button_texture_file_system", "#texture_file_system"),
            coll(BTN), view(f"({HAS_TEX} and {cond})")]


def text_label(size, offset, anchor, align, marks, cond, color=TXT, scale=1.0, layer=6):
    """A label showing the slot's text without its tags. cond: ONE simple has(...) check."""
    return {"type": "label", "layer": layer, "size": size, "offset": offset, "anchor_from": anchor, "anchor_to": anchor,
            "text": "#text", "text_alignment": align, "color": color, "shadow": False, "font_scale_factor": scale,
            "bindings": [coll(BTN), view(strip(marks), "#text"), view(cond)]}


def plain_button(name, texture, size, cond, anchor="center", offset=(0, 0)):
    """common.button + collection binding, shown when cond is true (the details binding must stay)."""
    return {f"{name}@common.button": dict(btn(texture, size=size), anchor_from=anchor, anchor_to=anchor, offset=list(offset),
                                          bindings=[details(), coll(BTN), view(cond)])}


ALL_MARKS = [PLAIN, HDR_OPEN, HDR_SHUT, HDR, CAP, CHECK, FIELD, SLIDE, STEP, TILE,
             A_SMALL, B_SMALL, B_WIDE, C_VALUE, C_SMALL, C_CHOOSE, "§b"]


def tile(offset_x):
    """Square slot tile (inventory). Same look in all four slots, only the x position differs."""
    return [
        plain_button("tile", "tile", (18, 18), has(TILE), anchor="left_middle", offset=(offset_x, 0)),
        {"tile_icon": dict(icon([14, 14], [offset_x + 2, 0], "left_middle"), bindings=tex_bindings(has(TILE)))},
        {"tile_on": {"type": "image", "texture": "textures/ui/npcstudio/panel/sel_ring", "size": [18, 18], "layer": 7,
                     "offset": [offset_x, 0], "anchor_from": "left_middle", "anchor_to": "left_middle",
                     "bindings": [coll(BTN), view(has(f"{TILE}§b"))]}}
    ]


def row_control(i):
    """One row = 4 collection slots, all direct children of the rows stack (Bedrock only reads
    collection_index there). The main slot is 20 tall; a, b and c are 0 tall and draw on top of it."""
    k = ROW0 + 4 * i
    return [
        {f"r{i}@server_form.npcs_main": {"collection_index": k}},
        {f"r{i}a@server_form.npcs_aux_a": {"collection_index": k + 1}},
        {f"r{i}b@server_form.npcs_aux_b": {"collection_index": k + 2}},
        {f"r{i}c@server_form.npcs_aux_c": {"collection_index": k + 3}}
    ]


def aux(controls):
    return {"type": "panel", "size": ["100%", 0], "bindings": [coll(BTN), view(shown())], "controls": [
        {"over": {"type": "panel", "size": ["100%", 20], "offset": [0, -20], "anchor_from": "top_left", "anchor_to": "top_left",
                  "layer": 8, "controls": controls}}]}


def small_btn(name, mark, anchor, offset):
    dx = -2 if anchor.startswith("right") else 2
    return [plain_button(name, "small", (12, 14), has(mark), anchor=anchor, offset=offset),
            {f"{name}_icon": dict(icon([8, 8], [offset[0] + dx, 0], anchor), layer=7, bindings=tex_bindings(has(mark)))}]


def control_column(controls):
    """A panel covering the control column (right of the captions); children anchor to its left edge."""
    return [{"col": {"type": "panel", "size": [f"{CTRL_COL} - 2px", "100%"], "anchor_from": "right_middle",
                     "anchor_to": "right_middle", "controls": controls}}]


def value_btn(name, mark, size, offset, scale):
    return [plain_button(name, "value" if mark != C_CHOOSE else "choose", size, has(mark), anchor="right_middle", offset=offset),
            {f"{name}_text": dict(text_label([size[0], 10], offset, "right_middle", "center", ALL_MARKS, has(mark), scale=scale), layer=7)}]


def row_templates():
    t = {}
    t["npcs_main"] = {"type": "panel", "size": ["100%", 20], "bindings": [coll(BTN), view(shown())], "controls": [
        # button row: raised; section header: flat with a hairline; caption rows: flat, the control does the work
        plain_button("btn_row", "row", ("100% - 6px", 18), has(PLAIN)),
        plain_button("btn_hdr", "hdr", ("100% - 6px", 18), has(HDR)),
        plain_button("btn_cap", "cap", ("100% - 6px", 18), has(CAP)),
        {"icon_row": dict(icon([14, 14], [8, 0], "left_middle"), bindings=tex_bindings(has(PLAIN)))},
        {"icon_hdr": dict(icon([12, 12], [8, 0], "left_middle"), bindings=tex_bindings(has(HDR)))},
        {"check": dict(icon([12, 12], [-5, 0], "right_middle"), bindings=tex_bindings(has(CHECK)))},
        {"track": dict(icon([f"{CTRL_COL} - 66px", 8], [-50, 0], "right_middle"), bindings=tex_bindings(has(SLIDE)))},
        {"chev_open": {"type": "image", "texture": "textures/ui/npcstudio/panel/chev_open", "size": [8, 8], "layer": 6,
                       "offset": [-8, 0], "anchor_from": "right_middle", "anchor_to": "right_middle",
                       "bindings": [coll(BTN), view(has(HDR_OPEN))]}},
        {"chev_shut": {"type": "image", "texture": "textures/ui/npcstudio/panel/chev_shut", "size": [8, 8], "layer": 6,
                       "offset": [-8, 0], "anchor_from": "right_middle", "anchor_to": "right_middle",
                       "bindings": [coll(BTN), view(has(HDR_SHUT))]}},
        {"label_row": text_label(["100% - 56px", 10], [28, 0], "left_middle", "left", ALL_MARKS[:-1], has(PLAIN))},
        {"label_hdr": text_label(["100% - 56px", 10], [26, 0], "left_middle", "left", ALL_MARKS, has(HDR), color=CYAN)},
        {"label_field": text_label([f"{LABEL_COL} - 10px", 10], [10, 0], "left_middle", "left", ALL_MARKS[:-1], has(FIELD), color=CAP)},
        {"label_slide": text_label([f"{LABEL_COL} - 10px", 10], [10, 0], "left_middle", "left", ALL_MARKS[:-1], has(SLIDE), color=CAP)},
        {"label_step": text_label([f"{LABEL_COL} - 10px", 10], [10, 0], "left_middle", "left", ALL_MARKS[:-1], has(STEP), color=CAP)},
        {"label_chk": text_label(["100% - 36px", 10], [10, 0], "left_middle", "left", ALL_MARKS[:-1], has(CHECK), color=CAP)}
    ] + tile(4)}
    t["npcs_aux_a"] = aux(control_column(small_btn("small", A_SMALL, "left_middle", [0, 0])) + tile(26))
    t["npcs_aux_b"] = aux(small_btn("small", B_SMALL, "right_middle", [-36, 0])
                          + value_btn("wide", B_WIDE, [f"{CTRL_COL} - 34px", 14], [-18, 0], 0.85) + tile(48))
    t["npcs_aux_c"] = aux(small_btn("small", C_SMALL, "right_middle", [-4, 0])
                          + value_btn("value", C_VALUE, [30, 14], [-4, 0], 0.75)
                          + value_btn("choose", C_CHOOSE, [f"{CTRL_COL} - 10px", 14], [-4, 0], 0.85) + tile(70))
    return t


def build():
    d = {"namespace": "server_form"}

    # instant menus: no slide/fade between screens, so folding a section or switching tabs is immediate
    d["third_party_server_screen"] = {
        "$screen_animations": ["@server_form.npcs_no_anim"],
        "$background_animations": ["@server_form.npcs_no_anim"],
        "render_game_behind": True
        # V3.2: "absorbs_input": false (free look) is the suspect for a game crash when the panel opened; removed
    }
    d["npcs_no_anim"] = {"anim_type": "offset", "easing": "linear", "duration": 0, "from": [0, 0], "to": [0, 0],
                         "play_event": "screen.exit_pop", "end_event": "screen.exit_end"}
    d["main_screen_content"] = {
        "type": "panel", "size": ["100%", "100%"],
        "controls": [{"server_form_factory": {"type": "factory", "control_ids": {
            "long_form": "@server_form.npcs_router", "custom_form": "@server_form.npcs_custom_router"}}}]
    }
    d["npcs_router"] = {"type": "panel", "size": ["100%", "100%"], "controls": [
        {"vanilla@server_form.npcs_vanilla_wrap": {}},
        {"studio@server_form.npcs_editor": {}}
    ]}
    d["npcs_vanilla_wrap"] = {"type": "panel", "size": ["100%", "100%"],
                              "bindings": [global_title(), view(NO_PANEL)],
                              "controls": [{"long_form@server_form.long_form": {}}]}

    # ---------- NPC Studio input forms (text boxes, sliders, toggles): same dark left panel, no grey box ----------
    d["npcs_custom_router"] = {"type": "panel", "size": ["100%", "100%"], "controls": [
        {"vanilla": {"type": "panel", "size": ["100%", "100%"], "bindings": [global_title(), view(NO_PANEL)],
                     "controls": [{"custom_form@server_form.custom_form": {}}]}},
        {"studio@server_form.npcs_custom": {"bindings": [global_title(), view(HAS_PANEL)]}}
    ]}
    d["npcs_custom"] = {
        "type": "image", "texture": "textures/ui/npcstudio/panel/panel_bg", "layer": 2,
        "size": [PANEL_W, "100%"], "anchor_from": "top_left", "anchor_to": "top_left",
        "controls": [
            {"title": {"type": "label", "text": "#title_text", "color": CYAN, "shadow": False, "layer": 4,
                       "size": ["100% - 30px", 10], "offset": [10, 6], "anchor_from": "top_left", "anchor_to": "top_left",
                       "bindings": [global_title(), view(CLEAN_TITLE, "#title_text")]}},
            {"close@common.button": dict(btn("close", size=(14, 14), mapping="button.menu_exit", collection=False),
                                         anchor_from="top_right", anchor_to="top_right", offset=[-3, 3])},
            {"rule": {"type": "image", "texture": "textures/ui/npcstudio/panel/rule", "size": ["100%", 1],
                      "offset": [0, 20], "anchor_from": "top_left", "anchor_to": "top_left", "layer": 3}},
            {"scroll@server_form.npcs_custom_scroll": {}}
        ]
    }
    d["npcs_custom_scroll@common.scrolling_panel"] = {
        "anchor_to": "top_left", "anchor_from": "top_left", "offset": [0, 22],
        "$show_background": False, "size": ["100%", "100% - 23px"],
        "$scrolling_content": "server_form.npcs_custom_content",
        "$scroll_size": [4, "100% - 4px"],
        "$scrolling_pane_size": ["100% - 6px", "100%"],
        "$scrolling_pane_offset": [0, 0],
        "$scroll_bar_right_padding_size": [0, 0]
    }
    d["npcs_custom_content"] = {
        "type": "stack_panel", "orientation": "vertical", "size": ["100% - 12px", "100%c"], "offset": [6, 0],
        "anchor_from": "top_left", "anchor_to": "top_left",
        "controls": [
            {"generated_form@server_form.generated_contents": {}},
            {"gap": {"type": "panel", "size": ["100%", 6]}},
            {"submit": {"type": "panel", "size": ["100%", 20],
                        "bindings": [{"binding_name": "#submit_button_visible", "binding_name_override": "#visible"}],
                        "controls": [
                            {"button@common.button": dict(btn("small", size=("100%", 18), mapping="button.submit_custom_form", collection=False),
                                                          anchor_from="center", anchor_to="center")},
                            {"label": {"type": "label", "text": "#submit_text", "color": TXT, "shadow": False, "layer": 6,
                                       "size": ["100%", 10], "text_alignment": "center", "anchor_from": "center", "anchor_to": "center",
                                       "bindings": [{"binding_name": "#submit_text"}]}}]}},
            {"pad_end": {"type": "panel", "size": ["100%", 8]}}
        ]
    }

    d["npcs_editor"] = {
        "type": "panel", "size": ["100%", "100%"], "layer": 2,
        "bindings": [global_title(), view(HAS_PANEL)],
        "controls": [
            {"left@server_form.npcs_left": {}},
            {"rail@server_form.npcs_rail": {}},
            {"bar@server_form.npcs_bar": {}}
        ]
    }

    # ---------- left panel ----------
    d["npcs_left"] = {
        "type": "image", "texture": "textures/ui/npcstudio/panel/panel_bg",
        "size": [PANEL_W, f"100% - {BAR_H}px"], "anchor_from": "top_left", "anchor_to": "top_left", "layer": 2,
        "controls": [
            {"tabs@server_form.npcs_tabs": {}},
            {"close@common.button": dict(btn("close", size=(14, 14), mapping="button.menu_exit", collection=False),
                                         anchor_from="top_right", anchor_to="top_right", offset=[-3, 3])},
            {"rule": {"type": "image", "texture": "textures/ui/npcstudio/panel/rule", "size": ["100%", 1],
                      "offset": [0, 20], "anchor_from": "top_left", "anchor_to": "top_left", "layer": 3}},
            {"scroll@server_form.npcs_scroll": {}}
        ]
    }
    tabs = [{f"tab{i}@server_form.npcs_tab": {"collection_index": TAB0 + i}} for i in range(TABS)]
    d["npcs_tabs"] = {"type": "stack_panel", "orientation": "horizontal", "size": ["100% - 22px", 18],
                      "offset": [3, 2], "anchor_from": "top_left", "anchor_to": "top_left",
                      "collection_name": "form_buttons", "controls": tabs}
    d["npcs_tab"] = {
        "type": "panel", "size": [f"{100 / TABS:.2f}%", "100%"],
        "bindings": [coll(BTN), view(shown())],
        "controls": [
            {"button@common.button": btn("tab")},
            {"label": label_from_button(["100% - 2px", 10], [0, 0], "center", "center", 0.7, strip_tab=True)},
            {"bar": {"type": "image", "texture": "textures/ui/npcstudio/panel/tab_bar", "size": ["100% - 8px", 2], "layer": 6,
                     "anchor_from": "bottom_middle", "anchor_to": "bottom_middle",
                     "bindings": [coll(BTN), view(has("§b"))]}}
        ]
    }
    d["npcs_scroll@common.scrolling_panel"] = {
        "anchor_to": "top_left", "anchor_from": "top_left", "offset": [0, 22],
        "$show_background": False, "size": ["100%", "100% - 23px"],
        "$scrolling_content": "server_form.npcs_rows",
        "$scroll_size": [4, "100% - 4px"],
        "$scrolling_pane_size": ["100% - 6px", "100%"],
        "$scrolling_pane_offset": [0, 0],
        "$scroll_bar_right_padding_size": [0, 0]
    }
    rows = [c for i in range(ROWN) for c in row_control(i)]
    d["npcs_rows"] = {
        "type": "stack_panel", "orientation": "vertical", "size": ["100%", "100%c"],
        "anchor_from": "top_left", "anchor_to": "top_left", "collection_name": "form_buttons",
        "controls": [
            {"body_box": {"type": "panel", "size": ["100%", "100%c"], "controls": [
                {"body": {"type": "label", "size": ["100% - 16px", "default"], "offset": [8, 2], "text": "#form_text", "color": SUB,
                          "anchor_from": "top_left", "anchor_to": "top_left",
                          "shadow": False, "font_scale_factor": 0.85, "layer": 4}}]}},
            {"pad": {"type": "panel", "size": ["100%", 4]}}
        ] + rows + [{"pad_end": {"type": "panel", "size": ["100%", 8]}}]
    }
    d.update(row_templates())

    # ---------- right rail: NPC heads (scrolls; Spawn is the first slot so it never moves) ----------
    slots = [{f"h{i}@server_form.npcs_head": {"collection_index": RAIL0 + i}} for i in range(RAILN)]
    d["npcs_rail"] = {
        "type": "image", "texture": "textures/ui/npcstudio/panel/panel_bg",
        "size": [RAIL_W, f"100% - {BAR_H}px"], "anchor_from": "top_right", "anchor_to": "top_right", "layer": 2,
        "controls": [{"scroll@server_form.npcs_rail_scroll": {}}]
    }
    d["npcs_rail_scroll@common.scrolling_panel"] = {
        "anchor_to": "top_left", "anchor_from": "top_left", "offset": [0, 2],
        "$show_background": False, "size": ["100%", "100% - 4px"],
        "$scrolling_content": "server_form.npcs_rail_list",
        "$scroll_size": [2, "100% - 4px"],
        "$scrolling_pane_size": ["100% - 3px", "100%"],
        "$scrolling_pane_offset": [0, 0],
        "$scroll_bar_right_padding_size": [0, 0]
    }
    d["npcs_rail_list"] = {"type": "stack_panel", "orientation": "vertical", "size": ["100%", "100%c"],
                           "anchor_from": "top_left", "anchor_to": "top_left",
                           "collection_name": "form_buttons", "controls": slots}
    d["npcs_head"] = {
        "type": "panel", "size": ["100%", 28],
        "bindings": [coll(BTN), view(shown())],
        "controls": [
            {"button@common.button": dict(btn("tile", size=(24, 24)), anchor_from="center", anchor_to="center")},
            {"icon": icon([18, 18], [0, 0], "center")},
            {"sel": {"type": "image", "texture": "textures/ui/npcstudio/panel/sel_ring", "size": [24, 24], "layer": 7,
                     "bindings": [coll(BTN), view(has("§b"))]}}
        ]
    }

    # ---------- bottom bar: tools ----------
    left = [{f"b{i}@server_form.npcs_tool": {"collection_index": BAR0 + i}} for i in range(BARN // 2)]
    right = [{f"b{i}@server_form.npcs_tool": {"collection_index": BAR0 + i}} for i in range(BARN // 2, BARN)]
    d["npcs_bar"] = {
        "type": "image", "texture": "textures/ui/npcstudio/panel/bar_bg",
        "size": ["100%", BAR_H], "anchor_from": "bottom_left", "anchor_to": "bottom_left", "layer": 2,
        "controls": [
            {"l": {"type": "stack_panel", "orientation": "horizontal", "size": ["100%c", BAR_H - 4], "offset": [4, 0],
                   "anchor_from": "left_middle", "anchor_to": "left_middle", "collection_name": "form_buttons", "controls": left}},
            {"r": {"type": "stack_panel", "orientation": "horizontal", "size": ["100%c", BAR_H - 4], "offset": [-4, 0],
                   "anchor_from": "right_middle", "anchor_to": "right_middle", "collection_name": "form_buttons", "controls": right}}
        ]
    }
    d["npcs_tool"] = {
        "type": "panel", "size": [BAR_H, BAR_H - 4],
        "bindings": [coll(BTN), view(shown())],
        "controls": [
            {"button@common.button": dict(btn("tool", size=(BAR_H - 4, BAR_H - 4)), anchor_from="center", anchor_to="center")},
            {"icon": icon([12, 12], [0, 0], "center")}
        ]
    }
    return d


# ---------- textures ----------
def nine(name, fill, border, size=8, slice_=2, top_line=None):
    img = Image.new("RGBA", (size, size), fill)
    g = ImageDraw.Draw(img)
    if border:
        g.rectangle([0, 0, size - 1, size - 1], outline=border)
    if top_line:
        g.line([(0, size - 1), (size - 1, size - 1)], fill=top_line)
    img.save(os.path.join(TEX, f"{name}.png"))
    with open(os.path.join(TEX, f"{name}.json"), "w") as f:
        json.dump({"nineslice_size": slice_, "base_size": [size, size]}, f)


def textures():
    os.makedirs(TEX, exist_ok=True)
    nine("panel_bg", (20, 20, 21, 240), (40, 40, 42, 255))
    nine("row", (35, 35, 37, 255), (48, 48, 51, 255))
    nine("row_hover", (44, 44, 47, 255), (70, 70, 75, 255))
    nine("row_pressed", (30, 70, 82, 255), (39, 211, 245, 255))
    nine("tile", (35, 35, 37, 255), (48, 48, 51, 255))
    nine("tile_hover", (44, 44, 47, 255), (70, 70, 75, 255))
    nine("tile_pressed", (11, 70, 90, 255), (39, 211, 245, 255))
    nine("hdr", (20, 20, 21, 0), None, top_line=(237, 237, 237, 28))
    nine("hdr_hover", (35, 35, 37, 255), None, top_line=(237, 237, 237, 28))
    nine("hdr_pressed", (44, 44, 47, 255), None, top_line=(237, 237, 237, 28))
    nine("tool", (35, 35, 37, 255), (58, 58, 62, 255))
    nine("tool_hover", (44, 44, 47, 255), (80, 80, 86, 255))
    nine("tool_pressed", (30, 70, 82, 255), (39, 211, 245, 255))
    nine("bar_bg", (15, 15, 16, 245), None)
    # Java-style controls: flat caption rows, small square buttons, inset value boxes, "Choose" buttons
    nine("cap", (0, 0, 0, 0), None)
    nine("cap_hover", (255, 255, 255, 10), None)
    nine("cap_pressed", (255, 255, 255, 18), None)
    nine("small", (44, 44, 47, 255), (66, 66, 71, 255))
    nine("small_hover", (58, 58, 62, 255), (96, 96, 103, 255))
    nine("small_pressed", (30, 70, 82, 255), (39, 211, 245, 255))
    nine("value", (14, 14, 15, 255), (58, 58, 62, 255))
    nine("value_hover", (20, 20, 22, 255), (96, 96, 103, 255))
    nine("value_pressed", (14, 30, 36, 255), (39, 211, 245, 255))
    nine("choose", (52, 52, 56, 255), (74, 74, 80, 255))
    nine("choose_hover", (64, 64, 69, 255), (110, 110, 118, 255))
    nine("choose_pressed", (30, 70, 82, 255), (39, 211, 245, 255))
    small_icons()
    slider_tracks()
    nine("sel_ring", (0, 0, 0, 0), (39, 211, 245, 255))
    nine("tab", (16, 21, 30, 0), None)
    nine("tab_hover", (35, 35, 37, 255), None)
    nine("tab_pressed", (11, 70, 90, 255), None)
    Image.new("RGBA", (2, 2), (39, 211, 245, 255)).save(os.path.join(TEX, "tab_bar.png"))
    for name, pts in [("chev_open", [(1, 2), (4, 5), (7, 2)]), ("chev_shut", [(2, 1), (5, 4), (2, 7)])]:
        img = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
        ImageDraw.Draw(img).line(pts, fill=(133, 133, 139, 255), width=1)
        img.save(os.path.join(TEX, f"{name}.png"))
    Image.new("RGBA", (2, 2), (48, 48, 51, 255)).save(os.path.join(TEX, "rule.png"))
    # close button: an X
    for name, bg, fg in [("close", (16, 21, 30, 0), (132, 148, 171, 255)), ("close_hover", (60, 30, 36, 255), (255, 255, 255, 255)),
                         ("close_pressed", (120, 30, 40, 255), (255, 255, 255, 255))]:
        img = Image.new("RGBA", (16, 16), bg)
        g = ImageDraw.Draw(img)
        g.line([(4, 4), (11, 11)], fill=fg, width=2)
        g.line([(11, 4), (4, 11)], fill=fg, width=2)
        img.save(os.path.join(TEX, f"{name}.png"))


ICONS = os.path.join(ROOT, "RP", "textures", "ui", "npcstudio")
INK = (214, 214, 219, 255)
ACCENT = (39, 211, 245, 255)


def small_icons():
    """16px pixel icons for the row controls (one stroke, one colour, like the rest of the panel)."""
    def save(name, draw):
        img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        draw(ImageDraw.Draw(img))
        img.save(os.path.join(ICONS, f"icon_{name}.png"))
    save("dec", lambda g: g.rectangle([3, 7, 12, 8], fill=INK))
    save("inc", lambda g: (g.rectangle([3, 7, 12, 8], fill=INK), g.rectangle([7, 3, 8, 12], fill=INK)))
    save("prev", lambda g: [g.rectangle([9 - i, 3 + i, 10 - i, 12 - i], fill=INK) for i in range(5)])
    save("next", lambda g: [g.rectangle([5 + i, 3 + i, 6 + i, 12 - i], fill=INK) for i in range(5)])

    def box(g, on):
        if on:
            g.rectangle([1, 1, 14, 14], fill=ACCENT)
            for x, y in [(4, 8), (5, 9), (6, 10), (7, 9), (8, 8), (9, 7), (10, 6), (11, 5)]:
                g.rectangle([x, y, x, y + 1], fill=(14, 14, 15, 255))
        else:
            g.rectangle([1, 1, 14, 14], fill=(14, 14, 15, 255), outline=(110, 110, 118, 255))
    save("check_on", lambda g: box(g, True))
    save("check_off", lambda g: box(g, False))


def slider_tracks():
    """21 track pictures (0%, 5% ... 100%): a thin rail, the cyan filled part and a light knob."""
    out = os.path.join(ICONS, "slider")
    os.makedirs(out, exist_ok=True)
    W, H = 48, 8
    for n in range(21):
        img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        g = ImageDraw.Draw(img)
        knob = round((W - 3) * n / 20)
        g.rectangle([0, 3, W - 1, 4], fill=(66, 66, 71, 255))
        if knob > 0:
            g.rectangle([0, 3, knob, 4], fill=ACCENT)
        g.rectangle([knob, 0, knob + 2, H - 1], fill=(237, 237, 240, 255))
        img.save(os.path.join(out, f"s{n:02d}.png"))


if __name__ == "__main__":
    textures()
    os.makedirs(UI, exist_ok=True)
    with open(os.path.join(UI, "server_form.json"), "w", encoding="utf-8") as f:
        json.dump(build(), f, indent=1, ensure_ascii=False)
    print("server_form.json + panel textures written")
