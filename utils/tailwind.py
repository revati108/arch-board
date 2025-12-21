from pathlib import Path
from pytailwind import Tailwind

def generate_tailwind_css():
    """
    Generates Tailwind CSS classes based on the provided configuration.
    """
    tailwind = Tailwind()

    html_files = list(Path("pages").rglob("*.pypx")) + list(Path("components").rglob("*.html")) + list(Path("scripts").rglob("*.js"))
    combined_content = ""
    for html_file in html_files:
        with open(html_file, 'r', encoding='utf-8') as file:
            combined_content += file.read() + "\n"

    # Strip Jinja2 tags to help detection
    import re
    combined_content = re.sub(r'\{%.*?%\}', ' ', combined_content, flags=re.DOTALL)
    combined_content = re.sub(r'\{\{.*?\}\}', ' ', combined_content, flags=re.DOTALL)

    tailwind_css = tailwind.generate(combined_content)
    output_path = Path("assets/css/tailwind.css")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as output_file:
        output_file.write(tailwind_css)
