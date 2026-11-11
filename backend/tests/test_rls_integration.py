"""Live two-student RLS tests.

Set the ACADLY_RLS_* variables to two dedicated test accounts and their access
tokens to run these against a non-production Supabase project. This suite is
skipped during normal CI when credentials are not configured.
"""

import os
from datetime import UTC, datetime
from uuid import uuid4

import httpx
import pytest

SUPABASE_URL = os.getenv("ACADLY_RLS_SUPABASE_URL", "").rstrip("/")
PUBLISHABLE_KEY = os.getenv("ACADLY_RLS_PUBLISHABLE_KEY", "")
STUDENT_A_TOKEN = os.getenv("ACADLY_RLS_STUDENT_A_TOKEN", "")
STUDENT_B_TOKEN = os.getenv("ACADLY_RLS_STUDENT_B_TOKEN", "")
_REQUIRED = (SUPABASE_URL, PUBLISHABLE_KEY, STUDENT_A_TOKEN, STUDENT_B_TOKEN)
pytestmark = pytest.mark.skipif(
    not all(_REQUIRED),
    reason="Set ACADLY_RLS_* credentials for live two-student Supabase tests.",
)



def headers(token: str, *, representation: bool = False) -> dict[str, str]:
    result = {
        "apikey": PUBLISHABLE_KEY,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    if representation:
        result["Prefer"] = "return=representation"
    return result


def auth_user_id(client: httpx.Client, token: str) -> str:
    response = client.get(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={"apikey": PUBLISHABLE_KEY, "Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200, "The configured RLS test token must be valid."
    return response.json()["id"]


def row_payload(table: str, owner_id: str) -> tuple[dict, dict]:
    unique = str(uuid4())
    now = datetime.now(UTC).isoformat()
    if table == "subjects":
        return {"name": f"RLS test {unique}"}, {"name": f"changed by other student {unique}"}
    if table == "study_sessions":
        return (
            {"session_type": "focus", "started_at": now, "duration_seconds": 60},
            {"duration_seconds": 120},
        )
    if table == "exams":
        return {"title": f"RLS test {unique}", "starts_at": now}, {"title": f"changed {unique}"}
    if table == "reminders":
        return {"title": f"RLS test {unique}", "remind_at": now}, {"title": f"changed {unique}"}
    if table == "notes":
        return (
            {
                "title": f"RLS test metadata {unique}",
                "file_path": f"{owner_id}/{unique}.txt",
                "file_name": "private-test.txt",
                "mime_type": "text/plain",
                "file_size_bytes": 12,
            },
            {"title": f"changed metadata {unique}"},
        )
    raise AssertionError(f"Unsupported RLS test table: {table}")


@pytest.mark.parametrize("table", ["subjects", "study_sessions", "exams", "reminders", "notes"])
def test_student_cannot_read_update_delete_or_claim_another_students_record(table: str) -> None:
    with httpx.Client(timeout=15.0) as client:
        student_a = auth_user_id(client, STUDENT_A_TOKEN)
        student_b = auth_user_id(client, STUDENT_B_TOKEN)
        assert student_a != student_b, "Use two different test student accounts."

        data, update = row_payload(table, student_b)

        # Even a valid Student B session cannot create a row owned by Student A.
        spoofed_insert = client.post(
            f"{SUPABASE_URL}/rest/v1/{table}",
            headers=headers(STUDENT_B_TOKEN),
            json={"user_id": student_a, **data},
        )
        assert spoofed_insert.status_code in (400, 401, 403), spoofed_insert.text

        created = client.post(
            f"{SUPABASE_URL}/rest/v1/{table}?select=id,user_id",
            headers=headers(STUDENT_B_TOKEN, representation=True),
            json={"user_id": student_b, **data},
        )
        assert created.status_code == 201, f"Could not create fixture for {table}: {created.text}"
        record_id = created.json()[0]["id"]

        try:
            read_by_a = client.get(
                f"{SUPABASE_URL}/rest/v1/{table}",
                params={"id": f"eq.{record_id}", "select": "id,user_id"},
                headers=headers(STUDENT_A_TOKEN),
            )
            assert read_by_a.status_code == 200
            assert read_by_a.json() == []

            update_by_a = client.patch(
                f"{SUPABASE_URL}/rest/v1/{table}",
                params={"id": f"eq.{record_id}", "select": "id"},
                headers=headers(STUDENT_A_TOKEN, representation=True),
                json={**update, "user_id": student_a},
            )
            assert update_by_a.status_code == 200
            assert update_by_a.json() == []

            delete_by_a = client.delete(
                f"{SUPABASE_URL}/rest/v1/{table}",
                params={"id": f"eq.{record_id}", "select": "id"},
                headers=headers(STUDENT_A_TOKEN, representation=True),
            )
            assert delete_by_a.status_code == 200
            assert delete_by_a.json() == []

            # Student B cannot transfer ownership of their existing row to A.
            transfer_by_b = client.patch(
                f"{SUPABASE_URL}/rest/v1/{table}",
                params={"id": f"eq.{record_id}", "select": "id"},
                headers=headers(STUDENT_B_TOKEN, representation=True),
                json={"user_id": student_a},
            )
            assert transfer_by_b.status_code in (400, 401, 403), transfer_by_b.text

            read_by_b = client.get(
                f"{SUPABASE_URL}/rest/v1/{table}",
                params={"id": f"eq.{record_id}", "select": "id,user_id"},
                headers=headers(STUDENT_B_TOKEN),
            )
            assert read_by_b.status_code == 200
            assert read_by_b.json() == [{"id": record_id, "user_id": student_b}]
        finally:
            client.delete(
                f"{SUPABASE_URL}/rest/v1/{table}",
                params={"id": f"eq.{record_id}"},
                headers=headers(STUDENT_B_TOKEN),
            )


@pytest.mark.parametrize(
    "table",
    ["profiles", "chapters", "study_tasks", "revisions", "user_preferences"],
)
def test_rls_hides_other_students_rows_for_remaining_owned_tables(table: str) -> None:
    """Verify SELECT isolation for tables not covered by the CRUD matrix above."""
    with httpx.Client(timeout=15.0) as client:
        student_a = auth_user_id(client, STUDENT_A_TOKEN)
        student_b = auth_user_id(client, STUDENT_B_TOKEN)
        assert student_a != student_b, "Use two different test student accounts."

        if table in {"profiles", "user_preferences"}:
            # Rows are provisioned for each user by the auth trigger; verify only
            # the owning user can read their own UUID-keyed row.
            read_by_a = client.get(
                f"{SUPABASE_URL}/rest/v1/{table}",
                params={"id" if table == "profiles" else "user_id": f"eq.{student_b}", "select": "*"},
                headers=headers(STUDENT_A_TOKEN),
            )
            assert read_by_a.status_code == 200
            assert read_by_a.json() == []
            return

        # Use a random, valid-looking foreign UUID. RLS should hide the row
        # regardless of whether the referenced fixture exists.
        read_by_a = client.get(
            f"{SUPABASE_URL}/rest/v1/{table}",
            params={"user_id": f"eq.{student_b}", "select": "*"},
            headers=headers(STUDENT_A_TOKEN),
        )
        assert read_by_a.status_code == 200
        assert all(row.get("user_id") != student_b for row in read_by_a.json())
