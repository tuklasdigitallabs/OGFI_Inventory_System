import { PrismaClient, ItemType, LocationType, ReasonCodeType, RoleCode } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const permissions = [
  ['auth', 'login', 'Log in to the system'],
  ['auth', 'refresh', 'Refresh an access token'],
  ['admin.users', 'read', 'View users'],
  ['admin.users', 'create', 'Create users'],
  ['admin.users', 'update', 'Update users'],
  ['admin.users', 'deactivate', 'Deactivate users'],
  ['admin.roles', 'read', 'View roles'],
  ['admin.roles', 'update', 'Update role permissions'],
  ['admin.audit', 'read', 'View audit logs'],
  ['master-data.items', 'read', 'View items'],
  ['master-data.items', 'create', 'Create items'],
  ['master-data.items', 'update', 'Update items'],
  ['master-data.uoms', 'read', 'View units of measure'],
  ['master-data.uoms', 'create', 'Create units of measure'],
  ['master-data.locations', 'read', 'View locations'],
  ['master-data.locations', 'create', 'Create locations'],
  ['master-data.suppliers', 'read', 'View suppliers'],
  ['master-data.suppliers', 'create', 'Create suppliers'],
  ['inventory.stock', 'read', 'View stock on hand'],
  ['inventory.movements', 'read', 'View inventory movements'],
  ['ledger.events', 'post', 'Post ledger events'],
  ['ledger.events', 'read', 'View ledger events'],
  ['purchasing.purchase-orders', 'read', 'View purchase orders'],
  ['purchasing.purchase-orders', 'create', 'Create purchase orders'],
  ['purchasing.purchase-orders', 'approve', 'Approve purchase orders'],
  ['purchasing.receivings', 'create', 'Receive supplier deliveries'],
  ['transfers', 'read', 'View transfers'],
  ['transfers', 'create', 'Create transfers'],
  ['transfers', 'approve', 'Approve transfers'],
  ['transfers', 'dispatch', 'Dispatch transfers'],
  ['transfers', 'receive', 'Receive transfers'],
  ['branch.wastage', 'read', 'View wastage'],
  ['branch.wastage', 'create', 'Record wastage'],
  ['branch.stock-counts', 'read', 'View stock counts'],
  ['branch.stock-counts', 'submit', 'Submit stock counts'],
  ['branch.issues', 'create', 'Issue stock to operations'],
  ['sales.batches', 'read', 'View sales batches'],
  ['sales.batches', 'create', 'Create sales batches'],
  ['reports', 'read', 'View reports'],
  ['reports', 'run', 'Run reports'],
  ['sync', 'read', 'View sync status'],
  ['sync', 'submit', 'Submit offline sync batches'],
] as const;

const roles = [
  [RoleCode.ADMIN, 'Administrator', 'Full system access'],
  [RoleCode.WAREHOUSE_MANAGER, 'Warehouse Manager', 'Warehouse inventory, ledger, and transfer operations'],
  [RoleCode.PURCHASING, 'Purchasing', 'Purchase order and receiving workflows'],
  [RoleCode.BRANCH_MANAGER, 'Branch Manager', 'Branch stock, wastage, count, and transfer workflows'],
  [RoleCode.BRANCH_ENCODER, 'Branch Encoder', 'Branch data entry workflows'],
  [RoleCode.AUDITOR, 'Auditor', 'Read-only audit, inventory, and reporting access'],
  [RoleCode.VIEWER, 'Viewer', 'Read-only operational visibility'],
] as const;

