import os
from uuid import uuid4
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from pydantic import BaseModel, Field, field_validator
from app.menu_images import generate_menu_image, IMAGE_DIR
from app.image_uploads import MAX_IMAGE_UPLOAD_BYTES, image_extension
from app.routes.owner_meal_routes import require_owner

router = APIRouter(prefix="/owner/menu-images", tags=["menu photos"])


class ImageRequest(BaseModel):
    menu_description: str = Field(min_length=3, max_length=500)

    @field_validator("menu_description")
    @classmethod
    def clean_menu(cls, value):
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Describe the menu using at least three characters")
        return value


@router.get("/status")
def status(owner=Depends(require_owner)):
    return {"configured": bool(os.getenv("CLOUDFLARE_API_TOKEN", "").strip() and os.getenv("CLOUDFLARE_ACCOUNT_ID", "").strip())}


@router.post("")
async def generate(req: ImageRequest, owner=Depends(require_owner)):
    url = await generate_menu_image(req.menu_description, owner.id)
    return {"image_url": url, "menu_description": req.menu_description}


@router.post("/upload")
async def upload(file: UploadFile = File(...), owner=Depends(require_owner)):
    try:
        content = await file.read(MAX_IMAGE_UPLOAD_BYTES + 1)
    finally:
        await file.close()
    if len(content) > MAX_IMAGE_UPLOAD_BYTES:
        raise HTTPException(413, "Choose an image smaller than 5 MB")
    extension = image_extension(content, strict_png=True, strict_jpeg=True)
    if extension is None:
        raise HTTPException(422, "Upload a PNG or JPEG photo")
    name = f"upload-{owner.id}-{uuid4().hex}{extension}"
    (IMAGE_DIR / name).write_bytes(content)
    return {"image_url": f"/menu-images/{name}"}
