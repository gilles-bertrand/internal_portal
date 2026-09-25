import {
  entities,
  UserModule,
  UserEntity,
  RefreshTokenEntity,
  type FastifyInstanceTypeForModule,
  AuthModule,
} from "#src/index.js";
import {
  entities as permissionsEntities,
  PermissionRuleEntity,
  PermissionsModule,
  RoleEntity,
  type RoleEntityType,
} from "@libs/permissions-backend";
import { MikroORM } from "@mikro-orm/postgresql";
import { fastify } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { sign } from "jsonwebtoken";
import { hash } from "argon2";
import { randomUUID } from "crypto";
import { hashToken, generateFamilyId } from "#src/utils/token.utils.js";
import { createJwtAuthMiddleware } from "#src/middlewares/jwt-auth.middleware.js";

export class TestModule {
  public static JWT_SECRET = "testSecret";
  public static JWT_REFRESH_SECRET = "testRefreshSecret";
  public static TEST_USER_ID = "test-user-id";

  declare public fastifyInstance: FastifyInstanceTypeForModule;

  private constructor(
    public module: UserModule,
    private orm: MikroORM,
  ) {}

  public static async init() {
    const connectionUrl = process.env.TEST_DATABASE_URL;
    if (!connectionUrl) {
      throw new Error(
        "TEST_DATABASE_URL environment variable is not set. Make sure global-setup.ts ran.",
      );
    }

    const orm = await MikroORM.init({
      entities: [...entities, ...permissionsEntities],
      clientUrl: connectionUrl,
    });

    const fastifyInstance = fastify().withTypeProvider<ZodTypeProvider>();
    fastifyInstance.setValidatorCompiler(validatorCompiler);
    fastifyInstance.setSerializerCompiler(serializerCompiler);

    // Use the same forked em for both modules to share transaction context
    const sharedEm = orm.em.fork();

    const module = UserModule.init({
      em: sharedEm,
      configuration: {
        jwtSecret: TestModule.JWT_SECRET,
      },
    });
    const authModule = AuthModule.init({
      em: sharedEm,
      configuration: {
        jwtSecret: TestModule.JWT_SECRET,
        jwtRefreshSecret: TestModule.JWT_REFRESH_SECRET,
      },
    });
    const permissionsModule = PermissionsModule.init(
      { em: sharedEm },
      createJwtAuthMiddleware(sharedEm, TestModule.JWT_SECRET),
    );

    const testModule = new TestModule(module, orm);
    testModule.fastifyInstance = fastifyInstance;

    await module.setupRoutes(fastifyInstance);
    await authModule.setupRoutes(fastifyInstance);
    await permissionsModule.setupRoutes(fastifyInstance);

    return testModule;
  }

  get em() {
    return this.module["context"].em;
  }

  public generateBearerToken(userId: string) {
    return "Bearer " + sign({ userId }, TestModule.JWT_SECRET);
  }

  public generateRefreshToken(userId: string) {
    return sign({ userId }, TestModule.JWT_REFRESH_SECRET, { expiresIn: "7d" });
  }

  public generateExpiredRefreshToken(userId: string) {
    return sign({ userId }, TestModule.JWT_REFRESH_SECRET, { expiresIn: "-1s" });
  }

  public async storeRefreshToken(
    userId: string,
    refreshToken: string,
    options?: { revoked?: boolean; expired?: boolean },
  ) {
    const tokenHash = hashToken(refreshToken);
    const refreshTokenRepo = this.em.getRepository(RefreshTokenEntity);

    const expiresAt = options?.expired
      ? new Date(Date.now() - 1000).toISOString()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    refreshTokenRepo.create({
      id: randomUUID(),
      tokenHash,
      userId,
      deviceInfo: null,
      ipAddress: "127.0.0.1",
      userAgent: "test",
      issuedAt: new Date().toISOString(),
      expiresAt,
      revokedAt: options?.revoked ? new Date().toISOString() : null,
      familyId: generateFamilyId(),
    });

    await this.em.flush();
  }

  public async ensureRole(name: string): Promise<RoleEntityType> {
    const roleRepository = this.em.getRepository(RoleEntity);
    const existing = await roleRepository.findOne({ name });
    if (existing) return existing;

    const role = roleRepository.create({ id: randomUUID(), name, description: null });
    await this.em.flush();
    return role;
  }

  public async createUser(data: {
    id?: string;
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    roleName?: string;
  }) {
    const { roleName = "encoder", id = randomUUID(), ...rest } = data;
    const role = await this.ensureRole(roleName);
    const hashedPassword = await hash(data.password);
    await this.em.getRepository(UserEntity).insert({
      ...rest,
      id,
      password: hashedPassword,
      role: role.id,
    });
    return { id, roleId: role.id, roleName: role.name };
  }

  public async grantPermission(roleId: string, action: string, subject: string) {
    this.em.getRepository(PermissionRuleEntity).create({
      id: randomUUID(),
      role: roleId,
      action,
      subject,
      conditions: null,
      fields: null,
      inverted: false,
      order: 0,
    });
    await this.em.flush();
  }

  /** Raccourci pour les tests qui doivent agir en tant qu'admin (manage:User/manage:Role). */
  public async createTechAdmin(overrides?: { email?: string }) {
    const admin = await this.createUser({
      email: overrides?.email ?? `tech-admin-${randomUUID()}@test.com`,
      firstName: "Tech",
      lastName: "Admin",
      password: "testpassword123",
      roleName: "tech_admin",
    });
    await this.grantPermission(admin.roleId, "manage", "User");
    await this.grantPermission(admin.roleId, "manage", "Role");
    return admin;
  }

  public async close() {
    await this.orm.close(true);
  }
}
