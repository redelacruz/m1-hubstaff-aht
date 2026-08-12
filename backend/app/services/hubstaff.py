import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Tuple
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
    orgs_data = await fetch_user_organizations(access_token)

    # Wipe existing orgs and projects for this user
    existing_org_ids_subquery = select(Organization.id).where(Organization.user_id == user_id)
    await db.execute(delete(Project).where(Project.organization_id.in_(existing_org_ids_subquery)))
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
        trainer_expected_aht_minutes=15.00,
        trainer_max_aht_minutes=25.00,
        reviewer_expected_aht_minutes=10.00,
        reviewer_max_aht_minutes=18.00,
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

    await db.refresh(new_user)
    await db.refresh(new_credential)

    return new_user, new_credential
