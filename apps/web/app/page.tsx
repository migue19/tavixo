"use client";
import { FormEvent, useEffect, useState } from 'react';
type Session = { accessToken: string; expiresIn: number; user: { name: string; email: string; role: string }; restaurant: { id: string; name: string; slug: string } };
type Member = { id: string; role: string; user: { name: string; email: string } };
const labels: Record<string, string> = { OWNER: 'Propietario', MANAGER: 'Gerente', CASHIER: 'Caja', WAITER: 'Mesero', KITCHEN: 'Cocina' };
export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState('');
  const [online, setOnline] = useState(true);
  async function refresh(): Promise<Session | null> {
    const response = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
    if (!response.ok) { setSession(null); return null; }
    const value: Session = await response.json(); setSession(value); setName(value.restaurant.name); return value;
  }
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    refresh().catch(() => {}).finally(() => setReady(true));
    const update = () => setOnline(navigator.onLine); update();
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => { refresh().catch(() => setError('No se pudo renovar la sesión. Revisa tu conexión.')); }, (session.expiresIn - 60) * 1000);
    return () => clearTimeout(timer);
  }, [session]);
  useEffect(() => {
    setMembers([]);
    if (!session || !['OWNER', 'MANAGER'].includes(session.user.role)) return;
    let cancelled = false;
    fetch('/api/restaurant/members', { headers: { Authorization: `Bearer ${session.accessToken}` } }).then(async response => {
      if (!response.ok) throw new Error('No se pudo cargar el equipo');
      const values: Member[] = await response.json(); if (!cancelled) setMembers(values);
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [session]);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: data.get('email'), password: data.get('password'), restaurantSlug: data.get('restaurantSlug') }) });
      if (!response.ok) throw new Error(response.status === 429 ? 'Demasiados intentos. Espera un minuto.' : 'Revisa tus credenciales y el restaurante.');
      const value: Session = await response.json(); setSession(value); setName(value.restaurant.name);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo conectar'); } finally { setBusy(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!session) return; setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/restaurant', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` }, body: JSON.stringify({ name }) });
      if (!response.ok) throw new Error('No se pudo guardar. Verifica tu sesión y permisos.');
      const restaurant = await response.json(); setSession({ ...session, restaurant }); setNotice('Nombre actualizado.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Error de conexión'); } finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError('');
    try { const response = await fetch('/api/auth/logout', { method: 'POST' }); if (!response.ok) throw new Error('No se pudo cerrar la sesión'); setSession(null); setMembers([]); setNotice(''); }
    catch { setError('No se pudo cerrar la sesión. Reintenta cuando tengas conexión.'); }
    finally { setBusy(false); }
  }
  return <main><header><a className="brand" href="/">tavixo<span>●</span></a><span className="tag">Tu restaurante, en sincronía</span>{session && <button className="secondary" onClick={logout} disabled={busy}>Cerrar sesión</button>}</header>
    {!online && <p role="status" className="alert">Sin conexión. Vuelve a conectarte para operar.</p>}
    {error && <p role="alert" className="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!ready ? <p>Cargando sesión…</p> : !session ? <section className="login"><div><p className="eyebrow">TAVIXO MANAGER</p><h1>Todo empieza<br/>en tu restaurante.</h1><p className="intro">Un solo espacio para administrar tu operación y mantener a tu equipo en sincronía.</p><div className="pilot">Primer restaurante<br/><strong>Birria El Cachanilla</strong></div></div><form onSubmit={login} className="card"><h2>Bienvenido</h2><p>Ingresa con tu cuenta de Tavixo.</p><label>Restaurante<input name="restaurantSlug" defaultValue="birria-el-cachanilla" required maxLength={80}/></label><label>Correo<input name="email" type="email" autoComplete="username" required maxLength={254}/></label><label>Contraseña<input name="password" type="password" autoComplete="current-password" required maxLength={128}/></label><button disabled={busy || !online}>{busy ? 'Ingresando…' : 'Entrar a mi restaurante →'}</button></form></section> : <section><p className="eyebrow">TU ESPACIO DE TRABAJO</p><h1>{session.restaurant.name}</h1><p className="intro">Hola, {session.user.name}. Tu cuenta tiene el rol de {labels[session.user.role]}.</p><div className="grid"><article className="card"><h2>Restaurante</h2><p>{session.restaurant.slug}</p>{['OWNER', 'MANAGER'].includes(session.user.role) ? <form onSubmit={save}><label>Nombre del restaurante<input value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={120}/></label><button disabled={busy || !online}>Guardar cambios</button></form> : <p>Consulta disponible. Tu gerente administra la configuración.</p>}</article>{['OWNER', 'MANAGER'].includes(session.user.role) && <article className="card"><h2>Tu equipo</h2><ul>{members.map(member => <li key={member.id}><strong>{member.user.name}</strong><br/><small>{member.user.email} · {labels[member.role]}</small></li>)}</ul></article>}<article className="card"><h2>Base lista</h2><p>Acceso seguro y administración del restaurante disponibles.</p><p>Mesas, comandas y cocina llegarán en los siguientes sprints.</p></article></div></section>}
    <footer>Tavixo · Restaurant Operating System</footer></main>;
}