const rolePermissionRules: Record<RoleCode, Array<[string, string]>> = {
  [RoleCode.ADMIN]: permissions.map(([module, action]) => [module, action]),
  [RoleCode.WAREHOUSE_MANAGER]: [
    ['inventory.stock', 'read'],
    ['inventory.movements', 'read'],
    ['ledger.events', 'post'],
    ['ledger.events', 'read'],
    ['master-data.items', 'read'],
    ['master-data.uoms', 'read'],
    ['master-data.locations', 'read'],
    ['transfers', 'read'],
    ['transfers', 'create'],
    ['transfers', 'approve'],
    ['transfers', 'dispatch'],
    ['transfers', 'receive'],
    ['reports', 'read'],
    ['reports', 'run'],
  ],
  [RoleCode.PURCHASING]: [
    ['inventory.stock', 'read'],
    ['master-data.items', 'read'],
    ['master-data.uoms', 'read'],
    ['master-data.suppliers', 'read'],
    ['master-data.suppliers', 'create'],
    ['purchasing.purchase-orders', 'read'],
    ['purchasing.purchase-orders', 'create'],
    ['purchasing.purchase-orders', 'approve'],
    ['purchasing.receivings', 'create'],
    ['reports', 'read'],
  ],
  [RoleCode.BRANCH_MANAGER]: [
    ['inventory.stock', 'read'],
    ['inventory.movements', 'read'],
    ['ledger.events', 'read'],
    ['master-data.items', 'read'],
    ['transfers', 'read'],
    ['transfers', 'create'],
    ['transfers', 'receive'],
    ['branch.wastage', 'read'],
    ['branch.wastage', 'create'],
    ['branch.stock-counts', 'read'],
    ['branch.stock-counts', 'submit'],
    ['branch.issues', 'create'],
    ['sales.batches', 'read'],
    ['sales.batches', 'create'],
    ['reports', 'read'],
  ],
  [RoleCode.BRANCH_ENCODER]: [
    ['inventory.stock', 'read'],
    ['master-data.items', 'read'],
    ['transfers', 'read'],
    ['branch.wastage', 'create'],
    ['branch.stock-counts', 'submit'],
    ['branch.issues', 'create'],
    ['sales.batches', 'create'],
  ],
  [RoleCode.AUDITOR]: [
    ['admin.audit', 'read'],
    ['inventory.stock', 'read'],
    ['inventory.movements', 'read'],
    ['ledger.events', 'read'],
    ['master-data.items', 'read'],
    ['master-data.uoms', 'read'],
    ['master-data.locations', 'read'],
    ['purchasing.purchase-orders', 'read'],
    ['transfers', 'read'],
    ['branch.wastage', 'read'],
    ['branch.stock-counts', 'read'],
    ['sales.batches', 'read'],
    ['reports', 'read'],
  ],
  [RoleCode.VIEWER]: [
    ['inventory.stock', 'read'],
    ['inventory.movements', 'read'],
    ['master-data.items', 'read'],
    ['master-data.uoms', 'read'],
    ['master-data.locations', 'read'],
    ['reports', 'read'],
  ],
};

const locations = [
  ['MAIN-WH', 'Main Commissary Warehouse', LocationType.WAREHOUSE],
  ['BGC-01', 'BGC Branch', LocationType.BRANCH],
  ['MAKATI-01', 'Makati Branch', LocationType.BRANCH],
  ['QC-01', 'Quezon City Branch', LocationType.BRANCH],
] as const;

const uoms = [
  ['KG', 'Kilogram'],
  ['G', 'Gram'],
  ['L', 'Liter'],
  ['ML', 'Milliliter'],
  ['PC', 'Piece'],
  ['BOX', 'Box'],
  ['CASE', 'Case'],
] as const;

const uomConversions = [
  ['KG', 'G', '1000'],
  ['G', 'KG', '0.001'],
  ['L', 'ML', '1000'],
  ['ML', 'L', '0.001'],
] as const;

const categories = ['Meat', 'Produce', 'Staples', 'Packaging', 'Finished Goods'];

