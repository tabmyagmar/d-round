import { betterAuth } from "better-auth";
import type { BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins/admin";
import { customSession } from "better-auth/plugins/custom-session";

import { createPermissionRepository } from "@repo/database";
import type { PrismaClient } from "@repo/database";
import { DEFAULT_ROLE } from "@repo/validation";

import { ADMIN_ROLES, ac, roles } from "./access-control";

const DAY_SECONDS = 60 * 60 * 24;

export type VerificationEmail = {
  user: { id: string; email: string; name: string };
  url: string;
  token: string;
};

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
   * Same-parent-domain deployment (web.example.com + api.example.com): set the parent domain so
   * the session cookie is shared. Leave undefined for localhost. See docs/adr/0002-auth.md.
   */
  cookieDomain?: string;
};

export const createAuth = (options: CreateAuthOptions) => {
  const permissions = createPermissionRepository(options.prisma);

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
