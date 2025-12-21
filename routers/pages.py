from fastapi import APIRouter
from fastapi.responses import HTMLResponse
from xtracto import Parser
from utils.config import get_context

pages_router = APIRouter()


@pages_router.get("/", response_class=HTMLResponse)
async def read_root():
    parser = Parser(path="index.pypx")
    parser.render(context=get_context({
        "current_page": "home",
        "page_title": "ArchBoard - Dashboard",
        "page_header": "Dashboard",
        "page_description": "System overview and quick actions",
    }))
    return HTMLResponse(parser.html_content)


@pages_router.get("/hyprland", response_class=HTMLResponse)
async def hyprland_page():
    parser = Parser(path="hyprland.pypx")
    parser.render(context=get_context({
        "current_page": "hyprland",
        "page_title": "ArchBoard - Hyprland Config",
        "page_header": "Hyprland Configuration",
        "page_description": "Configure your Hyprland window manager",
    }))
    return HTMLResponse(parser.html_content)


@pages_router.get("/system", response_class=HTMLResponse)
async def system_page():
    parser = Parser(path="system.pypx")
    parser.render(context=get_context({
        "current_page": "system",
        "page_title": "ArchBoard - System Settings",
        "page_header": "System Settings",
        "page_description": "Configure system settings",
    }))
    return HTMLResponse(parser.html_content)


@pages_router.get("/waybar", response_class=HTMLResponse)
async def waybar_page():
    parser = Parser(path="waybar.pypx")
    parser.render(context=get_context({
        "current_page": "waybar",
        "page_title": "ArchBoard - Waybar Settings",
        "page_header": "Waybar Settings",
        "page_description": "Configure Waybar settings",
    }))
    return HTMLResponse(parser.html_content)


@pages_router.get("/hyprlock", response_class=HTMLResponse)
async def hyprlock_page():
    parser = Parser(path="hyprlock.pypx")
    parser.render(context=get_context({
        "current_page": "hyprlock",
        "page_title": "ArchBoard - Hyprlock Settings",
        "page_header": "Hyprlock Settings",
        "page_description": "Configure Hyprlock settings",
    }))
    return HTMLResponse(parser.html_content)


@pages_router.get("/hypridle", response_class=HTMLResponse)
async def hypridle_page():
    parser = Parser(path="hypridle.pypx")
    parser.render(context=get_context({
        "current_page": "hypridle",
        "page_title": "ArchBoard - Hypridle Settings",
        "page_header": "Hypridle Settings",
        "page_description": "Configure Hypridle settings",
    }))
    return HTMLResponse(parser.html_content)


@pages_router.get("/wpaperd", response_class=HTMLResponse)
async def wpaperd_page():
    parser = Parser(path="wpaperd.pypx")
    parser.render(context=get_context({
        "current_page": "wpaperd",
        "page_title": "ArchBoard - Wpaperd Settings",
        "page_header": "Wpaperd Settings",
        "page_description": "Configure Wpaperd settings",
    }))
    return HTMLResponse(parser.html_content)
