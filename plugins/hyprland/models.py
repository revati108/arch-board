from pydantic import BaseModel
from typing import Optional

class LayerRuleUpdate(BaseModel):
    """Request model for layer rule updates."""
    action: str
    effect: str
    namespace: str
    old_raw: Optional[str] = None

class EnvUpdate(BaseModel):
    """Request model for env var updates."""
    action: str
    name: str
    value: Optional[str] = ""
    old_name: Optional[str] = None

class ExecUpdate(BaseModel):
    """Request model for exec command updates."""
    action: str
    type: str
    command: str
    old_command: Optional[str] = None

class WindowRuleUpdate(BaseModel):
    """Request model for window rule updates."""
    action: str
    type: str
    effect: str
    match: str
    old_raw: Optional[str] = None

class BindUpdate(BaseModel):
    """Request model for keybind updates."""
    action: str
    type: str
    mods: str
    key: str
    dispatcher: str
    params: Optional[str] = ""
    old_raw: Optional[str] = None
