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


# ---------- V3.1 editor layout (the website editor) ----------
# Every NPC Studio form has the same fixed button layout, so nothing depends on the title except
# "is this ours" (the §n§p tag, proven to work in game):
#   0-5     tabs                    (top of the left panel)
#   6-17    NPC heads               (right rail, empty label = hidden)
#   18-25   tools                   (bottom bar: 4 left, 4 right, empty label = hidden)
#   26-125  rows                    (left panel, scrolling; empty label = hidden)
# Row look comes from a tag at the start of the row's own label:
#   §h§r section header (open)   §i§r section header (folded)   §w§r switch row   (none) normal row
TAB0, RAIL0, RAILN, BAR0, BARN, ROW0, ROWN = 0, 6, 12, 18, 8, 26, 100
HDR_OPEN, HDR_SHUT, SW = "§h§r", "§i§r", "§w§r"
PANEL_W = "34%"
BAR_H = 24
RAIL_W = 28


def has(mark):
    return f"(not (({BTN} - '{mark}') = {BTN}))"


def lacks(mark):
    return f"(({BTN} - '{mark}') = {BTN})"


def shown():
    return f"(not ({BTN} = ''))"


def build():
    d = {"namespace": "server_form"}

    # instant menus: no slide/fade between screens, so folding a section or switching tabs is immediate
    d["third_party_server_screen"] = {
        "$screen_animations": ["@server_form.npcs_no_anim"],
        "$background_animations": ["@server_form.npcs_no_anim"],
        "render_game_behind": True
    }
    d["npcs_no_anim"] = {"anim_type": "offset", "easing": "linear", "duration": 0, "from": [0, 0], "to": [0, 0],
                         "play_event": "screen.exit_pop", "end_event": "screen.exit_end"}
    d["main_screen_content"] = {
        "type": "panel", "size": ["100%", "100%"],
        "controls": [{"server_form_factory": {"type": "factory", "control_ids": {
            "long_form": "@server_form.npcs_router", "custom_form": "@server_form.custom_form"}}}]
    }
    d["npcs_router"] = {"type": "panel", "size": ["100%", "100%"], "controls": [
        {"vanilla@server_form.npcs_vanilla_wrap": {}},
        {"studio@server_form.npcs_editor": {}}
    ]}
    d["npcs_vanilla_wrap"] = {"type": "panel", "size": ["100%", "100%"],
                              "bindings": [global_title(), view(NO_PANEL)],
                              "controls": [{"long_form@server_form.long_form": {}}]}

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
            {"label": label_from_button(["100%", 10], [0, 0], "center", "center", 0.85, strip_tab=True)},
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
    rows = [{f"r{i}@server_form.npcs_row": {"collection_index": ROW0 + i}} for i in range(ROWN)]
    d["npcs_rows"] = {
        "type": "stack_panel", "orientation": "vertical", "size": ["100%", "100%c"],
        "anchor_from": "top_left", "anchor_to": "top_left", "collection_name": "form_buttons",
        "controls": [
            {"body": {"type": "label", "size": ["100% - 12px", "default"], "offset": [6, 0], "text": "#form_text", "color": SUB,
                      "shadow": False, "font_scale_factor": 0.85, "layer": 4}},
            {"pad": {"type": "panel", "size": ["100%", 3]}}
        ] + rows + [{"pad_end": {"type": "panel", "size": ["100%", 6]}}]
    }
    clean = f"((({BTN} - '{HDR_OPEN}') - '{HDR_SHUT}') - '{SW}')"
    d["npcs_row"] = {
        "type": "panel", "size": ["100%", 20],
        "bindings": [coll(BTN), view(shown())],
        "controls": [
            # normal rows and switch rows: a raised button; headers: flat with a hairline
            {"btn_row@common.button": dict(btn("row", size=("100% - 6px", 18)), anchor_from="center", anchor_to="center",
                                          bindings=[{"binding_type": "collection_details", "binding_collection_name": "form_buttons"}, coll(BTN), view(f"({lacks(HDR_OPEN)} and {lacks(HDR_SHUT)})")])},
            {"btn_hdr@common.button": dict(btn("hdr", size=("100% - 6px", 18)), anchor_from="center", anchor_to="center",
                                          bindings=[{"binding_type": "collection_details", "binding_collection_name": "form_buttons"}, coll(BTN), view(f"(not ({lacks(HDR_OPEN)} and {lacks(HDR_SHUT)}))")])},
            {"icon_l": dict(icon([14, 14], [7, 0], "left_middle"), bindings=[
                coll("#form_button_texture", "#texture"), coll("#form_button_texture_file_system", "#texture_file_system"),
                coll(BTN), view(f"((not ((#texture = '') or (#texture = 'loading'))) and {lacks(SW)})")])},
            {"icon_r": dict(icon([20, 12], [-6, 0], "right_middle"), bindings=[
                coll("#form_button_texture", "#texture"), coll("#form_button_texture_file_system", "#texture_file_system"),
                coll(BTN), view(f"((not ((#texture = '') or (#texture = 'loading'))) and {has(SW)})")])},
            {"chev_open": {"type": "image", "texture": "textures/ui/npcstudio/panel/chev_open", "size": [8, 8], "layer": 6,
                           "offset": [-8, 0], "anchor_from": "right_middle", "anchor_to": "right_middle",
                           "bindings": [coll(BTN), view(has(HDR_OPEN))]}},
            {"chev_shut": {"type": "image", "texture": "textures/ui/npcstudio/panel/chev_shut", "size": [8, 8], "layer": 6,
                           "offset": [-8, 0], "anchor_from": "right_middle", "anchor_to": "right_middle",
                           "bindings": [coll(BTN), view(has(HDR_SHUT))]}},
            {"label": {"type": "label", "layer": 6, "size": ["100% - 52px", 10], "offset": [26, 0],
                       "anchor_from": "left_middle", "anchor_to": "left_middle", "text": "#text", "text_alignment": "left",
                       "color": TXT, "shadow": False, "bindings": [coll(BTN), view(clean, "#text")]}}
        ]
    }

    # ---------- right rail: NPC heads ----------
    slots = [{f"h{i}@server_form.npcs_head": {"collection_index": RAIL0 + i}} for i in range(RAILN)]
    d["npcs_rail"] = {
        "type": "image", "texture": "textures/ui/npcstudio/panel/panel_bg",
        "size": [RAIL_W, f"100% - {BAR_H}px"], "anchor_from": "top_right", "anchor_to": "top_right", "layer": 2,
        "controls": [{"stack": {"type": "stack_panel", "orientation": "vertical", "size": [RAIL_W, "100%c"], "offset": [0, 3],
                                "anchor_from": "top_middle", "anchor_to": "top_middle",
                                "collection_name": "form_buttons", "controls": slots}}]
    }
    d["npcs_head"] = {
        "type": "panel", "size": [RAIL_W, RAIL_W - 4],
        "bindings": [coll(BTN), view(shown())],
        "controls": [
            {"button@common.button": dict(btn("tile", size=(RAIL_W - 6, RAIL_W - 6)), anchor_from="center", anchor_to="center")},
            {"icon": icon([RAIL_W - 12, RAIL_W - 12], [0, 0], "center")},
            {"sel": {"type": "image", "texture": "textures/ui/npcstudio/panel/sel_ring", "size": [RAIL_W - 6, RAIL_W - 6], "layer": 7,
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


if __name__ == "__main__":
    textures()
    os.makedirs(UI, exist_ok=True)
    with open(os.path.join(UI, "server_form.json"), "w", encoding="utf-8") as f:
        json.dump(build(), f, indent=1, ensure_ascii=False)
    print("server_form.json + panel textures written")
