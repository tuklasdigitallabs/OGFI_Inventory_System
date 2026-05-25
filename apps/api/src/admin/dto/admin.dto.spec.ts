import { validate } from "class-validator";
import { CreateAdminUserDto, UpdateAdminUserDto } from "./admin.dto";

const validLocationId = "11111111-1111-4111-8111-111111111111";
const validRoleId = "22222222-2222-4222-8222-222222222222";

function createUserDto(roleId: string) {
  const dto = new CreateAdminUserDto();
  dto.email = "manager@example.com";
  dto.username = "manager";
  dto.fullName = "Store Manager";
  dto.roleId = roleId;
  dto.locationIds = [validLocationId];

  return dto;
}

describe("admin user role DTO validation", () => {
  it("accepts a role UUID", async () => {
    await expect(validate(createUserDto(validRoleId))).resolves.toHaveLength(0);
  });

  it("accepts a seeded deterministic role UUID", async () => {
    await expect(
      validate(createUserDto("33333333-3333-3333-3333-333333333333")),
    ).resolves.toHaveLength(0);
  });

  it("accepts a role code", async () => {
    await expect(validate(createUserDto("BRANCH_MANAGER"))).resolves.toHaveLength(
      0,
    );
  });

  it("accepts a lowercase role code for service normalization", async () => {
    const dto = new UpdateAdminUserDto();
    dto.roleId = "branch_manager";

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it("accepts a role name for legacy clients", async () => {
    await expect(validate(createUserDto("Branch Manager"))).resolves.toHaveLength(
      0,
    );
  });

  it("accepts a short display label for service normalization", async () => {
    await expect(validate(createUserDto("Admin"))).resolves.toHaveLength(0);
  });
});
