import os, uuid, bcrypt, secrets
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from .database import get_db
from .models import AuditLog, User

SECRET_KEY = os.getenv("SECRET_KEY", "demo-secret-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))
SESSION_TIMEOUT_MINUTES = int(os.getenv("SESSION_TIMEOUT_MINUTES", "30"))
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES = int(os.getenv("PASSWORD_RESET_TOKEN_EXPIRE_MINUTES", "15"))
security = HTTPBearer()

def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    return forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")

def hash_password(password: str) -> str:
    if len(password.encode("utf-8")) > 72:
        raise HTTPException(status_code=400, detail="La contraseña no puede superar 72 bytes")
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))

def create_access_token(user_id: int, session_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": str(user_id), "session_id": session_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

def audit(db: Session, user_id: int | None, action: str, detail: str, origin_ip: str | None):
    db.add(AuditLog(user_id=user_id, action=action, detail=detail, origin_ip=origin_ip))

def session_expired(user: User) -> bool:
    if not user.last_seen_at:
        return False
    return user.last_seen_at < datetime.utcnow() - timedelta(minutes=SESSION_TIMEOUT_MINUTES)

def cleanup_expired_session(db: Session, user: User):
    if user.active_session_id and session_expired(user):
        user.is_online = False
        user.active_session_id = None
        user.session_started_at = None
        db.commit()

def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)) -> User:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
        session_id = payload.get("session_id")
    except (JWTError, TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")
    cleanup_expired_session(db, user)
    db.refresh(user)
    if not user.active_session_id or user.active_session_id != session_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión inválida. El usuario inició sesión en otro equipo o la sesión expiró.")
    user.is_online = True
    user.last_seen_at = datetime.utcnow()
    db.commit(); db.refresh(user)
    return user

def new_session_id() -> str:
    return str(uuid.uuid4())

def new_reset_token() -> str:
    return secrets.token_urlsafe(32)
