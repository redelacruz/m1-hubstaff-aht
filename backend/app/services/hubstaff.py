import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Tuple, List, Optional
import httpx
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete

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
from sqlalchemy import select

logger = logging.getLogger(__name__)

HUBSTAFF_AUTH_URL = "https://account.hubstaff.com/access_tokens"
HUBSTAFF_API_BASE_URL = "https://api.hubstaff.com/v2"


async def exchange_pat_for_tokens(pat_token: str) -> Dict[str, Any]:
    """
    Exchanges a Hubstaff Personal Access Token (PAT) for an Access Token and Refresh Token.
    Endpoint: POST https://account.hubstaff.com/access_tokens
    Payload: grant_type=refresh_token&refresh_token=<PAT>
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.post(
                HUBSTAFF_AUTH_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": pat_token.strip(),
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

            if response.status_code != 200:
                error_detail = response.text
                try:
                    err_json = response.json()
                    error_detail = (
                        err_json.get("error_description")
                        or err_json.get("error")
                        or response.text
                    )
                except Exception:
                    pass
                raise HTTPException(
                    status_code=401,
                    detail=f"Hubstaff authentication failed: {error_detail}",
                )

            return response.json()
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Unable to reach Hubstaff authentication server: {str(e)}",
            )


async def get_valid_access_token(user_id: str, db: AsyncSession, force_refresh: bool = False) -> str:
    """
    Retrieves a valid Hubstaff access token for the user.
    If the token has expired, is expiring within 5 minutes, or force_refresh is True,
    it refreshes the access token using the stored refresh_token (or pat_token fallback),
    updates the credentials in the database, and returns the new access token.
    """
    cred_res = await db.execute(select(HubstaffCredential).where(HubstaffCredential.user_id == user_id))
    credential = cred_res.scalar_one_or_none()
    if not credential:
        raise HTTPException(status_code=400, detail="Hubstaff account is not connected.")

    now_utc = datetime.now(timezone.utc)

    # If token is still valid with >= 5 min buffer and force_refresh is False, return it
    if (
        not force_refresh
        and credential.token_expires_at
        and credential.token_expires_at > (now_utc + timedelta(minutes=5))
        and credential.access_token
    ):
        return credential.access_token

    # Token is expired or expiring soon, rotate/refresh using refresh_token or pat_token
    token_to_use = credential.refresh_token or credential.pat_token
    if not token_to_use:
        raise HTTPException(status_code=401, detail="No refresh token or PAT available to renew access token.")

    logger.info(f"Renewing Hubstaff access token for user {user_id} (force_refresh={force_refresh})...")
    try:
        token_data = await exchange_pat_for_tokens(token_to_use)
    except Exception as e:
        # Fallback to pat_token if refresh_token exchange failed and pat_token differs
        if credential.pat_token and token_to_use != credential.pat_token:
            logger.info("Refresh token exchange failed, falling back to stored PAT...")
            token_data = await exchange_pat_for_tokens(credential.pat_token)
        else:
            raise e

    new_access_token = token_data["access_token"]
    new_refresh_token = token_data.get("refresh_token", token_to_use)
    expires_in = token_data.get("expires_in", 86400)
    new_expires_at = now_utc + timedelta(seconds=expires_in)

    credential.access_token = new_access_token
    credential.refresh_token = new_refresh_token
    credential.token_expires_at = new_expires_at
    await db.commit()
    logger.info(
        f"Successfully refreshed Hubstaff access token for user {user_id}. Expires at {new_expires_at}."
    )

    return new_access_token


async def fetch_user_me(access_token: str) -> Dict[str, Any]:
    """
    Fetches the profile of the authenticated user from Hubstaff V2 API.
    Endpoint: GET https://api.hubstaff.com/v2/users/me
    Headers: Authorization: Bearer <access_token>, Accept: */*
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(
                f"{HUBSTAFF_API_BASE_URL}/users/me",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "*/*",
                },
            )

            if response.status_code != 200:
                try:
                    err_json = response.json()
                    error_msg = (
                        err_json.get("error")
                        or err_json.get("code")
                        or "Error fetching user profile"
                    )
                    details = err_json.get("details", [])
                    detail_str = (
                        f"{error_msg} ({', '.join(details)})"
                        if details
                        else error_msg
                    )
                except Exception:
                    detail_str = f"Hubstaff API error (status {response.status_code})"

                raise HTTPException(
                    status_code=response.status_code
                    if response.status_code in (400, 401, 403, 429)
                    else 400,
                    detail=f"Failed to fetch Hubstaff user profile: {detail_str}",
                )

            data = response.json()
            user_data = data.get("user")
            if not user_data:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid Hubstaff API response: 'user' object missing.",
                )

            return user_data
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Unable to connect to Hubstaff API: {str(e)}",
            )


