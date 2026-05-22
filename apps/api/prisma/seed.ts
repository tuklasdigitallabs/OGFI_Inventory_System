import {
  PrismaClient,
  ItemType,
  LocationType,
  ReferenceType,
  ReasonCodeType,
  RoleCode,
  TransactionType,
} from "@prisma/client";
import * as bcrypt from "bcrypt";
import { createHash } from "crypto";

const prisma = new PrismaClient();

const permissions = [
  ["auth", "login", "Log in to the system"],
  ["auth", "refresh", "Refresh an access token"],
  ["admin.users", "read", "View users"],
  ["admin.users", "create", "Create users"],
  ["admin.users", "update", "Update users"],
  ["admin.users", "deactivate", "Deactivate users"],
  ["admin.roles", "read", "View roles"],
  ["admin.roles", "update", "Update role permissions"],
  ["admin.audit", "read", "View audit logs"],
  ["admin.devices", "read", "View registered sync devices"],
  ["admin.devices", "create", "Register sync devices"],
  ["admin.devices", "update", "Update sync devices"],
  ["admin.devices", "deactivate", "Deactivate sync devices"],
  ["master-data.items", "read", "View items"],
  ["master-data.items", "create", "Create items"],
  ["master-data.items", "update", "Update items"],
  ["master-data.items", "deactivate", "Deactivate items"],
  ["master-data.uoms", "read", "View units of measure"],
  ["master-data.uoms", "create", "Create units of measure"],
  ["master-data.uoms", "update", "Update units of measure"],
  ["master-data.uoms", "deactivate", "Deactivate units of measure"],
  ["master-data.uom-conversions", "read", "View UOM conversions"],
  ["master-data.uom-conversions", "create", "Create UOM conversions"],
  ["master-data.uom-conversions", "update", "Update UOM conversions"],
  ["master-data.uom-conversions", "deactivate", "Remove UOM conversions"],
  ["master-data.locations", "read", "View locations"],
  ["master-data.locations", "create", "Create locations"],
  ["master-data.locations", "update", "Update locations"],
  ["master-data.locations", "deactivate", "Deactivate locations"],
  ["master-data.suppliers", "read", "View suppliers"],
  ["master-data.suppliers", "create", "Create suppliers"],
  ["master-data.suppliers", "update", "Update suppliers"],
  ["master-data.suppliers", "deactivate", "Deactivate suppliers"],
  ["master-data.categories", "read", "View categories"],
  ["master-data.categories", "create", "Create categories"],
  ["master-data.categories", "update", "Update categories"],
  ["master-data.categories", "deactivate", "Deactivate categories"],
  ["master-data.reason-codes", "read", "View reason codes"],
  ["master-data.reason-codes", "create", "Create reason codes"],
  ["master-data.reason-codes", "update", "Update reason codes"],
  ["master-data.reason-codes", "deactivate", "Deactivate reason codes"],
  ["master-data.recipes", "read", "View recipes and BOMs"],
  ["master-data.recipes", "create", "Create recipes and BOMs"],
  ["master-data.recipes", "update", "Update recipes and BOMs"],
  ["master-data.recipes", "deactivate", "Deactivate recipes and BOMs"],
  ["menu-pricing", "read", "View menu pricing and margins"],
  ["menu-pricing", "create", "Create menu pricing drafts"],
  ["menu-pricing", "approve", "Approve menu pricing"],
  ["inventory.stock", "read", "View stock on hand"],
  ["inventory.movements", "read", "View inventory movements"],
  ["inventory.adjustments", "read", "View adjustment requests"],
  ["inventory.adjustments", "create", "Create adjustment requests"],
  ["inventory.adjustments", "approve", "Approve adjustment requests"],
  ["ledger.events", "post", "Post ledger events"],
  ["ledger.events", "read", "View ledger events"],
  ["purchasing.purchase-orders", "read", "View purchase orders"],
  ["purchasing.purchase-orders", "create", "Create purchase orders"],
  ["purchasing.purchase-orders", "approve", "Approve purchase orders"],
  ["purchasing.receivings", "read", "View supplier receiving records"],
  ["purchasing.receivings", "create", "Receive supplier deliveries"],
  ["transfers", "read", "View transfers"],
  ["transfers", "create", "Create transfers"],
  ["transfers", "approve", "Approve transfers"],
  ["transfers", "dispatch", "Dispatch transfers"],
  ["transfers", "receive", "Receive transfers"],
  ["branch.wastage", "read", "View wastage"],
  ["branch.wastage", "create", "Record wastage"],
  ["branch.stock-counts", "read", "View stock counts"],
  ["branch.stock-counts", "submit", "Submit stock counts"],
  ["branch.issues", "read", "View stock issued to operations"],
  ["branch.issues", "create", "Issue stock to operations"],
  ["branch.sales-batches", "read", "View branch sales batches"],
  ["branch.sales-batches", "create", "Create branch sales batches"],
  ["sales.batches", "read", "View sales batches"],
  ["sales.batches", "create", "Create sales batches"],
  ["reports", "read", "View reports"],
  ["reports", "run", "Run reports"],
  ["sync", "read", "View sync status"],
  ["sync", "submit", "Submit offline sync batches"],
] as const;

