from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.menu_images import IMAGE_DIR
from app.payment_uploads import PAYMENT_IMAGE_DIR
from contextlib import asynccontextmanager
from app.migrate import require_current_schema

from app.database import engine

from app.routes import (
    auth_routes,
    meal_routes,
    billing_routes,
    dashboard_routes,
    owner_meal_routes,
    plan_routes,
    image_routes,
    discovery_routes,
    delivery_routes,
    payment_routes,
    join_routes,
    profile_routes,
    catalog_routes,
    weekly_menu_routes,
)


# =========================================================
# DATABASE
# =========================================================

from app import tenancy  # Register request-local ORM isolation hooks.


@asynccontextmanager
async def lifespan(app):
    # Read-only verification; migrations are a separate deployment operation.
    require_current_schema(engine)
    yield


# =========================================================
# FASTAPI APP
# =========================================================

app = FastAPI(
    title="Smart Mess & Tiffin Manager API", lifespan=lifespan
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://mess-manager-tau.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# ROUTERS
# =========================================================

app.include_router(auth_routes.router)
app.include_router(meal_routes.router)
app.include_router(billing_routes.router)
app.include_router(dashboard_routes.router)
app.include_router(owner_meal_routes.router)
app.include_router(weekly_menu_routes.router)
app.include_router(plan_routes.router)
app.include_router(image_routes.router)
app.include_router(discovery_routes.router)
app.include_router(delivery_routes.router)
app.include_router(payment_routes.router)
app.mount("/menu-images", StaticFiles(directory=IMAGE_DIR), name="menu-images")
app.mount("/payment-images", StaticFiles(directory=PAYMENT_IMAGE_DIR), name="payment-images")


# =========================================================
# ROOT
# =========================================================

@app.get("/")
def root():
    return {
        "message":
            "Smart Mess & Tiffin Manager API is running"
    }

from app.routes import workflow_routes
app.include_router(workflow_routes.router)

app.include_router(join_routes.router)


app.include_router(profile_routes.router)


app.include_router(catalog_routes.router)

from app.routes import purchase_routes
app.include_router(purchase_routes.router)

from app.routes import translation_routes
app.include_router(translation_routes.router)
from app.routes import kitchen_advisor
app.include_router(kitchen_advisor.router)
from app.routes import chat_routes
app.include_router(chat_routes.router)

from app.routes import a_la_carte_routes
app.include_router(a_la_carte_routes.router)
