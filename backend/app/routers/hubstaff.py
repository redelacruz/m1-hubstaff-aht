import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.database import get_db
from app.models import (
    User,
    HubstaffCredential,
    TaskLog,
    HubstaffEvent,
    HubstaffTimeTotal,
    UserSettings,
    Organization,
    Project,
    WebhookSubscription,
)
from app.services.hubstaff import (
    exchange_pat_for_tokens,
    fetch_user_me,
    provision_single_user_environment,
    sync_user_organizations_and_projects,
    sync_user_tracking_states,
    subscribe_user_webhooks,
)

logger = logging.getLogger(__name__)

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

    # 3. Wipe old database records & provision new user profile, force full tracking states sync & subscribe user webhooks
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
        # Provision default local user & settings for seed / unauthenticated state
        user = User(
            id="usr_alex_rivera_01",
            name="Alex Rivera",
            first_name="Alex",
            last_name="Rivera",
            email="alex.rivera@company.com",
            time_zone="America/New_York",
            status="active",
        )
        db.add(user)
        await db.flush()

        user_setting = UserSettings(
            user_id=user.id,
            default_role="Reviewer",
            tracking_start_date=datetime.now().date(),
            trainer_expected_aht_minutes=15.0,
            trainer_max_aht_minutes=25.0,
            reviewer_expected_aht_minutes=10.0,
            reviewer_max_aht_minutes=18.0,
        )
        db.add(user_setting)
        await db.commit()
        await db.refresh(user)
        await db.refresh(user_setting)

    cred_result = await db.execute(select(HubstaffCredential).where(HubstaffCredential.user_id == user.id))
    credential = cred_result.scalar_one_or_none()

    settings_result = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
    user_setting = settings_result.scalar_one_or_none()

    # Load organizations and projects
    orgs_result = await db.execute(select(Organization).where(Organization.user_id == user.id))
    orgs = orgs_result.scalars().all()

    orgs_payload = []
    for org in orgs:
        prjs_result = await db.execute(select(Project).where(Project.organization_id == org.id))
        prjs = prjs_result.scalars().all()
        orgs_payload.append({
            "id": org.id,
            "name": org.name,
            "status": org.status,
            "is_micro1": "micro1" in org.name.lower(),
            "projects": [
                {
                    "id": prj.id,
                    "name": prj.name,
                    "status": prj.status,
                }
                for prj in prjs
            ],
        })

    # Webhook Subscription Status
    sub_result = await db.execute(select(WebhookSubscription).where(WebhookSubscription.user_id == user.id))
    subscription = sub_result.scalars().first()

    webhook_status_payload = {
        "is_active": bool(subscription and subscription.status == "active"),
        "target_url": subscription.target_url if subscription else "https://hubstaff-data.redelacruz.com/api/hubstaff/webhook",
        "events": ["timer.start", "timer.stop"],
        "updated_at": subscription.updated_at.isoformat() if subscription and subscription.updated_at else None,
    }

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
        "user_settings": {
            "default_role": user_setting.default_role if user_setting else "Reviewer",
            "tracking_start_date": str(user_setting.tracking_start_date) if user_setting else "2026-08-01",
            "trainer_expected_aht_minutes": float(user_setting.trainer_expected_aht_minutes) if user_setting else 15.0,
            "trainer_max_aht_minutes": float(user_setting.trainer_max_aht_minutes) if user_setting else 25.0,
            "reviewer_expected_aht_minutes": float(user_setting.reviewer_expected_aht_minutes) if user_setting else 10.0,
            "reviewer_max_aht_minutes": float(user_setting.reviewer_max_aht_minutes) if user_setting else 18.0,
        } if user_setting else None,
        "organizations": orgs_payload,
        "webhook_status": webhook_status_payload,
    }


@router.post("/sync-organizations")
async def sync_organizations_endpoint(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).limit(1))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="No user found.")

    cred_result = await db.execute(select(HubstaffCredential).where(HubstaffCredential.user_id == user.id))
    credential = cred_result.scalar_one_or_none()
    if not credential or not credential.access_token:
        raise HTTPException(status_code=400, detail="Hubstaff account is not connected.")

    await sync_user_organizations_and_projects(user.id, credential.access_token, db)
    return {"success": True, "message": "Organizations and projects synced successfully."}


@router.post("/sync-tracking-states")
async def sync_tracking_states_endpoint(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).limit(1))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="No user found.")

    cred_result = await db.execute(select(HubstaffCredential).where(HubstaffCredential.user_id == user.id))
    credential = cred_result.scalar_one_or_none()
    if not credential or not credential.access_token:
        raise HTTPException(status_code=400, detail="Hubstaff account is not connected.")

    sync_result = await sync_user_tracking_states(user.id, credential.access_token, db)
    try:
        await subscribe_user_webhooks(user.id, credential.access_token, db)
    except Exception:
        pass
    return sync_result