const roles = [
  [RoleCode.ADMIN, "Administrator", "Full system access"],
  [
    RoleCode.WAREHOUSE_MANAGER,
    "Warehouse Manager",
    "Warehouse inventory, ledger, and transfer operations",
  ],
  [RoleCode.PURCHASING, "Purchasing", "Purchase order and receiving workflows"],
  [
    RoleCode.BRANCH_MANAGER,
    "Branch Manager",
    "Branch stock, wastage, count, and transfer workflows",
  ],
  [RoleCode.BRANCH_ENCODER, "Branch Encoder", "Branch data entry workflows"],
  [
    RoleCode.AUDITOR,
    "Auditor",
    "Read-only audit, inventory, and reporting access",
  ],
  [RoleCode.VIEWER, "Viewer", "Read-only operational visibility"],
] as const;

const rolePermissionRules: Record<RoleCode, Array<[string, string]>> = {
  [RoleCode.ADMIN]: permissions.map(([module, action]) => [module, action]),
  [RoleCode.WAREHOUSE_MANAGER]: [
    ["inventory.stock", "read"],
    ["inventory.movements", "read"],
    ["inventory.adjustments", "read"],
    ["inventory.adjustments", "create"],
    ["inventory.adjustments", "approve"],
    ["ledger.events", "post"],
    ["ledger.events", "read"],
    ["master-data.items", "read"],
    ["master-data.uoms", "read"],
    ["master-data.uom-conversions", "read"],
    ["master-data.locations", "read"],
    ["master-data.categories", "read"],
    ["master-data.reason-codes", "read"],
    ["master-data.recipes", "read"],
    ["master-data.recipes", "create"],
    ["master-data.recipes", "update"],
    ["master-data.recipes", "deactivate"],
    ["menu-pricing", "read"],
    ["menu-pricing", "create"],
    ["menu-pricing", "approve"],
    ["transfers", "read"],
    ["transfers", "create"],
    ["transfers", "approve"],
    ["transfers", "dispatch"],
    ["transfers", "receive"],
    ["reports", "read"],
    ["reports", "run"],
  ],
  [RoleCode.PURCHASING]: [
    ["inventory.stock", "read"],
    ["master-data.items", "read"],
    ["master-data.uoms", "read"],
    ["master-data.uom-conversions", "read"],
    ["master-data.suppliers", "read"],
    ["master-data.suppliers", "create"],
    ["master-data.suppliers", "update"],
    ["master-data.categories", "read"],
    ["purchasing.purchase-orders", "read"],
    ["purchasing.purchase-orders", "create"],
    ["purchasing.purchase-orders", "approve"],
    ["purchasing.receivings", "read"],
    ["purchasing.receivings", "create"],
    ["reports", "read"],
  ],
  [RoleCode.BRANCH_MANAGER]: [
    ["inventory.stock", "read"],
    ["inventory.movements", "read"],
    ["inventory.adjustments", "read"],
    ["inventory.adjustments", "create"],
    ["inventory.adjustments", "approve"],
    ["ledger.events", "read"],
    ["master-data.items", "read"],
    ["master-data.uoms", "read"],
    ["master-data.locations", "read"],
    ["master-data.categories", "read"],
    ["master-data.reason-codes", "read"],
    ["transfers", "read"],
    ["transfers", "create"],
    ["transfers", "receive"],
    ["branch.wastage", "read"],
    ["branch.wastage", "create"],
    ["branch.stock-counts", "read"],
    ["branch.stock-counts", "submit"],
    ["branch.issues", "read"],
    ["branch.issues", "create"],
    ["branch.sales-batches", "read"],
    ["branch.sales-batches", "create"],
    ["sync", "read"],
    ["sync", "submit"],
    ["reports", "read"],
  ],
  [RoleCode.BRANCH_ENCODER]: [
    ["inventory.stock", "read"],
    ["inventory.adjustments", "read"],
    ["inventory.adjustments", "create"],
    ["master-data.items", "read"],
    ["master-data.uoms", "read"],
    ["master-data.locations", "read"],
    ["master-data.categories", "read"],
    ["master-data.reason-codes", "read"],
    ["transfers", "read"],
    ["branch.wastage", "create"],
    ["branch.stock-counts", "submit"],
    ["branch.issues", "read"],
    ["branch.issues", "create"],
    ["branch.sales-batches", "read"],
    ["branch.sales-batches", "create"],
    ["sync", "read"],
    ["sync", "submit"],
  ],
  [RoleCode.AUDITOR]: [
    ["admin.audit", "read"],
    ["inventory.stock", "read"],
    ["inventory.movements", "read"],
    ["inventory.adjustments", "read"],
    ["ledger.events", "read"],
    ["master-data.items", "read"],
    ["master-data.uoms", "read"],
    ["master-data.uom-conversions", "read"],
    ["master-data.locations", "read"],
    ["master-data.suppliers", "read"],
    ["master-data.categories", "read"],
    ["master-data.reason-codes", "read"],
    ["master-data.recipes", "read"],
    ["menu-pricing", "read"],
    ["purchasing.purchase-orders", "read"],
    ["purchasing.receivings", "read"],
    ["transfers", "read"],
    ["branch.wastage", "read"],
    ["branch.stock-counts", "read"],
    ["branch.issues", "read"],
    ["branch.sales-batches", "read"],
    ["reports", "read"],
  ],
  [RoleCode.VIEWER]: [
    ["inventory.stock", "read"],
    ["inventory.movements", "read"],
    ["inventory.adjustments", "read"],
    ["master-data.items", "read"],
    ["master-data.uoms", "read"],
    ["master-data.uom-conversions", "read"],
    ["master-data.locations", "read"],
    ["master-data.suppliers", "read"],
    ["master-data.categories", "read"],
    ["master-data.reason-codes", "read"],
    ["purchasing.receivings", "read"],
    ["reports", "read"],
  ],
};

