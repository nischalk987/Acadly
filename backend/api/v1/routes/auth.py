from typing import Annotated
from fastapi import APIRouter, Depends
from auth import AuthenticatedStudent, get_current_student
from schemas.common import ApiResponse
from schemas.student import StudentIdentity

router = APIRouter()

@router.get("/me", response_model=ApiResponse[StudentIdentity])
async def auth_me(student: Annotated[AuthenticatedStudent, Depends(get_current_student)]) -> ApiResponse[StudentIdentity]:
    return ApiResponse(data=StudentIdentity(id=student.id, email=student.email))