async def fetch_user_organizations(access_token: str) -> list[Dict[str, Any]]:
    """
    Fetches user organizations from GET https://api.hubstaff.com/v2/organizations
    Only extracts id, name, and status.
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(
                f"{HUBSTAFF_API_BASE_URL}/organizations",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "*/*",
                },
            )

            if response.status_code != 200:
                try:
                    err_json = response.json()
                    error_msg = err_json.get("error") or err_json.get("code") or "Error fetching organizations"
                    details = err_json.get("details", [])
                    detail_str = f"{error_msg} ({', '.join(details)})" if details else error_msg
                except Exception:
                    detail_str = f"Hubstaff API error (status {response.status_code})"

                raise HTTPException(
                    status_code=response.status_code if response.status_code in (400, 401, 403, 429) else 400,
                    detail=f"Failed to fetch Hubstaff organizations: {detail_str}",
                )

            data = response.json()
            raw_orgs = data.get("organizations", [])
            orgs = []
            for org in raw_orgs:
                orgs.append({
                    "id": str(org["id"]),
                    "name": org.get("name", ""),
                    "status": org.get("status", "active"),
                })
            return orgs
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Unable to connect to Hubstaff API: {str(e)}",
            )


async def fetch_organization_projects(access_token: str, organization_id: str | int) -> list[Dict[str, Any]]:
    """
    Fetches projects for an organization from GET https://api.hubstaff.com/v2/organizations/{organization_id}/projects
    Only extracts id, name, and status.
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(
                f"{HUBSTAFF_API_BASE_URL}/organizations/{organization_id}/projects",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "*/*",
                },
            )

            if response.status_code != 200:
                try:
                    err_json = response.json()
                    error_msg = err_json.get("error") or err_json.get("code") or "Error fetching organization projects"
                    details = err_json.get("details", [])
                    detail_str = f"{error_msg} ({', '.join(details)})" if details else error_msg
                except Exception:
                    detail_str = f"Hubstaff API error (status {response.status_code})"

                raise HTTPException(
                    status_code=response.status_code if response.status_code in (400, 401, 403, 429) else 400,
                    detail=f"Failed to fetch Hubstaff organization projects: {detail_str}",
                )

            data = response.json()
            raw_projects = data.get("projects", [])
            projects = []
            for prj in raw_projects:
                projects.append({
                    "id": str(prj["id"]),
                    "name": prj.get("name", ""),
                    "status": prj.get("status", "active"),
                })
            return projects
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Unable to connect to Hubstaff API: {str(e)}",
            )


