import json, os
from datetime import datetime, timedelta
from decimal import Decimal
from fastapi import Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from .auth import PASSWORD_RESET_TOKEN_EXPIRE_MINUTES, audit, cleanup_expired_session, client_ip, create_access_token, get_current_user, hash_password, new_reset_token, new_session_id, verify_password
from .database import Base, engine, get_db
from .models import AuditLog, PasswordResetToken, Transaction, User
from .schemas import AuditResponse, DashboardResponse, LoginRequest, PasswordResetConfirmRequest, PasswordResetRequest, PasswordResetResponse, PublicUserResponse, RegisterRequest, TokenResponse, TransactionResponse, TransferRequest, UserResponse
from .ws import manager

Base.metadata.create_all(bind=engine)
app = FastAPI(title="Demo Transacciones", version="2.1.0")
origins_env = os.getenv("CORS_ORIGINS", "*")
origins = ["*"] if origins_env == "*" else [x.strip() for x in origins_env.split(",")]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False if origins == ["*"] else True, allow_methods=["*"], allow_headers=["*"])

def user_to_response(u: User):
    return UserResponse(id=u.id, first_name=u.first_name, last_name=u.last_name, email=u.email, username=u.username, avatar_color=u.avatar_color, balance=u.balance, is_online=bool(u.is_online and u.active_session_id), last_seen_at=u.last_seen_at)

def user_to_public_response(u: User):
    return PublicUserResponse(id=u.id, first_name=u.first_name, last_name=u.last_name, email=u.email, username=u.username, avatar_color=u.avatar_color, is_online=bool(u.is_online and u.active_session_id), last_seen_at=u.last_seen_at)

def tx_to_response(t: Transaction):
    return TransactionResponse(id=t.id, sender=t.sender.username, receiver=t.receiver.username, sender_id=t.sender_id, receiver_id=t.receiver_id, amount=t.amount, concept=t.concept, origin_ip=t.origin_ip, created_at=t.created_at)

@app.get("/health")
def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}

@app.post("/auth/register", response_model=TokenResponse)
async def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    username = payload.username.lower().strip()
    email = payload.email.lower().strip()
    if db.query(User).filter(or_(User.email == email, User.username == username)).first():
        raise HTTPException(status_code=409, detail="El correo o usuario ya existe")
    colors = ["#2563eb", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#be123c"]
    session_id = new_session_id()
    user = User(first_name=payload.first_name.strip(), last_name=payload.last_name.strip(), email=email, username=username, password_hash=hash_password(payload.password), avatar_color=colors[abs(hash(username)) % len(colors)], balance=Decimal("150000"), is_online=True, active_session_id=session_id, session_started_at=datetime.utcnow(), last_seen_at=datetime.utcnow())
    db.add(user); db.flush()
    audit(db, user.id, "REGISTER", "Usuario registrado e inicio de sesión automático", client_ip(request))
    db.commit(); db.refresh(user)
    await manager.broadcast({"type": "users_updated"})
    return TokenResponse(access_token=create_access_token(user.id, session_id))

@app.post("/auth/login", response_model=TokenResponse)
async def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username.lower().strip()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Usuario o contraseña inválidos")
    cleanup_expired_session(db, user); db.refresh(user)
    if user.active_session_id:
        audit(db, user.id, "LOGIN_BLOCKED", "Intento de doble inicio de sesión bloqueado", client_ip(request)); db.commit()
        raise HTTPException(status_code=409, detail="Este usuario ya tiene una sesión activa en otro equipo. Cierre la sesión anterior o espere a que expire por inactividad.")
    session_id = new_session_id()
    user.active_session_id = session_id; user.is_online = True; user.session_started_at = datetime.utcnow(); user.last_seen_at = datetime.utcnow()
    audit(db, user.id, "LOGIN", "Inicio de sesión exitoso", client_ip(request)); db.commit()
    await manager.broadcast({"type": "users_updated"})
    return TokenResponse(access_token=create_access_token(user.id, session_id))

@app.post("/auth/logout")
async def logout(request: Request, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current.is_online = False; current.active_session_id = None; current.session_started_at = None; current.last_seen_at = datetime.utcnow()
    audit(db, current.id, "LOGOUT", "Cierre de sesión", client_ip(request)); db.commit()
    await manager.broadcast({"type": "users_updated"})
    return {"message": "Sesión cerrada"}

@app.post("/auth/password/forgot", response_model=PasswordResetResponse)
def forgot_password(payload: PasswordResetRequest, request: Request, db: Session = Depends(get_db)):
    identity = payload.username_or_email.lower().strip()
    user = db.query(User).filter(or_(User.username == identity, User.email == identity)).first()
    generic_message = "Si el usuario existe, generamos un codigo temporal para recuperar la contrasena."
    if not user:
        audit(db, None, "PASSWORD_RESET_REQUEST_UNKNOWN", f"Solicitud para identidad no registrada: {identity}", client_ip(request))
        db.commit()
        return PasswordResetResponse(message=generic_message)

    token_value = new_reset_token()
    expires_at = datetime.utcnow() + timedelta(minutes=PASSWORD_RESET_TOKEN_EXPIRE_MINUTES)
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None)).update({"used_at": datetime.utcnow()})
    db.add(PasswordResetToken(user_id=user.id, token=token_value, expires_at=expires_at))
    audit(db, user.id, "PASSWORD_RESET_REQUEST", "Solicitud de recuperacion de contrasena", client_ip(request))
    db.commit()
    return PasswordResetResponse(message=generic_message, reset_token=token_value, expires_at=expires_at)

