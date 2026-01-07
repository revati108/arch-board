from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Optional
import os
import json
import shutil
import uuid
from pathlib import Path

# Router Definition
images_router = APIRouter(prefix="/images", tags=["images"])

# Constants
IMAGES_DIR = os.path.expanduser("~/.archboard/images")
MAPPING_FILE = os.path.join(IMAGES_DIR, "mapping.json")

# Helpers
class ImageManager:
    def __init__(self):
        self.ensure_dirs()
        self.mapping = self.load_mapping()

    def ensure_dirs(self):
        os.makedirs(IMAGES_DIR, exist_ok=True)
        os.makedirs(os.path.join(IMAGES_DIR, "folders"), exist_ok=True)
        if not os.path.exists(MAPPING_FILE):
             self.save_mapping({"images": {}, "folders": {}})

    def load_mapping(self) -> Dict:
        try:
            with open(MAPPING_FILE, "r") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {"images": {}, "folders": {}}

    def save_mapping(self, data: Dict):
        with open(MAPPING_FILE, "w") as f:
            json.dump(data, f, indent=2)
        self.mapping = data

    def add_image(self, file: UploadFile) -> str:
        gen_id = str(uuid.uuid4())
        ext = os.path.splitext(file.filename)[1]
        if not ext:
            ext = ".png" # Default fallback
            
        filename = f"{gen_id}{ext}"
        path = os.path.join(IMAGES_DIR, filename)
        
        with open(path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        self.mapping["images"][gen_id] = {
            "name": file.filename,
            "path": path,
            "id": gen_id
        }
        self.save_mapping(self.mapping)
        return gen_id

    def add_folder_image(self, folder_id: str, file: UploadFile, relative_path: str):
        folder_path = os.path.join(IMAGES_DIR, "folders", folder_id)
        os.makedirs(folder_path, exist_ok=True)
        
        safe_path = os.path.normpath(os.path.join(folder_path, relative_path))
        if not safe_path.startswith(folder_path):
            return
            
        os.makedirs(os.path.dirname(safe_path), exist_ok=True)
        
        with open(safe_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

    def register_folder(self, folder_name: str, files: List[UploadFile], relative_paths: List[str]):
        folder_id = str(uuid.uuid4())
        folder_info = {
            "id": folder_id,
            "name": folder_name,
            "path": os.path.join(IMAGES_DIR, "folders", folder_id)
        }
        
        # Process files
        for i, file in enumerate(files):
            rel_path = relative_paths[i] if i < len(relative_paths) else file.filename
            self.add_folder_image(folder_id, file, rel_path)
            
        self.mapping["folders"][folder_id] = folder_info
        self.save_mapping(self.mapping)
        return folder_info

manager = ImageManager()

# Models
class ImageItem(BaseModel):
    id: str
    name: str
    path: str

class FolderItem(BaseModel):
    id: str
    name: str
    path: str

class LibraryResponse(BaseModel):
    images: List[ImageItem]
    folders: List[FolderItem]

# Endpoints
@images_router.get("/list", response_model=LibraryResponse)
async def list_library():
    mapping = manager.load_mapping()
    images = [ImageItem(**v) for v in mapping.get("images", {}).values()]
    folders = [FolderItem(**v) for v in mapping.get("folders", {}).values()]
    return LibraryResponse(images=images, folders=folders)

@images_router.post("/upload")
async def upload_images(files: List[UploadFile] = File(...)):
    results = []
    for file in files:
        img_id = manager.add_image(file)
        results.append(manager.mapping["images"][img_id])
    return results

@images_router.post("/upload_folder")
async def upload_folder(
    folder_name: str = Form(...), 
    files: List[UploadFile] = File(...), 
    paths: List[str] = Form(...) 
):
    rel_paths = paths if len(paths) == len(files) else [f.filename for f in files]
    folder = manager.register_folder(folder_name, files, rel_paths)
    return folder

from fastapi.responses import FileResponse

@images_router.get("/raw/{image_id}")
async def get_raw_image(image_id: str):
    mapping = manager.load_mapping()
    
    if image_id in mapping.get("images", {}):
        img_data = mapping["images"][image_id]
        if os.path.exists(img_data["path"]):
            return FileResponse(img_data["path"])
            
    ids = list(mapping.get("images", {}).keys())
    for fid in ids:
        if fid.startswith(image_id): 
            img_data = mapping["images"][fid]
            if os.path.exists(img_data["path"]):
                return FileResponse(img_data["path"])
    
    raise HTTPException(status_code=404, detail="Image not found")