const locations = [
  ["MAIN-WH", "Main Commissary Warehouse", LocationType.WAREHOUSE],
  ["BGC-01", "BGC Branch", LocationType.BRANCH],
  ["MAKATI-01", "Makati Branch", LocationType.BRANCH],
  ["QC-01", "Quezon City Branch", LocationType.BRANCH],
  ["ORTIGAS-01", "Ortigas Branch", LocationType.BRANCH],
  ["CEBU-01", "Cebu Branch", LocationType.BRANCH],
] as const;

const syncDevices = [
  ["DEV-MAIN-WH-0001", "Main Warehouse Tablet 1", "Tablet", "MAIN-WH"],
  ["DEV-BGC-01-0001", "BGC Branch Tablet 1", "Tablet", "BGC-01"],
  ["DEV-MAKATI-01-0001", "Makati Branch Tablet 1", "Tablet", "MAKATI-01"],
  ["DEV-QC-01-0001", "Quezon City Branch Tablet 1", "Tablet", "QC-01"],
  ["DEV-ORTIGAS-01-0001", "Ortigas Branch Tablet 1", "Tablet", "ORTIGAS-01"],
  ["DEV-CEBU-01-0001", "Cebu Branch Tablet 1", "Tablet", "CEBU-01"],
] as const;

const uoms = [
  ["KG", "Kilogram"],
  ["G", "Gram"],
  ["L", "Liter"],
  ["ML", "Milliliter"],
  ["PC", "Piece"],
  ["BOX", "Box"],
  ["CASE", "Case"],
  ["BAG", "Bag"],
  ["BTL", "Bottle"],
  ["CAN", "Can"],
  ["PACK", "Pack"],
] as const;

const uomConversions = [
  ["KG", "G", "1000"],
  ["G", "KG", "0.001"],
  ["L", "ML", "1000"],
  ["ML", "L", "0.001"],
  ["BOX", "KG", "5"],
  ["KG", "BOX", "0.2"],
  ["BTL", "L", "1"],
  ["L", "BTL", "1"],
  ["CASE", "PC", "24"],
  ["PC", "CASE", "0.041666667"],
  ["CASE", "CAN", "24"],
  ["CAN", "CASE", "0.041666667"],
  ["CASE", "BTL", "24"],
  ["BTL", "CASE", "0.041666667"],
  ["PACK", "PC", "100"],
  ["PC", "PACK", "0.01"],
] as const;

const categories = [
  "Meat",
  "Produce",
  "Staples",
  "Packaging",
  "Sauces",
  "Dairy",
  "Beverages",
  "Cleaning",
  "Finished Goods",
  "Loose Items",
];

