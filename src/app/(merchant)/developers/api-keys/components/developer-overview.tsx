import { ArrowRight, Key, Shield, Zap, RefreshCw } from "lucide-react";
import React from "react";

export function DeveloperOverview({ baseUrl, onNavigate }: { baseUrl: string, onNavigate: (tab: "keys" | "reference" | "guides") => void }) {
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <h2 className="text-xl font-display font-medium text-text-primary mb-3">Welcome to PayERupee API</h2>
        <p className="text-text-secondary leading-relaxed mb-6">
          The PayERupee API is organized around REST. Our API has predictable resource-oriented URLs, accepts form-encoded request bodies, returns JSON-encoded responses, and uses standard HTTP response codes, authentication, and verbs.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            onClick={() => onNavigate("keys")}
            className="flex items-center justify-between p-4 rounded-xl border border-line hover:border-blue-500/30 hover:bg-surface-hover transition-colors text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg dark:bg-blue-500/10">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium text-text-primary text-sm">Generate API Keys</h3>
                <p className="text-xs text-text-muted mt-0.5">Create TEST or LIVE keys</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-blue-600 transition-colors" />
          </button>

          <button 
            onClick={() => onNavigate("reference")}
            className="flex items-center justify-between p-4 rounded-xl border border-line hover:border-blue-500/30 hover:bg-surface-hover transition-colors text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg dark:bg-amber-500/10">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium text-text-primary text-sm">API Reference</h3>
                <p className="text-xs text-text-muted mt-0.5">Explore endpoints and schemas</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-blue-600 transition-colors" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-text-muted" />
            <h3 className="font-medium text-text-primary">Authentication</h3>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">
            Authenticate your API requests using HTTP Bearer Auth. Use <code className="text-xs bg-canvas px-1.5 py-0.5 rounded text-text-primary border border-line font-mono">sk_test_...</code> for testing and <code className="text-xs bg-canvas px-1.5 py-0.5 rounded text-text-primary border border-line font-mono">sk_live_...</code> for production.
          </p>
        </div>
        
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center gap-2 mb-3">
            <RefreshCw className="w-5 h-5 text-text-muted" />
            <h3 className="font-medium text-text-primary">Idempotency</h3>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">
            Safely retry requests without accidentally performing the same operation twice. All mutating requests require an <code className="text-xs bg-canvas px-1.5 py-0.5 rounded text-text-primary border border-line font-mono">idempotencyKey</code> parameter.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-text-muted" />
            <h3 className="font-medium text-text-primary">Base URL</h3>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed mb-2">
            The API is available at:
          </p>
          <code className="block text-xs bg-canvas px-2 py-1.5 rounded text-text-primary border border-line font-mono break-all">
            {baseUrl}/api/v1
          </code>
        </div>
      </div>
    </div>
  );
}
