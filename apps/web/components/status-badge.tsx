import { Icon } from "@/lib/icons";

const toneClass = {
  success: "border-green-200 bg-green-50 text-og-green",
  warning: "border-orange-200 bg-orange-50 text-[#8a5200]",
  yellow: "border-yellow-200 bg-yellow-50 text-yellow-700",
  danger: "border-red-200 bg-red-50 text-og-error",
  info: "border-blue-200 bg-blue-50 text-og-info",
  neutral: "border-og-line bg-gray-50 text-og-gray",
};

const statusMap = {
  Approved: { tone: "success", icon: "CheckCircle2" },
  Active: { tone: "success", icon: "CircleCheck" },
  Inactive: { tone: "neutral", icon: "CircleAlert" },
  Archived: { tone: "neutral", icon: "FilePenLine" },
  Posted: { tone: "success", icon: "BadgeCheck" },
  Completed: { tone: "success", icon: "CloudCheck" },
  Pending: { tone: "warning", icon: "Clock" },
  "Pending Approval": { tone: "warning", icon: "Clock" },
  Draft: { tone: "neutral", icon: "FilePenLine" },
  Rejected: { tone: "danger", icon: "XCircle" },
  Failed: { tone: "danger", icon: "CircleAlert" },
  OK: { tone: "success", icon: "CircleCheck" },
  Low: { tone: "yellow", icon: "AlertTriangle" },
  LOW: { tone: "yellow", icon: "AlertTriangle" },
  "Out of Stock": { tone: "danger", icon: "CircleAlert" },
  "In Stock": { tone: "success", icon: "CircleCheck" },
  Empty: { tone: "danger", icon: "CircleAlert" },
  Expired: { tone: "danger", icon: "Clock" },
  "In Transit": { tone: "info", icon: "Route" },
  Variance: { tone: "warning", icon: "Scale" },
  Processing: { tone: "info", icon: "RefreshCw" },
  Download: { tone: "info", icon: "Download" },
  Retry: { tone: "warning", icon: "RotateCw" },
  QUEUED: { tone: "warning", icon: "CloudUpload" },
  RECEIVED: { tone: "info", icon: "CloudCheck" },
  PROCESSING: { tone: "info", icon: "RefreshCw" },
  COMPLETED: { tone: "success", icon: "CloudCheck" },
  COMPLETED_WITH_REJECTIONS: { tone: "warning", icon: "CloudAlert" },
  PROCESSED: { tone: "success", icon: "CloudCheck" },
  ALREADY_PROCESSED: { tone: "neutral", icon: "CloudCheck" },
  REJECTED: { tone: "danger", icon: "CloudAlert" },
  FAILED: { tone: "danger", icon: "CircleAlert" },
} as const;

type StatusBadgeProps = {
  value: string;
};

export function StatusBadge({ value }: StatusBadgeProps) {
  const config =
    statusMap[value as keyof typeof statusMap] ??
    ({ tone: "neutral", icon: "CircleCheck" } as const);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${toneClass[config.tone]}`}
    >
      <Icon name={config.icon} size={16} />
      {value}
    </span>
  );
}
