import type { Action } from '@/lib/screens';
import { Icon } from '@/lib/icons';

const variantClass = {
  primary: 'border-og-green bg-og-green text-white hover:bg-[#0b3f10]',
  secondary: 'border-og-line bg-white text-og-dark hover:border-og-green hover:text-og-green',
  warning: 'border-og-orange bg-og-orange text-og-dark hover:bg-[#e39c14]',
  danger: 'border-og-error bg-og-error text-white hover:bg-[#b91c1c]',
};

type ActionButtonProps = {
  action: Action;
};

export function ActionButton({ action }: ActionButtonProps) {
  return (
    <button
      className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition ${variantClass[action.variant ?? 'secondary']}`}
      type="button"
    >
      <Icon name={action.icon} size={18} />
      <span>{action.label}</span>
    </button>
  );
}
