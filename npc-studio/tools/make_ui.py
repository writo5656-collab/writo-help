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
CAP_COLOR = [0.80, 0.80, 0.82]  # caption text (not the CAP row tag below!)


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
TAB0, RAIL0, RAILN, BAR0, BARN, MINI_BTN, ROW0, ROWN = 0, 6, 24, 30, 8, 38, 39, 48
# Features that are off until each one is proven in game (the panel crashed the game in 4.3-4.8):
FREELOOK = bool(os.environ.get("NPCS_FREELOOK"))       # look around in the free space
DARK_INPUTS = bool(os.environ.get("NPCS_DARK_INPUTS"))  # input forms inside the dark panel
TILES = bool(os.environ.get("NPCS_TILES"))              # inventory slot tiles (core.js TILES must match)
# body tags (global #form_text): thirds grid · panel hidden
GRID_TAG, MINI_TAG = "§g§r", "§x§r"
BODY = "#form_text"
HAS_GRID = f"(not (({BODY} - '{GRID_TAG}') = {BODY}))"
IS_MINI = f"(not (({BODY} - '{MINI_TAG}') = {BODY}))"
NOT_MINI = f"(({BODY} - '{MINI_TAG}') = {BODY})"
PLAIN, HDR, HDR_OPEN, HDR_SHUT, TILE = "§o§r", "§j§r", "§h§r", "§i§r", "§e§r"
CAP, CHECK, FIELD, SLIDE, STEP = "§q§r", "§w§r", "§f§r", "§s§r", "§t§r"
A_SMALL, B_WIDE, C_SMALL = "§k§r", "§y§r", "§m§r"
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
NO_TEX = "((#texture = '') or (#texture = 'loading'))"


def tex_bindings(cond):
    return [coll("#form_button_texture", "#texture"), coll("#form_button_texture_file_system", "#texture_file_system"),
            coll(BTN), view(f"({HAS_TEX} and {cond})")]


def text_label(size, offset, anchor, align, marks, cond, color=TXT, scale=1.0, layer=6):
    """A label showing the slot's text without its tags. cond: ONE simple has(...) check."""
    return {"type": "label", "layer": layer, "size": size, "offset": offset, "anchor_from": anchor, "anchor_to": anchor,
            "text": "#text", "text_alignment": align, "color": color, "shadow": False, "font_scale_factor": scale,
            "bindings": [coll(BTN), view(strip(marks), "#text"), view(cond)]}


def image(name, texture, size, cond, anchor="center", offset=(0, 0), layer=1):
    """A plain picture shown when cond is true (backgrounds: no button, so no input)."""
    return {name: {"type": "image", "texture": f"textures/ui/npcstudio/panel/{texture}", "size": list(size), "layer": layer,
                   "anchor_from": anchor, "anchor_to": anchor, "offset": list(offset),
                   "bindings": [coll(BTN), view(cond)]}}


def one_button(texture, size, anchor="center", offset=(0, 0)):
    """THE button of a form entry. Exactly one per entry: three stacked buttons on one entry crashed the
    game. No visibility of its own: the entry's panel hides it when the entry is empty."""
    return {"button@common.button": dict(btn(texture, size=size), anchor_from=anchor, anchor_to=anchor, offset=list(offset))}


def row_control(i):
    """One row = 4 form entries, all direct children of the rows stack (Bedrock only reads
    collection_index there). The main entry is 20 tall; a, b and c are 0 tall and draw on top of it."""
    k = ROW0 + 4 * i
    if os.environ.get("NPCS_NO_AUX"):  # test build: rows without the -, value box, +
        return [{f"r{i}@server_form.npcs_main": {"collection_index": k}}]
    if ROW_PANEL:  # variant: the 4 entries sit in their own collection panel (no 0-tall entries)
        return [{f"row{i}": {"type": "collection_panel", "collection_name": "form_buttons", "size": ["100%", "100%c"],
                             "controls": [
            {"m@server_form.npcs_main": {"collection_index": k}},
            {"a@server_form.npcs_aux_a": {"collection_index": k + 1}},
            {"b@server_form.npcs_aux_b": {"collection_index": k + 2}},
            {"c@server_form.npcs_aux_c": {"collection_index": k + 3}}]}}]
    return [
        {f"r{i}@server_form.npcs_main": {"collection_index": k}},
        {f"r{i}a@server_form.npcs_aux_a": {"collection_index": k + 1}},
        {f"r{i}b@server_form.npcs_aux_b": {"collection_index": k + 2}},
        {f"r{i}c@server_form.npcs_aux_c": {"collection_index": k + 3}}
    ]


