import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const isProduction = config.get<string>("NODE_ENV") === "production";

  app.setGlobalPrefix("api");
  app.enableCors({
    origin: isProduction
      ? (config.get<string>("CORS_ORIGIN") ?? "").split(",").filter(Boolean)
      : true,
  });
  app.use(
    (
      _: unknown,
      response: { setHeader: (name: string, value: string) => void },
      next: () => void,
    ) => {
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("X-Frame-Options", "DENY");
      response.setHeader("Referrer-Policy", "same-origin");
      response.setHeader(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=()",
      );
      if (isProduction) {
        response.setHeader(
          "Content-Security-Policy",
          "default-src 'self'; frame-ancestors 'none'; object-src 'none'",
        );
      }
      next();
    },
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (!isProduction || config.get<string>("ENABLE_SWAGGER") === "true") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("OGFI Inventory API")
      .setDescription(
        "Centralized inventory, costing, reporting, and offline sync API",
      )
      .setVersion("0.1.0")
      .addBearerAuth(
        {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "Paste the JWT access token only. Swagger will add the Bearer prefix.",
        },
        "access-token",
      )
      .addSecurityRequirements("access-token")
      .build();
    SwaggerModule.setup(
      "api/docs",
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }

  const port = config.get<number>("PORT") ?? 3000;
  await app.listen(port);
}

void bootstrap();
