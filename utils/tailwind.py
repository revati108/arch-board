import os
import re
from pathlib import Path
from pytailwind import Tailwind
from hashlib import md5
from requestez.helpers import debug
from xtracto import Builder

SOURCE_HASH_FILE = "source_state.hash"

OUTPUT_HTML_FILE = "full.html"

OUTPUT_HASH_FILE = "full.html.hash"


def get_file_content(file_paths):
    """Helper to read and combine multiple files into a single string."""
    content = ""
    for file_path in file_paths:
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                content += file.read() + "\n"
        except Exception as e:
            debug(f"Error reading {file_path}: {e}")

    content = re.sub(r'\{%.*?%\}', ' ', content, flags=re.DOTALL)
    content = re.sub(r'\{\{.*?\}\}', ' ', content, flags=re.DOTALL)
    return content


def check_and_update_hash(content, hash_file_path):
    """
    Returns True if content has changed compared to the stored hash file.
    Updates the hash file if changed.
    """
    if not content:
        return False

    new_hash = md5(content.encode("utf-8")).hexdigest()

    existing_hash = ""
    if os.path.exists(hash_file_path):
        with open(hash_file_path, "r", encoding="utf-8") as f:
            existing_hash = f.read().strip()

    if new_hash == existing_hash:
        return False

    try:
        with open(hash_file_path, "w", encoding="utf-8") as f:
            f.write(new_hash)
        return True
    except Exception as e:
        debug(f"Error writing hash file {hash_file_path}: {e}")
        return False


def process_build_system():
    """
    Step 1: check source files -> Build if needed.
    Step 2: check build artifacts -> Return content if Tailwind update needed.
    """

    source_files = list(Path("pages").rglob("*.pypx")) + \
                   list(Path("components").rglob("*.html")) + \
                   list(Path("scripts").rglob("*.js"))

    source_content = get_file_content(source_files)

    if check_and_update_hash(source_content, SOURCE_HASH_FILE):
        debug("Source files changed. Running Builder...")
        Builder().build()
    else:
        debug("Source files unchanged. Skipping Builder.")

    build_files = list(Path("build").rglob("*.html")) + list(Path("scripts").rglob("*.js"))
    build_content = get_file_content(build_files)

    if not build_content:
        debug("No build artifacts found.")
        return None

    if check_and_update_hash(build_content, OUTPUT_HASH_FILE):
        debug("Build artifacts updated. Updating full.html for Tailwind...")

        with open(OUTPUT_HTML_FILE, "w", encoding="utf-8") as f:
            f.write(build_content)

        return build_content
    else:
        debug("Build artifacts unchanged (CSS is up to date).")
        return None


def generate_tailwind_css(official=True):
    """
    Generates Tailwind CSS only if the final build artifacts have changed.
    """

    combined_content = process_build_system()

    if combined_content is None:
        return True

    if official:
        debug("Generating official Tailwind CSS classes...")
        return generate_official_css()

    try:
        tailwind = Tailwind()
        tailwind_css = tailwind.generate(combined_content)
        output_path = Path("assets/css/tailwind.css")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as output_file:
            output_file.write(tailwind_css)
        debug("Tailwind CSS classes generated using pytailwind.")
        return True
    except Exception as e:
        debug(f"PyTailwind generation failed: {e}")
        return False


def generate_official_css():
    input_cmd = ""
    if os.path.exists("assets/css/input.css"):
        input_cmd = "-i assets/css/input.css"
    elif os.path.exists("global.css"):
        input_cmd = "-i global.css"

    command = f"tailwindcss {input_cmd} -o assets/css/official.css --content {OUTPUT_HTML_FILE} --minify"

    debug(f"Running command: {command}")
    result = os.system(command)

    if result == 0:
        debug("Official Tailwind CSS classes generated successfully.")
        return True
    else:
        debug("Tailwind CLI failed.")
        return False


if __name__ == "__main__":
    generate_tailwind_css(official=True)
