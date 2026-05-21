"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ApiClient,
  TOKEN_KEY,
  type AuthenticatedUser,
  type Transfer,
} from "@/lib/api-client";
import { Icon } from "@/lib/icons";
import type { Kpi, Screen } from "@/lib/screens";
import { KpiCard } from "./kpi-card";
import { StatusBadge } from "./status-badge";

type StoreOperationsLivePageProps = {
  screen: Screen;
};

type ReceiveForm = {
  lineQty: Record<string, string>;
  notes: string;
  transfer: Transfer | null;
};

const emptyReceiveForm: ReceiveForm = {
  lineQty: {},
  notes: "",
  transfer: null,
};

export function StoreOperationsLivePage({
  screen,
}: StoreOperationsLivePageProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [receiveForm, setReceiveForm] = useState<ReceiveForm>(emptyReceiveForm);
  const [saving, setSaving] = useState(false);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStoreOperations() {
      const token = window.localStorage.getItem(TOKEN_KEY);

      if (!token) {
        setError("Sign in again to load store operations.");
        setLoading(false);
        return;
      }

      try {
        const client = new ApiClient(token);
        const [currentUser, transferResponse] = await Promise.all([
          client.currentUser(),
          client.transfers(),
        ]);

        if (cancelled) {
          return;
        }

        setUser(currentUser);
        setTransfers(
          transferResponse.data.filter(
            (transfer) =>
              transfer.status === "DISPATCHED" &&
              currentUser.locationIds.includes(transfer.targetLocationId),
          ),
        );
        setError(null);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load store operations.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadStoreOperations();

    return () => {
      cancelled = true;
    };
  }, []);

  const kpis = useMemo<Kpi[]>(
    () => [
      {
        label: "Transfer Receiving",
        value: loading ? "..." : String(transfers.length),
        meta: "Incoming dispatched transfers",
        icon: "Inbox",
        tone: transfers.length > 0 ? "warning" : "success",
      },
      {
        label: "Locations",
        value: user ? String(user.locationIds.length) : "...",
        meta: "Accessible branches/stores",
        icon: "Store",
        tone: "info",
      },
      {
        label: "Variance",
        value: "0",
        meta: "Captured during receive",
        icon: "Scale",
        tone: "success",
      },
    ],
    [loading, transfers.length, user],
  );

  async function refresh(client: ApiClient, currentUser: AuthenticatedUser) {
    const transferResponse = await client.transfers();
    setTransfers(
      transferResponse.data.filter(
        (transfer) =>
          transfer.status === "DISPATCHED" &&
          currentUser.locationIds.includes(transfer.targetLocationId),
      ),
    );
  }

  async function submitReceive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!receiveForm.transfer || !user) {
      return;
    }

    setSaving(true);

    try {
      const client = await clientFromSession();
      await client.receiveTransfer(receiveForm.transfer.id, {
        lines: receiveForm.transfer.lines.map((line) => ({
          lineId: line.id,
          receivedQty: Number(receiveForm.lineQty[line.id] || 0),
        })),
        varianceNotes: receiveForm.notes || undefined,
      });
      await refresh(client, user);
      setReceiveForm(emptyReceiveForm);
      setError(null);
    } catch (receiveError) {
      setError(
        receiveError instanceof Error
          ? receiveError.message
          : "Unable to receive transfer.",
      );
    } finally {
      setSaving(false);
    }
  }

  function startReceive(transfer: Transfer) {
    setReceiveForm({
      lineQty: Object.fromEntries(
        transfer.lines.map((line) => [line.id, line.pickedQty ?? "0"]),
      ),
      notes: "",
      transfer,
    });
  }

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-4">
      <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-md bg-green-50 p-3 text-og-green">
            <Icon name={screen.icon} size={24} />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-og-gray">
              {screen.eyebrow}
            </p>
            <h1 className="font-poppins text-2xl font-semibold text-og-dark sm:text-[28px]">
              {screen.title}
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-og-gray">
              {screen.description}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {kpis.map((kpi) => (
          <KpiCard kpi={kpi} key={kpi.label} />
        ))}
      </section>

      {error ? (
        <div className="rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-og-error">
          {error}
        </div>
      ) : null}

      {receiveForm.transfer ? (
        <BranchReceiveForm
          disabled={saving}
          form={receiveForm}
          setForm={setReceiveForm}
          submit={submitReceive}
        />
      ) : null}

      <section className="og-card overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-og-line p-4">
          <Icon name="Inbox" size={20} className="text-og-green" />
          <h2 className="font-poppins text-xl font-semibold text-og-dark">
            Incoming Transfers
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                {["Transfer", "From", "To", "Lines", "Status"].map((column) => (
                  <th className="og-table-header" key={column}>
                    {column}
                  </th>
                ))}
                <th className="og-table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <StateRow label="Loading incoming transfers" /> : null}
              {!loading && transfers.length === 0 ? (
                <StateRow label="No incoming transfers ready to receive" />
              ) : null}
              {!loading
                ? transfers.map((transfer) => (
                    <tr
                      className="border-t border-og-line hover:bg-[#fff5e4]"
                      key={transfer.id}
                    >
                      <td className="og-table-cell font-semibold">
                        {transfer.transferNumber}
                      </td>
                      <td className="og-table-cell">
                        {text(transfer.sourceLocation?.code)}
                      </td>
                      <td className="og-table-cell">
                        {text(transfer.targetLocation?.code)}
                      </td>
                      <td className="og-table-cell">
                        {transfer.lineCount ?? transfer.lines.length}
                      </td>
                      <td className="og-table-cell">
                        <StatusBadge value={transfer.status} />
                      </td>
                      <td className="og-table-cell text-right">
                        <button
                          className="rounded-md p-2 text-og-gray hover:bg-white hover:text-og-green disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={saving}
                          title="Receive"
                          type="button"
                          onClick={() => startReceive(transfer)}
                        >
                          <Icon name="PackageCheck" size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function BranchReceiveForm({
  disabled,
  form,
  setForm,
  submit,
}: {
  disabled: boolean;
  form: ReceiveForm;
  setForm: (form: ReceiveForm) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const transfer = form.transfer!;

  return (
    <form className="og-card flex flex-col gap-4" onSubmit={submit}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-og-gray">
            Transfer Receiving
          </p>
          <h2 className="font-poppins text-xl font-semibold text-og-dark">
            {transfer.transferNumber}
          </h2>
        </div>
        <button
          className="rounded-md border border-og-line px-3 py-2 text-sm font-semibold text-og-dark hover:bg-orange-50"
          type="button"
          onClick={() => setForm(emptyReceiveForm)}
        >
          Close
        </button>
      </div>

      <div className="overflow-x-auto rounded-md border border-og-line">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr>
              {["Item", "UOM", "Picked", "Received Now"].map((column) => (
                <th
                  className="px-3 py-2 text-xs font-bold text-og-gray"
                  key={column}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transfer.lines.map((line) => (
              <tr className="border-t border-og-line" key={line.id}>
                <td className="px-3 py-2 font-semibold text-og-dark">
                  {text(line.item?.sku)}
                </td>
                <td className="px-3 py-2 text-og-dark">
                  {itemBaseUomCode(line.item)}
                </td>
                <td className="px-3 py-2 text-og-dark">
                  {decimal(line.pickedQty)}
                </td>
                <td className="px-3 py-2">
                  <input
                    className="h-10 w-full rounded-md border border-og-line px-3"
                    min="0"
                    step="0.000001"
                    type="number"
                    value={form.lineQty[line.id] ?? ""}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        lineQty: {
                          ...form.lineQty,
                          [line.id]: event.target.value,
                        },
                      })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <label className="flex flex-col gap-1 text-xs font-semibold text-og-dark">
        Variance Notes
        <input
          className="h-10 rounded-md border border-og-line px-3 text-sm font-normal"
          type="text"
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
        />
      </label>

      <button
        className="inline-flex h-10 w-fit items-center gap-2 rounded-md bg-og-green px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        type="submit"
      >
        <Icon name="PackageCheck" size={16} />
        Post Receiving
      </button>
    </form>
  );
}

function StateRow({ label }: { label: string }) {
  return (
    <tr className="border-t border-og-line">
      <td className="og-table-cell py-8 text-center text-og-gray" colSpan={6}>
        {label}
      </td>
    </tr>
  );
}

async function clientFromSession() {
  const token = window.localStorage.getItem(TOKEN_KEY);

  if (!token) {
    throw new Error("Sign in again to continue.");
  }

  return new ApiClient(token);
}

function decimal(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return Number(value).toLocaleString("en-PH", { maximumFractionDigits: 6 });
}

function itemBaseUomCode(item: Record<string, unknown> | undefined) {
  if (!item) {
    return "-";
  }

  if (isRecord(item.baseUom) && typeof item.baseUom.code === "string") {
    return item.baseUom.code;
  }

  return "-";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function text(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}
