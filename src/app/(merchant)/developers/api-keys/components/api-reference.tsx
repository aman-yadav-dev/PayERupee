"use client";

import { useState } from "react";
import { Copy, CheckCircle2, Lock, Landmark, Smartphone, FileJson, AlertCircle } from "lucide-react";

export function ApiReference({ baseUrl }: { baseUrl: string }) {
  const [activeSection, setActiveSection] = useState<"authentication" | "bank-payout" | "upi-payout">("authentication");
  const [codeLang, setCodeLang] = useState<"cURL" | "JS" | "Python" | "PHP">("cURL");
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCodeSnippet = () => {
    const url = baseUrl.includes("localhost") ? "http://localhost:3000/api/v1/payouts" : "https://payerupee.in/api/v1/payouts";
    const key = `sk_test_YOUR_SECRET_KEY`;
    
    let payload = "";
    if (activeSection === "authentication" || activeSection === "bank-payout") {
      payload = JSON.stringify({
        idempotencyKey: "payout_bank_001",
        amount: "1000.00",
        paymentMode: "IMPS",
        accountNumber: "1234567890",
        ifscCode: "HDFC0001234",
        accountHolderName: "Rahul Sharma"
      }, null, 2);
    } else {
      payload = JSON.stringify({
        idempotencyKey: "payout_upi_001",
        amount: "1000.00",
        paymentMode: "UPI",
        vpa: "merchant@upi"
      }, null, 2);
    }

    if (codeLang === "cURL") {
      return `curl -X POST ${url} \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '${payload}'`;
    }
    if (codeLang === "JS") {
      return `fetch("${url}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${key}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify(${payload.replace(/\n/g, '\n  ')})
})
.then(res => res.json())
.then(console.log);`;
    }
    if (codeLang === "Python") {
      return `import requests
import json

url = "${url}"
headers = {
    "Authorization": "Bearer ${key}",
    "Content-Type": "application/json"
}
payload = ${payload.replace(/\n/g, '\n')}

response = requests.post(url, headers=headers, data=json.dumps(payload))
print(response.json())`;
    }
    if (codeLang === "PHP") {
      return `$ch = curl_init();

$payload = json_encode(${payload.replace(/\n/g, '\n')});

curl_setopt($ch, CURLOPT_URL, "${url}");
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer ${key}",
    "Content-Type: application/json"
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
curl_close($ch);
echo $response;`;
    }
    return "";
  };

  const NavItem = ({ id, icon: Icon, label }: { id: typeof activeSection, icon: any, label: string }) => {
    const isActive = activeSection === id;
    return (
      <button
        onClick={() => setActiveSection(id)}
        className={`flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium transition-colors text-left ${
          isActive
            ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
            : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
        }`}
      >
        <Icon className={`w-4 h-4 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-text-muted"}`} />
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 lg:gap-10 items-start">
      {/* LEFT: Navigation (2 cols) */}
      <div className="lg:col-span-2 w-full lg:sticky lg:top-8 border-b border-line lg:border-none pb-4 lg:pb-0">
        <div className="flex flex-row lg:flex-col gap-1 overflow-x-auto scroll-thin">
          <div className="hidden lg:block mb-2 px-3">
            <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-wider">API Reference</h3>
          </div>
          <NavItem id="authentication" icon={Lock} label="Authentication" />
          <NavItem id="bank-payout" icon={Landmark} label="Bank Payout" />
          <NavItem id="upi-payout" icon={Smartphone} label="UPI Payout" />
        </div>
      </div>

      {/* CENTER: Content (6 cols) */}
      <div className="lg:col-span-6 w-full space-y-12 min-w-0 max-w-2xl mx-auto lg:mx-0">
        
        {activeSection === "authentication" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <div className="mb-2">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Section</span>
              </div>
              <h2 className="text-2xl font-display font-medium text-text-primary mb-3">Authentication</h2>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                The PayERupee API uses API keys to authenticate requests. Your API keys carry many privileges, so be sure to keep them secure. Do not share your secret API keys in publicly accessible areas such as GitHub, client-side code, and so forth.
              </p>
              <ul className="list-disc pl-5 text-sm text-text-secondary space-y-2 mb-6">
                <li><strong className="text-text-primary">TEST keys</strong> start with <code className="text-[10px] font-mono bg-canvas border border-line px-1 rounded">sk_test_</code></li>
                <li><strong className="text-text-primary">LIVE keys</strong> start with <code className="text-[10px] font-mono bg-canvas border border-line px-1 rounded">sk_live_</code></li>
              </ul>
              <p className="text-sm text-text-secondary leading-relaxed">
                Both keys use the exact same API endpoint. The environment is strictly determined by the API key provided in the header.
              </p>
            </div>

            <div>
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Header requirement</h3>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-surface border border-line p-3.5 rounded-xl gap-4">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] font-bold rounded uppercase tracking-wider">HEADER</span>
                  <code className="text-sm font-mono text-text-primary">Authorization: Bearer sk_test_...</code>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === "bank-payout" && (
          <div className="space-y-10 animate-in fade-in duration-300">
            <div>
              <div className="mb-2">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Section</span>
              </div>
              <h2 className="text-2xl font-display font-medium text-text-primary mb-3">Bank Payout</h2>
              <p className="text-sm text-text-secondary leading-relaxed">
                Create a payout strictly destined for a bank account. 
              </p>
            </div>

            <div>
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Request Endpoint</h3>
              <div className="flex items-center justify-between bg-surface border border-line p-3.5 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] font-bold rounded uppercase tracking-wider">POST</span>
                  <code className="text-sm font-mono text-text-primary">/api/v1/payouts</code>
                </div>
                <button onClick={() => handleCopy("/api/v1/payouts")} className="text-text-muted hover:text-text-primary transition-colors">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Request Body Parameters</h3>
              <div className="border-t border-line divide-y divide-line">
                <div className="py-4 flex flex-col sm:flex-row gap-2 sm:gap-6">
                  <div className="w-40 shrink-0">
                    <code className="text-sm font-mono text-text-primary">idempotencyKey</code>
                    <span className="ml-2 text-[9px] font-semibold text-coral-500 uppercase">Req</span>
                  </div>
                  <div>
                    <div className="text-xs text-text-muted font-mono mb-1">string</div>
                    <p className="text-sm text-text-secondary">Unique key to prevent duplicate payouts.</p>
                  </div>
                </div>
                <div className="py-4 flex flex-col sm:flex-row gap-2 sm:gap-6">
                  <div className="w-40 shrink-0">
                    <code className="text-sm font-mono text-text-primary">amount</code>
                    <span className="ml-2 text-[9px] font-semibold text-coral-500 uppercase">Req</span>
                  </div>
                  <div>
                    <div className="text-xs text-text-muted font-mono mb-1">string</div>
                    <p className="text-sm text-text-secondary">The amount to send in INR (e.g. <code className="text-[10px] bg-canvas border border-line px-1 rounded">"1000.00"</code>).</p>
                  </div>
                </div>
                <div className="py-4 flex flex-col sm:flex-row gap-2 sm:gap-6">
                  <div className="w-40 shrink-0">
                    <code className="text-sm font-mono text-text-primary">paymentMode</code>
                    <span className="ml-2 text-[9px] font-semibold text-coral-500 uppercase">Req</span>
                  </div>
                  <div>
                    <div className="text-xs text-text-muted font-mono mb-1">string</div>
                    <p className="text-sm text-text-secondary">Must be <code className="text-[10px] font-mono bg-canvas border border-line px-1 rounded">"IMPS"</code>.</p>
                  </div>
                </div>
                <div className="py-4 flex flex-col sm:flex-row gap-2 sm:gap-6">
                  <div className="w-40 shrink-0">
                    <code className="text-sm font-mono text-text-primary">accountNumber</code>
                    <span className="ml-2 text-[9px] font-semibold text-coral-500 uppercase">Req</span>
                  </div>
                  <div>
                    <div className="text-xs text-text-muted font-mono mb-1">string</div>
                    <p className="text-sm text-text-secondary">The beneficiary's bank account number.</p>
                  </div>
                </div>
                <div className="py-4 flex flex-col sm:flex-row gap-2 sm:gap-6">
                  <div className="w-40 shrink-0">
                    <code className="text-sm font-mono text-text-primary">ifscCode</code>
                    <span className="ml-2 text-[9px] font-semibold text-coral-500 uppercase">Req</span>
                  </div>
                  <div>
                    <div className="text-xs text-text-muted font-mono mb-1">string</div>
                    <p className="text-sm text-text-secondary">The 11-character IFSC code of the beneficiary bank.</p>
                  </div>
                </div>
                <div className="py-4 flex flex-col sm:flex-row gap-2 sm:gap-6">
                  <div className="w-40 shrink-0">
                    <code className="text-sm font-mono text-text-primary">accountHolderName</code>
                    <span className="ml-2 text-[9px] font-semibold text-coral-500 uppercase">Req</span>
                  </div>
                  <div>
                    <div className="text-xs text-text-muted font-mono mb-1">string</div>
                    <p className="text-sm text-text-secondary">The name of the beneficiary as registered with their bank.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <ResponseAndErrors />
          </div>
        )}

        {activeSection === "upi-payout" && (
          <div className="space-y-10 animate-in fade-in duration-300">
            <div>
              <div className="mb-2">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Section</span>
              </div>
              <h2 className="text-2xl font-display font-medium text-text-primary mb-3">UPI Payout</h2>
              <p className="text-sm text-text-secondary leading-relaxed">
                Create a payout destined for a UPI Virtual Payment Address (VPA). This is a first-class supported payment method. 
              </p>
              <div className="mt-4 p-4 rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/10 flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800 dark:text-blue-300/90 leading-relaxed">
                  <strong>Important:</strong> Provide the actual <code className="text-[10px] font-mono bg-blue-100/50 dark:bg-blue-900/30 px-1 rounded">vpa</code> field. <code className="text-[10px] font-mono bg-blue-100/50 dark:bg-blue-900/30 px-1 rounded">accountNumber</code> and <code className="text-[10px] font-mono bg-blue-100/50 dark:bg-blue-900/30 px-1 rounded">ifscCode</code> are not used for UPI payouts, and dummy IFSC values are not required.
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Request Endpoint</h3>
              <div className="flex items-center justify-between bg-surface border border-line p-3.5 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 text-[10px] font-bold rounded uppercase tracking-wider">POST</span>
                  <code className="text-sm font-mono text-text-primary">/api/v1/payouts</code>
                </div>
                <button onClick={() => handleCopy("/api/v1/payouts")} className="text-text-muted hover:text-text-primary transition-colors">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Request Body Parameters</h3>
              <div className="border-t border-line divide-y divide-line">
                <div className="py-4 flex flex-col sm:flex-row gap-2 sm:gap-6">
                  <div className="w-40 shrink-0">
                    <code className="text-sm font-mono text-text-primary">idempotencyKey</code>
                    <span className="ml-2 text-[9px] font-semibold text-coral-500 uppercase">Req</span>
                  </div>
                  <div>
                    <div className="text-xs text-text-muted font-mono mb-1">string</div>
                    <p className="text-sm text-text-secondary">Unique key to prevent duplicate payouts.</p>
                  </div>
                </div>
                <div className="py-4 flex flex-col sm:flex-row gap-2 sm:gap-6">
                  <div className="w-40 shrink-0">
                    <code className="text-sm font-mono text-text-primary">amount</code>
                    <span className="ml-2 text-[9px] font-semibold text-coral-500 uppercase">Req</span>
                  </div>
                  <div>
                    <div className="text-xs text-text-muted font-mono mb-1">string</div>
                    <p className="text-sm text-text-secondary">The amount to send in INR (e.g. <code className="text-[10px] bg-canvas border border-line px-1 rounded">"1000.00"</code>).</p>
                  </div>
                </div>
                <div className="py-4 flex flex-col sm:flex-row gap-2 sm:gap-6">
                  <div className="w-40 shrink-0">
                    <code className="text-sm font-mono text-text-primary">paymentMode</code>
                    <span className="ml-2 text-[9px] font-semibold text-coral-500 uppercase">Req</span>
                  </div>
                  <div>
                    <div className="text-xs text-text-muted font-mono mb-1">string</div>
                    <p className="text-sm text-text-secondary">Must be <code className="text-[10px] font-mono bg-canvas border border-line px-1 rounded">"UPI"</code>.</p>
                  </div>
                </div>
                <div className="py-4 flex flex-col sm:flex-row gap-2 sm:gap-6">
                  <div className="w-40 shrink-0">
                    <code className="text-sm font-mono text-text-primary">vpa</code>
                    <span className="ml-2 text-[9px] font-semibold text-coral-500 uppercase">Req</span>
                  </div>
                  <div>
                    <div className="text-xs text-text-muted font-mono mb-1">string</div>
                    <p className="text-sm text-text-secondary">The beneficiary's exact UPI Virtual Payment Address (e.g., <code className="text-[10px] bg-canvas border border-line px-1 rounded">user@bank</code>).</p>
                  </div>
                </div>
              </div>
            </div>
            
            <ResponseAndErrors />
          </div>
        )}
      </div>

      {/* RIGHT: Code Snippet Panel (4 cols) */}
      <div className="lg:col-span-4 w-full">
        <div className="sticky top-8 rounded-xl overflow-hidden border border-line bg-surface shadow-2xl">
          <div className="flex items-center justify-between px-4 py-2 border-b border-line bg-surface">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Example Request</span>
          </div>
          <div className="flex border-b border-line bg-surface/50">
            {(["cURL", "JS", "Python", "PHP"] as const).map(lang => (
              <button
                key={lang}
                onClick={() => setCodeLang(lang)}
                className={`flex-1 py-2 text-[11px] font-mono font-medium transition-colors ${codeLang === lang ? "text-blue-400 border-b-2 border-blue-400 bg-surface/50" : "text-text-muted hover:text-text-muted hover:bg-surface/30"}`}
              >
                {lang}
              </button>
            ))}
          </div>
          
          <div className="relative group">
            <button
              onClick={() => handleCopy(getCodeSnippet())}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-surface/50 text-text-muted hover:text-white hover:bg-surface opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
              title="Copy code"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <pre className="p-4 overflow-x-auto scroll-thin text-xs font-mono text-text-muted leading-relaxed max-h-[500px]">
              {getCodeSnippet()}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResponseAndErrors() {
  return (
    <>
      <div className="pt-8 border-t border-line">
        <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">Payment Mode Matrix</h3>
        <div className="border border-line rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm border-collapse bg-surface">
            <thead>
              <tr className="bg-surface-hover/50 border-b border-line">
                <th className="p-3 font-semibold text-text-secondary">Mode</th>
                <th className="p-3 font-semibold text-text-secondary">Status</th>
                <th className="p-3 font-semibold text-text-secondary">Destination</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-text-primary">
              <tr>
                <td className="p-3"><code className="text-xs font-mono text-text-primary">IMPS</code></td>
                <td className="p-3 flex items-center gap-1.5 text-text-primary"><div className="w-2 h-2 rounded-full bg-green-500"></div>Supported</td>
                <td className="p-3 text-text-secondary">Bank account</td>
              </tr>
              <tr>
                <td className="p-3"><code className="text-xs font-mono text-text-primary">UPI</code></td>
                <td className="p-3 flex items-center gap-1.5 text-text-primary"><div className="w-2 h-2 rounded-full bg-green-500"></div>Supported</td>
                <td className="p-3 text-text-secondary">UPI VPA</td>
              </tr>
              <tr>
                <td className="p-3"><code className="text-xs font-mono text-text-primary">NEFT</code></td>
                <td className="p-3 flex items-center gap-1.5 text-text-muted"><div className="w-2 h-2 rounded-full bg-surface dark:bg-surface"></div>Not currently supported</td>
                <td className="p-3 text-text-muted">—</td>
              </tr>
              <tr>
                <td className="p-3"><code className="text-xs font-mono text-text-primary">RTGS</code></td>
                <td className="p-3 flex items-center gap-1.5 text-text-muted"><div className="w-2 h-2 rounded-full bg-surface dark:bg-surface"></div>Not currently supported</td>
                <td className="p-3 text-text-muted">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="pt-8 border-t border-line">
        <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">Serialized Response</h3>
        <p className="text-sm text-text-secondary leading-relaxed mb-4">
          The public API returns a strictly serialized payout response. Destination fields (<code className="text-[10px] font-mono bg-canvas border border-line px-1 rounded">vpa</code> vs <code className="text-[10px] font-mono bg-canvas border border-line px-1 rounded">accountNumber</code>) are populated dynamically based on the <code className="text-[10px] font-mono bg-canvas border border-line px-1 rounded">paymentMode</code> used.
        </p>
        <div className="rounded-xl overflow-hidden border border-line bg-surface shadow-sm">
          <div className="flex items-center justify-between px-4 py-2 border-b border-line bg-surface">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Example Response (201 Created)</span>
          </div>
          <pre className="p-4 overflow-x-auto scroll-thin text-xs font-mono text-text-muted leading-relaxed">
{`{
  "success": true,
  "payout": {
    "id": "pay_xyz123",
    "idempotencyKey": "req_123456789",
    "amount": "1000.00",
    "fee": "5.00",
    "tax": "0.90",
    "totalDebitAmount": "1005.90",
    "status": "PENDING",
    "paymentMode": "IMPS",
    "merchantReference": null,
    "failureReason": null,
    "processedAt": null,
    "createdAt": "2026-10-04T12:00:00.000Z",
    "updatedAt": "2026-10-04T12:00:00.000Z",
    "accountNumber": "1234567890",
    "ifscCode": "HDFC0001234",
    "accountHolderName": "Rahul Sharma",
    "vpa": null
  }
}`}
          </pre>
        </div>
      </div>

      <div className="pt-8 border-t border-line">
        <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">API Errors</h3>
        <div className="border border-line rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm border-collapse bg-surface">
            <thead>
              <tr className="bg-surface-hover/50 border-b border-line">
                <th className="p-3 font-semibold text-text-secondary">Code</th>
                <th className="p-3 font-semibold text-text-secondary">Response Example</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-text-primary">
              <tr>
                <td className="p-3 font-mono">400</td>
                <td className="p-3"><code className="text-xs text-text-secondary font-mono">{"{\"success\":false,\"error\":\"Validation failed\"}"}</code></td>
              </tr>
              <tr>
                <td className="p-3 font-mono">401</td>
                <td className="p-3"><code className="text-xs text-text-secondary font-mono">{"{\"success\":false,\"error\":\"Invalid API key\"}"}</code></td>
              </tr>
              <tr>
                <td className="p-3 font-mono">403</td>
                <td className="p-3"><code className="text-xs text-text-secondary font-mono">{"{\"success\":false,\"error\":\"Merchant account not verified\"}"}</code></td>
              </tr>
              <tr>
                <td className="p-3 font-mono">429</td>
                <td className="p-3"><code className="text-xs text-text-secondary font-mono">{"{\"success\":false,\"error\":\"Too Many Requests\"}"}</code></td>
              </tr>
              <tr>
                <td className="p-3 font-mono">500</td>
                <td className="p-3"><code className="text-xs text-text-secondary font-mono">{"{\"success\":false,\"error\":\"Internal Server Error\"}"}</code></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
