import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "../lib/prisma.js";
import redis from "../lib/redis.js";
import { hash, compare } from "bcryptjs";
import { emailService } from "./email.js";
import { admin as adminPlugin } from "better-auth/plugins/admin";
import { jwt } from "better-auth/plugins";
import { APIError } from "better-auth/api";

import { createAccessControl } from "better-auth/plugins/access";
import {
    defaultStatements,
    userAc,
    adminAc,
} from "better-auth/plugins/admin/access";
const ac = createAccessControl(defaultStatements);
const user = ac.newRole({
    ...userAc.statements,
    user: [...userAc.statements.user, "list"],
});
const admin = ac.newRole(adminAc.statements);

// Redis adapter for Better Auth secondary storage (rate limiting, sessions)
// Guards against null redis client (build-time when REDIS_URL is not set)
const redisSecondaryStorage = {
    async get(key: string) {
        if (!redis) return null;
        const value = await redis.get(key);
        return value ? value : null;
    },
    async set(key: string, value: string, ttl?: number) {
        if (!redis) return;
        if (ttl) {
            await redis.set(key, value, "EX", ttl);
        } else {
            await redis.set(key, value);
        }
    },
    async delete(key: string) {
        if (!redis) return;
        await redis.del(key);
    },
};

const hashPassword = async (plain: string): Promise<string> => {
    return await hash(plain, 12);
};

const verifyPassword = async ({
    hash,
    password,
}: {
    hash: string;
    password: string;
}): Promise<boolean> => {
    return await compare(password, hash);
};

import { env } from "../env.js";

export const auth = betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: env.CORS_ORIGIN,
    appName: "Youtube",
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    user: {
        deleteUser: {
            enabled: true,
            sendDeleteAccountVerification: async ({ user, url }) => {
                await emailService.sendDeleteAccountVerificationMail(
                    user.email,
                    url,
                    user.name,
                );
            },
        },
        additionalFields: {
            dob: { type: "date", required: false, returned: true },
        },
    },
    emailVerification: {
        sendVerificationEmail: async ({ user, url }) => {
            const token = new URL(url).searchParams.get("token");
            const verificationUrl = `${env.APP_URL}/auth/verify-email?token=${token}`;
            await emailService.sendEmailVerificationMail(
                user.email,
                verificationUrl,
                user.name,
            );
        },
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
        expiresIn: 3600,
    },
    emailAndPassword: {
        enabled: true,
        sendResetPassword: async ({ user, url }) => {
            const token = new URL(url).searchParams.get("token");
            const resetUrl = `${env.APP_URL}/auth/reset-password?token=${token}`;
            await emailService.sendPasswordResetMail(
                user.email,
                resetUrl,
                user.name,
            );
        },
        password: {
            hash: hashPassword,
            verify: verifyPassword,
        },
        minPasswordLength: 8,
        maxPasswordLength: 128,
        requireEmailVerification: true,
        revokeSessionsOnPasswordReset: true,
        autoSignIn: true,
        resetPasswordTokenExpiresIn: 3600,
    },
    socialProviders: {
        ...(env.GOOGLE_CLIENT_ID &&
            env.GOOGLE_CLIENT_SECRET && {
                google: {
                    clientId: env.GOOGLE_CLIENT_ID,
                    clientSecret: env.GOOGLE_CLIENT_SECRET,
                },
            }),
        ...(env.GITHUB_CLIENT_ID &&
            env.GITHUB_CLIENT_SECRET && {
                github: {
                    clientId: env.GITHUB_CLIENT_ID,
                    clientSecret: env.GITHUB_CLIENT_SECRET,
                },
            }),
    },
    session: {
        expiresIn: 2592000, // 30 Days
        updateAge: 86400, // Update session every 1 day
        storeSessionInDatabase: true,
    },
    account: {
        accountLinking: {
            enabled: true,
            allowDifferentEmails: false,
            trustedProviders: ["google", "github"],
        },
    },
    verification: {
        disableCleanup: false,
    },
    rateLimit: {
        enabled: true,
        window: 60, // 60 second window
        max: 300, // 300 requests per window (increased for image-heavy SPA resilience)
        storage: "secondary-storage", // Use Redis for high-performance rate limiting
        customRules: {
            // Stricter limits for sensitive authentication paths
            "/sign-in/email": {
                window: 10,
                max: 5, // 5 attempts per 10 seconds
            },
            "/sign-up/email": {
                window: 60,
                max: 5,
            },
            "/forgot-password": {
                window: 60,
                max: 3,
            },
            "/reset-password": {
                window: 60,
                max: 5,
            },
        },
    },
    secondaryStorage: redisSecondaryStorage,
    advanced: {
        ipAddress: {
            disableIpTracking: false,
            ipv6Subnet: 64, // Rate limit by /64 subnet to prevent IPv6 rotation attacks
        },
        useSecureCookies: env.NODE_ENV === "production",
        disableCSRFCheck: false,
        disableOriginCheck: false,
        crossSubDomainCookies: {
            enabled: env.NODE_ENV === "production",
        },
        defaultCookieAttributes: {
            httpOnly: true,
            secure: env.NODE_ENV === "production",
            // If API and App on separate domains, "none" is required, otherwise "lax" is safer mapping domains locally
            sameSite: env.NODE_ENV === "production" ? "none" : "lax",
        },
    },
    databaseHooks: {
        user: {
            create: {
                after: async (user) => {
                    console.log(
                        `[AUTH] User created in DB: ${user.email} (${user.id})`,
                    );
                    try {
                        await emailService.sendUserJoiningMail(
                            user.email,
                            user.name,
                        );
                    } catch (error) {
                        console.error(
                            "[AUTH] Failed to send joining mail:",
                            error,
                        );
                        // Do not throw, we want the user to be created regardless of email success
                    }
                },
            },
            update: {
                after: async (user) => {
                    console.log(
                        `[AUTH] User updated in DB: ${user.email} | DOB: ${user.dob}`,
                    );
                },
            },
        },
        account: {
            create: {
                before: async (account) => {
                    // Audit log for account linking — non-blocking
                    if (account.providerId === "credential") return;

                    const existingUser = await prisma.user.findUnique({
                        where: { id: account.userId },
                    });

                    if (existingUser) {
                        const isNewUser =
                            Date.now() - existingUser.createdAt.getTime() <
                            30 * 1000;
                        if (!isNewUser) {
                            console.log(
                                `[AUTH] Account linked: ${existingUser.email} ← ${account.providerId}`,
                            );
                        }
                    }
                },
            },
        },
        session: {
            create: {
                before: async (session) => {
                    const existingUser = await prisma.user.findUnique({
                        where: { id: session.userId },
                        select: { banned: true },
                    });

                    if (existingUser?.banned) {
                        throw new APIError("UNAUTHORIZED", {
                            message: "User is banned from the platform.",
                        });
                    }
                    return { data: session };
                },
            },
        },
    },

    plugins: [
        jwt({
            jwt: {
                expirationTime: "15m", // Short-lived edge JWT (Hybrid Strategy)
            },
        }),
        adminPlugin({
            ac,
            roles: {
                admin,
                user,
            },
        }),
    ],
});
