from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.config import settings
from app.database import get_db, engine, Base
import app.models  # Register models with SQLAlchemy Base metadata
from app.routers import hubstaff


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-create tables & execute column DDL migrations on application startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS organizations ("
                "id VARCHAR(50) PRIMARY KEY, "
                "user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
                "name VARCHAR(150) NOT NULL, "
                "status VARCHAR(50) NOT NULL DEFAULT 'active', "
                "created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP"
                ");"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE projects ADD COLUMN IF NOT EXISTS organization_id VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE;"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE projects ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active';"
            )
        )
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Full CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(hubstaff.router)


@app.get("/")
async def root():
    return {
        "message": "Welcome to Hubstaff Tracking App API",
        "status": "online",
        "docs": "/docs",
    }


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "fastapi-backend",
    }


@app.get("/api/db-check")
async def db_check(db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(text("SELECT service_name, status FROM system_status;"))
        rows = result.fetchall()
        statuses = {row[0]: row[1] for row in rows}
        return {
            "database_connection": "successful",
            "system_statuses": statuses,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database connection failed: {str(e)}",
        )