ROW_PANEL = bool(os.environ.get("NPCS_ROW_PANEL"))


def aux(controls):
    if ROW_PANEL:  # full row size, lying on top of the main entry inside the row's collection panel
        return {"type": "panel", "size": ["100%", 20], "layer": 8, "anchor_from": "top_left", "anchor_to": "top_left",
                "bindings": [coll(BTN), view(shown())], "controls": controls}
    return {"type": "panel", "size": ["100%", 0], "bindings": [coll(BTN), view(shown())], "controls": [
        {"over": {"type": "panel", "size": ["100%", 20], "offset": [0, -20], "anchor_from": "top_left", "anchor_to": "top_left",
                  "layer": 8, "controls": controls}}]}


def small_slot(anchor, offset):
    """- / + / < / > : one small button with its icon."""
    dx = -2 if anchor.startswith("right") else 2
    return [one_button("small", (12, 14), anchor=anchor, offset=offset),
            {"icon": dict(icon([8, 8], [offset[0] + dx, 0], anchor), layer=7)}]


def row_templates():
    t = {}
    hdr_marks = [HDR, HDR_OPEN, HDR_SHUT]
    t["npcs_main"] = {"type": "panel", "size": ["100%", 20], "bindings": [coll(BTN), view(shown())], "controls": [
        # looks: plain pictures; the one button on top is see-through and only lights up on hover / press
        image("bg_row", "row", ("100% - 6px", 18), has(PLAIN)),
        image("bg_hdr", "hdr", ("100% - 6px", 18), has(HDR)),
        # two buttons that are never visible together, and never under the controls:
        #   full width on button / header / checkbox rows, only the label column on control rows
        {"full": {"type": "panel", "size": ["100%", "100%"], "bindings": [coll(BTN), view(lacks(CAP))],
                  "controls": [one_button("hit", ("100% - 6px", 18))]}},
        {"cap": {"type": "panel", "size": [f"{LABEL_COL} - 3px", 18], "offset": [3, 0], "anchor_from": "left_middle",
                 "anchor_to": "left_middle", "bindings": [coll(BTN), view(has(CAP))],
                 "controls": [one_button("hit", ("100%", "100%"))]}},
        {"icon_row": dict(icon([14, 14], [8, 0], "left_middle"), bindings=tex_bindings(has(PLAIN)))},
        {"icon_hdr": dict(icon([12, 12], [8, 0], "left_middle"), bindings=tex_bindings(has(HDR)))},
        {"check": dict(icon([12, 12], [-5, 0], "right_middle"), bindings=tex_bindings(has(CHECK)))},
        {"chev_open": {"type": "image", "texture": "textures/ui/npcstudio/panel/chev_open", "size": [8, 8], "layer": 6,
                       "offset": [-8, 0], "anchor_from": "right_middle", "anchor_to": "right_middle",
                       "bindings": [coll(BTN), view(has(HDR_OPEN))]}},
        {"chev_shut": {"type": "image", "texture": "textures/ui/npcstudio/panel/chev_shut", "size": [8, 8], "layer": 6,
                       "offset": [-8, 0], "anchor_from": "right_middle", "anchor_to": "right_middle",
                       "bindings": [coll(BTN), view(has(HDR_SHUT))]}},
        {"label_row": text_label(["100% - 56px", 10], [28, 0], "left_middle", "left", [PLAIN], has(PLAIN))},
        {"label_hdr": text_label(["100% - 56px", 10], [26, 0], "left_middle", "left", hdr_marks, has(HDR), color=CYAN)},
        {"label_cap": text_label([f"{LABEL_COL} - 10px", 10], [10, 0], "left_middle", "left", [CAP, FIELD, SLIDE, STEP],
                                 has(CAP), color=CAP_COLOR)},
        {"label_chk": text_label(["100% - 36px", 10], [10, 0], "left_middle", "left", [CHECK], has(CHECK), color=CAP_COLOR)}
    ]}
    # a: small button at the start of the control column
    t["npcs_aux_a"] = aux([{"col": {"type": "panel", "size": [f"{CTRL_COL} - 2px", "100%"], "anchor_from": "right_middle",
                                    "anchor_to": "right_middle", "controls": small_slot("left_middle", [0, 0])}}])
    # b: the value box between a and c; a slider's track is its picture, the number sits on the right
    box = [f"{CTRL_COL} - 34px", 14]
    t["npcs_aux_b"] = aux([{"box": {"type": "panel", "size": box, "anchor_from": "right_middle", "anchor_to": "right_middle",
                                    "offset": [-18, 0], "controls": [
        one_button("value", ("100%", "100%")),
        {"track": dict(icon(["100% - 40px", 8], [4, 0], "left_middle"), layer=7, bindings=[
            coll("#form_button_texture", "#texture"), coll("#form_button_texture_file_system", "#texture_file_system"),
            view(HAS_TEX)])},
        {"num": dict(text_label([34, 10], [-2, 0], "right_middle", "right", [B_WIDE], "(1 = 1)", scale=0.8), layer=7,
                     bindings=[coll("#form_button_texture", "#texture"), coll(BTN), view(strip([B_WIDE]), "#text"),
                               view(f"(not {NO_TEX})")])},
        {"text": dict(text_label(["100% - 4px", 10], [0, 0], "center", "center", [B_WIDE], "(1 = 1)", scale=0.85), layer=7,
                      bindings=[coll("#form_button_texture", "#texture"), coll(BTN), view(strip([B_WIDE]), "#text"),
                                view(NO_TEX)])}
    ]}}])
    # c: small button at the right edge
    t["npcs_aux_c"] = aux(small_slot("right_middle", [-4, 0]))
    return t


