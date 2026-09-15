import React from "react";

export default function KycStartPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
      <h1 className="text-2xl font-bold mb-4">KYC Setup Required</h1>
      <p className="text-gray-600 mb-6">
        Before you can access the merchant dashboard, you must complete your business verification (KYC).
      </p>
      <div className="p-4 bg-amber-50 text-amber-800 rounded-md">
        This is a temporary placeholder for Feature A1. The actual KYC application workflow will be implemented in Feature B.
      </div>
    </div>
  );
}
