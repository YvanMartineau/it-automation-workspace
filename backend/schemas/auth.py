"""Pydantic v2 request/response models for auth endpoints."""

from pydantic import BaseModel, ConfigDict, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    # What is ConfigDict in short, it is a new way to configure Pydantic models in v2.
    # In this case, from_attributes=True allows the model to be populated from attributes of an object, not just from a dictionary.
    # This is useful when you want to create a Pydantic model instance from an ORM model or any other object with attributes that match the model's fields.
    model_config = ConfigDict(from_attributes=True)

    access_token: str
    token_type: str = "bearer"
