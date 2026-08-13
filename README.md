# Hubstaff Active Handling Time (AHT) Tracker

A real-time tracking application for monitoring and calculating Active Handling Time (AHT) integrated with Hubstaff time tracking streams, manual task entries, and role-based performance metrics.

## Features

- **Real-Time Active Task Timer**: Tracks live task durations synchronized with Hubstaff activity streams.
- **Role & Subrole Metrics**: Supports role-specific threshold benchmarks for **Trainer** (`Trainer 1`, `Trainer 2`) and **Reviewer** (`Completion Reviewer`, `Quality Reviewer`).
- **Hubstaff Event Sync**: Real-time webhook and backend sync for Hubstaff timer events (`Timer Started`, `Timer Stopped`).
- **Analytics & Reporting**: Detailed AHT breakdowns, target benchmarks, and task history preview.
- **Manual Task Logging**: Support for untracked and manual task duration entries.

## Tech Stack

- **Frontend**: SolidJS, Vinxi, TypeScript, TailwindCSS
- **Backend**: Python, FastAPI, SQLAlchemy (AsyncPG)
- **Database**: PostgreSQL 16
- **Deployment**: Docker Compose

## Quick Start

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Start the application stack with Docker Compose:
   ```bash
   docker compose up -d
   ```

3. Rebuild frontend bundle when making changes:
   ```bash
   docker compose build --no-cache frontend && docker compose up -d frontend
   ```

## License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPLv3)](./LICENSE).
