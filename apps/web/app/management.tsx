"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Catalog from "./catalog";
import Orders from "./orders";
import Cash from "./cash";
import Shifts from "./shifts";
import Reports from "./reports";
export type Session = {
  accessToken: string;
  expiresIn: number;
  user: { name: string; email: string; role: string; branchId?: string | null };
  restaurant: { id: string; name: string; slug: string };
};
type Branch = { id: string; name: string; address: string; active: boolean };
type Member = {
  id: string;
  role: string;
  active: boolean;
  branchId: string | null;
  branch: { name: string; active: boolean } | null;
  user: { name: string; email: string };
};
type RestaurantAccess = { role: string; restaurant: Session["restaurant"] };
const labels: Record<string, string> = {
  OWNER: "Propietario",
  MANAGER: "Gerente",
  CASHIER: "Caja",
  WAITER: "Mesero",
  KITCHEN: "Cocina",
};
export default function Management({
  session,
  online,
  onSession,
  onSignedOut,
}: {
  session: Session;
  online: boolean;
  onSession: (value: Session) => void;
  onSignedOut: () => void;
}) {
  const loadSequence = useRef(0);
  const [tab, setTab] = useState("overview");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [restaurants, setRestaurants] = useState<RestaurantAccess[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const administrative = ["OWNER", "MANAGER"].includes(session.user.role);
  const owner = session.user.role === "OWNER";
  const roleOptions = owner
    ? ["MANAGER", "WAITER", "CASHIER", "KITCHEN"]
    : ["WAITER", "CASHIER", "KITCHEN"];
  const api = useCallback(
    async (path: string, method = "GET", body?: unknown) => {
      const response = await fetch(`/api${path}`, {
        method,
        credentials: "same-origin",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) {
        let message = "No se pudo completar la operación";
        try {
          const value = await response.json();
          message = Array.isArray(value.message)
            ? "Revisa los campos del formulario"
            : value.message || message;
        } catch {}
        if (response.status === 401)
          message = "Tu acceso cambió o venció. Vuelve a iniciar sesión.";
        throw new Error(message);
      }
      return response.json();
    },
    [session.accessToken],
  );
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    const [nextBranches, nextRestaurants, nextMembers] = await Promise.all([
      api("/restaurant/branches"),
      api("/restaurants"),
      administrative ? api("/restaurant/members") : Promise.resolve([]),
    ]);
    if (sequence === loadSequence.current) {
      setBranches(nextBranches);
      setRestaurants(nextRestaurants);
      setMembers(nextMembers);
    }
  }, [api, administrative]);
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    setNotice("");
    setBranches([]);
    setMembers([]);
    setRestaurants([]);
    load()
      .catch((e) => {
        if (mounted) setError(e.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
      loadSequence.current++;
    };
  }, [load]);
  async function act(operation: () => Promise<void>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
      setNotice(message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revisa tu conexión");
    } finally {
      setBusy(false);
    }
  }
  async function switchRestaurant(id: string) {
    if (id === session.restaurant.id) return;
    setBusy(true);
    setError("");
    try {
      const next: Session = await api("/auth/switch", "POST", {
        restaurantId: id,
      });
      setTab("overview");
      onSession(next);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo cambiar de restaurante",
      );
    } finally {
      setBusy(false);
    }
  }
  function values(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    return {
      form: event.currentTarget,
      data: new FormData(event.currentTarget),
    };
  }
  const disabled = busy || !online || loading;
  return (
    <div className="management">
      <div className="workspace-bar">
        <div>
          <p className="eyebrow">TU ESPACIO DE TRABAJO</p>
          <h1>{session.restaurant.name}</h1>
          <p>
            Hola, {session.user.name} · {labels[session.user.role]}
          </p>
        </div>
        <label className="restaurant-selector">
          Restaurante
          <select
            value={session.restaurant.id}
            onChange={(e) => switchRestaurant(e.target.value)}
            disabled={disabled}
          >
            {restaurants.map((value) => (
              <option key={value.restaurant.id} value={value.restaurant.id}>
                {value.restaurant.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <nav className="tabs" aria-label="Administración">
        {[
          ["overview", "Resumen"],
          ["branches", "Sucursales"],
          ["menu", "Menú"],
          ["tables", "Mesas"],
          ["orders", "Comandas"],
          ["kitchen", "Cocina"],
          ...(["OWNER", "MANAGER", "CASHIER"].includes(session.user.role)
            ? [
                ["cash", "Caja y ventas"],
                ["shifts", "Turnos de caja"],
                ["reports", "Reportes de ventas"],
              ]
            : []),
          ...(administrative ? [["team", "Equipo"]] : []),
          ["account", "Mi cuenta"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "selected" : ""}
            aria-current={tab === key ? "page" : undefined}
            onClick={() => {
              setTab(key);
              setError("");
              setNotice("");
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      {loading && <p role="status">Cargando restaurante…</p>}
      {tab === "overview" && (
        <>
          <div className="stats">
            <article>
              <span>Sucursales activas</span>
              <strong>{branches.filter((b) => b.active).length}</strong>
            </article>
            {administrative && (
              <article>
                <span>Personas en el equipo</span>
                <strong>{members.filter((m) => m.active).length}</strong>
              </article>
            )}
            <article>
              <span>Tu acceso</span>
              <strong className="role-summary">
                {labels[session.user.role]}
              </strong>
            </article>
          </div>
          <div className="management-grid">
            <article className="card">
              <h2>Tu restaurante</h2>
              <p>{session.restaurant.slug}</p>
              {administrative ? (
                <form
                  onSubmit={(event) => {
                    const { data } = values(event);
                    act(async () => {
                      const restaurant = await api("/restaurant", "PATCH", {
                        name: data.get("name"),
                      });
                      onSession({ ...session, restaurant });
                    }, "Nombre actualizado");
                  }}
                >
                  <label>
                    Nombre
                    <input
                      name="name"
                      defaultValue={session.restaurant.name}
                      key={session.restaurant.name}
                      required
                      minLength={2}
                      maxLength={120}
                    />
                  </label>
                  <button disabled={disabled}>Guardar nombre</button>
                </form>
              ) : (
                <p>Tu gerente administra la configuración.</p>
              )}
            </article>
            {owner && (
              <article className="card">
                <h2>Otro restaurante</h2>
                <p>
                  Agrega un restaurante independiente a tu cuenta. Tendrá su
                  propia sucursal principal y equipo.
                </p>
                <form
                  onSubmit={(event) => {
                    const { form, data } = values(event);
                    act(async () => {
                      await api("/restaurants", "POST", {
                        name: data.get("name"),
                        slug: data.get("slug"),
                      });
                      form.reset();
                    }, "Restaurante creado. Puedes seleccionarlo arriba.");
                  }}
                >
                  <label>
                    Nombre
                    <input name="name" required minLength={2} maxLength={120} />
                  </label>
                  <label>
                    Identificador para iniciar sesión
                    <input
                      name="slug"
                      required
                      minLength={2}
                      maxLength={80}
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      placeholder="mi-restaurante"
                    />
                    <small>Letras minúsculas, números y guiones.</small>
                  </label>
                  <button disabled={disabled}>Crear restaurante</button>
                </form>
              </article>
            )}
          </div>
        </>
      )}
      {tab === "branches" && (
        <div className="management-grid">
          <article className="card">
            <h2>{administrative ? "Tus sucursales" : "Tu sucursal"}</h2>
            {!loading && !branches.length && (
              <p>Aún no tienes una sucursal asignada.</p>
            )}
            <div className="record-list">
              {branches.map((branch) => (
                <div className="record" key={branch.id}>
                  <div className="record-heading">
                    <h3>{branch.name}</h3>
                    <span className={`badge ${branch.active ? "" : "muted"}`}>
                      {branch.active ? "Activa" : "Inactiva"}
                    </span>
                  </div>
                  {administrative ? (
                    <form
                      onSubmit={(event) => {
                        const { data } = values(event);
                        act(async () => {
                          await api(
                            `/restaurant/branches/${branch.id}`,
                            "PATCH",
                            {
                              name: data.get("name"),
                              address: data.get("address"),
                            },
                          );
                        }, "Sucursal actualizada");
                      }}
                    >
                      <label>
                        Nombre
                        <input
                          name="name"
                          defaultValue={branch.name}
                          key={branch.name}
                          required
                          minLength={2}
                          maxLength={120}
                        />
                      </label>
                      <label>
                        Dirección
                        <input
                          name="address"
                          defaultValue={branch.address}
                          key={branch.address}
                          maxLength={300}
                        />
                      </label>
                      <div className="actions">
                        <button disabled={disabled}>Guardar</button>
                        <button
                          type="button"
                          className="secondary"
                          disabled={disabled}
                          onClick={() => {
                            if (
                              branch.active &&
                              !window.confirm(
                                "¿Desactivar esta sucursal? El equipo operativo no podrá acceder hasta reasignarlo o reactivarla.",
                              )
                            )
                              return;
                            act(
                              async () => {
                                await api(
                                  `/restaurant/branches/${branch.id}`,
                                  "PATCH",
                                  { active: !branch.active },
                                );
                              },
                              branch.active
                                ? "Sucursal desactivada"
                                : "Sucursal reactivada",
                            );
                          }}
                        >
                          {branch.active ? "Desactivar" : "Reactivar"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p>{branch.address || "Sin dirección registrada"}</p>
                  )}
                </div>
              ))}
            </div>
          </article>
          {administrative && (
            <article className="card">
              <h2>Nueva sucursal</h2>
              <p>Organiza a tu equipo por ubicación.</p>
              <form
                onSubmit={(event) => {
                  const { form, data } = values(event);
                  act(async () => {
                    await api("/restaurant/branches", "POST", {
                      name: data.get("name"),
                      address: data.get("address"),
                    });
                    form.reset();
                  }, "Sucursal creada");
                }}
              >
                <label>
                  Nombre
                  <input
                    name="name"
                    placeholder="Sucursal Centro"
                    required
                    minLength={2}
                    maxLength={120}
                  />
                </label>
                <label>
                  Dirección
                  <input name="address" maxLength={300} />
                </label>
                <button disabled={disabled}>Agregar sucursal</button>
              </form>
            </article>
          )}
        </div>
      )}
      {tab === "team" && administrative && (
        <div className="management-grid team-grid">
          <article className="card">
            <h2>Tu equipo</h2>
            <p>
              Los cambios de permisos cierran las sesiones del empleado para que
              vuelva a entrar con su nuevo acceso.
            </p>
            <div className="record-list">
              {members.map((member) => {
                const editable =
                  member.user.email !== session.user.email &&
                  member.role !== "OWNER" &&
                  (owner || member.role !== "MANAGER");
                return (
                  <div className="record" key={member.id}>
                    <div className="record-heading">
                      <h3>{member.user.name}</h3>
                      <span className={`badge ${member.active ? "" : "muted"}`}>
                        {member.active ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <p className="member-email">{member.user.email}</p>
                    {editable ? (
                      <form
                        onSubmit={(event) => {
                          const { data } = values(event);
                          act(async () => {
                            await api(
                              `/restaurant/members/${member.id}`,
                              "PATCH",
                              {
                                role: data.get("role"),
                                branchId: data.get("branchId"),
                              },
                            );
                          }, "Acceso actualizado");
                        }}
                      >
                        <div className="field-row">
                          <label>
                            Rol
                            <select
                              name="role"
                              defaultValue={member.role}
                              key={member.role}
                            >
                              {roleOptions.map((role) => (
                                <option key={role} value={role}>
                                  {labels[role]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Sucursal
                            <select
                              name="branchId"
                              defaultValue={member.branchId ?? ""}
                              key={member.branchId ?? ""}
                              required
                            >
                              <option value="" disabled>
                                Seleccionar
                              </option>
                              {branches
                                .filter(
                                  (b) => b.active || b.id === member.branchId,
                                )
                                .map((branch) => (
                                  <option
                                    key={branch.id}
                                    value={branch.id}
                                    disabled={!branch.active}
                                  >
                                    {branch.name}
                                    {branch.active ? "" : " (inactiva)"}
                                  </option>
                                ))}
                            </select>
                          </label>
                        </div>
                        <div className="actions">
                          <button disabled={disabled}>Guardar acceso</button>
                          <button
                            type="button"
                            className="secondary"
                            disabled={disabled}
                            onClick={() => {
                              if (
                                member.active &&
                                !window.confirm(
                                  `¿Desactivar el acceso de ${member.user.name}?`,
                                )
                              )
                                return;
                              act(
                                async () => {
                                  await api(
                                    `/restaurant/members/${member.id}`,
                                    "PATCH",
                                    { active: !member.active },
                                  );
                                },
                                member.active
                                  ? "Acceso desactivado"
                                  : "Acceso reactivado",
                              );
                            }}
                          >
                            {member.active ? "Desactivar" : "Reactivar"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <p>
                        {labels[member.role]} ·{" "}
                        {member.branch?.name ?? "Sin sucursal asignada"}
                        {member.user.email === session.user.email
                          ? " · Tú"
                          : ""}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </article>
          <article className="card">
            <h2>Agregar empleado</h2>
            <p>
              Crea su cuenta con un correo nuevo. Podrá cambiar su contraseña en
              Mi cuenta.
            </p>
            <form
              onSubmit={(event) => {
                const { form, data } = values(event);
                act(async () => {
                  await api("/restaurant/members", "POST", {
                    name: data.get("name"),
                    email: data.get("email"),
                    password: data.get("password"),
                    role: data.get("role"),
                    branchId: data.get("branchId"),
                  });
                  form.reset();
                }, "Empleado creado. Comparte con él su acceso y el identificador del restaurante.");
              }}
            >
              <label>
                Nombre
                <input name="name" required minLength={2} maxLength={120} />
              </label>
              <label>
                Correo
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="off"
                />
              </label>
              <label>
                Contraseña inicial
                <input
                  name="password"
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                />
                <small>Al menos 12 caracteres.</small>
              </label>
              <label>
                Rol
                <select name="role" defaultValue="WAITER">
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {labels[role]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sucursal
                <select name="branchId" required defaultValue="">
                  <option value="" disabled>
                    Seleccionar sucursal
                  </option>
                  {branches
                    .filter((b) => b.active)
                    .map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                </select>
              </label>
              <button disabled={disabled}>Crear cuenta</button>
            </form>
          </article>
        </div>
      )}
      {(tab === "menu" || tab === "tables") && (
        <Catalog
          key={`${session.restaurant.id}:${tab}`}
          session={session}
          branches={branches}
          online={online}
          mode={tab}
        />
      )}
      {(tab === "orders" || tab === "kitchen") && (
        <Orders
          key={session.restaurant.id}
          session={session}
          branches={branches}
          online={online}
          kitchen={tab === "kitchen"}
        />
      )}
      {tab === "cash" && (
        <Cash
          key={session.restaurant.id}
          session={session}
          branches={branches}
          online={online}
        />
      )}
      {tab === "shifts" && (
        <Shifts
          key={session.restaurant.id}
          session={session}
          branches={branches}
          online={online}
        />
      )}
      {tab === "reports" && (
        <Reports
          key={session.restaurant.id}
          session={session}
          branches={branches}
          online={online}
        />
      )}
      {tab === "account" && (
        <article className="card account-card">
          <h2>Mi cuenta</h2>
          <p>
            {session.user.name}
            <br />
            {session.user.email}
          </p>
          <h3>Cambiar contraseña</h3>
          <p>Al cambiarla se cerrarán tus sesiones para proteger tu cuenta.</p>
          <form
            onSubmit={async (event) => {
              const { data } = values(event);
              if (data.get("newPassword") !== data.get("confirmPassword")) {
                setError("Las contraseñas nuevas no coinciden");
                return;
              }
              setBusy(true);
              setError("");
              try {
                await api("/me/password", "PATCH", {
                  currentPassword: data.get("currentPassword"),
                  newPassword: data.get("newPassword"),
                });
                onSignedOut();
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "No se pudo cambiar la contraseña",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Contraseña actual
              <input
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
                maxLength={128}
              />
            </label>
            <label>
              Nueva contraseña
              <input
                name="newPassword"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
            <label>
              Confirmar nueva contraseña
              <input
                name="confirmPassword"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
            <button disabled={disabled}>
              Cambiar contraseña y cerrar sesión
            </button>
          </form>
        </article>
      )}
    </div>
  );
}
