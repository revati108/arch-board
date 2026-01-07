from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from xtracto import Parser
from utils.config import get_context
from utils.plugins_frontend import register_navigation, NavItem, NavGroup
from plugins.hyprland.helpers.hyprlang import HyprLang
from .models import (
    HyprlockConfig, GeneralConfig, AuthConfig, BackgroundWidget, 
    ImageWidget, ShapeWidget, InputFieldWidget, LabelWidget, AnimationsConfig
)
import os


hyprlock_router = APIRouter(prefix="/hyprlock", tags=["hyprlock"])

register_navigation(
    items=[NavItem(id="hyprlock", title="Hyprlock", url="/hyprlock", icon="hyprlock", group="config", order=30)],
    groups=[NavGroup(id="config", title="Config", icon="config", order=10)]
)

@hyprlock_router.get("", response_class=HTMLResponse)
async def hyprlock_page():
    parser = Parser(path="hyprlock.pypx")
    context = get_context({
        "current_page": "hyprlock",
        "page_title": "ArchBoard - Hyprlock Settings",
        "page_header": "Hyprlock Settings",
        "page_description": "Configure Hyprlock settings",
    })
    parser.render(context)
    return HTMLResponse(parser.html_content)

@hyprlock_router.get("/images/preview")
def preview_image(path: str):
    """Serve a local image file for preview."""
    import mimetypes
    from fastapi.responses import FileResponse
    
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Basic security check? For local tool, we trust the user.
    # But maybe restrict to common image extensions?
    mime, _ = mimetypes.guess_type(path)
    if not mime or not mime.startswith("image/"):
        # Allow serving specifically requested files even if mime guess fails?
        # Just warn.
        pass
        
    return FileResponse(path)

def parse_category_to_model(category, model_class):
    data = {}
    for line in category.lines:
        key = line.key.replace(":", "_")
        value = line.value.raw
        if value.lower() == "true":
            value = True
        elif value.lower() == "false":
            value = False
        elif value.lstrip("-").replace(".", "", 1).isdigit():
            if "." in value:
                value = float(value)
            else:
                value = int(value)
        data[key] = value
    return model_class(**data)

@hyprlock_router.get("/config", response_model=HyprlockConfig)
def get_config():
    path = os.path.expanduser("~/.config/hypr/hyprlock.conf")
    if not os.path.exists(path):
        return HyprlockConfig()
    
    try:
        hl = HyprLang(path)
        conf = hl.load()
        
        config = HyprlockConfig()
        
        for cat in conf.categories:
            if cat.name == "general":
                config.general = parse_category_to_model(cat, GeneralConfig)
            elif cat.name == "auth":
                config.auth = parse_category_to_model(cat, AuthConfig)
            elif cat.name == "animations":
                config.animations = parse_category_to_model(cat, AnimationsConfig)
            elif cat.name == "background":
                config.backgrounds.append(parse_category_to_model(cat, BackgroundWidget))
            elif cat.name == "input-field":
                config.input_fields.append(parse_category_to_model(cat, InputFieldWidget))
            elif cat.name == "label":
                config.labels.append(parse_category_to_model(cat, LabelWidget))
            elif cat.name == "image":
                config.images.append(parse_category_to_model(cat, ImageWidget))
            elif cat.name == "shape":
                config.shapes.append(parse_category_to_model(cat, ShapeWidget))
                
        return config
    except Exception as e:
        print(f"Error parsing hyprlock config: {e}")
        return HyprlockConfig()

def model_to_hyprlang_string(model, indent=0):
    lines = []
    prefix = "    " * indent
    for field_name, value in model.dict(by_alias=True).items():
        if field_name == "zindex" and value == 0: continue 
        
        hypr_key = field_name.replace("_", ":") if ":" in field_name else field_name
        
        if isinstance(value, bool):
            val_str = "true" if value else "false"
        else:
            val_str = str(value)
            
        lines.append(f"{prefix}{hypr_key} = {val_str}")
    return "\n".join(lines)

@hyprlock_router.post("/config")
def save_config(config: HyprlockConfig):
    lines = []
    
    lines.append("general {")
    lines.append(model_to_hyprlang_string(config.general, 1))
    lines.append("}")
    lines.append("")
    
    lines.append("auth {")
    lines.append(model_to_hyprlang_string(config.auth, 1))
    lines.append("}")
    lines.append("")
    
    lines.append("animations {")
    lines.append(model_to_hyprlang_string(config.animations, 1))
    lines.append("}")
    lines.append("")
    
    for bg in config.backgrounds:
        lines.append("background {")
        lines.append(model_to_hyprlang_string(bg, 1))
        lines.append("}")
        lines.append("")
    # ... rest of the function
        
    for inp in config.input_fields:
        lines.append("input-field {")
        lines.append(model_to_hyprlang_string(inp, 1))
        lines.append("}")
        lines.append("")
        
    for label in config.labels:
        lines.append("label {")
        lines.append(model_to_hyprlang_string(label, 1))
        lines.append("}")
        lines.append("")
        
    for img in config.images:
        lines.append("image {")
        lines.append(model_to_hyprlang_string(img, 1))
        lines.append("}")
        lines.append("")

    for shape in config.shapes:
        lines.append("shape {")
        lines.append(model_to_hyprlang_string(shape, 1))
        lines.append("}")
        lines.append("")
        
    path = os.path.expanduser("~/.config/hypr/hyprlock.conf")
    try:
        with open(path, "w") as f:
            f.write("\n".join(lines))
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
