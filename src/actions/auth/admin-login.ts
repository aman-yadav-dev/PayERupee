"use server";

import { headers } from "next/headers";
import { auth } from "@/modules/auth/infrastructure/auth";
import { db } from "@/infrastructure/database/db";

export async function verifyAdminRoleAction() {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });

    if (!session?.user) {
      return { success: false, error: "No active session" };
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, role: true }
    });

    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      try {
        if (session?.session?.token) {
          await auth.api.revokeSession({
            headers: reqHeaders,
            body: { token: session.session.token },
          });
        }
      } catch {
        // Best effort session revocation
      }
      return { 
        success: false, 
        error: "FORBIDDEN_NOT_ADMIN", 
        message: "Access Denied: Your account does not have administrative privileges." 
      };
    }

    return { 
      success: true, 
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        role: user.role 
      } 
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred during role verification.";
    return { 
      success: false, 
      error: "SERVER_ERROR", 
      message 
    };
  }
}