@router.get("/events")
async def get_local_hubstaff_events(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).limit(1))
    user = result.scalar_one_or_none()
    if not user:
        return {"events": []}

    prjs_res = await db.execute(select(Project))
    prjs_map = {p.id: p.name for p in prjs_res.scalars().all()}

    all_events_res = await db.execute(
        select(HubstaffEvent)
        .where(HubstaffEvent.user_id == user.id)
        .order_by(HubstaffEvent.event_time.desc())
    )
    all_events = all_events_res.scalars().all()

    events_payload = []
    for evt in all_events:
        prj_name = prjs_map.get(evt.project_id, f"Project #{evt.project_id}")
        events_payload.append({
            "id": evt.id,
            "userId": evt.user_id,
            "eventName": evt.event_name,
            "eventTime": evt.event_time.isoformat(),
            "projectId": evt.project_id,
            "projectName": prj_name,
        })

    return {"events": events_payload}


@router.get("/webhook")
async def hubstaff_webhook_health_check():
    return {"status": "ok", "message": "Hubstaff webhook receiver endpoint is active."}


@router.post("/webhook")
async def hubstaff_webhook_receiver(request: Request, db: AsyncSession = Depends(get_db)):
    # 1. Check for Hubstaff Handshake Verification Header (X-Hook-Secret)
    hook_secret = request.headers.get("X-Hook-Secret")
    body_bytes = await request.body()

    # Handshake verification (empty body or handshake verification POST)
    if hook_secret and (not body_bytes or body_bytes == b"{}" or body_bytes == b""):
        logger.info("Received Hubstaff webhook handshake request. Responding with 200 OK and X-Hook-Secret.")
        return Response(
            content="",
            status_code=200,
            headers={"X-Hook-Secret": hook_secret}
        )

    # 2. Parse Incoming Event Telemetry Payload
    try:
        payload = await request.json()
        logger.info(f"Received Hubstaff Webhook Payload: {payload}")
    except Exception as e:
        logger.warning(f"Failed to parse Hubstaff webhook JSON: {e}")
        if hook_secret:
            return Response(content="", status_code=200, headers={"X-Hook-Secret": hook_secret})
        return Response(content='{"success": true}', status_code=200, media_type="application/json")

    # Locate event data dictionary inside payload (Hubstaff can use 'data', 'event', 'tracking_state', or root)
    evt_data = payload.get("data") or payload.get("event") or payload.get("tracking_state") or payload
    if not isinstance(evt_data, dict):
        evt_data = payload

    raw_type = (payload.get("type") or payload.get("event") or evt_data.get("type") or payload.get("object") or "").lower()

    # Match event type or process tracking_state
    if "start" in raw_type or "stop" in raw_type or raw_type in ("timer.start", "timer.stop", "tracking_state", ""):
        event_name = "Timer Started" if ("start" in raw_type or "start" in str(evt_data.get("type", "")).lower()) else "Timer Stopped"
        if "stop" in raw_type or "stop" in str(evt_data.get("type", "")).lower():
            event_name = "Timer Stopped"

        evt_id = str(evt_data.get("id") or payload.get("id") or f"wh_evt_{int(datetime.now().timestamp())}")
        project_id = str(evt_data.get("project_id") or payload.get("project_id") or "")
        occurred_at_raw = evt_data.get("occurred_at") or evt_data.get("created_at") or payload.get("occurred_at") or ""

        try:
            event_time = datetime.fromisoformat(str(occurred_at_raw).replace("Z", "+00:00"))
        except Exception:
            event_time = datetime.now(timezone.utc)

        # Get local active user from PostgreSQL
        user_res = await db.execute(select(User).limit(1))
        db_user = user_res.scalar_one_or_none()

        if db_user and evt_id:
            # Ensure project exists in projects table to satisfy FK constraint
            if project_id:
                prj_res = await db.execute(select(Project).where(Project.id == project_id))
                if not prj_res.scalar_one_or_none():
                    new_prj = Project(
                        id=project_id,
                        user_id=db_user.id,
                        name=f"Project #{project_id}",
                        status="active",
                    )
                    db.add(new_prj)
                    await db.flush()

            existing_res = await db.execute(select(HubstaffEvent).where(HubstaffEvent.id == evt_id))
            existing_evt = existing_res.scalar_one_or_none()

            if existing_evt:
                if project_id:
                    existing_evt.project_id = project_id
                existing_evt.event_name = event_name
                existing_evt.event_time = event_time
                logger.info(f"Updated existing HubstaffEvent {evt_id} -> {event_name}")
            else:
                new_evt = HubstaffEvent(
                    id=evt_id,
                    user_id=db_user.id,
                    project_id=project_id,
                    event_name=event_name,
                    event_time=event_time,
                )
                db.add(new_evt)
                logger.info(f"Inserted new HubstaffEvent {evt_id} -> {event_name} for project {project_id}")

            await db.commit()

    response_headers = {}
    if hook_secret:
        response_headers["X-Hook-Secret"] = hook_secret

    return Response(
        content='{"success": true}',
        status_code=200,
        media_type="application/json",
        headers=response_headers,
    )


@router.put("/user-settings")
async def update_db_user_settings(request: UserSettingsUpdateRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).limit(1))
    user = result.scalar_one_or_none()
    if not user:
        user = User(
            id="usr_alex_rivera_01",
            name="Alex Rivera",
            first_name="Alex",
            last_name="Rivera",
            email="alex.rivera@company.com",
            time_zone="America/New_York",
            status="active",
        )
        db.add(user)
        await db.flush()

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
    await db.execute(delete(WebhookSubscription))
    await db.execute(delete(TaskLog))
    await db.execute(delete(HubstaffEvent))
    await db.execute(delete(Project))
    await db.execute(delete(Organization))
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
