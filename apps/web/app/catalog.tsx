"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Session } from "./management";
type Branch = { id: string; name: string; active: boolean };
type Category = { id: string; name: string; active: boolean };
type Product = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  active: boolean;
  available: boolean;
  categoryId: string;
  category: Category;
};
type Table = { id: string; name: string; capacity: number; active: boolean };
const money = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    cents / 100,
  );
function cents(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(text))
    throw new Error("Ingresa un precio válido con hasta dos decimales");
  const [whole, fraction = ""] = text.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export default function Catalog({
  session,
  branches,
  online,
  mode,
}: {
  session: Session;
  branches: Branch[];
  online: boolean;
  mode: "menu" | "tables";
}) {
  const administrative = ["OWNER", "MANAGER"].includes(session.user.role);
  const [branchId, setBranchId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    setBranchId((current) =>
      branches.some((b) => b.id === current && b.active)
        ? current
        : (branches.find((b) => b.active)?.id ?? ""),
    );
  }, [branches]);
  const api = useCallback(
    async (path: string, method = "GET", body?: unknown) => {
      const response = await fetch(
        `/api/restaurant/branches/${branchId}/${path}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
      const value = await response.json();
      if (!response.ok)
        throw new Error(
          Array.isArray(value.message)
            ? "Revisa los campos del formulario"
            : (value.message ?? "No se pudo completar la operación"),
        );
      return value;
    },
    [branchId, session.accessToken],
  );
  const load = useCallback(
    async () =>
      Promise.all([api("categories"), api("products"), api("tables")]),
    [api],
  );
  const apply = useCallback((values: [Category[], Product[], Table[]]) => {
    setCategories(values[0]);
    setProducts(values[1]);
    setTables(values[2]);
  }, []);
  useEffect(() => {
    let current = true;
    setCategories([]);
    setProducts([]);
    setTables([]);
    setError("");
    setNotice("");
    setFilter("");
    setSearch("");
    if (!branchId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    load()
      .then((values) => {
        if (current) apply(values);
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [branchId, load, apply]);
  async function act(operation: () => Promise<void>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
      apply(await load());
      setNotice(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revisa tu conexión");
    } finally {
      setBusy(false);
    }
  }
  function form(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    return {
      element: event.currentTarget,
      data: new FormData(event.currentTarget),
    };
  }
  const disabled = busy || loading || !online;
  const activeCategories = categories.filter((c) => c.active);
  const visibleProducts = products.filter(
    (p) =>
      (!filter || p.categoryId === filter) &&
      `${p.name} ${p.description}`
        .toLocaleLowerCase("es")
        .includes(search.toLocaleLowerCase("es")),
  );
  return (
    <section className="catalog">
      <div className="catalog-heading">
        <div>
          <h2>{mode === "menu" ? "Menú" : "Mesas"}</h2>
          <p>
            {mode === "menu"
              ? "Organiza tus productos y mantén sus precios y disponibilidad al día."
              : "Configura las mesas y su capacidad para preparar la operación."}
          </p>
        </div>
        <label>
          Sucursal
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            disabled={busy || !online}
          >
            {!branchId && <option value="">Sin sucursales activas</option>}
            {branches
              .filter((b) => b.active)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="success">
          {notice}
        </p>
      )}
      {loading && <p role="status">Cargando sucursal…</p>}
      {!branchId && !loading && (
        <div className="card">
          <p>Activa o crea una sucursal para empezar.</p>
        </div>
      )}
      {branchId && mode === "menu" && (
        <>
          <div className="management-grid">
            <article className="card">
              <h2>Categorías</h2>
              {!loading && !categories.length && (
                <p>Empieza con una categoría para organizar el menú.</p>
              )}
              <div className="category-list">
                {categories.map((category) =>
                  administrative ? (
                    <form
                      key={category.id}
                      onSubmit={(e) => {
                        const { data } = form(e);
                        act(async () => {
                          await api(`categories/${category.id}`, "PATCH", {
                            name: data.get("name"),
                          });
                        }, "Categoría actualizada");
                      }}
                    >
                      <label>
                        Nombre de categoría
                        <input
                          name="name"
                          defaultValue={category.name}
                          required
                          minLength={2}
                          maxLength={80}
                        />
                      </label>
                      <span
                        className={`badge ${category.active ? "" : "muted"}`}
                      >
                        {category.active ? "Activa" : "Inactiva"}
                      </span>
                      <div className="actions">
                        <button disabled={disabled}>Guardar</button>
                        <button
                          type="button"
                          className="secondary"
                          disabled={disabled}
                          onClick={() =>
                            act(
                              async () => {
                                await api(
                                  `categories/${category.id}`,
                                  "PATCH",
                                  { active: !category.active },
                                );
                              },
                              category.active
                                ? "Categoría desactivada; sus productos no aparecen al equipo operativo"
                                : "Categoría reactivada",
                            )
                          }
                        >
                          {category.active ? "Desactivar" : "Reactivar"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p key={category.id}>{category.name}</p>
                  ),
                )}
              </div>
              {administrative && (
                <form
                  className="new-category"
                  onSubmit={(e) => {
                    const { element, data } = form(e);
                    act(async () => {
                      await api("categories", "POST", {
                        name: data.get("name"),
                      });
                      element.reset();
                    }, "Categoría creada");
                  }}
                >
                  <label>
                    Nueva categoría
                    <input
                      name="name"
                      placeholder="Ejemplo: Bebidas"
                      required
                      minLength={2}
                      maxLength={80}
                    />
                  </label>
                  <button disabled={disabled}>Agregar categoría</button>
                </form>
              )}
            </article>
            {administrative && (
              <article className="card">
                <h2>Nuevo producto</h2>
                {!activeCategories.length && (
                  <p>Crea o activa una categoría antes de agregar productos.</p>
                )}
                <form
                  onSubmit={(e) => {
                    const { element, data } = form(e);
                    act(async () => {
                      await api("products", "POST", {
                        name: data.get("name"),
                        description: data.get("description"),
                        categoryId: data.get("categoryId"),
                        priceCents: cents(data.get("price")),
                      });
                      element.reset();
                    }, "Producto creado");
                  }}
                >
                  <label>
                    Nombre del producto
                    <input name="name" required minLength={2} maxLength={120} />
                  </label>
                  <label>
                    Descripción
                    <textarea name="description" maxLength={500} rows={2} />
                  </label>
                  <label>
                    Categoría
                    <select name="categoryId" required defaultValue="">
                      <option value="" disabled>
                        Seleccionar categoría
                      </option>
                      {activeCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Precio en MXN
                    <input
                      name="price"
                      type="number"
                      min="0"
                      max="999999.99"
                      step="0.01"
                      inputMode="decimal"
                      required
                      placeholder="0.00"
                    />
                  </label>
                  <button disabled={disabled || !activeCategories.length}>
                    Agregar producto
                  </button>
                </form>
              </article>
            )}
          </div>
          <div className="product-toolbar">
            <h2>
              Productos <span className="count">{visibleProducts.length}</span>
            </h2>
            <label>
              Buscar
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto"
              />
            </label>
            <label>
              Categoría
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!loading && !visibleProducts.length && (
            <div className="card">
              <p>
                {products.length
                  ? "No hay productos que coincidan con tu búsqueda."
                  : "Todavía no hay productos en esta sucursal."}
              </p>
            </div>
          )}
          <div className="product-grid">
            {visibleProducts.map((product) => (
              <article className="card" key={product.id}>
                <div className="record-heading">
                  <h3>{product.name}</h3>
                  <strong>{money(product.priceCents)}</strong>
                </div>
                <p>{product.category.name}</p>
                <div className="status-row">
                  <span className={`badge ${product.active ? "" : "muted"}`}>
                    {product.active ? "En el menú" : "Inactivo"}
                  </span>
                  <span className={`badge ${product.available ? "" : "muted"}`}>
                    {product.available ? "Disponible" : "Agotado"}
                  </span>
                  {!product.category.active && (
                    <span className="badge muted">Categoría inactiva</span>
                  )}
                </div>
                {administrative ? (
                  <form
                    onSubmit={(e) => {
                      const { data } = form(e);
                      act(async () => {
                        await api(`products/${product.id}`, "PATCH", {
                          name: data.get("name"),
                          description: data.get("description"),
                          categoryId: data.get("categoryId"),
                          priceCents: cents(data.get("price")),
                        });
                      }, "Producto actualizado");
                    }}
                  >
                    <label>
                      Nombre
                      <input
                        name="name"
                        defaultValue={product.name}
                        required
                        minLength={2}
                        maxLength={120}
                      />
                    </label>
                    <label>
                      Descripción
                      <textarea
                        name="description"
                        defaultValue={product.description}
                        maxLength={500}
                        rows={2}
                      />
                    </label>
                    <div className="field-row">
                      <label>
                        Categoría
                        <select
                          name="categoryId"
                          defaultValue={product.categoryId}
                          required
                        >
                          {categories
                            .filter(
                              (c) => c.active || c.id === product.categoryId,
                            )
                            .map((c) => (
                              <option
                                key={c.id}
                                value={c.id}
                                disabled={!c.active}
                              >
                                {c.name}
                                {c.active ? "" : " (inactiva)"}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Precio en MXN
                        <input
                          name="price"
                          type="number"
                          min="0"
                          max="999999.99"
                          step="0.01"
                          inputMode="decimal"
                          defaultValue={(product.priceCents / 100).toFixed(2)}
                          required
                        />
                      </label>
                    </div>
                    <div className="actions">
                      <button disabled={disabled}>Guardar producto</button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={disabled}
                        onClick={() =>
                          act(async () => {
                            await api(`products/${product.id}`, "PATCH", {
                              available: !product.available,
                            });
                          }, "Disponibilidad actualizada")
                        }
                      >
                        {product.available
                          ? "Marcar agotado"
                          : "Marcar disponible"}
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={disabled}
                        onClick={() =>
                          act(
                            async () => {
                              await api(`products/${product.id}`, "PATCH", {
                                active: !product.active,
                              });
                            },
                            product.active
                              ? "Producto desactivado"
                              : "Producto reactivado",
                          )
                        }
                      >
                        {product.active ? "Desactivar" : "Reactivar"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <p>{product.description}</p>
                )}
              </article>
            ))}
          </div>
        </>
      )}
      {branchId && mode === "tables" && (
        <>
          <div className="management-grid">
            <article className="card">
              <h2>Mesas de la sucursal</h2>
              <p>
                {tables.filter((t) => t.active).length} activas ·{" "}
                {tables
                  .filter((t) => t.active)
                  .reduce((sum, t) => sum + t.capacity, 0)}{" "}
                lugares
              </p>
              {!loading && !tables.length && (
                <p>Agrega la primera mesa para comenzar.</p>
              )}
              <div className="table-grid">
                {tables.map((table) => (
                  <article className="table-card" key={table.id}>
                    <div className="record-heading">
                      <h3>{table.name}</h3>
                      <span className={`badge ${table.active ? "" : "muted"}`}>
                        {table.active ? "Activa" : "Inactiva"}
                      </span>
                    </div>
                    <p>{table.capacity} personas</p>
                    {administrative && (
                      <form
                        onSubmit={(e) => {
                          const { data } = form(e);
                          act(async () => {
                            await api(`tables/${table.id}`, "PATCH", {
                              name: data.get("name"),
                              capacity: Number(data.get("capacity")),
                            });
                          }, "Mesa actualizada");
                        }}
                      >
                        <label>
                          Nombre
                          <input
                            name="name"
                            defaultValue={table.name}
                            required
                            minLength={1}
                            maxLength={40}
                          />
                        </label>
                        <label>
                          Capacidad
                          <input
                            name="capacity"
                            type="number"
                            min="1"
                            max="100"
                            step="1"
                            defaultValue={table.capacity}
                            required
                          />
                        </label>
                        <div className="actions">
                          <button disabled={disabled}>Guardar</button>
                          <button
                            type="button"
                            className="secondary"
                            disabled={disabled}
                            onClick={() =>
                              act(
                                async () => {
                                  await api(`tables/${table.id}`, "PATCH", {
                                    active: !table.active,
                                  });
                                },
                                table.active
                                  ? "Mesa desactivada"
                                  : "Mesa reactivada",
                              )
                            }
                          >
                            {table.active ? "Desactivar" : "Reactivar"}
                          </button>
                        </div>
                      </form>
                    )}
                  </article>
                ))}
              </div>
            </article>
            {administrative && (
              <article className="card">
                <h2>Nueva mesa</h2>
                <form
                  onSubmit={(e) => {
                    const { element, data } = form(e);
                    act(async () => {
                      await api("tables", "POST", {
                        name: data.get("name"),
                        capacity: Number(data.get("capacity")),
                      });
                      element.reset();
                    }, "Mesa creada");
                  }}
                >
                  <label>
                    Nombre
                    <input
                      name="name"
                      placeholder="Mesa 1"
                      required
                      minLength={1}
                      maxLength={40}
                    />
                  </label>
                  <label>
                    Capacidad
                    <input
                      name="capacity"
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                      defaultValue={4}
                      required
                    />
                  </label>
                  <button disabled={disabled}>Agregar mesa</button>
                </form>
                <p>
                  La apertura de cuentas y los estados de ocupación llegarán con
                  las comandas en el siguiente sprint.
                </p>
              </article>
            )}
          </div>
        </>
      )}
    </section>
  );
}
