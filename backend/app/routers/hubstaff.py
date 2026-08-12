from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.database import get_db
from app.models import User, HubstaffCredential, TaskLog, HubstaffEvent, HubstaffTimeTotal, UserSettings
from app.services.hubstaff import exchange_pat_for_tokens, fetch_user_me, provision_single_user_environment

router = APIRouter(prefix="/api/hubstaff", tags=["Hubstaff Integration"])


class PatSubmissionRequest(BaseModel):
    pat_token: str = Field(..., min_length=10, description="Hubstaff Personal Access Token string")


class UserSettingsUpdateRequest(BaseModel):
    default_role: str = Field("Reviewer", description="Default role ('Trainer' or 'Reviewer')")
    tracking_start_date: str = Field("2026-08-01", description="Tracking start date YYYY-MM-DD")
    trainer_expected_aht_minutes: float = Field(15.0, ge=1.0)
    trainer_max_aht_minutes: float = Field(25.0, ge=1.0)
    reviewer_expected_aht_minutes: float = Field(10.0, ge=1.0)
    reviewer_max_aht_minutes: float = Field(18.0, ge=1.0)


@router.post("/pat")
async def submit_pat(request: PatSubmissionRequest, db: AsyncSession = Depends(get_db)):
    pat = request.pat_token.strip()
    if not pat:
        raise HTTPException(status_code=400, detail="Personal Access Token cannot be empty.")

    # 1. Exchange PAT for access token
    token_response = await exchange_pat_for_tokens(pat)

    # 2. Fetch user profile from GET /v2/users/me
    access_token = token_response["access_token"]
    user_data = await fetch_user_me(access_token)

    # 3. Wipe old database records & provision new user profile
    user, credential = await provision_single_user_environment(
        pat_token=pat,
        token_response=token_response,
        user_data=user_data,
        db=db,
    )

    return {
        "success": True,
        "connected": True,
        "is_locked": True,
        "user": {
            "id": user.id,
            "name": user.name,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "time_zone": user.time_zone,
            "status": user.status,
        },
    }


@router.get("/status")
async def get_hubstaff_status(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).limit(1))
    user = result.scalar_one_or_none()

    if not user:
        return {
            "connected": False,
            "is_locked": False,
            "user": None,
        }

    cred_result = await db.execute(select(HubstaffCredential).where(HubstaffCredential.user_id == user.id))
    credential = cred_result.scalar_one_or_none()

    return {
        "connected": bool(credential and credential.is_connected),
        "is_locked": bool(credential.is_locked) if credential else False,
        "user": {
            "id": user.id,
            "name": user.name,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "time_zone": user.time_zone,
            "status": user.status,
        },
    }


@router.put("/user-settings")
async def update_db_user_settings(request: UserSettingsUpdateRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).limit(1))
    user = result.scalar_one_or_none()
    if not user:
        return {"success": False, "message": "No active user connected yet."}

    settings_result = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
    user_setting = settings_result.scalar_one_or_none()

    try:
        parsed_date = datetime.strptime(request.tracking_start_date, "%Y-%m-%d").date()
    except ValueError:
        parsed_date = datetime.now().date()

    if not user_setting:
        user_setting = UserSettings(
            user_id=user.id,
            default_role=request.default_role,
            tracking_start_date=parsed_date,
            trainer_expected_aht_minutes=request.trainer_expected_aht_minutes,
            trainer_max_aht_minutes=request.trainer_max_aht_minutes,
            reviewer_expected_aht_minutes=request.reviewer_expected_aht_minutes,
            reviewer_max_aht_minutes=request.reviewer_max_aht_minutes,
        )
        db.add(user_setting)
    else:
        user_setting.default_role = request.default_role
        user_setting.tracking_start_date = parsed_date
        user_setting.trainer_expected_aht_minutes = request.trainer_expected_aht_minutes
        user_setting.trainer_max_aht_minutes = request.trainer_max_aht_minutes
        user_setting.reviewer_expected_aht_minutes = request.reviewer_expected_aht_minutes
        user_setting.reviewer_max_aht_minutes = request.reviewer_max_aht_minutes

    await db.commit()
    return {"success": True, "message": "User settings updated in database."}


@router.delete("/disconnect")
async def disconnect_hubstaff_account(db: AsyncSession = Depends(get_db)):
    await db.execute(delete(TaskLog))
    await db.execute(delete(HubstaffEvent))
    await db.execute(delete(HubstaffTimeTotal))
    await db.execute(delete(UserSettings))
    await db.execute(delete(HubstaffCredential))
    await db.execute(delete(User))
    await db.commit()

    return {
        "connected": False,
        "is_locked": False,
        "message": "Hubstaff account disconnected and all user data cleared.",
    }
