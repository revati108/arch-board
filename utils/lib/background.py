"""
Generic background task service for caching data.
Supports multiple registered tasks that run at different intervals.
"""
import threading
import time
from typing import Dict, Any, Callable, Optional
from dataclasses import dataclass
from collections import defaultdict


@dataclass
class BackgroundTask:
    """Configuration for a background task."""
    name: str
    callback: Callable[[], Any]
    interval: float  # seconds
    

class BackgroundService:
    """
    Generic background service that runs multiple tasks at different intervals.
    
    Usage:
        from utils.lib.background import bg_service
        
        # Register a task
        bg_service.register("my_task", my_function, interval=10)
        
        # Get cached result
        data = bg_service.get("my_task")
    """
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._tasks: Dict[str, BackgroundTask] = {}
        self._cache: Dict[str, Any] = {}
        self._last_run: Dict[str, float] = defaultdict(float)
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._min_sleep = 0.5  # seconds
        
    def register(self, name: str, callback: Callable[[], Any], interval: float = 5.0) -> None:
        """
        Register a background task.
        
        Args:
            name: Unique identifier for the task
            callback: Function to call (should return data to cache)
            interval: How often to refresh (in seconds)
        """
        self._tasks[name] = BackgroundTask(name=name, callback=callback, interval=interval)
        # Run immediately to get initial data
        try:
            self._cache[name] = callback()
            self._last_run[name] = time.time()
        except Exception as e:
            print(f"Error initializing task '{name}': {e}")
            self._cache[name] = None
    
    def unregister(self, name: str) -> None:
        """Remove a registered task."""
        self._tasks.pop(name, None)
        self._cache.pop(name, None)
        self._last_run.pop(name, None)
    
    def _refresh_loop(self):
        """Background thread loop that runs all tasks."""
        while self._running:
            now = time.time()
            for name, task in list(self._tasks.items()):
                # Check if it's time to run this task
                if now - self._last_run[name] >= task.interval:
                    try:
                        self._cache[name] = task.callback()
                        self._last_run[name] = now
                    except Exception as e:
                        print(f"Error in background task '{name}': {e}")
            time.sleep(self._min_sleep)
    
    def start(self) -> None:
        """Start the background service."""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._refresh_loop, daemon=True)
        self._thread.start()
        print(f"BackgroundService started with {len(self._tasks)} tasks")
    
    def stop(self) -> None:
        """Stop the background service."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=2)
    
    def get(self, name: str, default: Any = None) -> Any:
        """Get cached result (instant return)."""
        return self._cache.get(name, default)
    
    def get_all(self) -> Dict[str, Any]:
        """Get all cached results."""
        return self._cache.copy()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get service statistics."""
        return {
            "running": self._running,
            "task_count": len(self._tasks),
            "tasks": {
                name: {
                    "interval": task.interval,
                    "last_run": self._last_run.get(name, 0),
                    "has_data": name in self._cache
                }
                for name, task in self._tasks.items()
            }
        }


# Global singleton instance
bg_service = BackgroundService()


# ============================================================
# Pre-registered default tasks
# ============================================================

def _collect_system_info() -> Dict[str, Any]:
    """Collect system info for the dashboard."""
    import psutil
    disk = psutil.disk_usage("/")
    return {
        "cpu_count": psutil.cpu_count(),
        "memory_usage": psutil.virtual_memory().percent,
        "disk_usage": {
            "total": disk.total,
            "used": disk.used,
            "free": disk.free,
            "percent": disk.percent
        },
        "uptime": psutil.boot_time(),
        "cpu_usage": psutil.cpu_percent(interval=0.1, percpu=True),
        "overall_cpu_usage": psutil.cpu_percent(interval=0.1),
        "last_updated": time.time()
    }


def register_default_tasks():
    """Register default background tasks."""
    bg_service.register("system_info", _collect_system_info, interval=5.0)
