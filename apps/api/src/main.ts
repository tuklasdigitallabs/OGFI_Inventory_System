import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { Request, Response } from "express";
import Redis from "ioredis";
import { AppModule } from "./app.module";
import {
  clientIp,
  MemoryRateLimitStore,
  rateLimitKey,
  rateLimitRule,
  RedisRateLimitStore,
  type RateLimitStore,
} from "./common/rate-limit";

function rateLimitMiddleware(store: RateLimitStore) {
  return async function rateLimit(
    request: Request,
    response: Response,
    next: () => void,
  ) {
    const rule = rateLimitRule(request.path);
    if (!rule) {
      next();
      return;
    }

    let result;
    try {
      result = await store.hit(rateLimitKey(request, rule), rule);
    } catch {
      console.error(
        JSON.stringify({
          event: "rate_limit.store_error",
          path: request.path,
          rule: rule.key,
        }),
      );
      response.status(503).json({
        message: "Rate limit service is unavailable.",
        statusCode: 503,
      });
      return;
    }

    if (result.allowed) {
      next();
      return;
    }

    console.warn(
      JSON.stringify({
        event: "rate_limit.exceeded",
        ip: clientIp(request),
        path: request.path,
        rule: rule.key,
      }),
    );
    response.setHeader(
      "Retry-After",
      String(result.retryAfterSeconds ?? Math.ceil(rule.windowMs / 1000)),
    );
    response.status(429).json({
      message: "Too many requests. Please try again later.",
      statusCode: 429,
    });
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const isProduction = config.get<string>("NODE_ENV") === "production";
  const expressApp = app.getHttpAdapter().getInstance();
  const redisUrl =
    config.get<string>("RATE_LIMIT_REDIS_URL") ??
    config.get<string>("REDIS_URL");
  const rateLimitStore = redisUrl
    ? new RedisRateLimitStore(new Redis(redisUrl, { lazyConnect: false }))
    : new MemoryRateLimitStore();

  expressApp.disable("x-powered-by");
  expressApp.set("trust proxy", 1);
  app.setGlobalPrefix("api");
  app.enableCors({
    credentials: true,
    origin: isProduction
      ? (config.get<string>("CORS_ORIGIN") ?? "").split(",").filter(Boolean)
      : true,
  });
  app.use(rateLimitMiddleware(rateLimitStore));
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
