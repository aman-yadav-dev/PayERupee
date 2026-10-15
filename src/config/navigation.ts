import { LayoutGrid, WalletCards, ArrowLeftRight, Plug, ShieldCheck, CircleUserRound, ShieldAlert } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAVIGATION_GROUPS: NavGroup[] = [
  { 
    label: "", 
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutGrid }
    ] 
  },
  {
    label: "Financial management",
    items: [
      { label: "Wallet", href: "/wallet", icon: WalletCards },
      { label: "Transactions", href: "/transactions", icon: ArrowLeftRight },
    ],
  },
  { 
    label: "API management", 
    items: [
      { label: "Developers", href: "/developers/api-keys", icon: Plug }
    ] 
  },
  {
    label: "Security & account",
    items: [
      { label: "Security", href: "/settings/security", icon: ShieldCheck },
      { label: "Banned Users", href: "/settings/bans", icon: ShieldAlert },
      { label: "Profile", href: "/settings/profile", icon: CircleUserRound },
    ],
  },
];