@app.post("/auth/password/reset")
async def reset_password(payload: PasswordResetConfirmRequest, request: Request, db: Session = Depends(get_db)):
    reset = db.query(PasswordResetToken).filter(PasswordResetToken.token == payload.token).first()
    if not reset or reset.used_at or reset.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="El codigo de recuperacion no es valido o ya expiro")

    user = db.query(User).filter(User.id == reset.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="El usuario asociado al codigo no existe")

    user.password_hash = hash_password(payload.new_password)
    user.is_online = False
    user.active_session_id = None
    user.session_started_at = None
    user.last_seen_at = datetime.utcnow()
    reset.used_at = datetime.utcnow()
    audit(db, user.id, "PASSWORD_RESET_CONFIRM", "Contrasena actualizada por recuperacion", client_ip(request))
    db.commit()
    return {"message": "Contrasena actualizada correctamente. Ya puedes iniciar sesion."}

@app.get("/me", response_model=UserResponse)
def me(current: User = Depends(get_current_user)):
    return user_to_response(current)

@app.get("/users", response_model=list[PublicUserResponse])
def users(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    all_users = db.query(User).order_by(User.username.asc()).all()
    for u in all_users:
        cleanup_expired_session(db, u)
    return [user_to_public_response(u) for u in all_users]

@app.post("/transactions", response_model=TransactionResponse)
async def create_transaction(payload: TransferRequest, request: Request, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if payload.receiver_id == current.id:
        raise HTTPException(status_code=400, detail="No puedes enviarte dinero a ti mismo")
    receiver = db.query(User).filter(User.id == payload.receiver_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Usuario receptor no existe")
    amount = Decimal(payload.amount)
    db.refresh(current)
    if current.balance < amount:
        raise HTTPException(status_code=400, detail="Saldo insuficiente")
    current.balance -= amount; receiver.balance += amount
    tx = Transaction(sender_id=current.id, receiver_id=receiver.id, amount=amount, concept=payload.concept.strip(), origin_ip=client_ip(request))
    db.add(tx); db.flush()
    audit(db, current.id, "TRANSFER", f"Envió {amount} a {receiver.username}. Concepto: {payload.concept}", client_ip(request))
    db.commit(); db.refresh(tx)
    response = tx_to_response(tx)
    await manager.broadcast({"type": "transaction_created", "transaction": json.loads(response.model_dump_json())})
    await manager.broadcast({"type": "users_updated"})
    return response

@app.get("/transactions", response_model=list[TransactionResponse])
def transactions(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    txs = db.query(Transaction).filter(or_(Transaction.sender_id == current.id, Transaction.receiver_id == current.id)).order_by(Transaction.created_at.desc()).limit(100).all()
    return [tx_to_response(t) for t in txs]

@app.get("/dashboard", response_model=DashboardResponse)
def dashboard(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    sent_total = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(Transaction.sender_id == current.id).scalar()
    received_total = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(Transaction.receiver_id == current.id).scalar()
    transaction_count = db.query(Transaction).filter(or_(Transaction.sender_id == current.id, Transaction.receiver_id == current.id)).count()
    rows = db.query(func.date(Transaction.created_at), func.count(Transaction.id), func.coalesce(func.sum(Transaction.amount), 0)).group_by(func.date(Transaction.created_at)).order_by(func.date(Transaction.created_at)).limit(15).all()
    chart = [{"date": str(r[0]), "count": int(r[1]), "amount": float(r[2])} for r in rows]
    return DashboardResponse(balance=current.balance, sent_total=sent_total, received_total=received_total, transaction_count=transaction_count, chart=chart)

@app.get("/audit", response_model=list[AuditResponse])
def audit_logs(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(100).all()
    return [AuditResponse(id=l.id, user_id=l.user_id, action=l.action, detail=l.detail, origin_ip=l.origin_ip, created_at=l.created_at) for l in logs]

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        await websocket.send_json({"type": "connected"})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
