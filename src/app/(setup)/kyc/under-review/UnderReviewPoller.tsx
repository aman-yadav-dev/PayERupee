"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function UnderReviewPoller() {
  const router = useRouter();
  const isChecking = useRef(false);

  useEffect(() => {
    const intervalId = setInterval(async () => {
      if (isChecking.current) return;
      
      isChecking.current = true;
      try {
        const res = await fetch("/api/v1/merchant/kyc/application", {
          // Prevent aggressive caching of the fetch request
          headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" }
        });
        
        if (!res.ok) {
          isChecking.current = false;
          return;
        }
        
        const json = await res.json();
        const status = json.data?.status;
        
        // If the API returns a status and it is no longer UNDER_REVIEW,
        // force a router refresh so the server component's destination logic takes over
        if (status && status !== "UNDER_REVIEW") {
          router.refresh();
        }
      } catch (e) {
        // Fail silently to avoid interrupting the user's experience on transient network errors
      } finally {
        isChecking.current = false;
      }
    }, 5000); // Check every 5 seconds

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [router]);

  // This is a headless logic component
  return null;
}
