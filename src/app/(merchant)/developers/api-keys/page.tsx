"use client";

import { useState, useEffect } from "react";
import { Terminal, Key, BookOpen, Webhook, FileText, ArrowRight } from "lucide-react";
import { ApiKeysManagement } from "./components/api-keys-management";
import { ApiReference } from "./components/api-reference";
import { DeveloperOverview } from "./components/developer-overview";
import { DeveloperGuides } from "./components/developer-guides";

export default function DeveloperCenterPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "keys" | "reference" | "guides">("overview");
  const [baseUrl, setBaseUrl] = useState("https://payerupee.in");

  useEffect(() => {
    // Determine the base URL for docs
    const currentOrigin = window.location.origin;
    if (currentOrigin.includes("localhost")) {
      setBaseUrl(currentOrigin);
    } else {
      // The production domain rule applies here
      setBaseUrl("https://payerupee.in");
    }
  }, []);

  return (
    <main className="px-4 sm:px-5 lg:px-8 py-6 space-y-5 w-full max-w-[1440px] mx-auto animate-in fade-in duration-500">
      
      {/* Developer Center Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-medium text-text-primary tracking-tight">Developer Center</h1>
        <p className="text-sm sm:text-base text-text-muted mt-1">Build secure integrations with PayERupee APIs.</p>
      </div>

      {/* Main Horizontal Navigation */}
      <div className="border-b border-line overflow-x-auto scroll-thin pb-[1px]">
        <nav className="flex space-x-6 min-w-max" aria-label="Developer Navigation">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-3 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === "overview" 
                ? "border-blue-600 text-blue-600" 
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            <FileText className="w-4 h-4" />
            Overview
          </button>
          
          <button
            onClick={() => setActiveTab("keys")}
            className={`pb-3 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === "keys" 
                ? "border-blue-600 text-blue-600" 
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            <Key className="w-4 h-4" />
            API Keys
          </button>

          <button
            onClick={() => setActiveTab("reference")}
            className={`pb-3 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === "reference" 
                ? "border-blue-600 text-blue-600" 
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            <Terminal className="w-4 h-4" />
            API Reference
          </button>

          <button 
            disabled 
            className="pb-3 border-b-2 border-transparent text-text-muted font-medium text-sm flex items-center gap-2 cursor-not-allowed opacity-70"
          >
            <Webhook className="w-4 h-4" />
            Webhooks
            <span className="ml-1.5 text-[10px] uppercase font-bold tracking-wider bg-canvas border border-line text-text-muted px-1.5 py-0.5 rounded">Coming soon</span>
          </button>

          <button
            onClick={() => setActiveTab("guides")}
            className={`pb-3 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === "guides" 
                ? "border-blue-600 text-blue-600" 
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Guides
          </button>
        </nav>
      </div>

      {/* Render Active View */}
      <div className="mt-8 pb-12">
        {activeTab === "overview" && <DeveloperOverview baseUrl={baseUrl} onNavigate={setActiveTab} />}
        {activeTab === "keys" && <ApiKeysManagement />}
        {activeTab === "reference" && <ApiReference baseUrl={baseUrl} />}
        {activeTab === "guides" && <DeveloperGuides baseUrl={baseUrl} />}
      </div>
      
    </main>
  );
}
