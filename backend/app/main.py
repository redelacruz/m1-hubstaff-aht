import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select

from app.config import settings
from app.database import get_db, engine, Base, AsyncSessionLocal
import app.models  # Register models with SQLAlchemy Base metadata
from app.routers import hubstaff
from app.services.hubstaff import sync_user_tracking_states

logger = logging.getLogger(__name__)


async def start_periodic_reconciliation_task():
    """
    Background task running twice every day (every 12 hours = 43,200 seconds)
    to perform a limited 7-day state reconciliation, safeguarding against missed webhook events.
    """
    while True:
        try:
            await asyncio.sleep(43200)
            logger.info("Executing scheduled 12-hour 7-day background reconciliation...")
            async with AsyncSessionLocal() as db:
                user_res = await db.execute(select(app.models.User).limit(1))
                user = user_res.scalar_one_or_none()
                if user:
                    cred_res = await db.execute(
                        select(app.models.HubstaffCredential).where(app.models.HubstaffCredential.user_id == user.id)
                    )
                    credential = cred_res.scalar_one_or_none()
                    if credential and credential.access_token:
                        await sync_user_tracking_states(user.id, credential.access_token, db, max_days=7)
                        logger.info("Completed scheduled 12-hour 7-day background reconciliation.")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error in background reconciliation task: {e}")


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
                "CREATE TABLE IF NOT EXISTS webhook_subscriptions ("
                "id SERIAL PRIMARY KEY, "
                "user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
                "organization_id VARCHAR(50) NOT NULL, "
                "webhook_id VARCHAR(50) NOT NULL, "
                "target_url VARCHAR(500) NOT NULL, "
                "secret VARCHAR(255), "
                "events VARCHAR(255) NOT NULL DEFAULT 'timer.start,timer.stop', "
                "status VARCHAR(50) NOT NULL DEFAULT 'active', "
                "updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP"
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
        await conn.execute(
            text(
                "ALTER TABLE task_logs ADD COLUMN IF NOT EXISTS is_manual_entry BOOLEAN DEFAULT FALSE;"
            )
        )
        await conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_task_logs_title ON task_logs (title);"
            )
        )
        await conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_task_logs_title_role ON task_logs (title, role);"
            )
        )

    # Start 12-hour background reconciliation loop task
    task = asyncio.create_task(start_periodic_reconciliation_task())
    yield
    task.cancel()


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
