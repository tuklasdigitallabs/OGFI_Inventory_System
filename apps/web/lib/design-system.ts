export const designSystem = {
  colors: {
    primary: '#0E4D13',
    secondary: '#F3AB1B',
    backgroundAccent: '#FFDCA6',
    dark: '#1C1C1C',
    gray: '#6B7280',
    lightGray: '#E5E7EB',
    white: '#FFFFFF',
    error: '#DC2626',
    info: '#2563EB',
  },
  typography: {
    ui: 'Inter',
    headings: 'Poppins',
    table: '12px',
    default: '14px',
    forms: '16px',
  },
  spacing: {
    tight: '4px',
    default: '8px',
    section: '16px',
    largeSection: '24px',
  },
} as const;

export const statusTone = {
  Approved: 'success',
  Posted: 'success',
  Pending: 'warning',
  Draft: 'neutral',
  Rejected: 'danger',
  'In Transit': 'info',
  Variance: 'warning',
  Processing: 'info',
  Offline: 'danger',
} as const;
