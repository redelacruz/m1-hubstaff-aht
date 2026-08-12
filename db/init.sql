-- Database initialization for hubstaff_db

-- System status table for health checks
CREATE TABLE IF NOT EXISTS system_status (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_status (service_name, status)
VALUES 
    ('database', 'healthy'),
    ('backend', 'online'),
    ('frontend', 'online')
ON CONFLICT (service_name) DO UPDATE SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    email VARCHAR(100) NOT NULL UNIQUE,
    time_zone VARCHAR(50) DEFAULT 'UTC',
    status VARCHAR(30) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Hubstaff Credentials table for storing PAT, tokens, and lock state
CREATE TABLE IF NOT EXISTS hubstaff_credentials (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    pat_token TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_connected BOOLEAN NOT NULL DEFAULT true,
    is_locked BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    role_type VARCHAR(20) NOT NULL DEFAULT 'Unassigned', -- 'Trainer', 'Reviewer', or 'Unassigned'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Hubstaff Webhook Event Telemetry table
CREATE TABLE IF NOT EXISTS hubstaff_events (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id VARCHAR(50) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    event_name VARCHAR(50) NOT NULL, -- 'Timer Started' or 'Timer Stopped'
    event_time TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Task Logs table
CREATE TABLE IF NOT EXISTS task_logs (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'Trainer' or 'Reviewer'
    subrole VARCHAR(50) NOT NULL, -- 'Trainer 1', 'Trainer 2', 'Completion Reviewer', 'Quality Reviewer'
    title VARCHAR(255) NOT NULL,
    url VARCHAR(500),
    notes TEXT,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    timer_mode VARCHAR(20) NOT NULL DEFAULT 'hubstaff', -- 'hubstaff' or 'untracked'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User Settings table (page size settings stored in localStorage per user preference)
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    default_role VARCHAR(20) NOT NULL DEFAULT 'Reviewer',
    tracking_start_date DATE NOT NULL DEFAULT '2026-08-01',
    trainer_expected_aht_minutes NUMERIC(5,2) NOT NULL DEFAULT 15.00,
    trainer_max_aht_minutes NUMERIC(5,2) NOT NULL DEFAULT 25.00,
    reviewer_expected_aht_minutes NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    reviewer_max_aht_minutes NUMERIC(5,2) NOT NULL DEFAULT 18.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Hubstaff Tracked Time Aggregate Totals table
CREATE TABLE IF NOT EXISTS hubstaff_time_totals (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    trainer_seconds INTEGER NOT NULL DEFAULT 0,
    reviewer_seconds INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Initial Seed Data
INSERT INTO users (id, name, first_name, last_name, email, time_zone, status) VALUES
    ('usr_alex_rivera_01', 'Alex Rivera', 'Alex', 'Rivera', 'alex.rivera@company.com', 'America/New_York', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, name, role_type) VALUES
    ('PRJ-901', 'Quality Assurance & Reviews', 'Reviewer'),
    ('PRJ-902', 'Trainer Coaching & SOP', 'Trainer'),
    ('PRJ-903', 'Client Escalations', 'Reviewer')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_settings (user_id, default_role, tracking_start_date, trainer_expected_aht_minutes, trainer_max_aht_minutes, reviewer_expected_aht_minutes, reviewer_max_aht_minutes) VALUES
    ('usr_alex_rivera_01', 'Reviewer', '2026-08-01', 15.00, 25.00, 10.00, 18.00)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO hubstaff_time_totals (user_id, trainer_seconds, reviewer_seconds) VALUES
    ('usr_alex_rivera_01', 21600, 16200)
ON CONFLICT (user_id) DO NOTHING;
