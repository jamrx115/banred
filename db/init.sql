CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(180) UNIQUE NOT NULL,
    username VARCHAR(80) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_color VARCHAR(20) DEFAULT '#2563eb',
    balance NUMERIC(14,2) NOT NULL DEFAULT 100000,
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    active_session_id VARCHAR(120),
    session_started_at TIMESTAMP,
    last_seen_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    receiver_id INTEGER NOT NULL REFERENCES users(id),
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    concept VARCHAR(250) NOT NULL,
    origin_ip VARCHAR(80),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(80) NOT NULL,
    detail TEXT,
    origin_ip VARCHAR(80),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
