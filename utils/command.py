import subprocess

def run_command(cmd: str, shell: bool = True) -> tuple[str, int]:
    """Run a shell command and return output and return code."""
    try:
        print("executing :", cmd)
        result = subprocess.run(cmd, shell=shell, capture_output=True, text=True, timeout=10)
        return result.stdout.strip(), result.returncode
    except subprocess.TimeoutExpired:
        return "Command timed out", 1
    except Exception as e:
        return str(e), 1