def add_dark_inputs(d):
    # ---------- NPC Studio input forms (text boxes, sliders, toggles): same dark left panel, no grey box ----------
    d["npcs_custom_router"] = {"type": "panel", "size": ["100%", "100%"], "controls": [
        {"vanilla": {"type": "panel", "size": ["100%", "100%"], "bindings": [global_title(), view(NO_PANEL)],
                     "controls": [wrap_vanilla("custom_form@server_form.custom_form")]}},
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



def wrap_vanilla(name):
    """Mojang's form, inside the input blocker when free look is on (NPCS_SAFE=1: as it is)."""
    if not FREELOOK:
        return {name: {}}
    return {"block@server_form.npcs_blocker": {"controls": [{name: {}}]}}


def build():
    d = {"namespace": "server_form"}

    # instant menus: no slide/fade between screens, so folding a section or switching tabs is immediate
    d["third_party_server_screen"] = {
        "$screen_animations": ["@server_form.npcs_no_anim"],
        "$background_animations": ["@server_form.npcs_no_anim"],
        "render_game_behind": True
    }
    if FREELOOK:
        # free look: touches on the empty part of the screen reach the game (like the HUD), so you can turn
        # your view on the right while the Studio panel is open. Walking, breaking, placing and hitting are
        # switched off by the scripts meanwhile (core.js editorLock, viewport.js).
        d["third_party_server_screen"]["absorbs_input"] = False
    # other add-ons' forms and Mojang's dialogs keep blocking the world: they sit INSIDE a modal input
    # panel, like Mojang's own popups, so their buttons still work
    if FREELOOK:
        d["npcs_blocker"] = {"type": "input_panel", "size": ["100%", "100%"], "modal": True, "prevent_touch_input": True}
    d["npcs_no_anim"] = {"anim_type": "offset", "easing": "linear", "duration": 0, "from": [0, 0], "to": [0, 0],
                         "play_event": "screen.exit_pop", "end_event": "screen.exit_end"}
    d["main_screen_content"] = {
        "type": "panel", "size": ["100%", "100%"],
        "controls": [{"server_form_factory": {"type": "factory", "control_ids": {
            "long_form": "@server_form.npcs_router",
            "custom_form": "@server_form.npcs_custom_router" if DARK_INPUTS else "@server_form.custom_form"}}}]
    }
    d["npcs_router"] = {"type": "panel", "size": ["100%", "100%"], "controls": [
        {"vanilla@server_form.npcs_vanilla_wrap": {}},
        {"studio@server_form.npcs_editor": {}}
    ]}
    d["npcs_vanilla_wrap"] = {"type": "panel", "size": ["100%", "100%"],
                              "bindings": [global_title(), view(NO_PANEL)],
                              "controls": [wrap_vanilla("long_form@server_form.long_form")]}

    if DARK_INPUTS:
        add_dark_inputs(d)

    d["npcs_editor"] = {
        "type": "panel", "size": ["100%", "100%"], "layer": 2,
        "bindings": [global_title(), view(HAS_PANEL)],
        "controls": [
            {"grid@server_form.npcs_grid_free": {}},
            {"left@server_form.npcs_left": {}},
            {"rail@server_form.npcs_rail": {}},
            {"bar@server_form.npcs_bar": {}},
            {"mini@server_form.npcs_mini": {}}
        ]
    }
    # thirds grid over the free space right of the panel (Camera tab: Thirds guide)
    d["npcs_grid_free"] = {
        "type": "image", "texture": "textures/ui/npcstudio/panel/grid_thirds", "layer": 1,
        "size": [f"{100 - int(PANEL_W[:-1])}% - {RAIL_W}px", f"100% - {BAR_H}px"],
        "anchor_from": "top_right", "anchor_to": "top_right", "offset": [-RAIL_W, 0],
        "bindings": [{"binding_name": BODY}, view(f"({HAS_GRID} and {NOT_MINI})")]
    }
    # panel hidden: the whole view with the grid, a › handle on the left and a hint at the bottom
    d["npcs_mini"] = {
        "type": "panel", "size": ["100%", "100%"], "layer": 2,
        "bindings": [{"binding_name": BODY}, view(IS_MINI)],
        "controls": [
            {"grid": {"type": "image", "texture": "textures/ui/npcstudio/panel/grid_thirds", "size": ["100%", "100%"], "layer": 1}},
            {"handle_slot": {"type": "stack_panel", "orientation": "vertical", "size": [16, 40],
                             "anchor_from": "left_middle", "anchor_to": "left_middle", "collection_name": "form_buttons",
                             "controls": [{"h@server_form.npcs_mini_handle": {"collection_index": MINI_BTN}}]}},
            {"hint_bg": {"type": "image", "texture": "textures/ui/npcstudio/panel/bar_bg", "layer": 3,
                         "size": [240, 14], "anchor_from": "bottom_middle", "anchor_to": "bottom_middle", "offset": [0, -6],
                         "controls": [{"hint": {"type": "label", "text": "Panel hidden  ·  tap  >  on the left to bring it back",
                                                "color": SUB, "shadow": False, "font_scale_factor": 0.8, "layer": 4,
                                                "size": ["100% - 8px", 10], "text_alignment": "center",
                                                "anchor_from": "center", "anchor_to": "center"}}]}}
        ]
    }
    d["npcs_mini_handle"] = {
        "type": "panel", "size": [16, 40],
        "bindings": [coll(BTN), view(shown())],
        "controls": [
            {"button@common.button": dict(btn("tool", size=(16, 40)), anchor_from="center", anchor_to="center")},
            {"icon": icon([8, 8], [0, 0], "center")}
        ]
    }

    # ---------- left panel ----------
    d["npcs_left"] = {
        "type": "image", "texture": "textures/ui/npcstudio/panel/panel_bg",
        "size": [PANEL_W, f"100% - {BAR_H}px"], "anchor_from": "top_left", "anchor_to": "top_left", "layer": 2,
        "bindings": [{"binding_name": BODY}, view(NOT_MINI)],
        "controls": [
            {"tabs@server_form.npcs_tabs": {}},
            {"hide_slot": {"type": "stack_panel", "orientation": "horizontal", "size": [14, 14],
                           "anchor_from": "top_right", "anchor_to": "top_right", "offset": [-20, 3],
                           "collection_name": "form_buttons",
                           "controls": [{"h@server_form.npcs_hide_btn": {"collection_index": MINI_BTN}}]}},
            {"close@common.button": dict(btn("close", size=(14, 14), mapping="button.menu_exit", collection=False),
                                         anchor_from="top_right", anchor_to="top_right", offset=[-3, 3])},
            {"rule": {"type": "image", "texture": "textures/ui/npcstudio/panel/rule", "size": ["100%", 1],
                      "offset": [0, 20], "anchor_from": "top_left", "anchor_to": "top_left", "layer": 3}},
            {"scroll@server_form.npcs_scroll": {}}
        ]
    }
    tabs = [{f"tab{i}@server_form.npcs_tab": {"collection_index": TAB0 + i}} for i in range(TABS)]
    d["npcs_hide_btn"] = {
        "type": "panel", "size": [14, 14],
        "bindings": [coll(BTN), view(shown())],
        "controls": [
            {"button@common.button": dict(btn("small", size=(14, 14)), anchor_from="center", anchor_to="center")},
            {"icon": icon([8, 8], [0, 0], "center")}
        ]
    }
    d["npcs_tabs"] = {"type": "stack_panel", "orientation": "horizontal", "size": ["100% - 40px", 18],
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
            {"body": {"type": "label", "size": ["100% - 12px", "default"], "offset": [6, 0], "text": "#form_text", "color": SUB,
                      "shadow": False, "font_scale_factor": 0.85, "layer": 4}},
            {"pad": {"type": "panel", "size": ["100%", 4]}}
        ] + rows + [{"pad_end": {"type": "panel", "size": ["100%", 8]}}]
    }
    d.update(row_templates())

    # ---------- right rail: NPC heads (scrolls; Spawn is the first slot so it never moves) ----------
    slots = [{f"h{i}@server_form.npcs_head": {"collection_index": RAIL0 + i}} for i in range(RAILN)]
    d["npcs_rail"] = {
        "type": "image", "texture": "textures/ui/npcstudio/panel/panel_bg",
        "size": [RAIL_W, f"100% - {BAR_H}px"], "anchor_from": "top_right", "anchor_to": "top_right", "layer": 2,
        "bindings": [{"binding_name": BODY}, view(NOT_MINI)],
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
        "bindings": [{"binding_name": BODY}, view(NOT_MINI)],
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
    # the one see-through button of each row: lights up a little on hover, cyan on press
    nine("hit", (0, 0, 0, 0), None)
    nine("hit_hover", (255, 255, 255, 14), None)
    nine("hit_pressed", (39, 211, 245, 48), None)
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
    # thirds grid: thin light lines at 1/3 and 2/3, stretched over the free space
    W, H = 960, 540
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(img)
    for x in (W // 3, 2 * W // 3):
        g.rectangle([x - 1, 0, x, H - 1], fill=(255, 255, 255, 110))
    for y in (H // 3, 2 * H // 3):
        g.rectangle([0, y - 1, W - 1, y], fill=(255, 255, 255, 110))
    img.save(os.path.join(TEX, "grid_thirds.png"))
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


def validate(d):
    """Catch wrong value types before they reach the game: Bedrock crashes on some of them
    (V3.2: a label colour that was a text tag closed the game when the panel opened)."""
    errors = []

    def is_num(v):
        return isinstance(v, (int, float)) and not isinstance(v, bool)

    def walk(o, path):
        if isinstance(o, dict):
            for k, v in o.items():
                p = f"{path}/{k}"
                if k == "color" and not (isinstance(v, list) and len(v) in (3, 4) and all(is_num(x) and 0 <= x <= 1 for x in v)):
                    errors.append(f"{p}: colour must be [r, g, b] numbers 0-1, got {v!r}")
                if k in ("size", "offset", "max_size", "min_size") and not (isinstance(v, list) and len(v) == 2
                                                                            and all(is_num(x) or isinstance(x, str) for x in v)):
                    errors.append(f"{p}: must be a pair, got {v!r}")
                if k in ("size", "offset") and isinstance(v, list):
                    for x in v:
                        if isinstance(x, str) and "§" in x:
                            errors.append(f"{p}: text tag inside a size/offset: {v!r}")
                if k in ("layer", "font_scale_factor", "collection_index") and not is_num(v):
                    errors.append(f"{p}: must be a number, got {v!r}")
                if k == "texture" and not (isinstance(v, str) and not v.startswith("§")):
                    errors.append(f"{p}: texture must be a path, got {v!r}")
                if k in ("shadow", "modal", "render_game_behind") and not isinstance(v, bool):
                    errors.append(f"{p}: must be true/false, got {v!r}")
                walk(v, p)
        elif isinstance(o, list):
            for i, v in enumerate(o):
                walk(v, f"{path}[{i}]")
    walk(d, "")
    # exactly ONE button per form entry (three stacked buttons on one entry crashed the game)
    def count_buttons(o):
        n = 0
        if isinstance(o, dict):
            for k, v in o.items():
                n += k.endswith("@common.button")
                n += count_buttons(v)
        elif isinstance(o, list):
            for v in o:
                n += count_buttons(v)
        return n
    for name in ("npcs_aux_a", "npcs_aux_b", "npcs_aux_c", "npcs_tab", "npcs_head", "npcs_tool",
                 "npcs_hide_btn", "npcs_mini_handle"):
        if name in d and count_buttons(d[name]) != 1:
            errors.append(f"{name} has {count_buttons(d[name])} buttons (must be exactly 1 per form entry)")
    # the row: 2 buttons, shown by opposite checks (never both); same as the V3.1 rows that worked
    if "npcs_main" in d and count_buttons(d["npcs_main"]) != 2:
        errors.append(f"npcs_main has {count_buttons(d['npcs_main'])} buttons (must be 2: full / label column)")
    # expressions: the layout that works in game nests at most 6 brackets; 17 crashed the game
    import re as _re
    def exprs(o):
        if isinstance(o, dict):
            if "source_property_name" in o:
                yield o["source_property_name"]
            for v in o.values():
                yield from exprs(v)
        elif isinstance(o, list):
            for v in o:
                yield from exprs(v)
    for e in set(exprs(d)):
        depth = cur = 0
        for ch in e:
            cur += ch == "("
            cur -= ch == ")"
            depth = max(depth, cur)
        if depth > 6:
            errors.append(f"expression nests {depth} brackets (max 6): {e[:120]}")
    # every textures/ui/npcstudio path must exist
    import re
    for t in set(re.findall(r'textures/ui/npcstudio/[a-z0-9_/]+', json.dumps(d))):
        if not any(os.path.exists(os.path.join(ROOT, "RP", t + ext)) for ext in (".png", ".json")):
            errors.append(f"missing texture {t}")
    if errors:
        raise SystemExit("server_form.json check failed:\n  " + "\n  ".join(errors[:30]))


if __name__ == "__main__":
    textures()
    os.makedirs(UI, exist_ok=True)
    data = build()
    validate(data)
    with open(os.path.join(UI, "server_form.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
    print("server_form.json + panel textures written")