const items = [
  ["BEEF-BRISKET", "Beef Brisket", ItemType.RAW_MATERIAL, "Meat", "KG", "5"],
  ["BEEF-SIRLOIN", "Beef Sirloin", ItemType.RAW_MATERIAL, "Meat", "KG", "6"],
  [
    "BEEF-GYUDON",
    "Gyudon Beef Slice",
    ItemType.RAW_MATERIAL,
    "Meat",
    "KG",
    "4",
  ],
  [
    "CHICKEN-THIGH",
    "Chicken Thigh Fillet",
    ItemType.RAW_MATERIAL,
    "Meat",
    "KG",
    "8",
  ],
  [
    "CHICKEN-BREAST",
    "Chicken Breast Fillet",
    ItemType.RAW_MATERIAL,
    "Meat",
    "KG",
    "8",
  ],
  ["PORK-BELLY", "Pork Belly", ItemType.RAW_MATERIAL, "Meat", "KG", "5"],
  [
    "LETTUCE-ROMAINE",
    "Romaine Lettuce",
    ItemType.RAW_MATERIAL,
    "Produce",
    "KG",
    "3",
  ],
  [
    "CABBAGE-GREEN",
    "Green Cabbage",
    ItemType.RAW_MATERIAL,
    "Produce",
    "KG",
    "8",
  ],
  ["CARROT", "Carrot", ItemType.RAW_MATERIAL, "Produce", "KG", "5"],
  ["ONION-RED", "Red Onion", ItemType.RAW_MATERIAL, "Produce", "KG", "4"],
  [
    "GARLIC-PEELED",
    "Peeled Garlic",
    ItemType.RAW_MATERIAL,
    "Produce",
    "KG",
    "2",
  ],
  ["EGG-LARGE", "Large Egg", ItemType.RAW_MATERIAL, "Dairy", "PC", "120"],
  [
    "RICE-JASMINE",
    "Jasmine Rice",
    ItemType.RAW_MATERIAL,
    "Staples",
    "KG",
    "15",
  ],
  [
    "RICE-JAPANESE",
    "Japanese Rice",
    ItemType.RAW_MATERIAL,
    "Staples",
    "KG",
    "15",
  ],
  [
    "NOODLE-RAMEN",
    "Ramen Noodles",
    ItemType.RAW_MATERIAL,
    "Staples",
    "KG",
    "10",
  ],
  [
    "FLOUR-AP",
    "All-purpose Flour",
    ItemType.RAW_MATERIAL,
    "Staples",
    "KG",
    "8",
  ],
  [
    "COOKING-OIL",
    "Cooking Oil",
    ItemType.RAW_MATERIAL,
    "Loose Items",
    "L",
    "12",
  ],
  ["SOY-SAUCE", "Soy Sauce", ItemType.RAW_MATERIAL, "Sauces", "L", "8"],
  [
    "TERIYAKI-SAUCE",
    "Teriyaki Sauce",
    ItemType.RAW_MATERIAL,
    "Sauces",
    "L",
    "6",
  ],
  [
    "MAYO-JAPANESE",
    "Japanese Mayo",
    ItemType.RAW_MATERIAL,
    "Sauces",
    "KG",
    "4",
  ],
  [
    "SAUCE-CUP-2OZ",
    "2oz Sauce Cup",
    ItemType.PACKAGING,
    "Packaging",
    "PC",
    "200",
  ],
  [
    "BOWL-24OZ",
    "24oz Paper Bowl",
    ItemType.PACKAGING,
    "Packaging",
    "PC",
    "300",
  ],
  ["LID-24OZ", "24oz Bowl Lid", ItemType.PACKAGING, "Packaging", "PC", "300"],
  [
    "CHOPSTICKS",
    "Disposable Chopsticks",
    ItemType.PACKAGING,
    "Packaging",
    "PC",
    "500",
  ],
  [
    "PAPER-BAG-M",
    "Medium Paper Bag",
    ItemType.PACKAGING,
    "Packaging",
    "PC",
    "200",
  ],
  ["COKE-CAN", "Coke Can", ItemType.SUPPLY, "Beverages", "CAN", "48"],
  ["BOTTLED-WATER", "Bottled Water", ItemType.SUPPLY, "Beverages", "BTL", "48"],
  [
    "DISHWASHING-LIQUID",
    "Dishwashing Liquid",
    ItemType.SUPPLY,
    "Cleaning",
    "L",
    "5",
  ],
  [
    "BEEF-BOWL",
    "Beef Rice Bowl",
    ItemType.FINISHED_GOOD,
    "Finished Goods",
    "PC",
    "20",
  ],
  [
    "CHICKEN-BOWL",
    "Chicken Rice Bowl",
    ItemType.FINISHED_GOOD,
    "Finished Goods",
    "PC",
    "20",
  ],
  [
    "PORK-BOWL",
    "Pork Rice Bowl",
    ItemType.FINISHED_GOOD,
    "Finished Goods",
    "PC",
    "20",
  ],
] as const;

const suppliers = [
  [
    "Prime Poultry",
    "Maria Santos",
    "orders@primepoultry.local",
    "555-0101",
    "Net 15",
  ],
  [
    "Fresh Produce Co.",
    "Jose Reyes",
    "orders@freshproduce.local",
    "555-0102",
    "Net 7",
  ],
  [
    "Manila Meat Depot",
    "Ramon Chua",
    "orders@manilameat.local",
    "555-0104",
    "Net 14",
  ],
  [
    "Golden Grains Trading",
    "Liza Tan",
    "sales@goldengrains.local",
    "555-0105",
    "Net 30",
  ],
  [
    "SauceWorks Manila",
    "Ben Lim",
    "orders@sauceworks.local",
    "555-0106",
    "Net 15",
  ],
  [
    "Beverage Hub",
    "Mina Garcia",
    "orders@beveragehub.local",
    "555-0107",
    "COD",
  ],
  [
    "CleanOps Supply",
    "Carlo Dizon",
    "sales@cleanops.local",
    "555-0108",
    "Net 30",
  ],
  ["PackRight", "Ana Cruz", "orders@packright.local", "555-0103", "Net 30"],
] as const;