const items = [
  ['BEEF-BRISKET', 'Beef Brisket', ItemType.RAW_MATERIAL, 'Meat', 'KG', '5'],
  ['CHICKEN-THIGH', 'Chicken Thigh Fillet', ItemType.RAW_MATERIAL, 'Meat', 'KG', '8'],
  ['LETTUCE-ROMAINE', 'Romaine Lettuce', ItemType.RAW_MATERIAL, 'Produce', 'KG', '3'],
  ['RICE-JASMINE', 'Jasmine Rice', ItemType.RAW_MATERIAL, 'Staples', 'KG', '15'],
  ['SAUCE-CUP-2OZ', '2oz Sauce Cup', ItemType.PACKAGING, 'Packaging', 'PC', '200'],
  ['BEEF-BOWL', 'Beef Rice Bowl', ItemType.FINISHED_GOOD, 'Finished Goods', 'PC', '20'],
] as const;

const reasonCodes = [
  [ReasonCodeType.WASTAGE, 'SPOILAGE', 'Spoilage'],
  [ReasonCodeType.WASTAGE, 'DAMAGE', 'Damaged item'],
  [ReasonCodeType.WASTAGE, 'EXPIRED', 'Expired item'],
  [ReasonCodeType.ADJUSTMENT, 'COUNT_CORRECTION', 'Stock count correction'],
  [ReasonCodeType.ADJUSTMENT, 'RECEIVING_CORRECTION', 'Receiving correction'],
  [ReasonCodeType.VARIANCE, 'SHORT_SHIP', 'Short shipment'],
  [ReasonCodeType.VARIANCE, 'OVER_SHIP', 'Over shipment'],
  [ReasonCodeType.CANCELLATION, 'DUPLICATE_ENTRY', 'Duplicate entry'],
  [ReasonCodeType.CANCELLATION, 'USER_ERROR', 'User error'],
] as const;

function adminCredentials() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@ogfi.local';
  const username = process.env.SEED_ADMIN_USERNAME ?? 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!password) {
    throw new Error('SEED_ADMIN_PASSWORD is required. Set it in ignored apps/api/.env for local development.');
  }

  return {
    email,
    username,
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
  for (const [roleCode, rules] of Object.entries(rolePermissionRules) as Array<[RoleCode, Array<[string, string]>]>) {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });

    for (const [module, action] of rules) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { module_action: { module, action } },
      });

      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
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

async function seedUoms() {
  for (const [code, name] of uoms) {
    await prisma.uom.upsert({
      where: { code },
      update: { name, active: true },
      create: { code, name },
    });
  }

  for (const [fromCode, toCode, factor] of uomConversions) {
    const fromUom = await prisma.uom.findUniqueOrThrow({ where: { code: fromCode } });
    const toUom = await prisma.uom.findUniqueOrThrow({ where: { code: toCode } });

    await prisma.uomConversion.upsert({
      where: { fromUomId_toUomId: { fromUomId: fromUom.id, toUomId: toUom.id } },
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

  for (const [sku, name, itemType, categoryName, uomCode, lowStockThreshold] of items) {
    const category = await prisma.category.findUniqueOrThrow({ where: { name: categoryName } });
    const baseUom = await prisma.uom.findUniqueOrThrow({ where: { code: uomCode } });

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

async function seedAdminUser() {
  const { email, username, password } = adminCredentials();
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: RoleCode.ADMIN } });
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      username,
      fullName: 'OGFI Local Admin',
      active: true,
      roleId: adminRole.id,
      passwordHash,
    },
    create: {
      email,
      username,
      fullName: 'OGFI Local Admin',
      active: true,
      roleId: adminRole.id,
      passwordHash,
    },
  });

  const seededLocations = await prisma.location.findMany({
    where: { code: { in: locations.map(([code]) => code) } },
    select: { id: true },
  });

  for (const location of seededLocations) {
    await prisma.userLocationAccess.upsert({
      where: { userId_locationId: { userId: admin.id, locationId: location.id } },
      update: {},
      create: { userId: admin.id, locationId: location.id },
    });
  }
}

async function main() {
  await seedRoles();
  await seedPermissions();
  await seedRolePermissions();
  await seedLocations();
  await seedUoms();
  await seedItems();
  await seedReasonCodes();
  await seedAdminUser();
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Seed data loaded successfully.');
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
