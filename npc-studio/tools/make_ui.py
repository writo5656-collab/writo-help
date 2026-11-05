"""
NPC Studio V3 — side panel UI (RP/ui/server_form.json + textures).

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

TXT = [0.88, 0.92, 0.97]
SUB = [0.55, 0.61, 0.70]
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


def build():
    d = {"namespace": "server_form"}

    # ---------- screen: no slide/fade between menus, so switching tabs is instant ----------
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
        {"studio@server_form.npcs_panel_root": {}}
    ]}
    d["npcs_vanilla_wrap"] = {"type": "panel", "size": ["100%", "100%"],
                              "bindings": [global_title(), view(NO_PANEL)],
                              "controls": [{"long_form@server_form.long_form": {}}]}

    # ---------- the docked panel ----------
    d["npcs_panel_root"] = {
        "type": "panel", "size": ["100%", "100%"], "layer": 2,
        "bindings": [global_title(), view(HAS_PANEL)],
        "controls": [{"frame": {
            "type": "image", "texture": "textures/ui/npcstudio/panel/panel_bg",
            "size": ["40% + 40px", "100%"], "max_size": [300, "100%"],
            "anchor_from": "left_middle", "anchor_to": "left_middle", "layer": 2,
            "controls": [{"inner": {
                "type": "stack_panel", "orientation": "vertical",
                "size": ["100% - 10px", "100% - 8px"], "offset": [0, 4],
                "anchor_from": "top_middle", "anchor_to": "top_middle",
                "controls": [
                    {"header@server_form.npcs_header": {}},
                    {"tabs@server_form.npcs_tabs": {}},
                    {"rule": {"type": "image", "texture": "textures/ui/npcstudio/panel/rule", "size": ["100%", 1], "layer": 3}},
                    {"gap": {"type": "panel", "size": ["100%", 3]}},
                    {"scroll@server_form.npcs_scroll": {}}
                ]
            }}]
        }}]
    }

    d["npcs_header"] = {
        "type": "stack_panel", "orientation": "horizontal", "size": ["100%", 20],
        "controls": [
            {"logo": {"type": "image", "texture": "textures/ui/npcstudio/logo", "size": [16, 16], "layer": 4}},
            {"pad": {"type": "panel", "size": [5, 16]}},
            {"title": {"type": "label", "size": ["fill", 10], "offset": [0, 4], "text": "#text", "color": TXT,
                       "shadow": False, "layer": 4, "bindings": [global_title(), view(CLEAN_TITLE, "#text")]}},
            {"close@common.button": btn("close", size=(16, 16), mapping="button.menu_exit", collection=False)}
        ]
    }

    # tab row: first 6 buttons, placed by collection_index
    tabs = []
    for i in range(TABS):
        tabs.append({f"tab{i}@server_form.npcs_tab": {"collection_index": i}})
    d["npcs_tabs"] = {"type": "stack_panel", "orientation": "horizontal", "size": ["100%", 18],
                      "collection_name": "form_buttons",
                      "bindings": [global_title(), view(HAS_TABS)], "controls": tabs}
    d["npcs_tab"] = {
        "type": "panel", "size": [f"{100 / TABS:.2f}%", "100%"],
        "bindings": [coll(BTN), view(f"(not (({BTN} - '{TAB_MARK}') = {BTN}))")],
        "controls": [
            {"button@common.button": btn("tab")},
            {"label": label_from_button(["100%", 10], [0, 1], "center", "center", 0.8, strip_tab=True)},
            {"bar": {"type": "image", "texture": "textures/ui/npcstudio/panel/tab_bar", "size": ["100% - 6px", 2], "layer": 6,
                     "anchor_from": "bottom_middle", "anchor_to": "bottom_middle",
                     "bindings": [coll(BTN), view(f"(not (({BTN} - '§b') = {BTN}))")]}}
        ]
    }

    # scrolling area: body text + list or grid
    d["npcs_scroll@common.scrolling_panel"] = {
        "anchor_to": "top_left", "anchor_from": "top_left",
        "$show_background": False, "size": ["100%", "fill"],
        "$scrolling_content": "server_form.npcs_content",
        "$scroll_size": [4, "100% - 4px"],
        "$scrolling_pane_size": ["100% - 6px", "100%"],
        "$scrolling_pane_offset": [0, 0],
        "$scroll_bar_right_padding_size": [0, 0]
    }
    d["npcs_content"] = {
        "type": "stack_panel", "orientation": "vertical", "size": ["100% - 6px", "100%c"],
        "anchor_from": "top_left", "anchor_to": "top_left",
        "controls": [
            {"body": {"type": "label", "size": ["100%", "default"], "text": "#form_text", "color": SUB, "shadow": False,
                      "font_scale_factor": 0.85, "layer": 4}},
            {"pad": {"type": "panel", "size": ["100%", 4]}},
            {"list@server_form.npcs_list": {}},
            {"grid_tabs@server_form.npcs_grid_tabs": {}},
            {"grid@server_form.npcs_grid": {}},
            {"pad2": {"type": "panel", "size": ["100%", 6]}}
        ]
    }

    # list: same factory as vanilla, our row design; tab buttons are hidden here
    d["npcs_list"] = {
        "type": "stack_panel", "orientation": "vertical", "size": ["100%", "100%c"],
        "anchor_from": "top_left", "anchor_to": "top_left",
        "factory": {"name": "buttons", "control_ids": {
            "button": "@server_form.npcs_row",
            "label": "@server_form.dynamic_label",
            "header": "@server_form.dynamic_header",
            "divider": "@settings_common.option_group_section_divider"}},
        "collection_name": "form_buttons",
        "bindings": [{"binding_name": "#form_button_contents", "binding_name_override": "#collection_length"},
                     global_title(), view(f"(not {IS_GRID})")]
    }
    d["npcs_row"] = {
        "type": "panel", "size": ["100%", 24],
        "bindings": [coll(BTN), view(f"(({BTN} - '{TAB_MARK}') = {BTN})")],
        "controls": [
            {"button@common.button": btn("row", size=("100%", 22))},
            {"icon": icon([18, 18], [4, -1], "left_middle")},
            {"label": label_from_button(["100% - 30px", 10], [27, -1], "left_middle", "left", 1.0)}
        ]
    }

    # grid: explicit tiles so tabs (indices 0-5) can be skipped
    def grid(name, start, cond):
        rows = []
        for r in range(GRID_ROWS):
            tiles = [{f"t{c}@server_form.npcs_tile": {"collection_index": start + r * GRID_COLS + c}} for c in range(GRID_COLS)]
            rows.append({f"row{r}": {"type": "stack_panel", "orientation": "horizontal", "size": ["100%", "100%c"],
                                     "collection_name": "form_buttons", "controls": tiles}})
        d[name] = {"type": "stack_panel", "orientation": "vertical", "size": ["100%", "100%c"],
                   "bindings": [global_title(), view(cond)], "controls": rows}
    grid("npcs_grid_tabs", TABS, f"({IS_GRID} and {HAS_TABS})")
    grid("npcs_grid", 0, f"({IS_GRID} and (not {HAS_TABS}))")
    d["npcs_tile"] = {
        "type": "panel", "size": [f"{100 / GRID_COLS:.2f}%", 46],
        "bindings": [coll(BTN), view(f"(not ({BTN} = ''))")],
        "controls": [
            {"button@common.button": btn("tile", size=("100% - 3px", 44))},
            {"icon": icon([26, 26], [0, 4], "top_middle")},
            {"label": label_from_button(["100% - 6px", 8], [0, -4], "bottom_middle", "center", 0.62)}
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
    nine("panel_bg", (16, 21, 30, 238), (0, 0, 0, 255))
    nine("row", (24, 32, 48, 255), (42, 52, 71, 255))
    nine("row_hover", (31, 44, 66, 255), (11, 111, 134, 255))
    nine("row_pressed", (11, 70, 90, 255), (39, 211, 245, 255))
    nine("tile", (24, 32, 48, 255), (42, 52, 71, 255))
    nine("tile_hover", (31, 44, 66, 255), (11, 111, 134, 255))
    nine("tile_pressed", (11, 70, 90, 255), (39, 211, 245, 255))
    nine("tab", (16, 21, 30, 0), None)
    nine("tab_hover", (31, 44, 66, 255), None)
    nine("tab_pressed", (11, 70, 90, 255), None)
    Image.new("RGBA", (2, 2), (39, 211, 245, 255)).save(os.path.join(TEX, "tab_bar.png"))
    Image.new("RGBA", (2, 2), (42, 52, 71, 255)).save(os.path.join(TEX, "rule.png"))
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
