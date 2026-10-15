import React from "react";
import { BookOpen, CheckCircle2 } from "lucide-react";

export function DeveloperGuides({ baseUrl }: { baseUrl: string }) {
  return (
    <div className="space-y-8 max-w-4xl">
      
      <div className="rounded-2xl border border-line bg-surface overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-line bg-surface-hover/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg dark:bg-blue-500/10">
              <BookOpen className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-display font-medium text-text-primary">Quickstart Guide</h2>
          </div>
          <p className="text-sm text-text-secondary">Follow these steps to make your first API request.</p>
        </div>
        
        <div className="p-6 sm:p-8 space-y-8">
          
          <div className="relative pl-8">
            <div className="absolute left-0 top-0.5 w-6 h-6 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold">1</div>
            <h3 className="font-medium text-text-primary mb-2">Generate a TEST API Key</h3>
            <p className="text-sm text-text-secondary leading-relaxed mb-4">
              Navigate to the <strong>API Keys</strong> tab. Ensure you have selected the <strong>TEST</strong> environment toggle. Click <strong>Create API key</strong>, give it a recognizable name, and securely copy the <code className="text-xs bg-canvas border border-line px-1.5 py-0.5 rounded text-text-primary">rawSecret</code>.
            </p>
          </div>

          <div className="relative pl-8">
            <div className="absolute left-0 top-0.5 w-6 h-6 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold">2</div>
            <h3 className="font-medium text-text-primary mb-2">Understand the Contract</h3>
            <p className="text-sm text-text-secondary leading-relaxed mb-4">
              The primary functionality revolves around generating payouts. All requests require JSON payloads and Bearer token authentication. PayERupee uses synchronous idempotency to prevent duplicate transaction charges.
            </p>
          </div>

          <div className="relative pl-8">
            <div className="absolute left-0 top-0.5 w-6 h-6 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold">3</div>
            <h3 className="font-medium text-text-primary mb-2">Execute your first Payout</h3>
            <p className="text-sm text-text-secondary leading-relaxed mb-4">
              Using the key generated in Step 1, run the following command in your terminal. This example creates an IMPS bank payout. You can alternatively use UPI by replacing the bank fields with a <code className="text-xs font-mono bg-canvas border-line px-1 rounded">vpa</code> field.
            </p>
            <div className="bg-canvas border border-line rounded-xl overflow-hidden">
              <div className="px-4 py-2 border-b border-line bg-surface/50 text-xs font-mono text-text-muted flex justify-between items-center">
                <span>Terminal</span>
              </div>
              <pre className="p-4 overflow-x-auto scroll-thin text-xs font-mono text-text-primary leading-relaxed">
{`curl -X POST ${baseUrl}/api/v1/payouts \\
  -H "Authorization: Bearer sk_test_YOUR_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "idempotencyKey": "req_123456789",
    "amount": "100.00",
    "accountNumber": "1234567890",
    "ifscCode": "HDFC0000123",
    "accountHolderName": "John Doe",
    "paymentMode": "IMPS"
  }'`}
              </pre>
            </div>
          </div>

          <div className="relative pl-8">
            <div className="absolute left-0 top-0.5 w-6 h-6 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 rounded-full flex items-center justify-center text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <h3 className="font-medium text-text-primary mb-2">Verify in Dashboard</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              If the request is successful, you will receive a <code className="text-xs bg-canvas border border-line px-1.5 py-0.5 rounded">201 Created</code> response. You can view the transaction immediately in the <strong>Transactions</strong> dashboard under the TEST environment.
            </p>
          </div>
          
        </div>
      </div>
      
    </div>
  );
}
