"use client";
import ItemCancellation, { type CancelPayload } from "./item-cancellation";
export type Round = {
  id: string;
  number: number;
  status: string;
  notes: string;
  createdByName: string;
  createdAt: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    unitPriceCents: number;
    notes: string;
    cancelledQuantity: number;
    cancellations: {
      id: string;
      quantity: number;
      reason: string;
      actorName: string;
      createdAt: string;
    }[];
  }[];
};
const labels: Record<string, string> = {
  SENT: "Enviada",
  PREPARING: "En preparación",
  READY: "Lista",
  DELIVERED: "Entregada",
  CANCELLED: "Cancelada",
};
const money = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    n / 100,
  );
export default function Rounds({
  rounds,
  kitchen,
  cook,
  floor,
  disabled,
  onStatus,
  canCancel,
  totalCents,
  storageKey,
  onCancel,
}: {
  rounds: Round[];
  kitchen: boolean;
  cook: boolean;
  floor: boolean;
  disabled: boolean;
  onStatus: (round: Round, status: string) => void;
  canCancel: boolean;
  totalCents: number;
  storageKey: string;
  onCancel: (itemId: string, body: CancelPayload) => Promise<void>;
}) {
  return (
    <div className="round-list">
      {rounds
        .filter(
          (r) => !kitchen || ["SENT", "PREPARING", "READY"].includes(r.status),
        )
        .map((round) => (
          <section className="order-round" key={round.id}>
            <div className="record-heading">
              <h4>Ronda {round.number}</h4>
              <span className="badge">{labels[round.status]}</span>
            </div>
            <p>
              {new Date(round.createdAt).toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              · {round.createdByName}
            </p>
            <ul>
              {round.items
                .filter((i) => !kitchen || i.quantity > i.cancelledQuantity)
                .map((i) => (
                  <li key={i.id}>
                    <strong>
                      {i.quantity - i.cancelledQuantity} × {i.name}
                    </strong>
                    <span className="line-price">
                      {money(
                        (i.quantity - i.cancelledQuantity) * i.unitPriceCents,
                      )}
                    </span>
                    {i.notes && <p className="order-note">{i.notes}</p>}
                    {i.cancelledQuantity > 0 && (
                      <p className="order-note">
                        Cancelados: {i.cancelledQuantity} de {i.quantity}
                      </p>
                    )}
                    {!kitchen &&
                      i.cancellations.map((c) => (
                        <p key={c.id} className="order-note">
                          {c.quantity} cancelados · {c.reason} · {c.actorName} ·{" "}
                          {new Date(c.createdAt).toLocaleString("es-MX", {
                            timeZone: "America/Mexico_City",
                          })}
                        </p>
                      ))}
                    {canCancel && i.quantity > i.cancelledQuantity && (
                      <ItemCancellation
                        item={i}
                        totalCents={totalCents}
                        storageKey={`${storageKey}-${i.id}`}
                        disabled={disabled}
                        onCancel={(body) => onCancel(i.id, body)}
                      />
                    )}
                  </li>
                ))}
            </ul>
            {round.notes && <p className="order-note">{round.notes}</p>}
            <div className="actions">
              {cook && round.status === "SENT" && (
                <button
                  disabled={disabled}
                  onClick={() => onStatus(round, "PREPARING")}
                >
                  Preparar ronda {round.number}
                </button>
              )}
              {cook && round.status === "PREPARING" && (
                <button
                  disabled={disabled}
                  onClick={() => onStatus(round, "READY")}
                >
                  Ronda {round.number} lista
                </button>
              )}
              {floor && round.status === "READY" && (
                <button
                  disabled={disabled}
                  onClick={() => onStatus(round, "DELIVERED")}
                >
                  Entregar ronda {round.number}
                </button>
              )}
            </div>
          </section>
        ))}
    </div>
  );
}
