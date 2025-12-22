from xtracto import Config
import dotenv
import os
import time
from version_info import VERSION
import pwd


def get_linux_username():
    """
    Retrieves the actual login name of the current process owner on Linux.
    """
    # os.getuid() gets the User ID (UID) of the current process
    uid = os.getuid()
    # pwd.getpwuid() gets a password database entry (struct_passwd object) for that UID
    user_info = pwd.getpwuid(uid)
    # The username is stored in the pw_name attribute (or index 0)
    return user_info.pw_name



dotenv.load_dotenv()
config = Config()
def get_context(overrides: dict = None):
    context = {
        "current_page": "home",
        "page_title": "Welcome to Arch Board",
        "page_description": "Arch Board, simplest way to control your system.",
        "page_header": "Dashboard",
        "production": str(config.production).lower(),
        "username": os.environ.get("USER", get_linux_username()),
        "cache_key": VERSION if config.production else str(time.time()),
    }
    if overrides:
        context.update(overrides)
    return context

RELOAD_SERVER = True if not config.production else False