async def sync_user_organizations_and_projects(user_id: str, access_token: str, db: AsyncSession):
    """
    Fetches organizations from Hubstaff API, saves them into PostgreSQL,
    and populates projects specifically for the Micro1 organization.
    """
    access_token = await get_valid_access_token(user_id, db)
    try:
        orgs_data = await fetch_user_organizations(access_token)
    except HTTPException as e:
        if e.status_code == 401:
            logger.info("fetch_user_organizations returned 401. Refreshing token and retrying...")
            access_token = await get_valid_access_token(user_id, db, force_refresh=True)
            orgs_data = await fetch_user_organizations(access_token)
        else:
            raise e

    # Wipe existing orgs for this user (projects will cascade delete automatically)
    await db.execute(delete(Organization).where(Organization.user_id == user_id))
    await db.flush()

    for org_item in orgs_data:
        org_id_str = org_item["id"]
        org_name = org_item["name"]
        org_status = org_item["status"]

        new_org = Organization(
            id=org_id_str,
            user_id=user_id,
            name=org_name,
            status=org_status,
        )
        db.add(new_org)
        await db.flush()

        # Check if organization is Micro1 (case-insensitive substring match)
        if "micro1" in org_name.lower():
            projects_data = await fetch_organization_projects(access_token, org_id_str)
            for prj_item in projects_data:
                prj_id_str = prj_item["id"]
                prj_name = prj_item["name"]
                prj_status = prj_item["status"]

                new_project = Project(
                    id=prj_id_str,
                    organization_id=org_id_str,
                    name=prj_name,
                    status=prj_status,
                    role_type="Unassigned",
                )
                db.add(new_project)
            await db.flush()

    await db.commit()


async def provision_single_user_environment(
    pat_token: str,
    token_response: Dict[str, Any],
    user_data: Dict[str, Any],
    db: AsyncSession,
) -> Tuple[User, HubstaffCredential]:
    """
    Wipes all existing database records to enforce single-user architecture,
    then provisions the newly authenticated Hubstaff user, credentials, organizations, and projects.
    """
    # 1. Wipe all existing system data
    await db.execute(delete(TaskLog))
    await db.execute(delete(HubstaffEvent))
    await db.execute(delete(Project))
    await db.execute(delete(Organization))
    await db.execute(delete(HubstaffTimeTotal))
    await db.execute(delete(UserSettings))
    await db.execute(delete(HubstaffCredential))
    await db.execute(delete(User))
    await db.flush()

    user_id_str = str(user_data["id"])
    access_token = token_response["access_token"]
    refresh_token = token_response.get("refresh_token", pat_token)
    expires_in = token_response.get("expires_in", 86400)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    # 2. Insert new user record
    new_user = User(
        id=user_id_str,
        name=user_data.get("name")
        or f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}".strip(),
        first_name=user_data.get("first_name"),
        last_name=user_data.get("last_name"),
        email=user_data["email"],
        time_zone=user_data.get("time_zone", "UTC"),
        status=user_data.get("status", "active"),
    )
    db.add(new_user)
    await db.flush()

    # 3. Insert new credential record
    new_credential = HubstaffCredential(
        user_id=user_id_str,
        pat_token=pat_token,
        access_token=access_token,
        refresh_token=refresh_token,
        token_expires_at=expires_at,
        is_connected=True,
        is_locked=True,
    )
    db.add(new_credential)

    # 4. Insert default user settings record
    new_settings = UserSettings(
        user_id=user_id_str,
        default_role="Reviewer",
        tracking_start_date=datetime.now(timezone.utc).date(),
        reconciliation_interval_hours=12,
        reconciliation_lookback_days=7,
        admin_inactivity_threshold_minutes=10,
        trainer_expected_aht_minutes=60.00,
        trainer_max_aht_minutes=70.00,
        trainer_onboarding_minutes=120.00,
        reviewer_expected_aht_minutes=45.00,
        reviewer_max_aht_minutes=70.00,
        reviewer_onboarding_minutes=60.00,
    )
    db.add(new_settings)

    # 5. Insert default hubstaff time totals record
    new_totals = HubstaffTimeTotal(
        user_id=user_id_str,
        trainer_seconds=0,
        reviewer_seconds=0,
    )
    db.add(new_totals)

    await db.commit()

    # 6. Sync organizations & Micro1 projects from Hubstaff
    try:
        await sync_user_organizations_and_projects(user_id_str, access_token, db)
    except Exception as e:
        logger.warning(f"Could not fetch organizations during PAT provisioning: {e}")
        await db.rollback()

    # 7. Force initial full historical tracking state reconciliation up to Tracking Start Date
    try:
        await sync_user_tracking_states(user_id_str, access_token, db)
    except Exception as e:
        logger.warning(f"Could not complete initial tracking state reconciliation during PAT provisioning: {e}")
        await db.rollback()

    # 8. Subscribe to Hubstaff V2 user webhooks (timer.start, timer.stop)
    try:
        await subscribe_user_webhooks(user_id_str, access_token, db)
    except Exception as e:
        logger.warning(f"Could not subscribe to Hubstaff webhooks during PAT provisioning: {e}")
        await db.rollback()

    await db.refresh(new_user)
    await db.refresh(new_credential)

    return new_user, new_credential


