"use client";
import { CSSProperties, FormEvent, useEffect, useState } from "react";
import Management, { Session } from "./management";
export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [online, setOnline] = useState(true);
  async function refresh(): Promise<Session | null> {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "same-origin",
    });
    if (!response.ok) {
      setSession(null);
      return null;
    }
    const value: Session = await response.json();
    setSession(value);
    return value;
  }
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    refresh()
      .catch(() => {})
      .finally(() => setReady(true));
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(
      () => {
        refresh().catch(() =>
          setError("No se pudo renovar la sesión. Revisa tu conexión."),
        );
      },
      (session.expiresIn - 60) * 1000,
    );
    return () => clearTimeout(timer);
  }, [session]);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.get("email"),
          password: data.get("password"),
          restaurantSlug: data.get("restaurantSlug"),
        }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? "Demasiados intentos. Espera un minuto."
            : "Revisa tus credenciales y el restaurante.",
        );
      const value: Session = await response.json();
      setSession(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo conectar");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("No se pudo cerrar la sesión");
      setSession(null);
      setNotice("");
    } catch {
      setError(
        "No se pudo cerrar la sesión. Reintenta cuando tengas conexión.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={session?.restaurant.branding ? "restaurant-branded" : undefined}
      style={session?.restaurant.branding ? {
        "--brand-primary": session.restaurant.branding.primary,
        "--brand-accent": session.restaurant.branding.accent,
        "--brand-surface": session.restaurant.branding.surface,
      } as CSSProperties : undefined}>
      <header>
        {session?.restaurant.branding ? (
          <a className="restaurant-identity" href="/">
            {session.restaurant.branding.logo && <img src={session.restaurant.branding.logo} alt={`Logo de ${session.restaurant.name}`} width={88} height={88} />}
            <span><strong>{session.restaurant.name}</strong><small>Tu restaurante, en sincronía</small></span>
          </a>
        ) : <><a className="brand" href="/">tavixo<span>●</span></a><span className="tag">Tu restaurante, en sincronía</span></> }
        {session && (
          <button className="secondary" onClick={logout} disabled={busy}>
            Cerrar sesión
          </button>
        )}
      </header>
      {!online && (
        <p role="status" className="alert">
          Sin conexión. Vuelve a conectarte para operar.
        </p>
      )}
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!ready ? (
        <p>Cargando sesión…</p>
      ) : !session ? (
        <section className="login">
          <div>
            <p className="eyebrow">TAVIXO MANAGER</p>
            <h1>
              Todo empieza
              <br />
              en tu restaurante.
            </h1>
            <p className="intro">
              Un solo espacio para administrar tu operación y mantener a tu
              equipo en sincronía.
            </p>
            <div className="pilot">
              Cada restaurante, su propio espacio.
              <br />
              <strong>Tu operación, en sincronía.</strong>
            </div>
          </div>
          <form onSubmit={login} className="card">
            <h2>Bienvenido</h2>
            <p>Ingresa con tu cuenta de Tavixo.</p>
            <label>
              Restaurante
              <input
                name="restaurantSlug"
                placeholder="Ej. mi-restaurante"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                maxLength={80}
              />
            </label>
            <label>
              Correo
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                maxLength={254}
              />
            </label>
            <label>
              Contraseña
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
              />
            </label>
            <button disabled={busy || !online}>
              {busy ? "Ingresando…" : "Entrar a mi restaurante →"}
            </button>
          </form>
        </section>
      ) : (
        <Management
          session={session}
          online={online}
          onSession={setSession}
          onSignedOut={() => {
            setSession(null);
            setNotice(
              "Contraseña actualizada. Inicia sesión con tu nueva contraseña.",
            );
          }}
        />
      )}
      <footer>Tecnología Tavixo · Restaurant Operating System</footer>
    </main>
  );
}
