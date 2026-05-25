import { Controller, Get } from "@nestjs/common";
import { Public } from "./auth/decorators/public.decorator";

@Controller()
export class AppController {
  @Public()
  @Get("build-info")
  buildInfo() {
    return {
      service: "og-inventory-api",
      roleSelectorContract: "uuid-or-role-code",
    };
  }
}
