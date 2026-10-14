import { betterAuth } from "better-auth";
import type { BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from "better-auth/api";
import { admin } from "better-auth/plugins/admin";
import { customSession } from "better-auth/plugins/custom-session";

import { createPermissionRepository, createUserRepository } from "@repo/database";
import type { PrismaClient } from "@repo/database";
import { DEFAULT_ROLE, emailSchema, idSchema, passwordSchema, roleSchema } from "@repo/validation";
import type { AuditAction } from "@repo/validation";

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

/**
 * The client's address, set by the API on every request it hands Better Auth (`clientIp`, the rate
 * limiter's rule) and read by Better Auth for its `sessions` rows as well as by the audit hooks.
 */
export const CLIENT_IP_HEADER = "x-client-ip";

/** The API's request id (`REQUEST_ID_HEADER` in apps/api), carried into Better Auth's request. */
const API_REQUEST_ID_HEADER = "x-request-id";

/**
 * A sign-in, sign-out, password or admin-endpoint event as the audit log records it
 * (docs/adr/0015-audit-log.md). It never carries a password, a token or a request body.
 */
export type AuthAuditEvent = {
  action: Extract<AuditAction, `auth.${string}`>;
  status: "SUCCESS" | "FAILURE";
  /** Who acted, when known. */
  user: { id: string; email: string; name: string; role: string | null } | null;
  /** The address typed into the sign-in or the forgotten-password form, when it is one. */
  email: string | null;
  /** The user an `/admin/*` endpoint acted on, when the body names one by id. */
  targetUserId: string | null;
  /** The Better Auth endpoint (`/admin/set-role`). */
  endpoint: string;
  /** The role an `/admin/*` call gives (`admin`, or `admin, manager` for several), when it is one. */
  role: string | null;
  /** The error's code (`INVALID_EMAIL_OR_PASSWORD`) of a failure. */
  errorCode: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
};

/** The endpoints whose calls the audit log records, `/admin/*` aside. */
const AUDITED_ENDPOINTS: Readonly<Record<string, AuthAuditEvent["action"]>> = {
  "/sign-in/email": "auth.signIn",
  "/change-password": "auth.changePassword",
  "/request-password-reset": "auth.requestPasswordReset",
  "/reset-password": "auth.resetPassword",
};

type EventUser = { id: string; email: string; name: string; role?: string | null | undefined };

const userOf = (user: EventUser | null | undefined): AuthAuditEvent["user"] =>
  user ? { id: user.id, email: user.email, name: user.name, role: user.role ?? null } : null;

/**
 * A field of the request body as the client sent it: hooks see the body before Better Auth parses
 * it, so the event keeps a field only when its schema parses it (a password typed into the address
 * field is not an address).
 */
const bodyField = (body: unknown, key: string): unknown =>
  typeof body === "object" && body !== null ? (body as Record<string, unknown>)[key] : undefined;

/** The role an admin endpoint gives: `set-role` and `create-user` take one or several. */
const roleFieldSchema = roleSchema.or(roleSchema.array().min(1));

const requestOf = (request: Request | undefined) => ({
  ipAddress: request?.headers.get(CLIENT_IP_HEADER) ?? null,
  userAgent: request?.headers.get("user-agent") ?? null,
  requestId: request?.headers.get(API_REQUEST_ID_HEADER) ?? null,
});

type Emit = (event: AuthAuditEvent) => Promise<void>;

/** Hands an event to the API's recorder; a recorder that throws never breaks Better Auth's answer. */
const emitterOf =
  (onAuthEvent: ((event: AuthAuditEvent) => Promise<void>) | undefined): Emit =>
  async (event) => {
    try {
      await onAuthEvent?.(event);
    } catch {
      // The API's recorder logs its own failures; the endpoint answers as it would have.
    }
  };

/**
 * Before every endpoint: the password policy, and the sign-out event — sign-out deletes the session
 * before any after-hook runs, so its user is read here. Only requests that came over HTTP are
 * recorded: a server-side `auth.api` call belongs to a service that records its own action.
 */
const beforeHook = (emit: Emit) =>
  createAuthMiddleware(async (ctx) => {
    const violation = passwordPolicyViolation(ctx.path, ctx.body);
    if (violation !== null) {
      throw new APIError("BAD_REQUEST", { code: "PASSWORD_POLICY", message: violation });
    }
    if (ctx.path !== "/sign-out" || !ctx.request) {
      return;
    }
    const session = await getSessionFromCtx(ctx, { disableRefresh: true });
    if (session) {
      await emit({
        action: "auth.signOut",
        status: "SUCCESS",
        user: userOf(session.user),
        email: null,
        targetUserId: null,
        endpoint: ctx.path,
        role: null,
        errorCode: null,
        ...requestOf(ctx.request),
      });
    }
  });

/**
 * After an audited endpoint, whether it answered or refused (Better Auth runs after-hooks on an
 * `APIError` too, `context.returned` being that error): sign-in, password change, forgotten
 * password, a refused reset (a successful one is recorded by `onPasswordReset`, which knows its
 * user) and every POST to `/admin/*`.
 */
const afterHook = (emit: Emit) =>
  createAuthMiddleware(async (ctx) => {
    const isAdmin = ctx.path.startsWith("/admin/") && ctx.request?.method === "POST";
    const action = isAdmin ? "auth.admin" : AUDITED_ENDPOINTS[ctx.path];
    if (!action || !ctx.request) {
      return;
    }
    const returned: unknown = ctx.context.returned;
    const failed = isAPIError(returned);
    if (action === "auth.resetPassword" && !failed) {
      return;
    }
    const anonymous = action === "auth.requestPasswordReset" || action === "auth.resetPassword";
    const user =
      ctx.context.newSession?.user ??
      (anonymous || action === "auth.signIn"
        ? null
        : (await getSessionFromCtx(ctx, { disableRefresh: true }))?.user);
    const email = emailSchema.safeParse(bodyField(ctx.body, "email"));
    const userId = idSchema.safeParse(bodyField(ctx.body, "userId"));
    const role = roleFieldSchema.safeParse(bodyField(ctx.body, "role"));
    await emit({
      action,
      status: failed ? "FAILURE" : "SUCCESS",
      user: userOf(user),
      email: (action === "auth.signIn" || anonymous) && email.success ? email.data : null,
      targetUserId: isAdmin && userId.success ? userId.data : null,
      endpoint: ctx.path,
      role: isAdmin && role.success ? [role.data].flat().join(", ") : null,
      errorCode: failed ? (returned.body?.code ?? String(returned.status)) : null,
      ...requestOf(ctx.request),
    });
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
  /** Records a sign-in, sign-out, password or admin event in the audit log (ADR 0015). */
  onAuthEvent?: (event: AuthAuditEvent) => Promise<void>;
  /**
   * Same-parent-domain deployment (web.example.com + api.example.com): set the parent domain so
   * the session cookie is shared. Leave undefined for localhost. See docs/adr/0002-auth.md.
   */
  cookieDomain?: string;
};

export const createAuth = (options: CreateAuthOptions) => {
  const permissions = createPermissionRepository(options.prisma);
  const users = createUserRepository(options.prisma);
  const emit = emitterOf(options.onAuthEvent);

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
      onPasswordReset: async ({ user }, request) => {
        await users.markEmailVerified(user.id);
        if (request) {
          await emit({
            action: "auth.resetPassword",
            status: "SUCCESS",
            user: userOf(user),
            email: null,
            targetUserId: null,
            endpoint: "/reset-password",
            role: null,
            errorCode: null,
            ...requestOf(request),
          });
        }
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
    hooks: { before: beforeHook(emit), after: afterHook(emit) },
    advanced: {
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
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
