"use client";
import { NAVIGATION_GROUPS } from "@/config/navigation";

import { useRef, useState, useEffect } from "react";
import { Search, Bell, ChevronDown, Menu } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { useClickOutside } from "@/lib/useClickOutside";
import { formatDateTimeIST } from "@/lib/date";
import { useSession, signOut } from "@/modules/auth/infrastructure/auth-client";
import { useRouter } from "next/navigation";

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const { data: session } = useSession();
  
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/v1/merchant/notifications", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setNotifications(json.data.notifications);
          setUnreadCount(json.data.unreadCount);
        }
      }
    } catch (e) {
      // silent
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAllRead = async () => {
    try {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      await fetch("/api/v1/merchant/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true })
      });
    } catch (e) {
      fetchNotifications();
    }
  };

  const markAsRead = async (id: string) => {
    try {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      await fetch("/api/v1/merchant/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
    } catch (e) {
      fetchNotifications();
    }
  };

  useClickOutside(notifRef, () => setNotifOpen(false));
  useClickOutside(profileRef, () => setProfileOpen(false));

  const userName = session?.user?.name || "Merchant";
  const userEmail = session?.user?.email || "";
  const initials = userName.substring(0, 2).toUpperCase();
  
    const [currentDate, setCurrentDate] = useState("");
  
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [txnResults, setTxnResults] = useState<any[]>([]);
  const [isSearchingTxns, setIsSearchingTxns] = useState(false);

  useClickOutside(searchContainerRef, () => setIsSearchOpen(false));

  const flatNav = NAVIGATION_GROUPS.flatMap(g => g.items);
  const navResults = flatNav.filter(r => r.label.toLowerCase().includes(searchQuery.toLowerCase()));

  useEffect(() => {
    if (!searchQuery) {
      setTxnResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setIsSearchingTxns(true);
      try {
        const res = await fetch(`/api/v1/merchant/payouts?limit=5&search=${encodeURIComponent(searchQuery)}`, { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (json.success) setTxnResults(json.data);
        }
      } catch (e) {}
      setIsSearchingTxns(false);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  
  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }));
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-20 h-16 flex items-center justify-between gap-3 px-4 sm:px-5 lg:px-8 bg-canvas backdrop-blur-sm border-b border-line">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="md:hidden h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border border-line bg-surface text-text-secondary press-feedback"
        >
          <Menu className="h-[17px] w-[17px]" strokeWidth={2} />
        </button>
        <div className="min-w-0">
          <h1 className="font-display text-[17px] sm:text-[19px] font-medium tracking-tight text-text-primary truncate">
            Overview
          </h1>
          <p className="hidden sm:block text-[12.5px] text-text-muted -mt-0.5 truncate">
            {currentDate}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="hidden md:flex relative flex-1 max-w-[200px] lg:max-w-none" ref={searchContainerRef}>
          <div className={`flex items-center gap-2 h-9 w-full lg:w-64 rounded-lg border bg-surface px-3 text-text-muted transition-colors ${isSearchOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-line'}`}>
            <Search className="h-[15px] w-[15px] shrink-0" strokeWidth={2} />
            <input
              type="text"
              placeholder="Search transactions, vendors, or IDs"
              value={searchQuery}
              onFocus={() => setIsSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              className="w-full bg-transparent text-[13px] text-text-primary placeholder:text-text-muted outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
            />
          </div>
            
          {isSearchOpen && (
            <div className="absolute top-full left-0 mt-2 w-80 rounded-xl border border-line bg-surface shadow-[var(--shadow-pop)] z-50 overflow-hidden origin-top animate-pop-in">
              <div className="max-h-[400px] overflow-y-auto scroll-thin">
                {(!searchQuery && navResults.length === 0) ? null : (
                  <>
                    {navResults.length > 0 && (
                      <div className="py-2">
                        <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Navigation</p>
                        {navResults.map((nav, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setIsSearchOpen(false);
                              setSearchQuery("");
                              router.push(nav.href);
                            }}
                              className="w-full text-left px-4 py-2 hover:bg-canvas transition-colors text-[13px] font-medium text-text-primary"
                            >
                              {nav.label}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      <div className="py-2 border-t border-line-soft">
                        <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Transactions</p>
                        {isSearchingTxns ? (
                          <div className="px-4 py-3 text-[12.5px] text-text-muted">Searching...</div>
                        ) : txnResults.length > 0 ? (
                          txnResults.map((txn, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setIsSearchOpen(false);
                                setSearchQuery("");
                                router.push('/transactions');
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-canvas transition-colors flex flex-col"
                            >
                              <span className="text-[13px] font-medium text-text-primary">{txn.accountHolderName}</span>
                              <span className="text-[11.5px] text-text-muted truncate">{txn.id} &middot; {txn.paymentMode}</span>
                            </button>
                          ))
                        ) : searchQuery ? (
                          <div className="px-4 py-3 text-[12.5px] text-text-muted">No results found</div>
                        ) : (
                          <div className="px-4 py-3 text-[12.5px] text-text-muted">Type to search transactions...</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <ThemeToggle />

        <div className="relative" ref={notifRef}>
          <button
            type="button"
            aria-label="Notifications"
            onClick={() => {
              setNotifOpen((v) => !v);
              setProfileOpen(false);
            }}
            className="relative h-9 w-9 flex items-center justify-center rounded-lg border border-line bg-surface text-text-secondary hover:text-text-primary hover:border-blue-500/30 transition-colors press-feedback"
          >
            <Bell className="h-[16px] w-[16px]" strokeWidth={1.9} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-green-500 border-2 border-surface" />
            )}
          </button>

          {notifOpen && (
            <div className="fixed inset-x-4 top-16 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-80 rounded-xl border border-line bg-surface shadow-[var(--shadow-pop)] z-50 animate-pop-in origin-top sm:origin-top-right">
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <p className="text-[13px] font-medium text-text-primary">Notifications</p>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="text-[11.5px] text-blue-600 hover:text-blue-700 font-medium"
                    onClick={markAllRead}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto scroll-thin">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 border-t border-line-soft transition-colors flex flex-col items-center justify-center text-center">
                    <p className="text-[12.5px] text-text-muted">No notifications</p>
                  </div>
                ) : (
                  <div className="flex flex-col border-t border-line-soft">
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => !n.read && markAsRead(n.id)}
                        className={`text-left px-4 py-3 border-b border-line-soft last:border-b-0 hover:bg-canvas transition-colors ${!n.read ? "bg-blue-50/30" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-[13px] ${!n.read ? "font-semibold text-text-primary" : "font-medium text-text-secondary"}`}>
                            {n.title}
                          </p>
                          {!n.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />}
                        </div>
                        <p className="mt-1 text-[12px] text-text-muted leading-relaxed line-clamp-2">
                          {n.title === "New Login" ? "A new login was detected on your account." : n.message}
                        </p>
                        <p className="mt-1.5 text-[10px] text-text-muted">
                          {formatDateTimeIST(n.createdAt)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => {
              setProfileOpen((v) => !v);
              setNotifOpen(false);
            }}
            className="flex items-center gap-2 h-9 pl-1.5 pr-2.5 rounded-lg border border-line bg-surface hover:border-blue-500/30 transition-colors press-feedback"
          >
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center text-[11px] font-medium text-white">
              {initials}
            </div>
            <span className="hidden sm:block text-[13px] font-medium text-text-primary truncate max-w-[120px]">
              {userName}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-52 py-1.5 rounded-xl border border-line bg-surface shadow-[var(--shadow-pop)] z-50 animate-pop-in origin-top-right">
              <div className="px-3.5 py-2 border-b border-line-soft mb-1">
                <p className="text-[13px] font-medium text-text-primary truncate">{userName}</p>
                <p className="text-[11.5px] text-text-muted truncate">{userEmail}</p>
              </div>
              <button
                type="button"
                className="w-full text-left px-3.5 py-2 text-[13px] text-text-secondary hover:bg-canvas hover:text-text-primary transition-colors"
                onClick={() => {
                  setProfileOpen(false);
                  router.push("/settings/security");
                }}
              >
                Account Security
              </button>
              <button
                type="button"
                className="w-full text-left px-3.5 py-2 text-[13px] text-text-secondary hover:bg-canvas hover:text-text-primary transition-colors"
                onClick={() => {
                  setProfileOpen(false);
                  router.push("/developers/api-keys");
                }}
              >
                API keys
              </button>
              <button
                type="button"
                className="w-full text-left px-3.5 py-2 text-[13px] text-coral-600 hover:bg-canvas transition-colors"
                onClick={() => {
                  setProfileOpen(false);
                  handleSignOut();
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
