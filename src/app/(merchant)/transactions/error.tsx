"use client";

import { useEffect } from "react";

export default function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("Transactions Page Error Boundary Caught:", error);
  }, [error]);

  return (
    <div className="p-8 bg-coral-100 text-red-900">
      <h2 className="text-2xl font-bold">Something went wrong!</h2>
      <pre className="mt-4 whitespace-pre-wrap">{error.message}</pre>
      <pre className="mt-4 whitespace-pre-wrap text-sm">{error.stack}</pre>
    </div>
  );
}