const supplierItems = [
  ["Prime Poultry", "CHICKEN-THIGH", "185.000000"],
  ["Prime Poultry", "CHICKEN-BREAST", "195.000000"],
  ["Prime Poultry", "BEEF-BRISKET", "420.000000"],
  ["Manila Meat Depot", "BEEF-BRISKET", "415.000000"],
  ["Manila Meat Depot", "BEEF-SIRLOIN", "520.000000"],
  ["Manila Meat Depot", "BEEF-GYUDON", "455.000000"],
  ["Manila Meat Depot", "PORK-BELLY", "315.000000"],
  ["Fresh Produce Co.", "BEEF-BOWL", "145.000000"],
  ["Fresh Produce Co.", "BEEF-BRISKET", "430.000000"],
  ["Fresh Produce Co.", "CHICKEN-THIGH", "190.000000"],
  ["Fresh Produce Co.", "LETTUCE-ROMAINE", "95.000000"],
  ["Fresh Produce Co.", "CABBAGE-GREEN", "58.000000"],
  ["Fresh Produce Co.", "CARROT", "72.000000"],
  ["Fresh Produce Co.", "ONION-RED", "110.000000"],
  ["Fresh Produce Co.", "GARLIC-PEELED", "180.000000"],
  ["Fresh Produce Co.", "EGG-LARGE", "8.750000"],
  ["Fresh Produce Co.", "RICE-JASMINE", "68.000000"],
  ["Golden Grains Trading", "RICE-JASMINE", "66.000000"],
  ["Golden Grains Trading", "RICE-JAPANESE", "92.000000"],
  ["Golden Grains Trading", "NOODLE-RAMEN", "118.000000"],
  ["Golden Grains Trading", "FLOUR-AP", "54.000000"],
  ["Golden Grains Trading", "COOKING-OIL", "78.000000"],
  ["SauceWorks Manila", "SOY-SAUCE", "72.000000"],
  ["SauceWorks Manila", "TERIYAKI-SAUCE", "148.000000"],
  ["SauceWorks Manila", "MAYO-JAPANESE", "220.000000"],
  ["PackRight", "BEEF-BOWL", "8.500000"],
  ["PackRight", "SAUCE-CUP-2OZ", "1.850000"],
  ["PackRight", "BOWL-24OZ", "5.200000"],
  ["PackRight", "LID-24OZ", "2.450000"],
  ["PackRight", "CHOPSTICKS", "0.850000"],
  ["PackRight", "PAPER-BAG-M", "3.150000"],
  ["Beverage Hub", "COKE-CAN", "28.000000"],
  ["Beverage Hub", "BOTTLED-WATER", "16.000000"],
  ["CleanOps Supply", "DISHWASHING-LIQUID", "95.000000"],
] as const;

const recipes = [
  {
    outputSku: "BEEF-BOWL",
    servingQty: "1",
    yieldPercent: "98",
    wastageFactor: "2",
    lines: [
      ["RICE-JASMINE", "0.180000", "KG"],
      ["BEEF-GYUDON", "0.120000", "KG"],
      ["ONION-RED", "0.030000", "KG"],
      ["SOY-SAUCE", "0.030000", "L"],
      ["BOWL-24OZ", "1.000000", "PC"],
      ["LID-24OZ", "1.000000", "PC"],
    ],
  },
  {
    outputSku: "CHICKEN-BOWL",
    servingQty: "1",
    yieldPercent: "98",
    wastageFactor: "2",
    lines: [
      ["RICE-JASMINE", "0.180000", "KG"],
      ["CHICKEN-THIGH", "0.140000", "KG"],
      ["TERIYAKI-SAUCE", "0.035000", "L"],
      ["BOWL-24OZ", "1.000000", "PC"],
      ["LID-24OZ", "1.000000", "PC"],
    ],
  },
] as const;

