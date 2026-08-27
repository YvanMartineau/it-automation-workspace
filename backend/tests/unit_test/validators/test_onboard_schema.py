import pytest
from pydantic import ValidationError

from schemas.onboard import (
    OnboardRequest,
    OnboardResponse,
    OffboardResponse,
    OnboardedUserListItem,
)


class TestOnboardRequest:
    def test_valid_request(self):
        data = {
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane.doe@example.com",
            "department": "Engineering",
            "job_title": "Backend Developer",
        }
        req = OnboardRequest(**data)
        assert req.first_name == "Jane"
        assert req.email == "jane.doe@example.com"

    def test_missing_first_name(self):
        data = {
            "last_name": "Doe",
            "email": "jane.doe@example.com",
            "department": "Engineering",
            "job_title": "Backend Developer",
        }
        with pytest.raises(ValidationError):
            OnboardRequest(**data)

    def test_blank_first_name(self):
        data = {
            "first_name": "",
            "last_name": "Doe",
            "email": "jane.doe@example.com",
            "department": "Engineering",
            "job_title": "Backend Developer",
        }
        with pytest.raises(ValidationError):
            OnboardRequest(**data)

    def test_first_name_too_long(self):
        data = {
            "first_name": "A" * 101,
            "last_name": "Doe",
            "email": "jane.doe@example.com",
            "department": "Engineering",
            "job_title": "Backend Developer",
        }
        with pytest.raises(ValidationError):
            OnboardRequest(**data)

    def test_missing_last_name(self):
        data = {
            "first_name": "Jane",
            "email": "jane.doe@example.com",
            "department": "Engineering",
            "job_title": "Backend Developer",
        }
        with pytest.raises(ValidationError):
            OnboardRequest(**data)

    def test_missing_email(self):
        data = {
            "first_name": "Jane",
            "last_name": "Doe",
            "department": "Engineering",
            "job_title": "Backend Developer",
        }
        with pytest.raises(ValidationError):
            OnboardRequest(**data)

    def test_invalid_email(self):
        data = {
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "invalid-email",
            "department": "Engineering",
            "job_title": "Backend Developer",
        }
        with pytest.raises(ValidationError):
            OnboardRequest(**data)

    def test_missing_department(self):
        data = {
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane.doe@example.com",
            "job_title": "Backend Developer",
        }
        with pytest.raises(ValidationError):
            OnboardRequest(**data)

    def test_missing_job_title(self):
        data = {
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane.doe@example.com",
            "department": "Engineering",
        }
        with pytest.raises(ValidationError):
            OnboardRequest(**data)

    def test_extra_fields_ignored(self):
        data = {
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane.doe@example.com",
            "department": "Engineering",
            "job_title": "Backend Developer",
            "extra_field": "ignored",
        }
        req = OnboardRequest(**data)
        assert not hasattr(req, "extra_field")


class TestOnboardResponse:
    def test_valid_response(self):
        from uuid import uuid4

        data = {
            "user_id": uuid4(),
            "external_id": None,
            "email": "jane.doe@example.com",
            "department": "Engineering",
            "job_title": "Backend Developer",
            "status": "PENDING",
            "provisioning_source": "ldap",
            "temporary_paswrd": "Temp!123456",
        }
        resp = OnboardResponse(**data)
        assert resp.user_id == data["user_id"]
        assert resp.temporary_paswrd == "Temp!123456"


class TestOffboardResponse:
    def test_valid_response(self):
        from uuid import uuid4
        from datetime import datetime, timezone

        data = {
            "user_id": uuid4(),
            "status": "OFFBOARDED",
            "offboarded_at": datetime.now(timezone.utc),
        }
        resp = OffboardResponse(**data)
        assert resp.status == "OFFBOARDED"


class TestOnboardedUserListItem:
    def test_validation_alias_maps_id_to_user_id(self):
        from uuid import uuid4
        from datetime import datetime, timezone

        obj = {
            "id": uuid4(),
            "job_id": "job-123",
            "external_id": None,
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane.doe@example.com",
            "department": "Engineering",
            "job_title": "Backend Developer",
            "status": "PENDING",
            "job_status": "AD_CREATING",
            "provisioning_source": "ldap",
            "requested_by": None,
            "error_message": None,
            "created_at": datetime.now(timezone.utc),
            "offboarded_at": None,
        }
        item = OnboardedUserListItem(**obj)
        assert item.user_id == obj["id"]
        # serialization alias should expose workflow_status
        assert item.model_dump(by_alias=True)["workflow_status"] == "AD_CREATING"