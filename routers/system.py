from fastapi import APIRouter

from utils.lib.background import bg_service

system_router = APIRouter()

@system_router.get("/system/info")
async def system_info():
    return bg_service.get("system_info", {})
