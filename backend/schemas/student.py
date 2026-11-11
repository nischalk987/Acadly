"""Student identity response schema."""
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


class StudentIdentity(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    email: EmailStr | None = None
