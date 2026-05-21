import type { IconName } from "./icons";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export type Kpi = {
  label: string;
  value: string;
  meta: string;
  icon: IconName;
  tone: StatusTone;
  href?: string;
};

export type Action = {
  label: string;
  icon: IconName;
  variant?: "primary" | "secondary" | "warning" | "danger";
};

export type Screen = {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  icon: IconName;
  actions: Action[];
  filters: string[];
  kpis: Kpi[];
  table: {
    columns: string[];
    rows: string[][];
  };
};

export const navigation = [
  {
    label: "Dashboard",
    href: "/",
    icon: "LayoutDashboard",
    permissions: ["inventory.stock:read"],
  },
  {
    label: "Inventory",
    href: "/inventory",
    icon: "Package",
    permissions: ["inventory.stock:read"],
  },
  {
    label: "Master Data",
    href: "/master-data",
    icon: "Database",
    permissions: ["master-data.items:read"],
  },
  {
    label: "Purchasing",
    href: "/purchasing",
    icon: "ShoppingCart",
    permissions: ["purchasing.purchase-orders:read"],
  },
  {
    label: "Receiving",
    href: "/receiving",
    icon: "PackageCheck",
    permissions: ["purchasing.receivings:read", "purchasing.receivings:create"],
  },
  {
    label: "Transfers",
    href: "/transfers",
    icon: "Truck",
    permissions: ["transfers:read"],
  },
  {
    label: "Store Operations",
    href: "/store-operations",
    icon: "Store",
    permissions: [
      "branch.wastage:read",
      "branch.stock-counts:read",
      "branch.issues:read",
      "branch.sales-batches:read",
    ],
  },
  {
    label: "Recipes",
    href: "/recipes",
    icon: "ChefHat",
    permissions: ["master-data.recipes:read"],
  },
  {
    label: "Menu Pricing",
    href: "/menu-pricing",
    icon: "Utensils",
    permissions: ["menu-pricing:read"],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: "BarChart3",
    permissions: ["reports:read"],
  },
  {
    label: "Offline Sync",
    href: "/offline-sync",
    icon: "CloudSync",
    permissions: ["sync:read", "sync:submit"],
  },
  {
    label: "Admin Settings",
    href: "/admin",
    icon: "Settings",
    permissions: ["admin.users:read", "admin.roles:read", "admin.audit:read"],
  },
] satisfies Array<{
  label: string;
  href: string;
  icon: IconName;
  permissions: string[];
}>;

export function canAccessNavigationItem(
  userPermissions: string[] | undefined,
  item: (typeof navigation)[number],
) {
  return item.permissions.some((permission) =>
    userPermissions?.includes(permission),
  );
}

export const dashboard: Screen = {
  slug: "",
  title: "Operations Dashboard",
  eyebrow: "Central Inventory Console",
  description:
    "Live operational view for stock value, pending movements, sync health, and inventory exceptions.",
  icon: "LayoutDashboard",
  actions: [
    { label: "Filter", icon: "Filter", variant: "secondary" },
    { label: "Refresh", icon: "RefreshCw", variant: "primary" },
  ],
  filters: ["Business date", "Location", "Category", "Item type"],
  kpis: [
    {
      label: "Total Stock Value",
      value: "PHP 1.28M",
      meta: "Across active locations",
      icon: "Coins",
      tone: "success",
    },
    {
      label: "Low Stock",
      value: "18",
      meta: "Items below threshold",
      icon: "AlertTriangle",
      tone: "warning",
    },
    {
      label: "Pending Transfers",
      value: "7",
      meta: "Awaiting dispatch or receive",
      icon: "Truck",
      tone: "info",
    },
    {
      label: "Pending Sync",
      value: "4",
      meta: "Offline events queued",
      icon: "CloudUpload",
      tone: "warning",
    },
    {
      label: "Wastage This Period",
      value: "PHP 12.4K",
      meta: "Approved and draft records",
      icon: "Trash2",
      tone: "danger",
    },
    {
      label: "Variance",
      value: "3",
      meta: "Needs manager review",
      icon: "Scale",
      tone: "warning",
    },
  ],
  table: {
    columns: ["Time", "Location", "Movement", "Reference", "Status"],
    rows: [
      ["09:42", "Warehouse", "RECEIVE", "RR-000184", "Posted"],
      ["09:18", "OGFI Branch 2", "TRANSFER_IN", "TR-000531", "Variance"],
      ["08:57", "OGFI Branch 1", "WASTAGE", "WA-000082", "Pending"],
      ["08:12", "Warehouse", "TRANSFER_OUT", "TR-000532", "In Transit"],
    ],
  },
};

