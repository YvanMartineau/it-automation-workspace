"""
LdapProvisioningService — LDAP-backed identity provisioning (ADR-012).

Real directory provisioning: creates an inetOrgPerson entry and assigns
department-based group membership — the actual "least privilege, policy-
driven" story LocalDBProvisioningService couldn't deliver. Unlike the
local provider, set_password() isn't a no-op here: there's a real
directory account to attach a credential to.

Group policy is a naming convention, not a hardcoded map:
cn={department},{LDAP_GROUPS_OU}. Groups are created on first use
(get-or-create) since groupOfNames requires at least one member —
there's never an empty group to seed separately.

ldap3 is synchronous (like python-nmap), so every call goes through
run_in_executor — same pattern as services/scanner.py.
"""

import asyncio
import logging
from datetime import UTC, datetime
from uuid import UUID

from core.exceptions import ConflictError, ExternalServiceError, NotFoundError
from ldap3 import (
    HASHED_SALTED_SHA,
    MODIFY_ADD,
    MODIFY_DELETE,
    MODIFY_REPLACE,
    SUBTREE,
    Connection,
    Server,
)
from ldap3.core.exceptions import LDAPException
from ldap3.utils.hashed import hashed
from services.provisioning.base import ProvisionedUser, UserProvisioningService
from settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

ENTRY_ALREADY_EXISTS = 68  # LDAP result code


class LdapProvisioningService(UserProvisioningService):
    def __init__(self):
        self._server = Server(settings.LDAP_SERVER_URL)

    def _connect(self) -> Connection:
        return Connection(
            self._server,
            user=settings.LDAP_BIND_DN,
            password=settings.LDAP_BIND_PASSWORD,
            auto_bind=True,
        )

    # ---- sync implementations, always called via run_in_executor ----

    def _create_user_sync(
        self, user_id: UUID, first_name, last_name, email, department, job_title
    ) -> ProvisionedUser:
        uid = email.split("@")[0]
        user_dn = f"uid={uid},{settings.LDAP_USERS_OU}"

        conn = self._connect()
        try:
            added = conn.add(
                user_dn,
                object_class=["inetOrgPerson", "organizationalPerson", "person"],
                attributes={
                    "cn": f"{first_name} {last_name}",
                    "sn": last_name,
                    "givenName": first_name,
                    "mail": email,
                    "title": job_title,
                    "departmentNumber": department,
                    "employeeNumber": str(user_id),  # was internal_id
                    "description": "active",
                },
            )
            if not added:
                if conn.result.get("result") == ENTRY_ALREADY_EXISTS:
                    raise ConflictError(f"A directory entry already exists for '{email}'")
                raise ExternalServiceError(f"LDAP add failed for '{email}': {conn.result}")

            self._ensure_group_membership_sync(conn, department, user_dn)

            return ProvisionedUser(
                user_id=user_id,  # was internal_id
                external_id=user_dn,
                first_name=first_name,
                last_name=last_name,
                email=email,
                department=department,
                job_title=job_title,
                status="active",
                provisioning_source="ldap",
            )
        finally:
            conn.unbind()

    def _ensure_group_membership_sync(
        self, conn: Connection, department: str, user_dn: str
    ) -> None:
        group_dn = f"cn={department},{settings.LDAP_GROUPS_OU}"
        # Search FROM the (guaranteed-to-exist) groups OU, not from group_dn itself —
        # using a group DN that doesn't exist yet as the search base raises noSuchObject
        # rather than just returning zero results.
        conn.search(
            settings.LDAP_GROUPS_OU,
            f"(cn={department})",
            search_scope=SUBTREE,
            attributes=["member"],
        )
        if conn.entries:
            conn.modify(group_dn, {"member": [(MODIFY_ADD, [user_dn])]})
        else:
            created = conn.add(
                group_dn, object_class=["groupOfNames"], attributes={"member": [user_dn]}
            )
            if not created:
                raise ExternalServiceError(f"Could not create group '{group_dn}': {conn.result}")

    def _set_password_sync(self, user_dn: str, password: str) -> None:
        conn = self._connect()
        try:
            pw_hash = hashed(
                HASHED_SALTED_SHA, password
            )  # salted-hashed client-side, never sent in cleartext
            modified = conn.modify(user_dn, {"userPassword": [(MODIFY_REPLACE, [pw_hash])]})
            if not modified:
                raise ExternalServiceError(
                    f"LDAP password set failed for '{user_dn}': {conn.result}"
                )
        finally:
            conn.unbind()

    def _deactivate_user_sync(self, user_id: UUID) -> ProvisionedUser:
        conn = self._connect()
        try:
            conn.search(
                settings.LDAP_USERS_OU,
                f"(employeeNumber={user_id})",
                search_scope=SUBTREE,
                attributes=["givenName", "sn", "mail", "departmentNumber", "title", "description"],
            )
            if not conn.entries:
                raise NotFoundError(f"No directory entry found for user_id '{user_id}'")
            entry = conn.entries[0]
            user_dn = entry.entry_dn
            current_description = str(entry.description) if "description" in entry else ""

            if current_description.startswith("offboarded:"):
                offboarded_at = datetime.fromisoformat(
                    current_description.split("offboarded:", 1)[1]
                )
            else:
                conn.search(
                    settings.LDAP_GROUPS_OU,
                    f"(member={user_dn})",
                    search_scope=SUBTREE,
                    attributes=["member"],
                )
                for grp in conn.entries:
                    conn.modify(grp.entry_dn, {"member": [(MODIFY_DELETE, [user_dn])]})

                offboarded_at = datetime.now(UTC)
                conn.modify(
                    user_dn,
                    {
                        "description": [
                            (MODIFY_REPLACE, [f"offboarded:{offboarded_at.isoformat()}"])
                        ]
                    },
                )

            return ProvisionedUser(
                user_id=user_id,
                external_id=user_dn,
                first_name=str(entry.givenName) if "givenName" in entry else "",
                last_name=str(entry.sn) if "sn" in entry else "",
                email=str(entry.mail) if "mail" in entry else "",
                department=str(entry.departmentNumber) if "departmentNumber" in entry else "",
                job_title=str(entry.title) if "title" in entry else "",
                status="offboarded",
                provisioning_source="ldap",
                offboarded_at=offboarded_at,
            )
        finally:
            conn.unbind()

    # ---- async interface ----
    async def create_user(
        self, *, user_id: UUID, first_name, last_name, email, department, job_title
    ) -> ProvisionedUser:
        loop = asyncio.get_running_loop()
        try:
            return await loop.run_in_executor(
                None,
                self._create_user_sync,
                user_id,
                first_name,
                last_name,
                email,
                department,
                job_title,
            )
        except LDAPException as err:
            raise ExternalServiceError(f"LDAP operation failed: {err}") from err

    async def set_password(self, user: ProvisionedUser, password: str) -> None:
        loop = asyncio.get_running_loop()
        try:
            await loop.run_in_executor(None, self._set_password_sync, user.external_id, password)
        except LDAPException as err:
            raise ExternalServiceError(f"LDAP password set failed: {err}") from err

    async def deactivate_user(self, user_id: UUID) -> ProvisionedUser:
        loop = asyncio.get_running_loop()
        try:
            return await loop.run_in_executor(None, self._deactivate_user_sync, user_id)
        except LDAPException as err:
            raise ExternalServiceError(f"LDAP deactivation failed: {err}") from err
