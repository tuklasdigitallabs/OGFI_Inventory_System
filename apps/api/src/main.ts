import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { AppModule } from "./app.module";

type RateLimitRule = {
  key: string;
  limit: number;
  windowMs: number;
};

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimitRule(path: string): RateLimitRule | null {
  if (path === "/api/auth/login") {
    return { key: "auth-login", limit: 10, windowMs: 60_000 };
  }
  if (path === "/api/auth/altcha-challenge") {
    return { key: "auth-altcha", limit: 30, windowMs: 60_000 };
  }
  if (path.startsWith("/api/")) {
    return { key: "api", limit: 600, windowMs: 60_000 };
  }
  return null;
}

function clientIp(request: Request) {
  return request.ip || request.socket.remoteAddress || "unknown";
}

function rateLimitMiddleware(
  request: Request,
  response: Response,
  next: () => void,
) {
  const rule = rateLimitRule(request.path);
  if (!rule) {
    next();
    return;
  }

  const now = Date.now();
  const bucketKey = `${rule.key}:${clientIp(request)}`;
  const bucket = rateLimitBuckets.get(bucketKey);
  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(bucketKey, { count: 1, resetAt: now + rule.windowMs });
    next();
    return;
  }

  bucket.count += 1;
  if (bucket.count > rule.limit) {
    response.setHeader(
      "Retry-After",
      Math.ceil((bucket.resetAt - now) / 1000).toString(),
    );
    response.status(429).json({
      message: "Too many requests. Please try again later.",
      statusCode: 429,
    });
    return;
  }

  next();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const isProduction = config.get<string>("NODE_ENV") === "production";
  const expressApp = app.getHttpAdapter().getInstance();

  expressApp.disable("x-powered-by");
  expressApp.set("trust proxy", 1);
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: isProduction
      ? (config.get<string>("CORS_ORIGIN") ?? "").split(",").filter(Boolean)
      : true,
  });
  app.use(rateLimitMiddleware);
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
