import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins/admin";

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

export const createAuth = (options: CreateAuthOptions) =>
  betterAuth({
    appName: "d-round",
    baseURL: options.baseURL,
    basePath: "/api/auth",
    secret: options.secret,
    database: prismaAdapter(options.prisma, { provider: "postgresql" }),
    trustedOrigins: options.trustedOrigins,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    emailVerification: {
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
        adminRoles: ADMIN_ROLES,
      }),
    ],
  });

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];
export type SessionUser = Session["user"];
