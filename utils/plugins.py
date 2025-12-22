import os
from typing import Dict, List
from fastapi import APIRouter
from requestez.helpers import get_logger, error
from logging import Logger

get_logger().logger = Logger("arch_board")

def list_plugins() -> Dict[str, str]:
    final_plugins = {}
    plugins = []
    if os.path.exists("plugins.txt"):
        with open("plugins.txt") as f:
            plugins = f.read().splitlines()
            for line in plugins:
                line = line.strip().split("=", 1)
                if len(line) != 2: continue
                final_plugins["plugins."+line[0].strip()] = line[1].strip()  # plugin_name, router name
    default_routers = ["hyprland", "system", "presets", "pages", "static"]
    for router in default_routers:
        if "exclude:router:"+router in plugins:
            continue
        final_plugins["routers."+router] = router+"_router"
    return final_plugins

def get_routers() -> List[APIRouter]:
    """
    Load all the plugins in plugins.txt from the plugins directory
    :return:
    """
    plugins = list_plugins()
    routers = []
    for plugin_name, router_name in plugins.items():
        try:
            routers.append(getattr(__import__(f"{plugin_name}"), router_name))
        except Exception as e:
            error(f"Failed to load plugin {plugin_name}: {e}")
    return routers

