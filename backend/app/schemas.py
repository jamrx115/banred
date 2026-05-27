from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, EmailStr, Field

class RegisterRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=4, max_length=72)

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    username: str
    avatar_color: str | None = None
    balance: Decimal
    is_online: bool
    last_seen_at: datetime | None = None

class TransferRequest(BaseModel):
    receiver_id: int
    amount: Decimal = Field(gt=0)
    concept: str = Field(min_length=1, max_length=250)

class TransactionResponse(BaseModel):
    id: int
    sender: str
    receiver: str
    sender_id: int
    receiver_id: int
    amount: Decimal
    concept: str
    origin_ip: str | None = None
    created_at: datetime

class DashboardResponse(BaseModel):
    balance: Decimal
    sent_total: Decimal
    received_total: Decimal
    transaction_count: int
    top_users: list[UserResponse]
    chart: list[dict]

class AuditResponse(BaseModel):
    id: int
    user_id: int | None
    action: str
    detail: str | None
    origin_ip: str | None
    created_at: datetime