const openingStock = [
  ["MAIN-WH", "BEEF-BRISKET", "42", "415.000000"],
  ["MAIN-WH", "BEEF-SIRLOIN", "18", "520.000000"],
  ["MAIN-WH", "BEEF-GYUDON", "30", "455.000000"],
  ["MAIN-WH", "CHICKEN-THIGH", "55", "185.000000"],
  ["MAIN-WH", "CHICKEN-BREAST", "24", "195.000000"],
  ["MAIN-WH", "PORK-BELLY", "22", "315.000000"],
  ["MAIN-WH", "RICE-JASMINE", "180", "66.000000"],
  ["MAIN-WH", "RICE-JAPANESE", "85", "92.000000"],
  ["MAIN-WH", "NOODLE-RAMEN", "36", "118.000000"],
  ["MAIN-WH", "COOKING-OIL", "65", "78.000000"],
  ["MAIN-WH", "SOY-SAUCE", "44", "72.000000"],
  ["MAIN-WH", "TERIYAKI-SAUCE", "30", "148.000000"],
  ["MAIN-WH", "LETTUCE-ROMAINE", "18", "95.000000"],
  ["MAIN-WH", "BOWL-24OZ", "1600", "5.200000"],
  ["MAIN-WH", "LID-24OZ", "1600", "2.450000"],
  ["MAIN-WH", "SAUCE-CUP-2OZ", "2200", "1.850000"],
  ["MAIN-WH", "CHOPSTICKS", "3000", "0.850000"],
  ["MAIN-WH", "PAPER-BAG-M", "900", "3.150000"],
  ["MAIN-WH", "COKE-CAN", "480", "28.000000"],
  ["MAIN-WH", "BOTTLED-WATER", "360", "16.000000"],
  ["MAIN-WH", "DISHWASHING-LIQUID", "24", "95.000000"],
  ["BGC-01", "RICE-JASMINE", "38", "66.000000"],
  ["BGC-01", "BEEF-GYUDON", "12", "455.000000"],
  ["BGC-01", "CHICKEN-THIGH", "14", "185.000000"],
  ["BGC-01", "SOY-SAUCE", "9", "72.000000"],
  ["BGC-01", "TERIYAKI-SAUCE", "7", "148.000000"],
  ["BGC-01", "BOWL-24OZ", "260", "5.200000"],
  ["BGC-01", "LID-24OZ", "260", "2.450000"],
  ["BGC-01", "COKE-CAN", "60", "28.000000"],
  ["MAKATI-01", "RICE-JASMINE", "22", "66.000000"],
  ["MAKATI-01", "BEEF-GYUDON", "5", "455.000000"],
  ["MAKATI-01", "CHICKEN-THIGH", "7", "185.000000"],
  ["MAKATI-01", "BOWL-24OZ", "120", "5.200000"],
  ["MAKATI-01", "LID-24OZ", "120", "2.450000"],
  ["MAKATI-01", "COKE-CAN", "12", "28.000000"],
  ["QC-01", "RICE-JASMINE", "14", "66.000000"],
  ["QC-01", "BEEF-GYUDON", "3", "455.000000"],
  ["QC-01", "CHICKEN-THIGH", "4", "185.000000"],
  ["QC-01", "BOWL-24OZ", "85", "5.200000"],
  ["QC-01", "LID-24OZ", "85", "2.450000"],
  ["QC-01", "COKE-CAN", "0", "28.000000"],
  ["ORTIGAS-01", "RICE-JASMINE", "17", "66.000000"],
  ["ORTIGAS-01", "BEEF-GYUDON", "6", "455.000000"],
  ["ORTIGAS-01", "CHICKEN-THIGH", "5", "185.000000"],
  ["ORTIGAS-01", "BOWL-24OZ", "95", "5.200000"],
  ["ORTIGAS-01", "LID-24OZ", "95", "2.450000"],
  ["ORTIGAS-01", "BOTTLED-WATER", "18", "16.000000"],
  ["CEBU-01", "RICE-JASMINE", "30", "66.000000"],
  ["CEBU-01", "BEEF-GYUDON", "10", "455.000000"],
  ["CEBU-01", "CHICKEN-THIGH", "11", "185.000000"],
  ["CEBU-01", "SOY-SAUCE", "5", "72.000000"],
  ["CEBU-01", "BOWL-24OZ", "180", "5.200000"],
  ["CEBU-01", "LID-24OZ", "180", "2.450000"],
  ["CEBU-01", "BOTTLED-WATER", "0", "16.000000"],
] as const;

const reasonCodes = [
  [ReasonCodeType.WASTAGE, "SPOILAGE", "Spoilage"],
  [ReasonCodeType.WASTAGE, "DAMAGE", "Damaged item"],
  [ReasonCodeType.WASTAGE, "EXPIRED", "Expired item"],
  [ReasonCodeType.ADJUSTMENT, "COUNT_CORRECTION", "Stock count correction"],
  [ReasonCodeType.ADJUSTMENT, "RECEIVING_CORRECTION", "Receiving correction"],
  [ReasonCodeType.VARIANCE, "SHORT_SHIP", "Short shipment"],
  [ReasonCodeType.VARIANCE, "OVER_SHIP", "Over shipment"],
  [ReasonCodeType.CANCELLATION, "DUPLICATE_ENTRY", "Duplicate entry"],
  [ReasonCodeType.CANCELLATION, "USER_ERROR", "User error"],
] as const;

function adminCredentials() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@ogfi.local";
  const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!password) {
    throw new Error(
      "SEED_ADMIN_PASSWORD is required. Set it in ignored apps/api/.env for local development.",
    );
  }

  return {
    email,
    username,
    password,
  };
}

function preserveSeededAccounts() {
  return process.env.PRESERVE_SEEDED_ACCOUNTS === "true";
}

function devSuperCredentials() {
  const password = process.env.SEED_DEV_SUPER_PASSWORD;

  if (!password) {
    return null;
  }

  return {
    email: process.env.SEED_DEV_SUPER_EMAIL ?? "dev.super@ogfi.local",
    username: process.env.SEED_DEV_SUPER_USERNAME ?? "dev-super",
    password,
  };
}

async function seedRoles() {
  for (const [code, name, description] of roles) {
    await prisma.role.upsert({
      where: { code },
      update: { name, description },
      create: { code, name, description },
    });
  }
}

async function seedPermissions() {
  for (const [module, action, description] of permissions) {
    await prisma.permission.upsert({
      where: { module_action: { module, action } },
      update: { description },
      create: { module, action, description },
    });
  }
}

