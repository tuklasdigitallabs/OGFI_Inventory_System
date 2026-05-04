import { Icon } from '@/lib/icons';

const toneClass = {
  success: 'border-green-200 bg-green-50 text-og-green',
  warning: 'border-orange-200 bg-orange-50 text-[#8a5200]',
  danger: 'border-red-200 bg-red-50 text-og-error',
  info: 'border-blue-200 bg-blue-50 text-og-info',
  neutral: 'border-og-line bg-gray-50 text-og-gray',
};

const statusMap = {
  Approved: { tone: 'success', icon: 'CheckCircle2' },
  Posted: { tone: 'success', icon: 'BadgeCheck' },
  Completed: { tone: 'success', icon: 'CloudCheck' },
  Pending: { tone: 'warning', icon: 'Clock' },
  Draft: { tone: 'neutral', icon: 'FilePenLine' },
  Rejected: { tone: 'danger', icon: 'XCircle' },
  Failed: { tone: 'danger', icon: 'CircleAlert' },
  Low: { tone: 'warning', icon: 'AlertTriangle' },
  'In Transit': { tone: 'info', icon: 'Route' },
  Variance: { tone: 'warning', icon: 'Scale' },
  Processing: { tone: 'info', icon: 'RefreshCw' },
  Download: { tone: 'info', icon: 'Download' },
  Retry: { tone: 'warning', icon: 'RotateCw' },
} as const;

type StatusBadgeProps = {
  value: string;
};

export function StatusBadge({ value }: StatusBadgeProps) {
  const config = statusMap[value as keyof typeof statusMap] ?? ({ tone: 'neutral', icon: 'CircleCheck' } as const);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${toneClass[config.tone]}`}
    >
      <Icon name={config.icon} size={16} />
      {value}
    </span>
  );
}
