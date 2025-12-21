from xtracto import Config
import dotenv
import os
import time

dotenv.load_dotenv()
config = Config()
def get_context(overrides: dict = None):
    context = {
        "current_page": "home",
        "page_title": "Welcome to Arch Board",
        "page_description": "Arch Board, simplest way to control your system.",
        "page_header": "Dashboard",
        "production": str(config.production).lower(),
        "username": os.environ.get("USER", "user"),
        "cache_key": os.environ.get("VERSION", "0.0.0") if config.production else str(time.time()),
    }
    if overrides:
        context.update(overrides)
    return context

RELOAD_SERVER = True if not config.production else False
