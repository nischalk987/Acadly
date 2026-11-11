"""Health response schemas."""
from typing import Literal

from pydantic import BaseModel, ConfigDict


class HealthStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["ok"]