async def fetch_organization_tracking_states(
    access_token: str,
    organization_id: str,
    start_iso: str,
    stop_iso: str,
) -> Tuple[int, List[Dict[str, Any]]]:
    """
    Fetches tracking states from GET /v2/organizations/{organization_id}/tracking_states
    within the specified start and stop ISO 8601 time window.
    Returns (status_code, tracking_states_list).
    """
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "*/*",
    }
    params = {
        "occurred[start]": start_iso,
        "occurred[stop]": stop_iso,
        "include_removed": "true",
    }
    url = f"{HUBSTAFF_API_BASE_URL}/organizations/{organization_id}/tracking_states"

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        try:
            response = await client.get(url, headers=headers, params=params)
            if response.status_code == 200:
                data = response.json()
                return 200, data.get("tracking_states", [])
            else:
                logger.warning(
                    f"Hubstaff API tracking_states error status {response.status_code}: {response.text}"
                )
                return response.status_code, []
        except httpx.RequestError as e:
            logger.warning(f"Unable to connect to Hubstaff tracking_states API: {e}")
            return 502, []


async def sync_user_tracking_states(
    user_id: str, access_token: str, db: AsyncSession, max_days: Optional[int] = None
) -> Dict[str, Any]:
    """
    Queries tracking_states endpoint backward in <= 7-day chunks starting from now
    down to user's set tracking_start_date (up to 6-month API retention limit),
    or within the last max_days if specified.
    Performs state reconciliation:
    1. Upserts new and modified events into PostgreSQL all the way back to cutoff date.
    2. Prunes local database events within the prune window that no longer exist on Hubstaff.
    3. Adjusts user's tracking_start_date if a gap is detected.
    """
    # Ensure fresh access token before starting
    access_token = await get_valid_access_token(user_id, db)

    # 1. Fetch user settings
    settings_res = await db.execute(select(UserSettings).where(UserSettings.user_id == user_id))
    user_settings = settings_res.scalar_one_or_none()

    start_date = user_settings.tracking_start_date if user_settings else datetime.now(timezone.utc).date()
    start_datetime_utc = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)

    now_utc = datetime.now(timezone.utc)
    six_months_ago = now_utc - timedelta(days=180)
    three_months_ago = now_utc - timedelta(days=90)

    if max_days:
        fetch_cutoff_datetime = max(start_datetime_utc, now_utc - timedelta(days=max_days))
        prune_cutoff_datetime = fetch_cutoff_datetime
    else:
        # API Fetching Cutoff: query backward to tracking_start_date (up to 6 months API retention limit)
        fetch_cutoff_datetime = max(start_datetime_utc, six_months_ago)
        # Deletion Pruning Cutoff: only prune/delete local events within the last 3 months
        prune_cutoff_datetime = max(start_datetime_utc, three_months_ago)

    # 2. Fetch user's organizations
    orgs_res = await db.execute(select(Organization).where(Organization.user_id == user_id))
    orgs = orgs_res.scalars().all()

    # Load project names map for display
    prjs_res = await db.execute(select(Project))
    prjs_map = {p.id: p.name for p in prjs_res.scalars().all()}

    # Bulk fetch existing local events into memory for fast fuzzy matching
    local_events_res = await db.execute(
        select(HubstaffEvent).where(
            HubstaffEvent.user_id == user_id,
            HubstaffEvent.event_time >= fetch_cutoff_datetime,
        )
    )
    local_events = list(local_events_res.scalars().all())

    remote_event_ids = set()

    for org in orgs:
        current_stop = now_utc
        while current_stop > fetch_cutoff_datetime:
            chunk_start = max(current_stop - timedelta(days=7), fetch_cutoff_datetime)
            if chunk_start >= current_stop:
                break

            # Format ISO strings with Z
            start_str = chunk_start.strftime("%Y-%m-%dT%H:%M:%SZ")
            stop_str = current_stop.strftime("%Y-%m-%dT%H:%M:%SZ")

            status_code, raw_events = await fetch_organization_tracking_states(
                access_token, org.id, start_str, stop_str
            )
            if status_code == 401:
                logger.info("Hubstaff tracking_states returned 401. Refreshing access token and retrying...")
                access_token = await get_valid_access_token(user_id, db, force_refresh=True)
                status_code, raw_events = await fetch_organization_tracking_states(
                    access_token, org.id, start_str, stop_str
                )

            for evt in raw_events:
                evt_id_str = str(evt["id"])
                prj_id_str = str(evt.get("project_id", ""))
                evt_type = str(evt.get("type", "start")).lower()
                event_name = "Timer Started" if evt_type == "start" else "Timer Stopped"

                # Parse occurred_at (truncate microseconds for 1-second precision)
                raw_time = evt.get("occurred_at", "")
                try:
                    event_time = datetime.fromisoformat(raw_time.replace("Z", "+00:00")).replace(microsecond=0)
                except Exception:
                    event_time = datetime.now(timezone.utc).replace(microsecond=0)

                remote_event_ids.add(evt_id_str)

                # Check if exact ID match exists in local DB
                existing_evt = next((e for e in local_events if e.id == evt_id_str), None)

                if existing_evt:
                    existing_evt.project_id = prj_id_str
                    existing_evt.event_name = event_name
                    existing_evt.event_time = event_time
                else:
                    # Fuzzy match against real-time webhook events (UUIDs) within <= 5s window
                    correlated_webhook_evt = None
                    for local_evt in local_events:
                        if (
                            local_evt.project_id == prj_id_str
                            and local_evt.event_name == event_name
                            and abs((local_evt.event_time.replace(microsecond=0) - event_time).total_seconds()) <= 5.0
                        ):
                            correlated_webhook_evt = local_evt
                            break

                    if correlated_webhook_evt:
                        # Promote Webhook UUID event to official REST API Integer ID event
                        remote_event_ids.add(correlated_webhook_evt.id)
                        await db.delete(correlated_webhook_evt)
                        local_events.remove(correlated_webhook_evt)
                        logger.info(
                            f"Correlated Webhook Event ({correlated_webhook_evt.id}) promoted to API Integer ID ({evt_id_str})"
                        )

                    # Insert promoted/new event
                    new_evt = HubstaffEvent(
                        id=evt_id_str,
                        user_id=user_id,
                        project_id=prj_id_str,
                        event_name=event_name,
                        event_time=event_time,
                    )
                    db.add(new_evt)
                    local_events.append(new_evt)

            await db.flush()
            current_stop = chunk_start

    # 3. Prune deleted events ONLY within the 3-month window [prune_cutoff_datetime, now_utc]
    local_window_res = await db.execute(
        select(HubstaffEvent).where(
            HubstaffEvent.user_id == user_id,
            HubstaffEvent.event_time >= prune_cutoff_datetime,
            HubstaffEvent.event_time <= now_utc,
        )
    )
    local_window_events = local_window_res.scalars().all()

    for local_evt in local_window_events:
        if local_evt.id not in remote_event_ids:
            await db.delete(local_evt)

    await db.commit()

    # 4. Gap adjustment logic: find earliest event_time among all user's events in DB
    all_events_res = await db.execute(
        select(HubstaffEvent)
        .where(HubstaffEvent.user_id == user_id)
        .order_by(HubstaffEvent.event_time.asc())
    )
    all_events = all_events_res.scalars().all()

    updated_start_date = start_date
    if all_events:
        earliest_event_date = all_events[0].event_time.date()
        if earliest_event_date > start_date:
            updated_start_date = earliest_event_date
            if user_settings:
                user_settings.tracking_start_date = updated_start_date
                await db.commit()

    # Prepare return payload of events
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

    return {
        "success": True,
        "tracking_start_date": str(updated_start_date),
        "events_count": len(events_payload),
        "events": events_payload,
    }


