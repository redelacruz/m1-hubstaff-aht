from datetime import datetime, date
from typing import Optional
from sqlalchemy import String, Integer, Numeric, Text, Date, DateTime, Boolean, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SystemStatus(Base):
    __tablename__ = "system_status"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    service_name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    first_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    time_zone: Mapped[Optional[str]] = mapped_column(String(50), default="UTC", nullable=True)
    status: Mapped[Optional[str]] = mapped_column(String(30), default="active", nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    organizations: Mapped[list["Organization"]] = relationship(
        "Organization", back_populates="user", cascade="all, delete-orphan"
    )
    hubstaff_events: Mapped[list["HubstaffEvent"]] = relationship(
        "HubstaffEvent", back_populates="user", cascade="all, delete-orphan"
    )
    task_logs: Mapped[list["TaskLog"]] = relationship(
        "TaskLog", back_populates="user", cascade="all, delete-orphan"
    )
    time_adjustments: Mapped[list["HubstaffTimeAdjustment"]] = relationship(
        "HubstaffTimeAdjustment", back_populates="user", cascade="all, delete-orphan"
    )
    settings: Mapped[Optional["UserSettings"]] = relationship(
        "UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    time_totals: Mapped[Optional["HubstaffTimeTotal"]] = relationship(
        "HubstaffTimeTotal", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    credential: Mapped[Optional["HubstaffCredential"]] = relationship(
        "HubstaffCredential", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


class HubstaffCredential(Base):
    __tablename__ = "hubstaff_credentials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    pat_token: Mapped[str] = mapped_column(Text, nullable=False)
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token: Mapped[str] = mapped_column(Text, nullable=False)
    token_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_connected: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationship
    user: Mapped["User"] = relationship("User", back_populates="credential")


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="organizations")
    projects: Mapped[list["Project"]] = relationship(
        "Project", back_populates="organization", cascade="all, delete-orphan"
    )


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    organization_id: Mapped[Optional[str]] = mapped_column(
        String(50), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)
    role_type: Mapped[str] = mapped_column(String(20), default="Unassigned", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    organization: Mapped[Optional["Organization"]] = relationship("Organization", back_populates="projects")
    hubstaff_events: Mapped[list["HubstaffEvent"]] = relationship(
        "HubstaffEvent", back_populates="project", cascade="all, delete-orphan"
    )


class HubstaffEvent(Base):
    __tablename__ = "hubstaff_events"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    project_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    event_name: Mapped[str] = mapped_column(String(50), nullable=False)  # 'Timer Started' / 'Timer Stopped'
    event_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="hubstaff_events")
    project: Mapped["Project"] = relationship("Project", back_populates="hubstaff_events")


class TaskGroup(Base):
    __tablename__ = "task_groups"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    subrole: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User")
    task_logs: Mapped[list["TaskLog"]] = relationship(
        "TaskLog", back_populates="task_group", cascade="all, delete-orphan"
    )


class TaskLog(Base):
    __tablename__ = "task_logs"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    task_group_id: Mapped[Optional[str]] = mapped_column(
        String(50), ForeignKey("task_groups.id", ondelete="SET NULL"), nullable=True
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # 'Trainer' or 'Reviewer'
    subrole: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    timer_mode: Mapped[str] = mapped_column(String(20), default="hubstaff", nullable=False)  # 'hubstaff' / 'untracked'
    is_manual_entry: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="task_logs")
    task_group: Mapped[Optional["TaskGroup"]] = relationship("TaskGroup", back_populates="task_logs")


class UserSettings(Base):
    __tablename__ = "user_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    default_role: Mapped[str] = mapped_column(String(20), default="Reviewer", nullable=False)
    tracking_start_date: Mapped[date] = mapped_column(Date, nullable=False)
    trainer_expected_aht_minutes: Mapped[float] = mapped_column(Numeric(5, 2), default=15.00, nullable=False)
    trainer_max_aht_minutes: Mapped[float] = mapped_column(Numeric(5, 2), default=25.00, nullable=False)
    trainer_onboarding_minutes: Mapped[float] = mapped_column(Numeric(6, 2), default=120.00, nullable=False)
    reviewer_expected_aht_minutes: Mapped[float] = mapped_column(Numeric(5, 2), default=10.00, nullable=False)
    reviewer_max_aht_minutes: Mapped[float] = mapped_column(Numeric(5, 2), default=18.00, nullable=False)
    reviewer_onboarding_minutes: Mapped[float] = mapped_column(Numeric(6, 2), default=60.00, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="settings")


class HubstaffTimeTotal(Base):
    __tablename__ = "hubstaff_time_totals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    trainer_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reviewer_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="time_totals")


class WebhookSubscription(Base):
    __tablename__ = "webhook_subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    organization_id: Mapped[str] = mapped_column(String(50), nullable=False)
    webhook_id: Mapped[str] = mapped_column(String(50), nullable=False)
    target_url: Mapped[str] = mapped_column(String(500), nullable=False)
    secret: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    events: Mapped[str] = mapped_column(String(255), default="timer.start,timer.stop", nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User")


class HubstaffTimeAdjustment(Base):
    __tablename__ = "hubstaff_time_adjustments"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # 'Trainer' or 'Reviewer'
    adjustment_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'addition' or 'deletion'
    amount_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationship
    user: Mapped["User"] = relationship("User", back_populates="time_adjustments")

