"use client";
import { CSSProperties, FormEvent, useEffect, useRef, useState } from "react";
import type { Branding } from "./branding";
import type { Session } from "./management";
type Settings = { branding: Branding; defaults: Branding; setupNeeded: boolean };
export default function BrandSettings({ session, online, onSaved }: { session: Session; online: boolean; onSaved: (branding: Branding) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(true);
  const savedCallback = useRef(onSaved);
  useEffect(() => { savedCallback.current = onSaved; }, [onSaved]);
  useEffect(() => { mounted.current = true; heading.current?.focus(); return () => { mounted.current = false; }; }, []);
  const [value, setValue] = useState<Settings | null>(null);
  const [colors, setColors] = useState({ primary: "#123c35", accent: "#e2c497", surface: "#faf8f2" });
  const [file, setFile] = useState<File | null>(null), [preview, setPreview] = useState<string | null>(null);
  const [remove, setRemove] = useState(false), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/restaurant/branding", { headers: { Authorization: `Bearer ${session.accessToken}` }, cache: "no-store", signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error("No se pudo cargar la configuración"); const data: Settings = await response.json(); setValue(data); setColors(data.branding); })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Revisa tu conexión"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [session.restaurant.id]);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function save(event: FormEvent) {
    event.preventDefault(); if (!value || busy || !online) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const body = new FormData();
      for (const [key,color] of Object.entries({primary:colors.primary,accent:colors.accent,surface:colors.surface})) body.append(key,color);
      body.append("logoAction", file ? "replace" : remove ? "remove" : "keep");
      if (file) body.append("logo", file);
      const response = await fetch("/api/restaurant/branding", { method: "POST", headers: { Authorization: `Bearer ${session.accessToken}` }, body });
      const data = await response.json();
      if (!mounted.current) return;
      if (!response.ok) throw new Error(typeof data.message === "string" ? data.message : "Revisa el logo y los colores seleccionados");
      setValue(data); setColors(data.branding); setFile(null); if (fileInput.current) fileInput.current.value = ""; setRemove(false); savedCallback.current(data.branding);
      setNotice("Identidad guardada. Ya se aplica al panel y a los nuevos tickets y reportes.");
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "No se pudo guardar la identidad"); }
    finally { if (mounted.current) setBusy(false); }
  }
  const logo = preview ?? (remove ? null : value?.branding.logo);
  return <section className="brand-settings">
    <h2 ref={heading} tabIndex={-1}>Identidad del restaurante</h2>
    <p>Haz que {session.restaurant.name} se sienta propio. Sólo el propietario y el gerente pueden cambiar esta identidad.</p>
    {loading && <p role="status">Cargando configuración…</p>}
    {error && <p className="alert" role="alert">{error}</p>}
    {notice && <p className="success" role="status">{notice}</p>}
    {value && <div className="brand-settings-grid">
      <form className="card" onSubmit={save}>
        <h3>Logo y colores</h3>
        <label>Subir logo
          <input ref={fileInput} type="file" accept="image/png,image/jpeg" disabled={busy || !online} onChange={event => {
            const next = event.target.files?.[0]; if (!next) return;
            setError(""); setNotice("");
            if (!["image/png","image/jpeg"].includes(next.type) || next.size > 512 * 1024) { setError("Elige un PNG o JPG de hasta 512 KB"); event.target.value = ""; return; }
            setFile(next); setRemove(false);
          }} />
          <small>PNG o JPG, máximo 512 KB, entre 128 y 2048 px por lado. Recomendado: cuadrado; PNG transparente si lo tienes. No se aceptan SVG ni GIF; el logo se guarda como imagen estática.</small>
        </label>
        <div className="actions"><button type="button" className="secondary" disabled={busy || !online} onClick={() => { setFile(null); if (fileInput.current) fileInput.current.value = ""; setRemove(true); }}>Quitar logo</button></div>
        {([["primary","Color principal"],["accent","Color de acento"],["surface","Fondo claro"]] as const).map(([key,label]) => <label key={key}>{label}<div className="brand-color-input"><input aria-label={label} type="color" value={colors[key]} disabled={busy || !online} onChange={e => setColors({...colors,[key]:e.target.value})} /><span>{colors[key].toUpperCase()}</span></div></label>)}
        <p><small>Usa un principal oscuro y un fondo claro. Validamos el contraste al guardar; los estados de cocina, pagos y alertas conservan sus colores.</small></p>
        <button className="secondary" type="button" disabled={busy || !online} onClick={() => setColors(value.defaults)}>Restablecer colores sugeridos</button>
        <button type="submit" disabled={busy || !online}>{busy ? "Guardando…" : "Guardar identidad"}</button>
      </form>
      <aside className="card brand-preview" style={{ "--preview-primary": colors.primary, "--preview-accent": colors.accent, "--preview-surface": colors.surface } as CSSProperties}>
        <h3>Vista previa</h3><p>Revisa tu combinación antes de guardar.</p>
        <div className="brand-preview-header">{logo ? <img src={logo} alt={`Vista previa del logo de ${session.restaurant.name}`} width={88} height={88} /> : <span className="brand-logo-placeholder" aria-hidden="true">{session.restaurant.name.slice(0,1)}</span>}<strong>{session.restaurant.name}</strong></div>
        <div className="brand-preview-panel"><strong>Tu restaurante, en sincronía</strong><p>Mesas, comandas y ventas en un solo lugar.</p><span className="brand-preview-button">Acción principal</span></div>
        <p><small>La marca se aplica a todos los usuarios de este restaurante, a los tickets digitales/PDF y a los colores del Excel. La página de acceso mantiene la identidad Tavixo.</small></p>
      </aside>
    </div>}
  </section>;
}
