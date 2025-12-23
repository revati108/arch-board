import psutil

def get_cpu_count():
    return psutil.cpu_count()

def get_cpu_usage():
    return psutil.cpu_percent(interval=1, percpu=True)

def get_memory_usage():
    return psutil.virtual_memory().percent

def get_disk_usage():
    usage = psutil.disk_usage("/")
    return {
        "total": usage.total,
        "used": usage.used,
        "free": usage.free,
        "percent": usage.percent
    }

def get_uptime():
    return psutil.boot_time()

def get_system_info():
    return {
        "cpu_count": get_cpu_count(),
        "memory_usage": get_memory_usage(),
        "disk_usage": get_disk_usage(),
        "uptime": get_uptime(),
        "cpu_usage": get_cpu_usage(),
        "overall_cpu_usage": psutil.cpu_percent(interval=1)
    }
