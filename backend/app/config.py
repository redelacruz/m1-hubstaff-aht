import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Hubstaff Tracking App"
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql+asyncpg://hubstaff_user:hubstaff_password_secure_123@db:5432/hubstaff_db"
    )
    CORS_ORIGINS_RAW: str = os.getenv(
        "CORS_ORIGINS",
        "http://192.168.4.103,http://192.168.4.103:3000,http://192.168.4.104:8000,http://localhost:3000,https://hubstaff-app.redelacruz.com,https://hubstaff-data.redelacruz.com"
    )

    @property
    def cors_origins(self) -> List[str]:
        if not self.CORS_ORIGINS_RAW:
            return [
                "http://192.168.4.103",
                "http://192.168.4.103:3000",
                "http://192.168.4.104:8000",
                "http://localhost:3000",
                "https://hubstaff-app.redelacruz.com",
                "https://hubstaff-data.redelacruz.com",
            ]
        return [origin.strip() for origin in self.CORS_ORIGINS_RAW.split(",") if origin.strip()]

settings = Settings()
