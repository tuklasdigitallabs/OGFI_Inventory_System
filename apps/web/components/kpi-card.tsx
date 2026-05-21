import Link from "next/link";
import type { Kpi } from "@/lib/screens";
import { Icon } from "@/lib/icons";

const toneClass = {
  success: "text-og-green bg-green-50 border-green-100",
  warning: "text-[#8a5200] bg-orange-50 border-orange-100",
  danger: "text-og-error bg-red-50 border-red-100",
  info: "text-og-info bg-blue-50 border-blue-100",
  neutral: "text-og-gray bg-gray-50 border-og-line",
};

type KpiCardProps = {
  kpi: Kpi;
};

export function KpiCard({ kpi }: KpiCardProps) {
  const content = (
    <article className="og-card min-h-[118px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-og-gray">
            {kpi.label}
          </p>
          <p className="mt-2 font-poppins text-[28px] font-semibold leading-none text-og-dark">
            {kpi.value}
          </p>
        </div>
        <span className={`rounded-md border p-2 ${toneClass[kpi.tone]}`}>
          <Icon name={kpi.icon} size={24} />
        </span>
      </div>
      <p className="mt-3 text-sm text-og-gray">{kpi.meta}</p>
    </article>
  );

  if (!kpi.href) {
    return content;
  }

  return (
    <Link className="block transition hover:-translate-y-0.5" href={kpi.href}>
      {content}
    </Link>
  );
}