async function seedRolePermissions() {
  for (const [roleCode, rules] of Object.entries(rolePermissionRules) as Array<
    [RoleCode, Array<[string, string]>]
  >) {
    const role = await prisma.role.findUniqueOrThrow({
      where: { code: roleCode },
    });

    for (const [module, action] of rules) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { module_action: { module, action } },
      });

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permission.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
}

async function seedLocations() {
  for (const [code, name, type] of locations) {
    await prisma.location.upsert({
      where: { code },
      update: { name, type, active: true },
      create: { code, name, type },
    });
  }
}

async function seedSyncDevices() {
  for (const [deviceCode, name, type, locationCode] of syncDevices) {
    const location = await prisma.location.findUniqueOrThrow({
      where: { code: locationCode },
    });

    await prisma.syncDevice.upsert({
      where: { deviceCode },
      update: {
        active: true,
        locationId: location.id,
        name,
        type,
      },
      create: {
        deviceCode,
        locationId: location.id,
        name,
        type,
      },
    });
  }
}

async function seedUoms() {
  for (const [code, name] of uoms) {
    await prisma.uom.upsert({
      where: { code },
      update: { name, active: true },
      create: { code, name },
    });
  }

  for (const [fromCode, toCode, factor] of uomConversions) {
    const fromUom = await prisma.uom.findUniqueOrThrow({
      where: { code: fromCode },
    });
    const toUom = await prisma.uom.findUniqueOrThrow({
      where: { code: toCode },
    });

    await prisma.uomConversion.upsert({
      where: {
        fromUomId_toUomId: { fromUomId: fromUom.id, toUomId: toUom.id },
      },
      update: { factor },
      create: { fromUomId: fromUom.id, toUomId: toUom.id, factor },
    });
  }
}

async function seedItems() {
  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: { active: true },
      create: { name },
    });
  }

  for (const [
    sku,
    name,
    itemType,
    categoryName,
    uomCode,
    lowStockThreshold,
  ] of items) {
    const category = await prisma.category.findUniqueOrThrow({
      where: { name: categoryName },
    });
    const baseUom = await prisma.uom.findUniqueOrThrow({
      where: { code: uomCode },
    });

    await prisma.item.upsert({
      where: { sku },
      update: {
        name,
        itemType,
        categoryId: category.id,
        baseUomId: baseUom.id,
        lowStockThreshold,
        active: true,
      },
      create: {
        sku,
        name,
        itemType,
        categoryId: category.id,
        baseUomId: baseUom.id,
        lowStockThreshold,
      },
    });
  }

  const [cookingOil, bottleUom, mlUom] = await Promise.all([
    prisma.item.findUniqueOrThrow({ where: { sku: "COOKING-OIL" } }),
    prisma.uom.findUniqueOrThrow({ where: { code: "BTL" } }),
    prisma.uom.findUniqueOrThrow({ where: { code: "ML" } }),
  ]);

  await prisma.item.update({
    where: { id: cookingOil.id },
    data: {
      looseCountEnabled: true,
      looseRemainderUomId: mlUom.id,
      looseWholeUnitQty: "1",
      looseWholeUomId: bottleUom.id,
    },
  });
}

async function seedReasonCodes() {
  for (const [type, code, name] of reasonCodes) {
    await prisma.reasonCode.upsert({
      where: { type_code: { type, code } },
      update: { name, active: true },
      create: { type, code, name },
    });
  }
}

async function seedSuppliers() {
  for (const [name, contactName, email, phone, paymentTerms] of suppliers) {
    const existing = await prisma.supplier.findFirst({ where: { name } });

    if (existing) {
      await prisma.supplier.update({
        where: { id: existing.id },
        data: {
          active: true,
          contactName,
          email,
          phone,
          paymentTerms,
        },
      });
    } else {
      await prisma.supplier.create({
        data: {
          name,
          contactName,
          email,
          phone,
          paymentTerms,
        },
      });
    }
  }

  for (const [supplierName, sku, unitCost] of supplierItems) {
    const supplier = await prisma.supplier.findFirstOrThrow({
      where: { name: supplierName },
    });
    const item = await prisma.item.findUniqueOrThrow({ where: { sku } });

    await prisma.supplierItem.upsert({
      where: {
        supplierId_itemId: { supplierId: supplier.id, itemId: item.id },
      },
      update: { active: true, unitCost },
      create: { supplierId: supplier.id, itemId: item.id, unitCost },
    });
  }
}