async def subscribe_user_webhooks(
    user_id: str,
    access_token: str,
    db: AsyncSession,
) -> List[Dict[str, Any]]:
    """
    Subscribes to Hubstaff V2 user-level webhooks (events: timer.start, timer.stop) for the authenticated user.
    Target URL: https://hubstaff-data.redelacruz.com/api/hubstaff/webhook
    Endpoint: POST /v2/users/me/webhooks
    Saves subscription record into PostgreSQL webhook_subscriptions table.
    """
    access_token = await get_valid_access_token(user_id, db)
    target_url = "https://hubstaff-data.redelacruz.com/api/hubstaff/webhook"
    events = ["timer.start", "timer.stop"]

    existing_res = await db.execute(
        select(WebhookSubscription).where(
            WebhookSubscription.user_id == user_id,
            WebhookSubscription.target_url == target_url,
        )
    )
    existing_sub = existing_res.scalar_one_or_none()
    if existing_sub and existing_sub.status == "active":
        return [{
            "organization_id": existing_sub.organization_id or "user_me",
            "webhook_id": existing_sub.webhook_id,
            "target_url": existing_sub.target_url,
            "status": existing_sub.status,
            "events": existing_sub.events,
        }]

    url = f"{HUBSTAFF_API_BASE_URL}/users/me/webhooks"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "Accept": "*/*",
    }
    body = {
        "target_url": target_url,
        "events": events,
    }

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        try:
            response = await client.post(url, headers=headers, json=body)
            if response.status_code == 401:
                logger.info("Hubstaff webhook subscription returned 401. Refreshing token and retrying...")
                access_token = await get_valid_access_token(user_id, db, force_refresh=True)
                headers["Authorization"] = f"Bearer {access_token}"
                response = await client.post(url, headers=headers, json=body)

            if response.status_code in (200, 201):
                res_data = response.json()
                webhook_obj = res_data.get("webhook", res_data)
                webhook_id = str(webhook_obj.get("id", f"wh_{user_id}_01"))
                secret = webhook_obj.get("secret") or res_data.get("secret")

                if existing_sub:
                    existing_sub.webhook_id = webhook_id
                    existing_sub.status = "active"
                    if secret:
                        existing_sub.secret = secret
                else:
                    new_sub = WebhookSubscription(
                        user_id=user_id,
                        organization_id="user_me",
                        webhook_id=webhook_id,
                        target_url=target_url,
                        secret=secret,
                        events="timer.start,timer.stop",
                        status="active",
                    )
                    db.add(new_sub)

                await db.commit()
                return [{
                    "organization_id": "user_me",
                    "webhook_id": webhook_id,
                    "target_url": target_url,
                    "status": "active",
                    "events": "timer.start,timer.stop",
                }]
            else:
                logger.warning(
                    f"Hubstaff user webhook subscription status {response.status_code}: {response.text}"
                )
        except Exception as e:
            logger.warning(f"Error subscribing to Hubstaff user webhook: {e}")

    return []
