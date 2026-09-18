import { ReactNode } from "react";
import AuthOnboardingLayout from "@/components/auth/AuthOnboardingLayout";

export default function AuthRootLayout({ children }: { children: ReactNode }) {
  return <AuthOnboardingLayout>{children}</AuthOnboardingLayout>;
}
