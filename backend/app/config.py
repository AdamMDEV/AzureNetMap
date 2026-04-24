from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    law_firewall_id: str = ""
    law_prod_nta_id: str = ""
    law_dev_nta_id: str = ""
    cache_ttl_seconds: int = 300
    default_time_range_hours: int = 24
    max_time_range_days: int = 30
    log_level: str = "INFO"


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
