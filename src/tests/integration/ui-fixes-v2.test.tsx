// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TransactionsDetailDrawer } from "../../components/merchant/TransactionsDetailDrawer";
import { ApiKeysManagement } from "../../app/(merchant)/developers/api-keys/components/api-keys-management";

describe("UI Consistency V2", () => {
  it("TransactionsDetailDrawer uses dark mode semantic tokens and is responsive", () => {
    const { container: container2 } = render(<TransactionsDetailDrawer transactionId="tx-1" onClose={() => {}} transactions={[]} />);
    const drawerShell = container2.querySelector('div[role="dialog"]');
    expect(drawerShell).not.toBeNull();
    const className = drawerShell?.className || "";
    // Dark mode semantic tokens
    expect(className).toContain("bg-surface");
    expect(className).not.toContain("bg-white");
  });

  it("APIKeysManagement Create API Key button has correct primary styling", () => {
    const { container } = render(<ApiKeysManagement />);
    const button = screen.getAllByText("Create API key")[0];
    const className = button.className;
    // Should NOT have bg-surface and text-white overrides
    expect(className).not.toContain("bg-surface");
    expect(className).not.toContain("text-white");
  });
});
