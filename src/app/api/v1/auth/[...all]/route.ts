import { logger } from "@/infrastructure/logger/logger";
import { auth } from "@/modules/auth/infrastructure/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest } from "next/server";
import { dispatchLoginNotification } from "@/modules/auth/application/login-notification.service";

const { GET: authGET, POST: authPOST } = toNextJsHandler(auth.handler);

export { authGET as GET };

export async function POST(req: NextRequest) {
  const isSignInEmail = req.nextUrl.pathname.includes("/sign-in/email");
  
  const response = await authPOST(req);

  if (isSignInEmail && response.status === 200) {
    try {
      const data = await response.clone().json();
      if (data?.session && data?.user) {
        const rawIp = (req as any).ip || req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
        const ipAddress = rawIp.split(":")[0] || rawIp;
        await dispatchLoginNotification({ ...data.session, ipAddress });
      }
    } catch (error) {
      logger.error("[Auth POST Intercept] Error creating login notification:", error);
    }
  }

  return response;
}
