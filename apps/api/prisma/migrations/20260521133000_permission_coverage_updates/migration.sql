INSERT INTO "permissions" ("module", "action", "description")
VALUES ('purchasing.receivings', 'read', 'View supplier receiving records')
ON CONFLICT ("module", "action") DO UPDATE
SET "description" = EXCLUDED."description";

WITH permission AS (
  SELECT "id"
  FROM "permissions"
  WHERE "module" = 'purchasing.receivings'
    AND "action" = 'read'
),
target_roles AS (
  SELECT "id"
  FROM "roles"
  WHERE "code" IN ('ADMIN', 'PURCHASING', 'AUDITOR', 'VIEWER')
)
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT target_roles."id", permission."id"
FROM target_roles
CROSS JOIN permission
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

WITH permissions AS (
  SELECT "id"
  FROM "permissions"
  WHERE "module" = 'sync'
    AND "action" IN ('read', 'submit')
),
target_roles AS (
  SELECT "id"
  FROM "roles"
  WHERE "code" IN ('BRANCH_MANAGER', 'BRANCH_ENCODER')
)
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT target_roles."id", permissions."id"
FROM target_roles
CROSS JOIN permissions
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
