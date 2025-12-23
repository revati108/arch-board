"""
Waybar configuration router.
"""
from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from xtracto import Parser
from utils.config import get_context
from utils.plugins_frontend import register_navigation, NavItem, NavGroup, register_search, SearchItem
import os
import json
import re
from utils.jsonc_parser import parse, to_string, set_value, DictNode, ListNode

# constants
WAYBAR_CONFIG_DIR = os.path.expanduser("~/.config/waybar")
CONFIG_FILE = os.path.join(WAYBAR_CONFIG_DIR, "config")
STYLE_FILE = os.path.join(WAYBAR_CONFIG_DIR, "style.css")

# Fallback if config is named config.jsonc
if not os.path.exists(CONFIG_FILE) and os.path.exists(CONFIG_FILE + ".jsonc"):
    CONFIG_FILE = CONFIG_FILE + ".jsonc"

waybar_router = APIRouter(prefix="/waybar", tags=["waybar"])

# Register navigation
register_navigation(
    items=[NavItem(id="waybar", title="Waybar", url="/waybar", icon="waybar", group="config", order=31)],
    groups=[NavGroup(id="config", title="Config", icon="config", order=10)]
)

# Register search
register_search([
    SearchItem(id="waybar_config", title="Waybar Settings", url="/waybar", category="Configuration", description="Configure Waybar modules and style")
])

def strip_comments(text):
    """
    Strips C-style comments (// and /* ... */) from text.
    Strictly for the 'View JSON' or parsing for the FE if we want to send clean JSON.
    But actually, standard json.loads will fail on comments, so we do need this
    if we want to send 'clean' json to the frontend for the editor.
    However, our frontend expects to edit specific modules. 
    
    If we send the whole file as JSON, the frontend loses comments.
    
    Strategy:
    1. GET /config: Returns the parsed CLEAN JSON (so frontend can easily render/edit).
    2. POST /config: Receives { "module_name": { ...new_config... } }. 
       We parse the file with JSONCParser, find the key, update it, and write back.
    """
    pattern = r'//.*?$|/\*.*?\*/'
    return re.sub(pattern, '', text, flags=re.MULTILINE|re.DOTALL)

@waybar_router.get("", response_class=HTMLResponse)
async def waybar_page():
    parser = Parser(path="waybar.pypx")
    parser.render(context=get_context({
        "current_page": "waybar",
        "page_title": "ArchBoard - Waybar Settings",
        "page_header": "Waybar Settings",
        "page_description": "Configure Waybar modules and appearance",
    }))
    return HTMLResponse(parser.html_content)

@waybar_router.get("/config")
async def get_config():
    """Reads and parses the Waybar configuration file."""
    if not os.path.exists(CONFIG_FILE):
        return JSONResponse({"error": "Config file not found"}, status_code=404)
    
    try:
        with open(CONFIG_FILE, "r") as f:
            content = f.read()
        
        # We send clean JSON to frontend for easier consumption
        json_content = strip_comments(content)
        config_data = json.loads(json_content)
        return config_data
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@waybar_router.post("/config")
async def save_config(payload: list | dict = Body(...)):
    """
    Saves the Waybar configuration.
    
    The payload can be:
    1. A full config object (or array) -> We might overwrite everything (Risk losing comments if we didn't track them)
    2. A partial update?
    
    Actually, my frontend sends the FULL config right now in `saveModule`.
    Wait, `saveModule` in frontend fetches full config, updates one key, and sends full config back.
    
    If frontend sends full config back as JSON, we LOST the comments from the parts we didn't touch?
    YES. Because `fetch('/waybar/config')` returned clean JSON.
    
    We need to change the API Protocol.
    Frontend should send: { "key": "clock", "value": {...new_settings...}, "path": [...] }
    
    Let's handle this by checking if payload has metadata or is raw config.
    But to support the requirement "Search integration in ui checks for input etc", 
    we really only edit one module at a time in the UI I built.
    
    Let's modify the frontend to send:
    POST /waybar/module_update
    {
        "path": ["clock"] or ["modules-right", 0],
        "value": { ... }
    }
    
    However, I don't want to rewrite the frontend entirely yet. 
    The existing frontend sends the WHOLE config array/dict.
    
    If I want to preserve comments, I MUST NOT accept the whole clean JSON back.
    
    Let's update the Frontend to send only the changed module.
    
    Revised Logic:
    1. Frontend: `saveModule` sends: { "module": "name", "config": {...} } (Object)
    2. Backend: 
       - Reads file -> AST
       - Finds "module" in AST (this is tricky if it's an array config)
       - Updates it
       - Writes file
    
    But what if the user edits the layout ("modules-left")?
    
    Simplified approach for now:
    Assume config is a single Object (common). 
    If Array, we search all objects.
    
    Let's change endpoint to `POST /config/update`.
    """
    pass # Replaced by specific implementation below

@waybar_router.post("/config/update")
async def update_module_config(data: dict = Body(...)):
    """
    Update a specific module's config.
    Expected payload: { "path": ["module_name"], "value": {...} }
    OR
    { "path": [0, "module_name"], "value": {...} } for array configs?
    
    Let's simpler:
    { "module": "clock", "value": {...} }
    I will search for 'clock' key in the root object (or objects in array) and update it.
    """
    module_name = data.get("module")
    new_value = data.get("value")
    
    if not module_name or new_value is None:
         return JSONResponse({"error": "Missing module or value"}, status_code=400)
    
    if not os.path.exists(CONFIG_FILE):
        return JSONResponse({"error": "Config file not found"}, status_code=404)

    try:
        with open(CONFIG_FILE, "r") as f:
            content = f.read()
            
        root = parse(content)
        
        # Strategy: Find path then set_value
        target_path = None
        
        if isinstance(root, DictNode):
             # Single bar config
             target_path = [module_name]
             
        elif isinstance(root, ListNode):
             # Multi-bar config: Find first bar containing this module
             for i, (child, _) in enumerate(root.children):
                  if isinstance(child, DictNode):
                       for k_node, _, _ in child.children:
                            if k_node.value == module_name:
                                 target_path = [i, module_name]
                                 break
                  if target_path: break
             
             # If not found, default to first bar
             if not target_path:
                  target_path = [0, module_name]
        
        if target_path:
            set_value(root, target_path, new_value)
            
            # Write back
            new_content = to_string(root)
            with open(CONFIG_FILE, "w") as f:
                f.write(new_content)
                
            return {"status": "success", "message": f"Module {module_name} updated"}
        else:
            return JSONResponse({"error": "Could not determine update path"}, status_code=500)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


@waybar_router.get("/style")
async def get_style():
    """Reads the Waybar style.css file."""
    if not os.path.exists(STYLE_FILE):
        return JSONResponse({"error": "Style file not found"}, status_code=404)
    
    try:
        with open(STYLE_FILE, "r") as f:
            content = f.read()
        return {"content": content}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@waybar_router.post("/style")
async def save_style(style: dict = Body(...)):
    """Saves the Waybar style.css file."""
    content = style.get("content")
    if content is None:
        return JSONResponse({"error": "Content required"}, status_code=400)
        
    try:
        with open(STYLE_FILE, "w") as f:
            f.write(content)
        return {"status": "success", "message": "Style saved"}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