async function seedRecipes() {
  for (const recipeSeed of recipes) {
    const outputItem = await prisma.item.findUniqueOrThrow({
      where: { sku: recipeSeed.outputSku },
    });

    const recipe = await prisma.recipe.upsert({
      where: {
        outputItemId_version: {
          outputItemId: outputItem.id,
          version: 1,
        },
      },
      update: {
        active: true,
        servingQty: recipeSeed.servingQty,
        yieldPercent: recipeSeed.yieldPercent,
        wastageFactor: recipeSeed.wastageFactor,
      },
      create: {
        outputItemId: outputItem.id,
        version: 1,
        servingQty: recipeSeed.servingQty,
        yieldPercent: recipeSeed.yieldPercent,
        wastageFactor: recipeSeed.wastageFactor,
      },
    });

    await prisma.recipeLine.deleteMany({ where: { recipeId: recipe.id } });

    for (const [ingredientSku, qty, uomCode] of recipeSeed.lines) {
      const ingredient = await prisma.item.findUniqueOrThrow({
        where: { sku: ingredientSku },
      });
      const uom = await prisma.uom.findUniqueOrThrow({
        where: { code: uomCode },
      });

      await prisma.recipeLine.create({
        data: {
          recipeId: recipe.id,
          ingredientId: ingredient.id,
          qty,
          uomId: uom.id,
        },
      });
    }
  }
}

async function seedAdminUser() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@ogfi.local";
  const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const existing = await prisma.user.findUnique({ where: { email } });

  if (preserveSeededAccounts() && existing) {
    await grantSeededLocationAccess(existing.id);
    return existing;
  }

  const { password } = adminCredentials();
  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { code: RoleCode.ADMIN },
  });
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      username,
      fullName: "OGFI Local Admin",
      active: true,
      roleId: adminRole.id,
      passwordHash,
    },
    create: {
      email,
      username,
      fullName: "OGFI Local Admin",
      active: true,
      roleId: adminRole.id,
      passwordHash,
    },
  });

  await grantSeededLocationAccess(admin.id);

  return admin;
}

async function seedDevSuperUser() {
  const email = process.env.SEED_DEV_SUPER_EMAIL ?? "dev.super@ogfi.local";
  const existing = await prisma.user.findUnique({ where: { email } });

  if (preserveSeededAccounts() && existing) {
    await grantSeededLocationAccess(existing.id);
    return existing;
  }

  const credentials = devSuperCredentials();

  if (!credentials) {
    return null;
  }

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { code: RoleCode.ADMIN },
  });
  const passwordHash = await bcrypt.hash(credentials.password, 12);

  const user = await prisma.user.upsert({
    where: { email: credentials.email },
    update: {
      username: credentials.username,
      fullName: "OGFI Dev Super User",
      active: true,
      roleId: adminRole.id,
      passwordHash,
      mustChangePassword: false,
      failedLoginCount: 0,
      lastFailedLoginAt: null,
      restrictedAt: null,
      restrictedReason: null,
      restrictionCount: 0,
      restrictionWindowStart: null,
      lockedAt: null,
      lockReason: null,
    },
    create: {
      email: credentials.email,
      username: credentials.username,
      fullName: "OGFI Dev Super User",
      active: true,
      roleId: adminRole.id,
      passwordHash,
    },
  });

  await grantSeededLocationAccess(user.id);

  return user;
}

async function grantSeededLocationAccess(userId: string) {
  const seededLocations = await prisma.location.findMany({
    where: { code: { in: locations.map(([code]) => code) } },
    select: { id: true },
  });

  for (const location of seededLocations) {
    await prisma.userLocationAccess.upsert({
      where: {
        userId_locationId: { userId, locationId: location.id },
      },
      update: {},
      create: { userId, locationId: location.id },
    });
  }
}

async function seedOpeningStock(createdById: string) {
  const businessDate = new Date("2026-05-01T00:00:00.000Z");

  for (const [locationCode, sku, qty, unitCost] of openingStock) {
    const location = await prisma.location.findUniqueOrThrow({
      where: { code: locationCode },
    });
    const item = await prisma.item.findUniqueOrThrow({ where: { sku } });
    const uuid = uuidFromSeed(`opening-stock-v2:${locationCode}:${sku}`);
    const referenceId = uuidFromSeed(
      `opening-stock-v2-reference:${locationCode}:${sku}`,
    );
    const existing = await prisma.ledgerEvent.findUnique({ where: { uuid } });

    if (!existing) {
      await prisma.ledgerEvent.create({
        data: {
          uuid,
          locationId: location.id,
          itemId: item.id,
          transactionType: TransactionType.ADJUSTMENT,
          qtyIn: qty,
          qtyOut: "0",
          unitCostAtTime: unitCost,
          extendedCost: String(Number(qty) * Number(unitCost)),
          referenceType: ReferenceType.ADJUSTMENT,
          referenceId,
          businessDate,
          createdById,
          approvedById: createdById,
          metadata: {
            seed: "opening-stock-v2",
            locationCode,
            sku,
          },
        },
      });
    }
  }
}

function uuidFromSeed(value: string) {
  const hash = createHash("md5").update(value).digest("hex");

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `8${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join("-");
}

async function main() {
  await seedRoles();
  await seedPermissions();
  await seedRolePermissions();
  await seedLocations();
  await seedSyncDevices();
  await seedUoms();
  await seedItems();
  await seedSuppliers();
  await seedRecipes();
  await seedReasonCodes();
  const admin = await seedAdminUser();
  await seedDevSuperUser();
  await seedOpeningStock(admin.id);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed data loaded successfully.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
