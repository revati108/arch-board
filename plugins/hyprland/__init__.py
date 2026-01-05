"""
Hyprland configuration API routes.
Provides endpoints for reading and writing Hyprland config.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional
import os

from plugins.hyprland.helpers.hyprlang import HyprLang
from plugins.hyprland.helpers.hyprland_schema import get_schema
from utils.config import get_context
from utils.plugins_frontend import register_navigation, NavItem, NavGroup, register_search, SearchItem
from xtracto import Parser

hyprland_router = APIRouter(prefix="/hyprland", tags=["hyprland"])

# Register navigation
register_navigation(
    items=[NavItem(id="hyprland", title="Hyprland", url="/hyprland", icon="hyprland", group="config", order=10)],
    groups=[NavGroup(id="config", title="Config", icon="config", order=10)]
)

from plugins.hyprland.helpers.hyprland_schema import HYPRLAND_SCHEMA

# Generate search items from schema
search_items = []

# 1. Schema Items (Granular options)
for tab in HYPRLAND_SCHEMA:
    # Add the tab itself
    search_items.append(SearchItem(
        id=f"hyprland-tab-{tab.id}",
        title=f"{tab.title} Settings",
        url=f"/hyprland?tab={tab.id}",
        category=f"Hyprland: {tab.title}",
        description=f"Configure {tab.title.lower()} settings",
        keywords=[tab.title.lower(), "settings", "config"]
    ))

    # Add options
    for section in tab.sections:
        for option in section.options:
            # Format title: "general:border_size" -> "Border Size"
            base_title = option.name.replace("_", " ").title()

            # Use section title for context to avoid duplicates (e.g., "Natural Scroll" in Mouse vs Touchpad)
            # If section name is like "input:touchpad", title is "Touchpad"
            # If section name is just "general", title is "General Settings" -> maybe redundant if we just say "Border Size"?
            # A good heuristic: if the section title is specific (not "General Settings"), prepend it.

            start_context = ""
            if section.title and "General" not in section.title and "Miscellaneous" not in section.title:
                start_context = f"{section.title}: "

            formatted_title = f"{start_context}{base_title}"

            search_items.append(SearchItem(
                id=f"hyprland-opt-{section.name}-{option.name}",
                title=formatted_title,
                url=f"/hyprland?tab={tab.id}",  # Highlight param added via wrapper or selector
                category=f"Hyprland: {tab.title}",  # Explicit namespace
                description=option.description,  # Use schema description!
                keywords=option.name.split("_") + [tab.title.lower(), section.title.lower()],
                selector=f'[data-path="{section.name}:{option.name}"]'  # Deep link selector
            ))

# 2. Special Tabs (Manual)
special_tabs = [
    ("monitors", "Monitors", "Configure displays, resolution, positioning"),
    ("binds", "Keybinds", "Manage keyboard shortcuts and hotkeys"),
    ("gestures", "Gestures", "Touchpad and touchscreen gestures"),
    ("windowrules", "Window Rules", "Window placement and opacity rules"),
    ("exec", "Startup Commands", "Autostart applications and scripts"),
    ("env", "Environment Variables", "Session environment variables (QT, GTK, etc)")
]

for tab_id, title, desc in special_tabs:
    search_items.append(SearchItem(
        id=f"hyprland-special-{tab_id}",
        title=title,
        url=f"/hyprland?tab={tab_id}",
        category=f"Hyprland: {title}",
        description=desc,
        keywords=[title.lower(), "settings", "config"]
    ))

# Register all items
register_search(search_items)

# Default config path
CONFIG_PATH = os.path.expanduser("~/.config/hypr/hyprland.conf")


# Page route
@hyprland_router.get("", response_class=HTMLResponse)
async def hyprland_page():
    parser = Parser(path="hyprland.pypx")
    parser.render(context=get_context({
        "current_page": "hyprland",
        "page_title": "ArchBoard - Hyprland Config",
        "page_header": "Hyprland Configuration",
        "page_description": "Configure your Hyprland window manager",
    }))
    return HTMLResponse(parser.html_content)


def to_hypr_value(value: Any) -> str:
    """Convert Python value to hyprland config format."""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


class ConfigUpdate(BaseModel):
    """Request model for config updates."""
    path: str  # e.g., "general:gaps_in" or "decoration:blur:enabled"
    value: Any


class BulkConfigUpdate(BaseModel):
    """Request model for bulk config updates."""
    updates: Dict[str, Any]  # path -> value


@hyprland_router.get("/schema")
async def get_config_schema():
    """Return the config schema for UI generation."""
    return {"schema": get_schema()}


@hyprland_router.get("/config")
async def get_config():
    """Load and return the current config."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        # Build flat config dict from parsed config
        config_values = {}

        # Get all values using the schema paths
        schema = get_schema()
        for tab in schema:
            for section in tab["sections"]:
                section_name = section["name"]
                for option in section["options"]:
                    option_name = option["name"]

                    # Try to get value from config
                    full_path = f"{section_name}:{option_name}"
                    value = conf.get(full_path)

                    if value is not None:
                        config_values[full_path] = value
                    else:
                        # Use default
                        config_values[full_path] = option["default"]

        return {
            "config": config_values,
            "path": CONFIG_PATH
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.post("/config")
async def update_config(update: ConfigUpdate):
    """Update a single config value."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        # Set the value
        success = conf.set(update.path, to_hypr_value(update.value))

        if not success:
            raise HTTPException(status_code=400, detail=f"Failed to set {update.path}")

        # Save back to file
        hl.save()

        return {"success": True, "path": update.path, "value": update.value}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.post("/config/bulk")
async def bulk_update_config(update: BulkConfigUpdate):
    """Update multiple config values at once."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        results = {}
        for path, value in update.updates.items():
            success = conf.set(path, to_hypr_value(value))
            results[path] = {"success": success, "value": value}

        # Save back to file
        hl.save()

        return {"success": True, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.post("/reload")
async def reload_hyprland():
    """Trigger hyprctl reload."""
    try:
        import subprocess
        result = subprocess.run(["hyprctl", "reload"], capture_output=True, text=True)
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# MONITORS
# =============================================================================

@hyprland_router.get("/monitors")
async def get_monitors():
    """Get all monitor configurations."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        monitors = []
        for line in conf.lines:
            if line.key == "monitor":
                # Parse: name, resolution, position, scale, [extras...]
                parts = [p.strip() for p in line.value.raw.split(",")]
                if len(parts) >= 4:
                    monitors.append({
                        "raw": line.value.raw,
                        "name": parts[0],
                        "resolution": parts[1],
                        "position": parts[2],
                        "scale": parts[3],
                        "extras": parts[4:] if len(parts) > 4 else []
                    })
                elif len(parts) == 1 and parts[0] == "disable":
                    monitors.append({
                        "raw": line.value.raw,
                        "name": parts[0],
                        "disabled": True
                    })

        return {"monitors": monitors}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class MonitorUpdate(BaseModel):
    """Monitor update model."""
    name: str
    resolution: str
    position: str
    scale: str
    extras: list = []


@hyprland_router.post("/monitors")
async def update_monitor(monitor: MonitorUpdate):
    """Add or update a monitor configuration."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        # Build the monitor line value
        value = f"{monitor.name}, {monitor.resolution}, {monitor.position}, {monitor.scale}"
        if monitor.extras:
            value += ", " + ", ".join(monitor.extras)

        # Find existing monitor line with same name and update, or add new
        found = False
        for line in conf.lines:
            if line.key == "monitor" and line.value.raw.startswith(monitor.name + ","):
                line.value.raw = value
                found = True
                break

        if not found:
            from plugins.hyprland.helpers.hyprlang import HyprLine, HyprValue
            conf.lines.append(HyprLine(key="monitor", value=HyprValue(raw=value)))

        hl.save()
        return {"success": True, "monitor": monitor.model_dump()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# KEYBINDS
# =============================================================================

@hyprland_router.get("/binds")
async def get_binds():
    """Get all keybind configurations."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        binds = []
        bind_types = ["bind", "binde", "bindl", "bindr", "bindm", "bindc", "bindg", "bindd", "bindt", "binds", "bindo",
                      "bindu"]

        for line in conf.lines:
            if line.key in bind_types or line.key.startswith("bind"):
                # Parse: MODS, key, dispatcher, params
                parts = [p.strip() for p in line.value.raw.split(",", 3)]
                bind_info = {
                    "type": line.key,
                    "raw": line.value.raw,
                    "mods": parts[0] if len(parts) > 0 else "",
                    "key": parts[1] if len(parts) > 1 else "",
                    "dispatcher": parts[2] if len(parts) > 2 else "",
                    "params": parts[3] if len(parts) > 3 else ""
                }
                binds.append(bind_info)

        return {"binds": binds}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class BindUpdate(BaseModel):
    """Keybind update model."""
    action: str = "add"  # "add", "update", "delete"
    type: str = "bind"
    mods: str
    key: str
    dispatcher: str
    params: str = ""
    old_raw: Optional[str] = None


# POST endpoint moved to consolidated CRUD section below
# =============================================================================
# WINDOW RULES
# =============================================================================

@hyprland_router.get("/windowrules")
async def get_windowrules():
    """Get all window rule configurations."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        rules = []
        for line in conf.lines:
            if line.key == "windowrule" or line.key == "windowrulev2":
                # Parse: effect, match
                parts = [p.strip() for p in line.value.raw.split(",", 1)]
                rules.append({
                    "type": line.key,
                    "raw": line.value.raw,
                    "effect": parts[0] if len(parts) > 0 else "",
                    "match": parts[1] if len(parts) > 1 else ""
                })

        return {"windowrules": rules}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# LAYER RULES
# =============================================================================

@hyprland_router.get("/layerrules")
async def get_layerrules():
    """Get all layer rule configurations."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        rules = []
        for line in conf.lines:
            if line.key == "layerrule":
                # Parse: effect, namespace (legacy) or effect on, match:namespace ns (new)
                raw = line.value.raw
                parts = [p.strip() for p in raw.split(",", 1)]
                
                effect = parts[0] if len(parts) > 0 else ""
                namespace = ""
                
                if len(parts) > 1:
                    match_part = parts[1]
                    if "match:namespace" in match_part.lower():
                        # New syntax: extract namespace from match:namespace value
                        idx = match_part.lower().find("match:namespace")
                        rest = match_part[idx + 15:].strip()
                        namespace = rest.split(",")[0].strip()
                    else:
                        # Legacy syntax
                        namespace = match_part.strip()
                
                rules.append({
                    "raw": raw,
                    "effect": effect,
                    "namespace": namespace
                })

        return {"layerrules": rules}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class LayerRuleUpdate(BaseModel):
    """Request model for layer rule updates."""
    action: str  # "add", "update", "delete"
    effect: str
    namespace: str
    old_raw: Optional[str] = None


@hyprland_router.post("/layerrules")
async def update_layer_rule(update: LayerRuleUpdate):
    """Add, update, or delete a layer rule."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        with open(CONFIG_PATH, 'r') as f:
            lines = f.readlines()

        # Check if we should use new syntax (check migration status)
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()
        
        # Detect syntax style from existing rules
        use_new_syntax = False
        for line in conf.lines:
            if line.key == "layerrule" and "match:" in line.value.raw:
                use_new_syntax = True
                break
        
        # Build the new line based on syntax
        if use_new_syntax:
            # New syntax: effect on, match:namespace namespace
            effect_part = update.effect
            if " " not in effect_part:
                effect_part = f"{effect_part} on"
            new_line = f"layerrule = {effect_part}, match:namespace {update.namespace}\n"
        else:
            # Legacy syntax: effect, namespace
            new_line = f"layerrule = {update.effect}, {update.namespace}\n"

        if update.action == "add":
            # Find where to insert (after other layerrule lines or at appropriate spot)
            insert_idx = len(lines)
            for i, line in enumerate(lines):
                if line.strip().startswith("layerrule"):
                    insert_idx = i + 1
            lines.insert(insert_idx, new_line)

        elif update.action == "update":
            if update.old_raw:
                for i, line in enumerate(lines):
                    if update.old_raw in line:
                        lines[i] = new_line
                        break

        elif update.action == "delete":
            if update.old_raw:
                lines = [l for l in lines if update.old_raw not in l]

        with open(CONFIG_PATH, 'w') as f:
            f.writelines(lines)

        return {"success": True, "action": update.action}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# EXEC COMMANDS
# =============================================================================

@hyprland_router.get("/exec")
async def get_exec_commands():
    """Get all exec and exec-once commands."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        commands = []
        for line in conf.lines:
            if line.key in ["exec", "exec-once"]:
                commands.append({
                    "type": line.key,
                    "command": line.value.raw
                })

        return {"exec": commands}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# ENVIRONMENT VARIABLES
# =============================================================================

class EnvUpdate(BaseModel):
    """Request model for env var updates."""
    action: str  # "add", "update", "delete"
    name: str
    value: Optional[str] = ""
    old_name: Optional[str] = None  # For updates


class ExecUpdate(BaseModel):
    """Request model for exec command updates."""
    action: str  # "add", "update", "delete"
    type: str  # "exec" or "exec-once"
    command: str
    old_command: Optional[str] = None  # For updates


class WindowRuleUpdate(BaseModel):
    """Request model for window rule updates."""
    action: str  # "add", "update", "delete"
    type: str  # "windowrule" or "windowrulev2"
    effect: str
    match: str
    old_raw: Optional[str] = None  # For updates/deletes


class BindUpdate(BaseModel):
    """Request model for keybind updates."""
    action: str  # "add", "update", "delete"
    type: str  # "bind", "binde", etc.
    mods: str
    key: str
    dispatcher: str
    params: Optional[str] = ""
    old_raw: Optional[str] = None  # For updates/deletes


@hyprland_router.get("/env")
async def get_env_vars():
    """Get all environment variable configurations."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        env_vars = []
        for i, line in enumerate(conf.lines):
            if line.key == "env":
                # Parse: NAME,VALUE
                parts = line.value.raw.split(",", 1)
                if len(parts) >= 2:
                    env_vars.append({
                        "index": i,
                        "name": parts[0].strip(),
                        "value": parts[1].strip(),
                        "raw": line.value.raw
                    })
                elif len(parts) == 1:
                    env_vars.append({
                        "index": i,
                        "name": parts[0].strip(),
                        "value": "",
                        "raw": line.value.raw
                    })

        return {"env": env_vars}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.post("/env")
async def update_env_var(update: EnvUpdate):
    """Add, update, or delete an environment variable."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        with open(CONFIG_PATH, 'r') as f:
            lines = f.readlines()

        new_line = f"env = {update.name},{update.value}\n"

        if update.action == "add":
            # Find where to insert (after other env lines or at top)
            insert_idx = 0
            for i, line in enumerate(lines):
                if line.strip().startswith("env ="):
                    insert_idx = i + 1
            lines.insert(insert_idx, new_line)

        elif update.action == "update":
            old_pattern = f"env = {update.old_name}," if update.old_name else None
            for i, line in enumerate(lines):
                if old_pattern and line.strip().startswith(old_pattern):
                    lines[i] = new_line
                    break

        elif update.action == "delete":
            pattern = f"env = {update.name},"
            lines = [l for l in lines if not l.strip().startswith(pattern)]

        with open(CONFIG_PATH, 'w') as f:
            f.writelines(lines)

        return {"success": True, "action": update.action}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.post("/exec")
async def update_exec_command(update: ExecUpdate):
    """Add, update, or delete an exec command."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        with open(CONFIG_PATH, 'r') as f:
            lines = f.readlines()

        new_line = f"{update.type} = {update.command}\n"

        if update.action == "add":
            # Find where to insert
            insert_idx = len(lines)
            for i, line in enumerate(lines):
                if line.strip().startswith("exec"):
                    insert_idx = i + 1
            lines.insert(insert_idx, new_line)

        elif update.action == "update":
            old_line = f"{update.type} = {update.old_command}"
            for i, line in enumerate(lines):
                if line.strip() == old_line.strip():
                    lines[i] = new_line
                    break

        elif update.action == "delete":
            target = f"{update.type} = {update.command}"
            lines = [l for l in lines if l.strip() != target.strip()]

        with open(CONFIG_PATH, 'w') as f:
            f.writelines(lines)

        return {"success": True, "action": update.action}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.post("/windowrules")
async def update_window_rule(update: WindowRuleUpdate):
    """Add, update, or delete a window rule."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        with open(CONFIG_PATH, 'r') as f:
            lines = f.readlines()

        new_line = f"{update.type} = {update.effect},{update.match}\n"

        if update.action == "add":
            # Find where to insert
            insert_idx = len(lines)
            for i, line in enumerate(lines):
                if line.strip().startswith("windowrule"):
                    insert_idx = i + 1
            lines.insert(insert_idx, new_line)

        elif update.action == "update":
            if update.old_raw:
                for i, line in enumerate(lines):
                    if update.old_raw in line:
                        lines[i] = new_line
                        break

        elif update.action == "delete":
            if update.old_raw:
                lines = [l for l in lines if update.old_raw not in l]

        with open(CONFIG_PATH, 'w') as f:
            f.writelines(lines)

        return {"success": True, "action": update.action}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.post("/binds")
async def update_bind(update: BindUpdate):
    """Add, update, or delete a keybind."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        with open(CONFIG_PATH, 'r') as f:
            lines = f.readlines()

        if update.action == "add":
            params = f",{update.params}" if update.params else ""
            new_line = f"{update.type} = {update.mods},{update.key},{update.dispatcher}{params}\n"
            # Find where to insert
            insert_idx = len(lines)
            for i, line in enumerate(lines):
                if line.strip().startswith("bind"):
                    insert_idx = i + 1
            lines.insert(insert_idx, new_line)

        elif update.action == "update":
            if update.old_raw:
                params = f",{update.params}" if update.params else ""
                new_line = f"{update.type} = {update.mods},{update.key},{update.dispatcher}{params}\n"
                for i, line in enumerate(lines):
                    if update.old_raw in line:
                        lines[i] = new_line
                        break

        elif update.action == "delete":
            if update.old_raw:
                lines = [l for l in lines if update.old_raw not in l]

        with open(CONFIG_PATH, 'w') as f:
            f.writelines(lines)

        return {"success": True, "action": update.action}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.get("/windows")
async def get_open_windows():
    """Get list of open windows via hyprctl."""
    import subprocess
    import json

    try:
        result = subprocess.run(
            ["hyprctl", "clients", "-j"],
            capture_output=True,
            text=True,
            timeout=5
        )

        if result.returncode != 0:
            return {"windows": []}

        clients = json.loads(result.stdout)
        windows = []
        for client in clients:
            windows.append({
                "title": client.get("title", ""),
                "class": client.get("class", ""),
                "initialClass": client.get("initialClass", ""),
                "initialTitle": client.get("initialTitle", ""),
                "address": client.get("address", ""),
                "workspace": client.get("workspace", {}).get("name", "")
            })

        return {"windows": windows}
    except Exception as e:
        return {"windows": [], "error": str(e)}


# =============================================================================
# GESTURES
# =============================================================================

class GestureUpdate(BaseModel):
    """Request model for gesture updates."""
    action: str  # "add", "update", "delete"
    fingers: int
    direction: str  # "horizontal", "vertical", etc.
    gesture_action: str  # "workspace", "move", "resize", "special", "close", "fullscreen", "float", "dispatcher", "unset"
    dispatcher: Optional[str] = ""  # Dispatcher name when gesture_action is "dispatcher"
    params: Optional[str] = ""
    mod: Optional[str] = ""  # Modifier key (e.g., "SUPER", "ALT")
    scale: Optional[str] = ""  # Animation speed scale (e.g., "1.5")
    old_raw: Optional[str] = None


@hyprland_router.get("/gestures")
async def get_gestures():
    """Get all gesture configurations."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        gestures = []
        for line in conf.lines:
            if line.key == "gesture":
                # Parse: fingers, direction, [mod: X,] [scale: X,] action, [params]
                raw = line.value.raw
                parts = [p.strip() for p in raw.split(",")]

                if len(parts) >= 3:
                    fingers = parts[0]
                    direction = parts[1]

                    # Parse optional mod: and scale: options
                    mod = ""
                    scale = ""
                    idx = 2

                    while idx < len(parts):
                        part = parts[idx]
                        if part.startswith("mod:"):
                            mod = part.replace("mod:", "").strip()
                            idx += 1
                        elif part.startswith("scale:"):
                            scale = part.replace("scale:", "").strip()
                            idx += 1
                        else:
                            break

                    if idx < len(parts):
                        action = parts[idx]
                        dispatcher = ""
                        params = ""

                        # Check if action is "dispatcher"
                        if action.lower() == "dispatcher" and idx + 1 < len(parts):
                            dispatcher = parts[idx + 1]
                            params = ",".join(parts[idx + 2:]) if idx + 2 < len(parts) else ""
                            action = "dispatcher"
                        else:
                            params = ",".join(parts[idx + 1:]) if idx + 1 < len(parts) else ""

                        gestures.append({
                            "fingers": fingers,
                            "direction": direction,
                            "action": action,
                            "dispatcher": dispatcher,
                            "params": params,
                            "mod": mod,
                            "scale": scale,
                            "raw": raw
                        })

        return {"gestures": gestures}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.post("/gestures")
async def update_gesture(update: GestureUpdate):
    """Add, update, or delete a gesture."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        with open(CONFIG_PATH, 'r') as f:
            lines = f.readlines()

        # Build the gesture line based on Hyprland format:
        # gesture = fingers, direction, [mod: X,] [scale: X,] action[, args]
        parts = [str(update.fingers), update.direction]

        # Add optional mod
        if update.mod:
            parts.append(f"mod: {update.mod}")

        # Add optional scale
        if update.scale:
            parts.append(f"scale: {update.scale}")

        # Add action
        if update.gesture_action == "dispatcher":
            # Format: dispatcher, dispatcher_name, params
            parts.append("dispatcher")
            parts.append(update.dispatcher)
            if update.params:
                parts.append(update.params)
        else:
            parts.append(update.gesture_action)
            if update.params:
                parts.append(update.params)

        new_line = f"gesture = {', '.join(parts)}\n"

        if update.action == "add":
            # Find where to insert
            insert_idx = len(lines)
            for i, line in enumerate(lines):
                if line.strip().startswith("gesture"):
                    insert_idx = i + 1
            lines.insert(insert_idx, new_line)

        elif update.action == "update":
            if update.old_raw:
                for i, line in enumerate(lines):
                    if update.old_raw in line:
                        lines[i] = new_line
                        break

        elif update.action == "delete":
            if update.old_raw:
                lines = [l for l in lines if update.old_raw not in l]

        with open(CONFIG_PATH, 'w') as f:
            f.writelines(lines)

        return {"success": True, "action": update.action}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# CONFIG MIGRATION (v0.53+ new window rule syntax)
# =============================================================================

from plugins.hyprland.helpers.migration import HyprlandVersion, ConfigMigrator, MigrationResult
from pathlib import Path


@hyprland_router.get("/migration/version")
async def get_hyprland_version():
    """Get the detected Hyprland version."""
    version = HyprlandVersion.detect()
    if version:
        return {
            "version": str(version),
            "major": version.major,
            "minor": version.minor,
            "patch": version.patch,
            "supports_new_window_rules": version.supports_new_window_rules()
        }
    return {"version": None, "error": "Could not detect Hyprland version"}


@hyprland_router.get("/migration/status")
async def get_migration_status():
    """Check if config needs migration and return summary."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        needs_migration = ConfigMigrator.needs_migration(conf)
        summary = ConfigMigrator.get_migration_summary(conf) if needs_migration else ""

        # Get version info
        version = HyprlandVersion.detect()
        version_info = None
        if version:
            version_info = {
                "version": str(version),
                "supports_new_window_rules": version.supports_new_window_rules()
            }

        return {
            "needs_migration": needs_migration,
            "summary": summary,
            "version": version_info,
            "config_path": CONFIG_PATH
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@hyprland_router.post("/migration/migrate")
async def migrate_config():
    """Perform migration with automatic backup."""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Hyprland config not found")

    try:
        hl = HyprLang(CONFIG_PATH)
        conf = hl.load()

        if not ConfigMigrator.needs_migration(conf):
            return {
                "success": True,
                "migrated": False,
                "message": "Config is already using new syntax"
            }

        # Create backup
        config_path = Path(CONFIG_PATH)
        backup_path = ConfigMigrator.backup_config(config_path)

        # Perform migration
        result = ConfigMigrator.migrate(conf)

        # Save migrated config
        hl.save()

        return {
            "success": True,
            "migrated": True,
            "migrated_rules": result.migrated_rules,
            "renamed_options": result.renamed_options,
            "backup_path": str(backup_path),
            "message": f"Migrated {result.migrated_rules} rules, renamed {result.renamed_options} options. Backup saved to {backup_path.name}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
