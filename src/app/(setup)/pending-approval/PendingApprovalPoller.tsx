"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PendingApprovalPoller() {
  const router = useRouter();

  useEffect(() => {
    const intervalId = setInterval(() => {
      router.refresh();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [router]);

  return null;
}
