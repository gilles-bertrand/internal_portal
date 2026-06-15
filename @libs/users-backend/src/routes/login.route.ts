import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { jsonApiErrorDocumentSchema, makeJsonApiError, type Route } from "@libs/backend-shared";
import type { EntityManager, EntityRepository } from "@mikro-orm/core";
import { verifyPassword } from "#src/utils/auth.utils.js";
import { generateTokens } from "#src/utils/jwt.utils.js";
import { hashToken, generateFamilyId } from "#src/utils/token.utils.js";
import { email, object, string } from "zod";
import type { UserEntityType } from "#src/entities/user.entity.js";
import { RefreshTokenEntity } from "#src/entities/refresh-token.entity.js";
import { randomUUID } from "crypto";

export class LoginRoute implements Route {
  public constructor(
    private userRepository: EntityRepository<UserEntityType>,
    private em: EntityManager,
    private jwtSecret: string,
    private jwtRefreshSecret: string,
  ) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.post(
      "/login",
      {
        schema: {
          body: object({
            email: email(),
            password: string().min(8),
            deviceInfo: string().optional(),
          }),
          response: {
            200: object({
              data: object({
                accessToken: string(),
                refreshToken: string(),
              }),
            }),
            401: jsonApiErrorDocumentSchema,
            423: jsonApiErrorDocumentSchema,
          },
        },
      },
      // oxlint-disable-next-line complexity
      async (request, reply) => {
        const { email, password, deviceInfo } = request.body;

        const user = await this.userRepository.findOne({ email });

        const invalidCredentials = () =>
          reply.code(401).send(
            makeJsonApiError(401, "Invalid Credentials", {
              code: "INVALID_CREDENTIALS",
              detail: "Invalid email or password",
            }),
          );

        if (!user) {
          return invalidCredentials();
        }

        // Verrouillage anti-bruteforce
        if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
          return reply.code(423).send(
            makeJsonApiError(423, "Account Locked", {
              code: "ACCOUNT_LOCKED",
              detail: "Compte temporairement verrouillé — réessayez plus tard",
            }),
          );
        }

        const isValidPassword = await verifyPassword(user.password, password);

        if (!isValidPassword) {
          const MAX_ATTEMPTS = 5;
          const LOCK_MINUTES = 15;
          const attempts = (user.failedLoginAttempts ?? 0) + 1;
          const lockedUntil =
            attempts >= MAX_ATTEMPTS
              ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
              : null;

          await this.userRepository.nativeUpdate(
            { id: user.id },
            { failedLoginAttempts: attempts, lockedUntil },
          );

          return invalidCredentials();
        }

        // Réinitialiser le compteur après succès
        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await this.userRepository.nativeUpdate(
            { id: user.id },
            { failedLoginAttempts: 0, lockedUntil: null },
          );
        }

        const tokens = generateTokens(
          { userId: user.id, email: user.email, role: user.role },
          this.jwtSecret,
          this.jwtRefreshSecret,
        );

        // Store refresh token hash in database
        const refreshTokenRepo = this.em.getRepository(RefreshTokenEntity);
        const tokenHash = hashToken(tokens.refreshToken);

        refreshTokenRepo.create({
          id: randomUUID(),
          tokenHash,
          userId: user.id,
          deviceInfo: deviceInfo ?? null,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          revokedAt: null,
          familyId: generateFamilyId(),
        });

        await this.em.flush();

        return reply.send({
          data: tokens,
        });
      },
    );
  }
}
