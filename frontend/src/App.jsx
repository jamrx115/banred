import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  LogOut,
  Send,
  ShieldCheck,
  Users,
  Wallet,
  Wifi,
  WifiOff,
} from 'lucide-react';
import './style.css';

const runtimeConfig = window.__APP_CONFIG__ || {};
const API = runtimeConfig.VITE_API_URL || import.meta.env.VITE_API_URL || window.location.origin.replace(':5173', ':8000');
const WS = runtimeConfig.VITE_WS_URL || import.meta.env.VITE_WS_URL || API.replace(/^http/, 'ws') + '/ws';

function money(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function initials(user) {
  return `${user?.first_name?.[0] || user?.username?.[0] || '?'}${user?.last_name?.[0] || ''}`.toUpperCase();
}

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) localStorage.removeItem('token');
    throw new Error(data.detail || 'No pudimos completar la solicitud.');
  }
  return data;
}

function Avatar({ user, size = 42 }) {
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, background: user?.avatar_color || '#53eb25' }}
      aria-hidden="true"
    >
      {initials(user)}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="empty-state">
      <Clock3 size={20} />
      <b>{title}</b>
      <span>{text}</span>
    </div>
  );
}

function ConfirmModal({ transfer, receiver, onCancel, onConfirm }) {
  if (!receiver) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal card">
        <div className="modal-icon">
          <Send size={22} />
        </div>
        <h2>Confirma tu envío</h2>
        <p>Estás a un paso de transferir</p>
        <h1>{money(transfer.amount)}</h1>
        <p>
          a <b>{receiver.first_name} {receiver.last_name}</b> ({receiver.username})
        </p>
        <div className="confirm-detail">
          <span>Concepto</span>
          <b>{transfer.concept}</b>
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onCancel}>Revisar</button>
          <button type="button" onClick={onConfirm}>
            <CheckCircle2 size={18} />
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function Auth({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetForm, setResetForm] = useState({
    username_or_email: '',
    token: '',
    new_password: '',
  });

  const isRegister = mode === 'register';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const updateReset = (event) => setResetForm({ ...resetForm, [event.target.name]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      const path = isRegister ? '/auth/register' : '/auth/login';
      const body = isRegister ? form : { username: form.username, password: form.password };
      const login = await request(path, { method: 'POST', body: JSON.stringify(body) });
      localStorage.setItem('token', login.access_token);
      onLogin();
    } catch (err) {
      setError(err.message);
    }
  }

  async function requestPasswordReset(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setResetToken('');
    try {
      const response = await request('/auth/password/forgot', {
        method: 'POST',
        body: JSON.stringify({ username_or_email: resetForm.username_or_email }),
      });
      setNotice(response.message);
      if (response.reset_token) {
        setResetToken(response.reset_token);
        setResetForm({ ...resetForm, token: response.reset_token });
      }
      setMode('reset');
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmPasswordReset(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      const response = await request('/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify({
          token: resetForm.token,
          new_password: resetForm.new_password,
        }),
      });
      setNotice(response.message);
      setResetToken('');
      setResetForm({ username_or_email: '', token: '', new_password: '' });
      setMode('login');
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleMode() {
    setError('');
    setNotice('');
    setMode(isRegister ? 'login' : 'register');
  }

  function goToLogin() {
    setError('');
    setNotice('');
    setMode('login');
  }

  const authTitle = isForgot ? 'Recuperar contraseña' : isReset ? 'Crear nueva contraseña' : isRegister ? 'Crea tu cuenta' : 'Bienvenido de nuevo';
  const authText = isForgot ? 'Escribe tu usuario o correo para generar un codigo temporal.' : isReset ? 'Usa el codigo de recuperacion y define una nueva clave.' : isRegister ? 'Completa los datos para empezar con saldo demo.' : 'Ingresa con tu usuario para continuar.';

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <div className="welcome-panel">
          <span className="eyebrow">Banred demo</span>
          <h1>Transacciones claras, rápidas y en vivo.</h1>
          <p>
            Gestiona usuarios, saldos y transferencias con una experiencia sencilla para probar el flujo completo.
          </p>
          <div className="welcome-list">
            <span><ShieldCheck size={18} /> Sesión única por usuario</span>
            <span><Wifi size={18} /> Actualización en tiempo real</span>
            <span><Wallet size={18} /> Saldo inicial para practicar</span>
          </div>
        </div>

        <form className="card auth-card" onSubmit={isForgot ? requestPasswordReset : isReset ? confirmPasswordReset : submit}>
          <div>
            <div className="brand">Banco Digital</div>
            <h2>{authTitle}</h2>
            <p>{authText}</p>
          </div>

          {!isForgot && !isReset && isRegister && (
            <div className="split-fields">
              <Field label="Nombre">
                <input name="first_name" value={form.first_name} onChange={update} required />
              </Field>
              <Field label="Apellido">
                <input name="last_name" value={form.last_name} onChange={update} required />
              </Field>
            </div>
          )}

          {!isForgot && !isReset && isRegister && (
            <Field label="Correo">
              <input name="email" type="email" value={form.email} onChange={update} required />
            </Field>
          )}

          {isForgot && (
            <Field label="Usuario o correo">
              <input name="username_or_email" value={resetForm.username_or_email} onChange={updateReset} required />
            </Field>
          )}

          {isReset && (
            <>
              {resetToken && (
                <div className="demo-token">
                  <span>Codigo demo</span>
                  <code>{resetToken}</code>
                </div>
              )}
              <Field label="Codigo de recuperacion">
                <input name="token" value={resetForm.token} onChange={updateReset} required />
              </Field>
              <Field label="Nueva contraseña">
                <input name="new_password" type="password" autoComplete="new-password" value={resetForm.new_password} onChange={updateReset} required />
              </Field>
            </>
          )}

          {!isForgot && !isReset && (
            <>
              <Field label="Usuario">
            <input name="username" autoComplete="username" value={form.username} onChange={update} required />
          </Field>
          <Field label="Contraseña">
            <input name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} value={form.password} onChange={update} required />
          </Field>
            </>
          )}

          {error && <div className="error">{error}</div>}
          {notice && <div className="notice success">{notice}</div>}

          <button type="submit">{isForgot ? 'Generar codigo' : isReset ? 'Cambiar contraseña' : isRegister ? 'Crear cuenta' : 'Entrar'}</button>
          {!isForgot && !isReset && (
            <div className="auth-links">
              <button type="button" className="link" onClick={toggleMode}>
                {isRegister ? 'Ya tengo una cuenta' : 'Crear una cuenta nueva'}
              </button>
              {!isRegister && (
                <button type="button" className="link" onClick={() => setMode('forgot')}>
                  Olvide mi contraseña
                </button>
              )}
            </div>
          )}

          {(isForgot || isReset) && (
            <div className="auth-links">
              {isForgot && (
                <button type="button" className="link" onClick={() => setMode('reset')}>
                  Ya tengo un codigo
                </button>
              )}
              <button type="button" className="link" onClick={goToLogin}>
                Volver al ingreso
              </button>
            </div>
          )}
        </form>
      </section>
    </main>
  );
}