export const screens: Record<string, Screen> = {
  "master-data": {
    slug: "master-data",
    title: "Master Data",
    eyebrow: "Administration",
    description:
      "Maintain item catalogs, UOMs, suppliers, locations, categories, reason codes, and recipe ingredients.",
    icon: "Database",
    actions: [
      { label: "Create", icon: "FilePlus2", variant: "primary" },
      { label: "Update", icon: "Save", variant: "secondary" },
      { label: "Deactivate", icon: "Trash2", variant: "danger" },
    ],
    filters: ["Resource", "Status", "Search", "Type"],
    kpis: [
      {
        label: "Items",
        value: "Live",
        meta: "Catalog and costing setup",
        icon: "Package",
        tone: "success",
      },
      {
        label: "Suppliers",
        value: "Live",
        meta: "Purchasing master records",
        icon: "Handshake",
        tone: "info",
      },
      {
        label: "Recipes",
        value: "Live",
        meta: "Ingredient and yield setup",
        icon: "ChefHat",
        tone: "success",
      },
    ],
    table: {
      columns: ["Resource", "Records", "Status"],
      rows: [
        ["Items", "Live API", "Active"],
        ["UOMs", "Live API", "Active"],
        ["Recipes", "Live API", "Active"],
      ],
    },
  },
  inventory: {
    slug: "inventory",
    title: "Stock On Hand",
    eyebrow: "Inventory",
    description:
      "Computed balances by location and item from immutable ledger events.",
    icon: "Boxes",
    actions: [
      { label: "Search", icon: "Search", variant: "secondary" },
      { label: "Filter", icon: "Filter", variant: "secondary" },
      {
        label: "Adjustment Request",
        icon: "SlidersHorizontal",
        variant: "warning",
      },
    ],
    filters: ["Location", "Category", "Item type", "Low stock only"],
    kpis: [
      {
        label: "Available Stock",
        value: "1,842",
        meta: "Positive-balance item lots",
        icon: "CircleCheck",
        tone: "success",
      },
      {
        label: "Insufficient Stock",
        value: "11",
        meta: "Cannot dispatch fully",
        icon: "OctagonAlert",
        tone: "danger",
      },
      {
        label: "Warehouse Count",
        value: "Due Fri",
        meta: "Next scheduled count",
        icon: "ClipboardCheck",
        tone: "info",
      },
    ],
    table: {
      columns: ["SKU", "Item", "Location", "Qty", "Avg Cost", "Status"],
      rows: [
        [
          "RM-001",
          "Chicken Fillet",
          "Warehouse",
          "124.50 kg",
          "PHP 186.20",
          "OK",
        ],
        ["PK-004", "12oz Cup", "Branch 1", "480 pc", "PHP 2.10", "Low"],
        [
          "SP-008",
          "Cleaning Solution",
          "Branch 2",
          "0 bottle",
          "PHP 98.00",
          "Out of Stock",
        ],
      ],
    },
  },
  purchasing: {
    slug: "purchasing",
    title: "Purchase Orders",
    eyebrow: "Purchasing",
    description:
      "Create, submit, approve, and review supplier purchase orders.",
    icon: "ShoppingCart",
    actions: [
      { label: "Create PO", icon: "FilePlus2", variant: "primary" },
      { label: "Submit for Approval", icon: "Send", variant: "secondary" },
      { label: "Print PO", icon: "Printer", variant: "secondary" },
    ],
    filters: ["Supplier", "Status", "Expected date", "Location"],
    kpis: [
      {
        label: "Draft POs",
        value: "5",
        meta: "Saved but not submitted",
        icon: "FilePenLine",
        tone: "neutral",
      },
      {
        label: "Pending Approval",
        value: "3",
        meta: "Needs approver action",
        icon: "Clock",
        tone: "warning",
      },
      {
        label: "Approved",
        value: "14",
        meta: "Ready for receiving",
        icon: "CheckCircle2",
        tone: "success",
      },
    ],
    table: {
      columns: ["PO No.", "Supplier", "Location", "Expected", "Status"],
      rows: [
        ["PO-000219", "Prime Poultry", "Warehouse", "May 6", "Approved"],
        ["PO-000220", "Fresh Produce Co.", "Warehouse", "May 7", "Pending"],
        ["PO-000221", "PackRight", "Warehouse", "May 8", "Draft"],
      ],
    },
  },
  receiving: {
    slug: "receiving",
    title: "Supplier Receiving",
    eyebrow: "Receiving",
    description:
      "Match PO lines, verify quantity and quality, then post RECEIVE ledger events.",
    icon: "PackageCheck",
    actions: [
      { label: "Receive Goods", icon: "PackageCheck", variant: "primary" },
      { label: "Partial Receive", icon: "Split", variant: "secondary" },
      { label: "Attach DR/Invoice", icon: "Paperclip", variant: "secondary" },
    ],
    filters: ["PO number", "Supplier", "Variance found", "Business date"],
    kpis: [
      {
        label: "Receiving List",
        value: "9",
        meta: "Documents today",
        icon: "ClipboardCheck",
        tone: "info",
      },
      {
        label: "Variance Found",
        value: "2",
        meta: "Short or over delivery",
        icon: "AlertTriangle",
        tone: "warning",
      },
      {
        label: "Post Receive",
        value: "6",
        meta: "Ready to ledger post",
        icon: "CheckCircle2",
        tone: "success",
      },
    ],
    table: {
      columns: ["RR No.", "Supplier", "PO", "Accepted", "Status"],
      rows: [
        ["RR-000184", "Prime Poultry", "PO-000219", "23 lines", "Posted"],
        ["RR-000185", "Fresh Produce Co.", "PO-000220", "8 lines", "Variance"],
        ["RR-000186", "PackRight", "PO-000221", "12 lines", "Pending"],
      ],
    },
  },
  transfers: {
    slug: "transfers",
    title: "Location to Location Transfers",
    eyebrow: "Transfers",
    description:
      "Request, approve, dispatch, receive, and resolve stock movement variances.",
    icon: "ArrowRightLeft",
    actions: [
      { label: "Create Request", icon: "FilePlus2", variant: "primary" },
      { label: "Dispatch", icon: "Truck", variant: "secondary" },
      { label: "Confirm Receive", icon: "PackageCheck", variant: "secondary" },
    ],
    filters: ["Source", "Destination", "Status", "Needed date"],
    kpis: [
      {
        label: "In Transit",
        value: "4",
        meta: "Dispatched to branch",
        icon: "Route",
        tone: "info",
      },
      {
        label: "Variance Capture",
        value: "2",
        meta: "Received qty mismatch",
        icon: "Scale",
        tone: "warning",
      },
      {
        label: "Approved Requests",
        value: "8",
        meta: "Ready for picking",
        icon: "CheckCircle2",
        tone: "success",
      },
    ],
    table: {
      columns: ["Transfer", "From", "To", "Lines", "Status"],
      rows: [
        ["TR-000531", "Warehouse", "Branch 2", "18", "Variance"],
        ["TR-000532", "Warehouse", "Branch 1", "10", "In Transit"],
        ["TR-000533", "Warehouse", "Branch 3", "22", "Approved"],
      ],
    },
  },
  "store-operations": {
    slug: "store-operations",
    title: "Store Operations",
    eyebrow: "Branch Store",
    description:
      "Daily branch inventory workflow for receiving, wastage, stock counts, issue to ops, and sales batches.",
    icon: "Store",
    actions: [
      { label: "Wastage Entry", icon: "Trash2", variant: "warning" },
      { label: "Stock Count", icon: "ClipboardCheck", variant: "secondary" },
      { label: "Sales Batch", icon: "ReceiptText", variant: "primary" },
    ],
    filters: ["Branch", "Business date", "Entry type", "Approval status"],
    kpis: [
      {
        label: "Transfer Receiving",
        value: "3",
        meta: "Awaiting branch confirm",
        icon: "Inbox",
        tone: "info",
      },
      {
        label: "Pending Approval",
        value: "6",
        meta: "Manager review required",
        icon: "Clock",
        tone: "warning",
      },
      {
        label: "Rejected Entry",
        value: "1",
        meta: "Returned for correction",
        icon: "XCircle",
        tone: "danger",
      },
    ],
    table: {
      columns: ["Document", "Type", "Branch", "Owner", "Status"],
      rows: [
        ["WA-000082", "Wastage", "Branch 1", "Encoder A", "Pending"],
        ["SC-000043", "Stock Count", "Branch 2", "Manager B", "Draft"],
        ["SB-000118", "Sales Batch", "Branch 3", "Encoder C", "Posted"],
      ],
    },
  },
  recipes: {
    slug: "recipes",
    title: "Recipes",
    eyebrow: "Recipe Management",
    description:
      "Recipe versions, ingredient lines, UOM conversion, menu mapping, and consumption cost preview.",
    icon: "ChefHat",
    actions: [
      { label: "Create Recipe", icon: "FilePlus2", variant: "primary" },
      { label: "Cost Preview", icon: "Calculator", variant: "secondary" },
      { label: "Version History", icon: "History", variant: "secondary" },
    ],
    filters: ["Finished item", "Ingredient", "Active version", "Category"],
    kpis: [
      {
        label: "Recipes List",
        value: "86",
        meta: "Active recipe versions",
        icon: "ChefHat",
        tone: "success",
      },
      {
        label: "Menu Item Mapping",
        value: "74",
        meta: "Mapped POS items",
        icon: "Link",
        tone: "info",
      },
      {
        label: "Sales Consumption",
        value: "Ready",
        meta: "Ingredient consumption configured",
        icon: "UtensilsCrossed",
        tone: "success",
      },
    ],
    table: {
      columns: ["Recipe", "Version", "Ingredients", "Yield", "Status"],
      rows: [
        ["Classic Chicken Bowl", "v3", "8", "94%", "Approved"],
        ["Signature Rice Meal", "v2", "11", "91%", "Approved"],
        ["Family Platter", "v1", "15", "Draft"],
      ],
    },
  },
  "menu-pricing": {
    slug: "menu-pricing",
    title: "Menu Pricing",
    eyebrow: "Costing and Profitability",
    description:
      "Simulate selling prices from recipe cost, food cost percentage, and gross margin before approval.",
    icon: "Utensils",
    actions: [
      { label: "Create Draft", icon: "FilePlus2", variant: "primary" },
      { label: "Submit", icon: "Send", variant: "secondary" },
      { label: "Approve", icon: "Check", variant: "secondary" },
    ],
    filters: ["Status", "Location", "Channel", "Effective date"],
    kpis: [
      {
        label: "Draft Prices",
        value: "Live",
        meta: "Editable pricing scenarios",
        icon: "FilePenLine",
        tone: "neutral",
      },
      {
        label: "Approved Prices",
        value: "Live",
        meta: "Active official menu prices",
        icon: "BadgeCheck",
        tone: "success",
      },
      {
        label: "Margin Review",
        value: "Live",
        meta: "Food cost and gross margin",
        icon: "Calculator",
        tone: "info",
      },
    ],
    table: {
      columns: ["Item", "Price", "Cost / Serving", "Food Cost", "Margin"],
      rows: [],
    },
  },
  reports: {
    slug: "reports",
    title: "Reports and Exports",
    eyebrow: "Reporting",
    description:
      "Run background reports, inspect job status, and download XLSX or PDF exports.",
    icon: "BarChart3",
    actions: [
      { label: "Run Report", icon: "PlayCircle", variant: "primary" },
      { label: "Download XLSX", icon: "FileSpreadsheet", variant: "secondary" },
      { label: "Download PDF", icon: "FileText", variant: "secondary" },
    ],
    filters: ["Report", "Date range", "Location", "Export format"],
    kpis: [
      {
        label: "Stock Valuation",
        value: "Queued",
        meta: "Background job",
        icon: "Coins",
        tone: "warning",
      },
      {
        label: "Movement Report",
        value: "12",
        meta: "Runs this week",
        icon: "Activity",
        tone: "info",
      },
      {
        label: "Theoretical vs Actual",
        value: "3",
        meta: "Variance reports",
        icon: "GitCompare",
        tone: "warning",
      },
    ],
    table: {
      columns: ["Report", "Requested By", "Format", "Status", "Output"],
      rows: [
        ["Stock On Hand", "Admin", "XLSX", "Completed", "Download"],
        ["Wastage Summary", "Auditor", "PDF", "Processing", "Pending"],
        ["Transfer Variance", "Warehouse", "XLSX", "Failed", "Retry"],
      ],
    },
  },
  "offline-sync": {
    slug: "offline-sync",
    title: "Offline Sync Center",
    eyebrow: "PWA Sync",
    description:
      "Monitor the IndexedDB queue, sync status, rejected offline entries, and retry controls.",
    icon: "CloudSync",
    actions: [
      { label: "Sync Now", icon: "RefreshCw", variant: "primary" },
      { label: "Retry Sync", icon: "RotateCw", variant: "secondary" },
      { label: "View Local Queue", icon: "Database", variant: "secondary" },
    ],
    filters: ["Device", "Branch", "Status", "App version"],
    kpis: [
      {
        label: "Online",
        value: "Yes",
        meta: "Connection available",
        icon: "Wifi",
        tone: "success",
      },
      {
        label: "Pending Sync",
        value: "4",
        meta: "Local events waiting",
        icon: "CloudUpload",
        tone: "warning",
      },
      {
        label: "Sync Failed",
        value: "1",
        meta: "Rejected offline entry",
        icon: "CloudAlert",
        tone: "danger",
      },
    ],
    table: {
      columns: ["UUID", "Device", "Event", "Retry", "Status"],
      rows: [
        ["a8c1...21", "Branch 1 POS", "WASTAGE", "0", "Pending"],
        ["b9d2...55", "Branch 2 Tablet", "STOCK_COUNT", "1", "Rejected"],
        ["c7a4...18", "Branch 3 POS", "SALES_BATCH", "0", "Approved"],
      ],
    },
  },
  admin: {
    slug: "admin",
    title: "Admin Settings",
    eyebrow: "Governance",
    description:
      "Users, roles, permissions, locations, reason codes, and audit trail controls.",
    icon: "Settings",
    actions: [
      { label: "Create User", icon: "UserPlus", variant: "primary" },
      { label: "Edit User", icon: "Pencil", variant: "secondary" },
      { label: "Deactivate User", icon: "UserX", variant: "danger" },
    ],
    filters: ["Role", "Location access", "Active status", "Audit module"],
    kpis: [
      {
        label: "Users Page",
        value: "42",
        meta: "Active accounts",
        icon: "Users",
        tone: "info",
      },
      {
        label: "Permissions",
        value: "118",
        meta: "Role action toggles",
        icon: "KeyRound",
        tone: "success",
      },
      {
        label: "Audit Trail",
        value: "2.4K",
        meta: "Events this month",
        icon: "ShieldCheck",
        tone: "neutral",
      },
    ],
    table: {
      columns: ["User", "Role", "Location Access", "Last Action", "Status"],
      rows: [
        ["Maria Santos", "Admin", "All", "Updated role matrix", "Approved"],
        [
          "Ben Cruz",
          "Warehouse Manager",
          "Warehouse",
          "Approved transfer",
          "Approved",
        ],
        [
          "Ana Reyes",
          "Branch Encoder",
          "Branch 1",
          "Submitted wastage",
          "Pending",
        ],
      ],
    },
  },
};

export function getScreen(slug?: string) {
  if (!slug) {
    return dashboard;
  }

  return screens[slug] ?? dashboard;
}
