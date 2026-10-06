import { betterAuth } from "better-auth";
import type { BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { admin } from "better-auth/plugins/admin";
import { customSession } from "better-auth/plugins/custom-session";

import { createPermissionRepository, createUserRepository } from "@repo/database";
import type { PrismaClient } from "@repo/database";
import { DEFAULT_ROLE, passwordSchema } from "@repo/validation";

import { ADMIN_ROLES, ac, roles } from "./access-control";

const DAY_SECONDS = 60 * 60 * 24;

export type VerificationEmail = {
  user: { id: string; email: string; name: string };
  url: string;
  token: string;
};

/**
 * A password link to mail. `invitation`: the user has no password yet (an admin created them) —
 * the link sets the first one. `reset`: forgot password or an admin re-send.
 */
export type PasswordResetEmail = {
  user: { id: string; email: string; name: string };
  url: string;
  purpose: "invitation" | "reset";
};

/** Every endpoint that stores a new password; the policy hook checks their `newPassword`. */
export const PASSWORD_SETTING_PATHS: ReadonlySet<string> = new Set([
  "/reset-password",
  "/change-password",
  "/set-password",
  "/admin/set-user-password",
]);

/**
 * The server side of THE password policy (`passwordSchema`, @repo/validation): the forms parse
 * with the same schema, this refuses a request that bypassed them. Sign-in and the admin
 * `create-user` (server-side and tests only; the invitation creates users without a password)
 * are not password-setting paths.
 */
const passwordPolicyViolation = (path: string, body: unknown): string | null => {
  if (!PASSWORD_SETTING_PATHS.has(path)) {
    return null;
  }
  const candidate =
    typeof body === "object" && body !== null && "newPassword" in body
      ? body.newPassword
      : undefined;
  const result = passwordSchema.safeParse(candidate);
  return result.success ? null : (result.error.issues[0]?.message ?? "Invalid password");
};

const passwordPolicy = createAuthMiddleware((ctx) => {
  const violation = passwordPolicyViolation(ctx.path, ctx.body);
  return violation === null
    ? Promise.resolve()
    : Promise.reject(new APIError("BAD_REQUEST", { code: "PASSWORD_POLICY", message: violation }));
});

export type CreateAuthOptions = {
  prisma: PrismaClient;
  /** >= 32 random bytes; rotating it invalidates every session. */
  secret: string;
  /** Public origin of the API, e.g. https://api.example.com (cookies are set on this host). */
  baseURL: string;
  /** Browser origins allowed to call the auth endpoints (the web app). */
  trustedOrigins: string[];
  /**
   * Called when Better Auth wants a verification mail sent. The API implements this with the
   * outbox (insert row → enqueue after commit); mail is never sent inline from here.
   */
  sendVerificationEmail: (email: VerificationEmail) => Promise<void>;
  /**
   * Called when Better Auth wants a password link sent (forgot password, invitation, admin
   * re-send). Same rule as above: the API writes an outbox row, nothing is sent inline.
   */
  sendPasswordResetEmail: (email: PasswordResetEmail) => Promise<void>;
  /**
   * Same-parent-domain deployment (web.example.com + api.example.com): set the parent domain so
   * the session cookie is shared. Leave undefined for localhost. See docs/adr/0002-auth.md.
   */
  cookieDomain?: string;
};

export const createAuth = (options: CreateAuthOptions) => {
  const permissions = createPermissionRepository(options.prisma);
  const users = createUserRepository(options.prisma);

  // The base options are passed to `customSession` as well, so `user` inside it carries the admin
  // plugin's fields (`role`) and `Auth["$Infer"]["Session"]` picks up the custom shape.
  const base = {
    baseURL: options.baseURL,
    basePath: "/api/auth",
    secret: options.secret,
    database: prismaAdapter(options.prisma, { provider: "postgresql" }),
    trustedOrigins: options.trustedOrigins,
    emailAndPassword: {
      enabled: true,
      // No public sign-up: users are created only through the admin plugin (`auth.api.createUser`).
      disableSignUp: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        // A deactivated user gets no link: it would only lead to a refused sign-in.
        if (!(await users.findById(user.id))) {
          return;
        }
        const purpose = (await users.hasCredentialAccount(user.id)) ? "reset" : "invitation";
        await options.sendPasswordResetEmail({
          user: { id: user.id, email: user.email, name: user.name },
          url,
          purpose,
        });
      },
      // The link was mailed, so using it proves the mailbox: an invited user is verified by
      // setting the first password (ADR 0002).
      onPasswordReset: async ({ user }) => {
        await users.markEmailVerified(user.id);
      },
    },
    emailVerification: {
      // Inert while sign-up is off: admin-created users are mailed via /send-verification-email.
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url, token }) => {
        await options.sendVerificationEmail({
          user: { id: user.id, email: user.email, name: user.name },
          url,
          token,
        });
      },
    },
    session: {
      expiresIn: 7 * DAY_SECONDS,
      updateAge: DAY_SECONDS,
    },
    hooks: { before: passwordPolicy },
    advanced: {
      database: {
        // Postgres generates UUID v7 ids (prisma schema `@default(uuid(7))`).
        generateId: false,
      },
      ...(options.cookieDomain
        ? { crossSubDomainCookies: { enabled: true, domain: options.cookieDomain } }
        : {}),
    },
    plugins: [
      admin({
        ac,
        roles,
        defaultRole: DEFAULT_ROLE,
        adminRoles: [...ADMIN_ROLES],
      }),
    ],
  } satisfies BetterAuthOptions;

  return betterAuth({
    ...base,
    plugins: [
      ...base.plugins,
      // Every session lookup loads the user's effective grants (role ∪ ALLOW − DENY, one query)
      // so the API context and the browser build the same CASL ability. See ADR 0003.
      customSession(async ({ user, session }) => {
        // `?? DEFAULT_ROLE` only satisfies the plugin's optional type: `users.role` is NOT NULL
        // with a foreign key to `roles` (ADR 0005), and an unknown key yields no grants anyway.
        const grants = await permissions.findEffectiveGrants(user.id, user.role ?? DEFAULT_ROLE);
        return {
          user: {
            ...user,
            permissions: grants.map(({ action, modelName }) => ({ action, subject: modelName })),
          },
          session,
        };
      }, base),
    ],
  });
};

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];
export type SessionUser = Session["user"];
