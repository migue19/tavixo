"use client";
import { useEffect, useRef, useState } from "react";
export type CancelPayload = {
  requestId: string;
  quantity: number;
  expectedCancelledQuantity: number;
  expectedTotalCents: number;
  reason: string;
};
export default function ItemCancellation({
  item,
  totalCents,
  storageKey,
  disabled,
  onCancel,
}: {
  item: {
    id: string;
    name: string;
    quantity: number;
    cancelledQuantity: number;
  };
  totalCents: number;
  storageKey: string;
  disabled: boolean;
  onCancel: (body: CancelPayload) => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [quantity, setQuantity] = useState(1),
    [reason, setReason] = useState(""),
    [pending, setPending] = useState<CancelPayload | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const locked = useRef(false);
  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      setPending(stored);
      if (stored) setOpen(true);
    } catch {
      setPending(null);
    }
  }, [storageKey]);
  async function submit() {
    if (disabled || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const body = pending ?? {
        requestId: crypto.randomUUID(),
        quantity,
        expectedCancelledQuantity: item.cancelledQuantity,
        expectedTotalCents: totalCents,
        reason: reason.trim(),
      };
      sessionStorage.setItem(storageKey, JSON.stringify(body));
      setPending(body);
      await onCancel(body);
      sessionStorage.removeItem(storageKey);
      setPending(null);
      setOpen(false);
      setReason("");
      setQuantity(1);
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (
        status &&
        status >= 400 &&
        status < 500 &&
        ![401, 408, 429].includes(status)
      ) {
        sessionStorage.removeItem(storageKey);
        setPending(null);
      }
      setError(
        e instanceof Error
          ? e.message
          : "Sin respuesta; reintenta la misma cancelación",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <div>
      {!open ? (
        <button
          className="secondary"
          disabled={disabled || busy}
          onClick={() => setOpen(true)}
        >
          Cancelar {item.name}
        </button>
      ) : (
        <form
          aria-label={`Cancelar producto ${item.name}`}
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {pending ? (
            <p className="alert">
              Cancelación pendiente: {pending.quantity} × {item.name}.{" "}
              {pending.reason}. Reintenta el mismo envío.
            </p>
          ) : (
            <>
              <label>
                Cantidad a cancelar
                <input
                  type="number"
                  min={1}
                  max={item.quantity - item.cancelledQuantity}
                  value={quantity}
                  disabled={disabled || busy}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </label>
              <label>
                Motivo de cancelación del producto
                <input
                  required
                  maxLength={500}
                  value={reason}
                  disabled={disabled || busy}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            </>
          )}
          {error && (
            <p role="alert" className="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button
              disabled={
                disabled ||
                busy ||
                (!pending &&
                  (!reason.trim() ||
                    !Number.isInteger(quantity) ||
                    quantity < 1 ||
                    quantity > item.quantity - item.cancelledQuantity))
              }
            >
              {pending
                ? "Reintentar cancelación"
                : "Confirmar cancelación de producto"}
            </button>
            {!pending && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Volver
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
