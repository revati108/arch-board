from pydantic import BaseModel, Field, validator
from typing import List, Optional, Union, Dict, Any

# --- Fundamental Types ---
# Hyprlock uses "vec2" (e.g., "10, 20" or "10%, 20%")
class Vec2(BaseModel):
    x: Union[int, float, str]
    y: Union[int, float, str]

    def to_string(self):
        return f"{self.x}, {self.y}"

# Colors can be hex, rgba, or gradients
class Color(BaseModel):
    value: str # Store the raw string for now (rgba(0,0,0,1) or legacy hex)

# --- Configuration Sections ---

class GeneralConfig(BaseModel):
    hide_cursor: bool = False
    ignore_empty_input: bool = False
    immediate_render: bool = False
    text_trim: bool = True
    fractional_scaling: int = 2
    screencopy_mode: int = 0
    fail_timeout: int = 2000
    no_fade_in: bool = False
    no_fade_out: bool = False
    grace: int = 0
    disable_loading_bar: bool = False

class AnimationsConfig(BaseModel):
    enabled: bool = True

class AuthConfig(BaseModel):
    pam_enabled: bool = Field(True, alias="pam:enabled")
    pam_module: str = Field("hyprlock", alias="pam:module")
    fingerprint_enabled: bool = Field(False, alias="fingerprint:enabled")
    # Fingerprint messages omitted for brevity, can add later

class BackgroundWidget(BaseModel):
    monitor: str = ""
    path: str = "" # empty for color, screenshot for screenshot
    color: str = "rgba(17, 17, 17, 1.0)"
    blur_passes: int = 0
    blur_size: int = 7
    noise: float = 0.0117
    contrast: float = 0.8916
    brightness: float = 0.8172
    vibrancy: float = 0.1696
    vibrancy_darkness: float = 0.05
    reload_time: int = -1
    reload_cmd: str = ""
    crossfade_time: float = -1.0
    zindex: int = -1

class ImageWidget(BaseModel):
    monitor: str = ""
    path: str = ""
    size: int = 150
    rounding: int = -1
    border_size: int = 4
    border_color: str = "rgba(221, 221, 221, 1.0)"
    rotate: int = 0
    reload_time: int = -1
    reload_cmd: str = ""
    position: str = "0, 0" # Using string for simpler serialization to Hyprlang
    halign: str = "center"
    valign: str = "center"
    zindex: int = 0

class ShapeWidget(BaseModel):
    monitor: str = ""
    size: str = "100, 100"
    color: str = "rgba(17, 17, 17, 1.0)"
    rounding: int = -1
    rotate: int = 0
    border_size: int = 0
    border_color: str = "rgba(0, 207, 230, 1.0)"
    xray: bool = False
    position: str = "0, 0"
    halign: str = "center"
    valign: str = "center"
    zindex: int = 0

class InputFieldWidget(BaseModel):
    monitor: str = ""
    size: str = "400, 90"
    outline_thickness: int = 4
    dots_size: float = 0.25
    dots_spacing: float = 0.15
    dots_center: bool = True
    dots_rounding: int = -1
    dots_text_format: str = ""
    outer_color: str = "rgba(17, 17, 17, 1.0)"
    inner_color: str = "rgba(200, 200, 200, 1.0)"
    font_color: str = "rgba(10, 10, 10, 1.0)"
    font_family: str = "Noto Sans"
    fade_on_empty: bool = True
    fade_timeout: int = 2000
    placeholder_text: str = "<i>Input Password...</i>"
    hide_input: bool = False
    hide_input_base_color: str = "rgba(153, 170, 187)"
    rounding: int = -1
    check_color: str = "rgba(204, 136, 34, 1.0)"
    fail_color: str = "rgba(204, 34, 34, 1.0)"
    fail_text: str = "<i>$FAIL <b>($ATTEMPTS)</b></i>"
    capslock_color: str = ""
    numlock_color: str = ""
    bothlock_color: str = ""
    invert_numlock: bool = False
    swap_font_color: bool = False
    position: str = "0, 0"
    halign: str = "center"
    valign: str = "center"
    zindex: int = 0

class LabelWidget(BaseModel):
    monitor: str = ""
    text: str = "Sample Text"
    text_align: str = "center"
    color: str = "rgba(254, 254, 254, 1.0)"
    font_size: int = 16
    font_family: str = "Sans"
    rotate: int = 0
    position: str = "0, 0"
    halign: str = "center"
    valign: str = "center"
    zindex: int = 0
    shadow_passes: int = 0
    shadow_size: int = 3
    shadow_color: str = "rgb(0,0,0)"
    shadow_boost: float = 1.2

class HyprlockConfig(BaseModel):
    general: GeneralConfig = GeneralConfig()
    auth: AuthConfig = AuthConfig()
    animations: AnimationsConfig = AnimationsConfig()
    backgrounds: List[BackgroundWidget] = []
    input_fields: List[InputFieldWidget] = []
    labels: List[LabelWidget] = []
    images: List[ImageWidget] = []
    shapes: List[ShapeWidget] = []

    class Config:
        populate_by_name = True
