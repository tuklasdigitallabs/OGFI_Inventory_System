"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ApiClient,
  getSessionAccessToken,
  type AuthenticatedUser,
  type MasterDataRecord,
  type ReportCatalogItem,
  type ReportRun,
} from "@/lib/api-client";
import { Icon } from "@/lib/icons";
import type { Kpi, Screen } from "@/lib/screens";
import { KpiCard } from "./kpi-card";
import { StatusBadge } from "./status-badge";

type ReportsLivePageProps = {
  screen: Screen;
};

type ReportsState = {
  catalog: ReportCatalogItem[];
  error: string | null;
  loading: boolean;
  locations: MasterDataRecord[];
  runs: ReportRun[];
  user: AuthenticatedUser | null;
};

type ReportForm = {
  dateFrom: string;
  dateTo: string;
  format: "CSV";
  itemType: string;
  locationId: string;
  reportKey: string;
};

const emptyForm: ReportForm = {
  dateFrom: "",
  dateTo: "",
  format: "CSV",
  itemType: "",
  locationId: "",
  reportKey: "stock-on-hand",
};

export function ReportsLivePage({ screen }: ReportsLivePageProps) {
  const [form, setForm] = useState<ReportForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<ReportsState>({
    catalog: [],
    error: null,
    loading: true,
    locations: [],
    runs: [],
    user: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadReports() {
      const token = getSessionAccessToken();

      if (!token) {
        setState({
          catalog: [],
          error: "Sign in again to load reports.",
          loading: false,
          locations: [],
          runs: [],
          user: null,
        });
        return;
      }

      try {
        const client = new ApiClient(token);
        const [user, catalog, locations, runs] = await Promise.all([
          client.currentUser(),
          client.reportCatalog(),
          client.masterData<MasterDataRecord>("locations"),
          client.reportRuns(),
        ]);

        if (!cancelled) {
          setState({
            catalog: catalog.data,
            error: null,
            loading: false,
            locations: locations.data.filter(
              (location) => location.active !== false,
            ),
            runs: runs.data,
            user,
          });
          setForm((current) => ({
            ...current,
            reportKey: catalog.data[0]?.key ?? current.reportKey,
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            catalog: [],
            error:
              error instanceof Error
                ? error.message
                : "Unable to load reports.",
            loading: false,
            locations: [],
            runs: [],
            user: null,
          });
        }
      }
    }

    void loadReports();

    return () => {
      cancelled = true;
    };
  }, []);

  const kpis = useMemo(
    () => buildReportKpis(state.runs, state.loading),
    [state.loading, state.runs],
  );
  const selectedReport = state.catalog.find(
    (report) => report.key === form.reportKey,
  );
  const canRunReports = hasPermission(state.user, "reports:run");

  async function refresh(client: ApiClient) {
    const runs = await client.reportRuns();
    setState((current) => ({ ...current, runs: runs.data }));
  }

  async function runReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canRunReports) {
      setState((current) => ({
        ...current,
        error: "You do not have permission to run reports.",
      }));
      return;
    }

    setSaving(true);

    try {
      const client = await clientFromSession();
      const run = await client.runReport({
        reportKey: form.reportKey,
        format: form.format,
        locationId: form.locationId || undefined,
        dateFrom: form.dateFrom || undefined,
        dateTo: form.dateTo || undefined,
        itemType: form.itemType || undefined,
      });

      await refresh(client);
      setState((current) => ({
        ...current,
        error: run.status === "FAILED" ? run.error : null,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Unable to run report.",
      }));
    } finally {
      setSaving(false);
    }
  }

  async function downloadRun(id: string) {
    setSaving(true);

    try {
      const client = await clientFromSession();
      const download = await client.downloadReportRun(id);
      const blob = new Blob([download.content], { type: download.contentType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = download.filename;
      link.click();
      URL.revokeObjectURL(url);
      setState((current) => ({ ...current, error: null }));
    } catch (error) {
      setState((current) => ({
        ...current,
        error:
          error instanceof Error ? error.message : "Unable to download report.",
      }));
    } finally {
      setSaving(false);
    }
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

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {kpis.map((kpi) => (
          <KpiCard kpi={kpi} key={kpi.label} />
        ))}
      </section>

      {state.error ? (
        <div className="rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-og-error">
          {state.error}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <form className="og-card flex flex-col gap-4" onSubmit={runReport}>
          <div>
            <h2 className="font-poppins text-lg font-semibold text-og-dark">
              Run Report
            </h2>
            <p className="mt-1 text-sm text-og-gray">
              {selectedReport?.description ?? "Select a report to generate."}
            </p>
          </div>

          <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
            Report
            <select
              className="h-10 rounded-md border border-og-line px-3 text-sm font-medium text-og-dark"
              disabled={state.loading || saving || !canRunReports}
              value={form.reportKey}
              onChange={(event) =>
                setForm({ ...form, reportKey: event.target.value })
              }
            >
              {state.catalog.map((report) => (
                <option key={report.key} value={report.key}>
                  {report.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
            Location
            <select
              className="h-10 rounded-md border border-og-line px-3 text-sm font-medium text-og-dark"
              disabled={state.loading || saving || !canRunReports}
              value={form.locationId}
              onChange={(event) =>
                setForm({ ...form, locationId: event.target.value })
              }
            >
              <option value="">All allowed locations</option>
              {state.locations.map((location) => (
                <option key={String(location.id)} value={String(location.id)}>
                  {text(location.code)} - {text(location.name)}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <DateField
              disabled={state.loading || saving || !canRunReports}
              label="From"
              value={form.dateFrom}
              onChange={(dateFrom) => setForm({ ...form, dateFrom })}
            />
            <DateField
              disabled={state.loading || saving || !canRunReports}
              label="To"
              value={form.dateTo}
              onChange={(dateTo) => setForm({ ...form, dateTo })}
            />
          </div>

          <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
            Item type
            <select
              className="h-10 rounded-md border border-og-line px-3 text-sm font-medium text-og-dark"
              disabled={state.loading || saving || !canRunReports}
              value={form.itemType}
              onChange={(event) =>
                setForm({ ...form, itemType: event.target.value })
              }
            >
              <option value="">All item types</option>
              <option value="RAW_MATERIAL">Raw material</option>
              <option value="PACKAGING">Packaging</option>
              <option value="SUPPLY">Supply</option>
              <option value="FINISHED_GOOD">Finished good</option>
              <option value="SEMI_FINISHED">Semi-finished</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
            Format
            <input
              className="h-10 rounded-md border border-og-line bg-gray-50 px-3 text-sm font-medium text-og-gray"
              readOnly
              value={form.format}
            />
          </label>

          <button
            className="inline-flex h-10 w-fit items-center gap-2 rounded-md bg-og-green px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={
              state.loading ||
              saving ||
              state.catalog.length === 0 ||
              !canRunReports
            }
            type="submit"
          >
            <Icon name="PlayCircle" size={18} />
            Run Report
          </button>
        </form>

        <section className="og-card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-og-line p-4">
            <div className="flex items-center gap-2">
              <Icon name="BarChart3" size={20} className="text-og-green" />
              <h2 className="font-poppins text-xl font-semibold text-og-dark">
                Report Runs
              </h2>
            </div>
            <span className="text-xs font-semibold text-og-gray">
              {state.runs.length} records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  {[
                    "Report",
                    "Format",
                    "Requested",
                    "Completed",
                    "Status",
                    "Actions",
                  ].map((column) => (
                    <th className="og-table-header" key={column}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.loading ? (
                  <tr className="border-t border-og-line">
                    <td
                      className="og-table-cell py-8 text-center text-og-gray"
                      colSpan={6}
                    >
                      Loading report runs
                    </td>
                  </tr>
                ) : null}

                {!state.loading && state.runs.length === 0 ? (
                  <tr className="border-t border-og-line">
                    <td
                      className="og-table-cell py-8 text-center text-og-gray"
                      colSpan={6}
                    >
                      No report runs yet
                    </td>
                  </tr>
                ) : null}

                {!state.loading
                  ? state.runs.map((run) => (
                      <tr
                        className="border-t border-og-line hover:bg-[#fff5e4]"
                        key={run.id}
                      >
                        <td className="og-table-cell">{run.reportName}</td>
                        <td className="og-table-cell">{run.format}</td>
                        <td className="og-table-cell">
                          {formatDateTime(run.createdAt)}
                        </td>
                        <td className="og-table-cell">
                          {run.completedAt
                            ? formatDateTime(run.completedAt)
                            : "-"}
                        </td>
                        <td className="og-table-cell">
                          <StatusBadge value={run.status} />
                        </td>
                        <td className="og-table-cell">
                          <button
                            className="inline-flex h-8 items-center gap-2 rounded-md border border-og-line px-3 text-xs font-semibold text-og-dark disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={saving || run.status !== "COMPLETED"}
                            type="button"
                            onClick={() => downloadRun(run.id)}
                          >
                            <Icon name="Download" size={14} />
                            CSV
                          </button>
                        </td>
                      </tr>
                    ))
                  : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </div>
  );
}

function DateField({
  disabled,
  label,
  value,
  onChange,
}: {
  disabled: boolean;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-og-gray">
      {label}
      <input
        className="h-10 rounded-md border border-og-line px-3 text-sm font-medium text-og-dark"
        disabled={disabled}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function buildReportKpis(runs: ReportRun[], loading: boolean): Kpi[] {
  const completed = runs.filter((run) => run.status === "COMPLETED").length;
  const processing = runs.filter((run) =>
    ["QUEUED", "PROCESSING"].includes(run.status),
  ).length;
  const failed = runs.filter((run) => run.status === "FAILED").length;

  return [
    {
      label: "Completed",
      value: loading ? "..." : formatInteger(completed),
      meta: "Ready for download",
      icon: "FileSpreadsheet",
      tone: "success",
    },
    {
      label: "Processing",
      value: loading ? "..." : formatInteger(processing),
      meta: "Queued or running",
      icon: "Clock",
      tone: processing > 0 ? "warning" : "neutral",
    },
    {
      label: "Failed",
      value: loading ? "..." : formatInteger(failed),
      meta: "Needs rerun or review",
      icon: "TriangleAlert",
      tone: failed > 0 ? "danger" : "success",
    },
  ];
}

async function clientFromSession() {
  const token = getSessionAccessToken();

  if (!token) {
    throw new Error("Sign in again to continue.");
  }

  return new ApiClient(token);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(
    value,
  );
}

function hasPermission(user: AuthenticatedUser | null, permission: string) {
  return user?.permissions.includes(permission) ?? false;
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}