function Dashboard({ onLogout }) {
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [txs, setTxs] = useState([]);
  const [dash, setDash] = useState(null);
  const [audit, setAudit] = useState([]);
  const [transfer, setTransfer] = useState({ receiver_id: '', amount: '', concept: '' });
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);

  const selectedReceiver = useMemo(
    () => users.find((user) => String(user.id) === String(transfer.receiver_id)),
    [users, transfer.receiver_id],
  );
  const availableUsers = users.filter((user) => user.id !== me?.id);
  const lastTransactions = txs.slice(0, 5);

  async function load() {
    try {
      const [meData, usersData, txData, dashData, auditData] = await Promise.all([
        request('/me'),
        request('/users'),
        request('/transactions'),
        request('/dashboard'),
        request('/audit'),
      ]);
      setMe(meData);
      setUsers(usersData);
      setTxs(txData);
      setDash(dashData);
      setAudit(auditData);
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
      if (err.message.includes('Ses') || err.message.includes('Token')) {
        localStorage.removeItem('token');
        onLogout();
      }
    }
  }

  useEffect(() => {
    load();
    const socket = new WebSocket(WS);
    socket.onopen = () => setWsConnected(true);
    socket.onclose = () => setWsConnected(false);
    socket.onerror = () => setWsConnected(false);
    socket.onmessage = () => load();
    const heartbeat = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) socket.send('ping');
    }, 20000);
    const fallback = setInterval(load, 15000);

    return () => {
      clearInterval(heartbeat);
      clearInterval(fallback);
      socket.close();
    };
  }, []);

  function submitTransfer(event) {
    event.preventDefault();
    setNotice(null);
    setConfirming(true);
  }

  async function confirmTransfer() {
    try {
      await request('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          receiver_id: Number(transfer.receiver_id),
          amount: Number(transfer.amount),
          concept: transfer.concept,
        }),
      });
      setTransfer({ receiver_id: '', amount: '', concept: '' });
      setConfirming(false);
      setNotice({ type: 'success', text: 'Transferencia realizada correctamente.' });
      await load();
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
      setConfirming(false);
    }
  }

  async function logout() {
    await request('/auth/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem('token');
    onLogout();
  }

  if (!me || !dash) {
    return <div className="loading">Preparando tu panel...</div>;
  }

  return (
    <main className="container">
      <header className="topbar">
        <div className="profile">
          <Avatar user={me} size={54} />
          <div>
            <span className="eyebrow">Hola, {me.first_name}</span>
            <h1>Tu panel de transacciones</h1>
            <p>Usuario <b>{me.username}</b></p>
          </div>
        </div>
        <div className="header-actions">
          <span className={wsConnected ? 'ws ok' : 'ws bad'}>
            {wsConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
            {wsConnected ? 'En vivo' : 'Reconectando'}
          </span>
          <button type="button" className="logout" onClick={logout}>
            <LogOut size={18} />
            Salir
          </button>
        </div>
      </header>

      {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

      <section className="summary">
        <article className="balance-card">
          <span>Saldo disponible</span>
          <strong>{money(dash.balance)}</strong>
          <p>Listo para hacer transferencias de prueba.</p>
        </article>
        <article className="card stat">
          <ArrowUpRight />
          <span>Enviado</span>
          <strong>{money(dash.sent_total)}</strong>
        </article>
        <article className="card stat">
          <ArrowDownLeft />
          <span>Recibido</span>
          <strong>{money(dash.received_total)}</strong>
        </article>
        <article className="card stat">
          <Users />
          <span>Movimientos</span>
          <strong>{dash.transaction_count}</strong>
        </article>
      </section>

      <section className="workspace">
        <article className="card transfer-card">
          <div className="section-title">
            <div>
              <h2>Enviar dinero</h2>
              <p>Elige un usuario, revisa el resumen y confirma.</p>
            </div>
            <Send size={22} />
          </div>
          <form onSubmit={submitTransfer}>
            <Field label="Destinatario">
              <select value={transfer.receiver_id} onChange={(event) => setTransfer({ ...transfer, receiver_id: event.target.value })} required>
                <option value="">Selecciona una persona</option>
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name} - @{user.username}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Monto">
              <input type="number" min="1" placeholder="Ej: 50000" value={transfer.amount} onChange={(event) => setTransfer({ ...transfer, amount: event.target.value })} required />
            </Field>
            <Field label="Concepto">
              <input placeholder="Ej: almuerzo, préstamo, aporte" value={transfer.concept} onChange={(event) => setTransfer({ ...transfer, concept: event.target.value })} required />
            </Field>

            {selectedReceiver && (
              <div className="receiver-preview">
                <Avatar user={selectedReceiver} />
                <div>
                  <span>Enviarás a</span>
                  <b>{selectedReceiver.first_name} {selectedReceiver.last_name}</b>
                </div>
              </div>
            )}

            <button type="submit">
              <Send size={18} />
              Revisar envío
            </button>
          </form>
        </article>

        <article className="card">
          <div className="section-title">
            <div>
              <h2>Actividad reciente</h2>
              <p>Últimos movimientos de tu cuenta.</p>
            </div>
            <Clock3 size={22} />
          </div>
          {lastTransactions.length === 0 ? (
            <EmptyState title="Sin movimientos todavía" text="Cuando envíes o recibas dinero, aparecerá aquí." />
          ) : (
            <div className="activity-list">
              {lastTransactions.map((tx) => {
                const sent = tx.sender_id === me.id;
                return (
                  <div className="activity-row" key={tx.id}>
                    <span className={sent ? 'movement sent' : 'movement received'}>
                      {sent ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                    </span>
                    <div className="grow">
                      <b>{sent ? `A ${tx.receiver}` : `De ${tx.sender}`}</b>
                      <small>{tx.concept}</small>
                    </div>
                    <strong>{sent ? '-' : '+'}{money(tx.amount)}</strong>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </section>

      <section className="columns">
        <article className="card">
          <div className="section-title">
            <div>
              <h2>Transacciones por día</h2>
              <p>Resumen visual de actividad.</p>
            </div>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dash.chart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value, name) => (name === 'amount' ? money(value) : value)} />
                <Bar dataKey="count" name="Cantidad" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card">
          <div className="section-title">
            <div>
              <h2>Usuarios</h2>
              <p>{users.filter((user) => user.is_online).length} conectados ahora.</p>
            </div>
          </div>
          <div className="user-list">
            {users.map((user) => (
              <div className="user-row" key={user.id}>
                <Avatar user={user} />
                <div className="grow">
                  <b>{user.first_name} {user.last_name}</b>
                  <small>@{user.username}</small>
                </div>
                <span className={user.is_online ? 'online' : 'offline'}>{user.is_online ? 'Activo' : 'Fuera'}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="columns single">
        <article className="card">
          <div className="section-title">
            <div>
              <h2><ShieldCheck size={20} /> Auditoría</h2>
              <p>Últimos eventos del sistema.</p>
            </div>
          </div>
          <div className="audit-list">
            {audit.slice(0, 5).map((item) => (
              <div className="audit-row" key={item.id}>
                <b>{item.action}</b>
                <span>{item.detail}</span>
                <small>{new Date(item.created_at).toLocaleString('es-CO')} - {item.origin_ip || 'Sin IP'}</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="card">
        <div className="section-title">
          <div>
            <h2>Historial completo</h2>
            <p>Detalle de transferencias asociadas a tu usuario.</p>
          </div>
        </div>
        {txs.length === 0 ? (
          <EmptyState title="Aún no hay transferencias" text="Haz tu primer envío para llenar este historial." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Envía</th>
                  <th>Recibe</th>
                  <th>Monto</th>
                  <th>Concepto</th>
                  <th>IP origen</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((tx) => (
                  <tr key={tx.id}>
                    <td>{new Date(tx.created_at).toLocaleString('es-CO')}</td>
                    <td>{tx.sender}</td>
                    <td>{tx.receiver}</td>
                    <td>{money(tx.amount)}</td>
                    <td>{tx.concept}</td>
                    <td>{tx.origin_ip || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {confirming && (
        <ConfirmModal
          transfer={transfer}
          receiver={selectedReceiver}
          onCancel={() => setConfirming(false)}
          onConfirm={confirmTransfer}
        />
      )}
    </main>
  );
}

function App() {
  const [logged, setLogged] = useState(Boolean(localStorage.getItem('token')));
  return logged ? <Dashboard onLogout={() => setLogged(false)} /> : <Auth onLogin={() => setLogged(true)} />;
}

createRoot(document.getElementById('root')).render(<App />);
