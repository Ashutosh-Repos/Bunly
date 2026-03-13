import { prisma } from "../lib/prisma";

export class AuditService {
    /**
     * Log an administrative or sensitive action for audit purposes.
     * Fails open (catches errors) to not break the main transaction if logging fails.
     */
    static async log(data: {
        actorId: string;
        action: string;
        resource: string;
        resourceId: string;
        reason?: string;
        metadata?: Record<string, unknown>;
        targetUserId?: string;
        ipAddress?: string;
        userAgent?: string;
    }) {
        return prisma.audit_logs
            .create({
                data: {
                    ...data,
                    // If metadata is provided, ensure it's casted correctly for Prisma Json
                    metadata: data.metadata ? (data.metadata as any) : undefined,
                },
            })
            .catch((err) =>
                console.error("[AuditService] Failed to write audit log:", err),
            );
    }
}
