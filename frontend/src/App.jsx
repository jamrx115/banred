import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BarChart, Bar, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { LogOut, Send, ShieldCheck, Users, Wallet, Wifi, WifiOff } from 'lucide-react';
import './style.css';

const runtimeConfig = window.__APP_CONFIG__ || {};
const API = runtimeConfig.API_URL || import.meta.env.VITE_API_URL || window.location.origin.replace(':5173', ':8000');
const WS = runtimeConfig.WS_URL || import.meta.env.VITE_WS_URL || API.replace(/^http/, 'ws') + '/ws';

function money(value) { return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value || 0)); }
function initials(user) { return `${user?.first_name?.[0] || user?.username?.[0] || '?'}${user?.last_name?.[0] || ''}`.toUpperCase(); }
async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { if (res.status === 401) localStorage.removeItem('token'); throw new Error(data.detail || 'Error en la solicitud'); }
  return data;
}
function Avatar({ user, size = 42 }) { return <div className="avatar" style={{ width: size, height: size, background: user?.avatar_color || '#2563eb' }}>{initials(user)}</div>; }
function ConfirmModal({ transfer, receiver, onCancel, onConfirm }) {
  if (!receiver) return null;
  return <div className="modal-backdrop"><div className="modal card"><h2>Confirmar transferencia</h2><p>Vas a enviar:</p><h1>{money(transfer.amount)}</h1><p>a <b>{receiver.first_name} {receiver.last_name}</b> ({receiver.username})</p><p>Concepto: <b>{transfer.concept}</b></p><div className="modal-actions"><button className="secondary" onClick={onCancel}>Cancelar</button><button onClick={onConfirm}>Confirmar envío</button></div></div></div>;
}
function Auth({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', username: '', password: '' });
  const [error, setError] = useState('');
  const update = e => setForm({ ...form, [e.target.name]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setError('');
    try {
      const path = mode === 'register' ? '/auth/register' : '/auth/login';
      const body = mode === 'register' ? form : { username: form.username, password: form.password };
      const login = await request(path, { method: 'POST', body: JSON.stringify(body) });
      localStorage.setItem('token', login.access_token); onLogin();
    } catch (err) { setError(err.message); }
  }
  return <div className="auth-page"><form className="card auth-card" onSubmit={submit}><div className="brand">Demo Banco Digital</div><h1>{mode === 'login' ? 'Ingreso seguro' : 'Crear usuario'}</h1><p>Demo con sesión única, WebSockets y dashboard en vivo.</p>{mode === 'register' && <><input name="first_name" placeholder="Nombre" value={form.first_name} onChange={update} required/><input name="last_name" placeholder="Apellido" value={form.last_name} onChange={update} required/><input name="email" type="email" placeholder="Correo" value={form.email} onChange={update} required/></>}<input name="username" placeholder="Usuario" value={form.username} onChange={update} required/><input name="password" type="password" placeholder="Contraseña" value={form.password} onChange={update} required/>{error && <div className="error">{error}</div>}<button>{mode === 'login' ? 'Entrar' : 'Registrarme'}</button><button type="button" className="link" onClick={() => { setError(''); setMode(mode === 'login' ? 'register' : 'login'); }}>{mode === 'login' ? 'Crear usuario nuevo' : 'Ya tengo usuario'}</button></form></div>;
}
function Dashboard({ onLogout }) {
  const [me, setMe] = useState(null), [users, setUsers] = useState([]), [txs, setTxs] = useState([]), [dash, setDash] = useState(null), [audit, setAudit] = useState([]);
  const [transfer, setTransfer] = useState({ receiver_id: '', amount: '', concept: '' }), [confirming, setConfirming] = useState(false), [message, setMessage] = useState(''), [wsConnected, setWsConnected] = useState(false);
  const selectedReceiver = useMemo(() => users.find(u => String(u.id) === String(transfer.receiver_id)), [users, transfer.receiver_id]);
  async function load() {
    try { const [meData, usersData, txData, dashData, auditData] = await Promise.all([request('/me'), request('/users'), request('/transactions'), request('/dashboard'), request('/audit')]); setMe(meData); setUsers(usersData); setTxs(txData); setDash(dashData); setAudit(auditData); }
    catch (err) { setMessage(err.message); if (err.message.includes('Sesión inválida') || err.message.includes('Token')) { localStorage.removeItem('token'); onLogout(); } }
  }
  useEffect(() => { load(); const socket = new WebSocket(WS); socket.onopen = () => setWsConnected(true); socket.onclose = () => setWsConnected(false); socket.onerror = () => setWsConnected(false); socket.onmessage = () => load(); const heartbeat = setInterval(() => { if (socket.readyState === WebSocket.OPEN) socket.send('ping'); }, 20000); const fallback = setInterval(load, 15000); return () => { clearInterval(heartbeat); clearInterval(fallback); socket.close(); }; }, []);
  function submitTransfer(e) { e.preventDefault(); setMessage(''); setConfirming(true); }
  async function confirmTransfer() { try { await request('/transactions', { method: 'POST', body: JSON.stringify({ receiver_id: Number(transfer.receiver_id), amount: Number(transfer.amount), concept: transfer.concept }) }); setTransfer({ receiver_id: '', amount: '', concept: '' }); setConfirming(false); setMessage('Transferencia realizada correctamente'); await load(); } catch (err) { setMessage(err.message); setConfirming(false); } }
  async function logout() { await request('/auth/logout', { method: 'POST' }).catch(() => {}); localStorage.removeItem('token'); onLogout(); }
  if (!me || !dash) return <div className="loading">Cargando aplicación...</div>;
  const availableUsers = users.filter(u => u.id !== me.id);
  return <main className="container"><header className="topbar"><div className="profile"><Avatar user={me} size={54}/><div><h1>Panel de Transacciones</h1><p>Usuario: <b>{me.username}</b></p></div></div><div className="header-actions"><span className={wsConnected ? 'ws ok' : 'ws bad'}>{wsConnected ? <Wifi size={16}/> : <WifiOff size={16}/>} {wsConnected ? 'WebSocket activo' : 'WebSocket desconectado'}</span><button className="logout" onClick={logout}><LogOut size={18}/> Salir</button></div></header>{message && <div className="notice">{message}</div>}<section className="grid"><div className="card stat"><Wallet/><span>Saldo actual</span><strong>{money(dash.balance)}</strong></div><div className="card stat"><Send/><span>Dinero enviado</span><strong>{money(dash.sent_total)}</strong></div><div className="card stat"><Wallet/><span>Dinero recibido</span><strong>{money(dash.received_total)}</strong></div><div className="card stat"><Users/><span>Transacciones</span><strong>{dash.transaction_count}</strong></div></section><section className="columns"><div className="card"><h2>Enviar dinero</h2><form onSubmit={submitTransfer}><select value={transfer.receiver_id} onChange={e => setTransfer({...transfer, receiver_id: e.target.value})} required><option value="">Seleccione receptor</option>{availableUsers.map(u => <option key={u.id} value={u.id}>{u.username} - {u.first_name} {u.last_name}</option>)}</select><input type="number" min="1" placeholder="Monto" value={transfer.amount} onChange={e => setTransfer({...transfer, amount: e.target.value})} required/><input placeholder="Concepto" value={transfer.concept} onChange={e => setTransfer({...transfer, concept: e.target.value})} required/><button>Enviar</button></form></div><div className="card"><h2>Top 5 usuarios con mayor saldo</h2><div className="user-list">{dash.top_users.map(u => <div className="user-row" key={u.id}><Avatar user={u}/><div className="grow"><b>{u.username}</b><small>{u.first_name} {u.last_name}</small></div><strong>{money(u.balance)}</strong></div>)}</div></div></section><section className="columns"><div className="card"><h2>Gráfico vivo de transacciones</h2><div className="chart"><ResponsiveContainer width="100%" height={260}><BarChart data={dash.chart}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip formatter={(v, name) => name === 'amount' ? money(v) : v}/><Bar dataKey="count" name="Cantidad"/></BarChart></ResponsiveContainer></div></div><div className="card"><h2>Usuarios registrados</h2><div className="user-list">{users.map(u => <div className="user-row" key={u.id}><Avatar user={u}/><div className="grow"><b>{u.username}</b><small>{u.first_name} {u.last_name}</small></div><span className={u.is_online ? 'online' : 'offline'}>{u.is_online ? 'Conectado' : 'Desconectado'}</span></div>)}</div></div></section><section className="card"><h2>Log de transacciones</h2><div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Envía</th><th>Recibe</th><th>Monto</th><th>Concepto</th><th>IP origen</th></tr></thead><tbody>{txs.map(t => <tr key={t.id}><td>{new Date(t.created_at).toLocaleString('es-CO')}</td><td>{t.sender}</td><td>{t.receiver}</td><td>{money(t.amount)}</td><td>{t.concept}</td><td>{t.origin_ip || '-'}</td></tr>)}</tbody></table></div></section><section className="card"><h2><ShieldCheck size={20}/> Auditoría</h2><div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Acción</th><th>Detalle</th><th>IP origen</th></tr></thead><tbody>{audit.map(a => <tr key={a.id}><td>{new Date(a.created_at).toLocaleString('es-CO')}</td><td>{a.action}</td><td>{a.detail}</td><td>{a.origin_ip || '-'}</td></tr>)}</tbody></table></div></section>{confirming && <ConfirmModal transfer={transfer} receiver={selectedReceiver} onCancel={() => setConfirming(false)} onConfirm={confirmTransfer}/>}</main>;
}
function App() { const [logged, setLogged] = useState(Boolean(localStorage.getItem('token'))); return logged ? <Dashboard onLogout={() => setLogged(false)}/> : <Auth onLogin={() => setLogged(true)}/>; }
createRoot(document.getElementById('root')).render(<App/>);
