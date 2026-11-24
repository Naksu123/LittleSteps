"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Baby,
  BarChart3,
  BookOpen,
  ClipboardList,
  Database,
  FileText,
  GraduationCap,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { prefetchPortalData } from "@/services/api";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const SIDEBAR_MODE_KEY = "littlesteps_sidebar_mode";

interface PortalShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function PortalShell({ title, subtitle, children }: PortalShellProps) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { user, activeChildId, logout } = useAuth();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<
    "auto" | "expanded" | "collapsed"
  >("auto");
  const [isDesktopViewport, setIsDesktopViewport] = useState(true);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setMobileDrawerOpen(false);
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    if (!pendingHref) return;
    const timer = window.setTimeout(() => setPendingHref(null), 6000);
    return () => window.clearTimeout(timer);
  }, [pendingHref]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.sessionStorage.getItem(SIDEBAR_MODE_KEY);
      if (saved === "expanded" || saved === "collapsed") {
        setSidebarMode(saved);
      }
    } catch {
      // Ignore storage errors
    }
    if (typeof window.matchMedia === "function") {
      const mql = window.matchMedia("(min-width: 1024px)");
      const syncMatch = (matches: boolean) => setIsDesktopViewport(matches);
      syncMatch(mql.matches);
      const onChange = (e: MediaQueryListEvent) => syncMatch(e.matches);
      if (typeof mql.addEventListener === "function") {
        mql.addEventListener("change", onChange);
        return () => mql.removeEventListener("change", onChange);
      }
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    }

    const syncViewport = () => setIsDesktopViewport(window.innerWidth >= 1024);
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    if (!mobileDrawerOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileDrawerOpen(false);
      }
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileDrawerOpen]);

  const roles = user?.roles || [];
  const adminNav = [
    { href: "/admin", label: "Overview & Health", shortLabel: "Overview", icon: Shield },
    { href: "/admin/users", label: "Users & Roles", shortLabel: "Users", icon: Users },
    {
      href: "/admin/classes",
      label: "Classes & Enrollment",
      shortLabel: "Classes",
      icon: GraduationCap,
    },
    {
      href: "/admin/content",
      label: "Subjects & Storage",
      shortLabel: "Content",
      icon: Database,
    },
    {
      href: "/admin/settings",
      label: "Settings & Audit",
      shortLabel: "Settings",
      icon: Settings,
    },
  ];

  const teacherNav = [
    { href: "/teacher", label: "Class Overview", shortLabel: "Classes", icon: Users },
    {
      href: "/teacher/lessons",
      label: "Lessons & Content",
      shortLabel: "Lessons",
      icon: BookOpen,
    },
    {
      href: "/teacher/assignments",
      label: "Assignments & Notes",
      shortLabel: "Tasks",
      icon: ClipboardList,
    },
    {
      href: "/teacher/analytics",
      label: "Class Analytics",
      shortLabel: "Analytics",
      icon: BarChart3,
    },
    { href: "/kids", label: "Kids Preview", shortLabel: "Kids", icon: Sparkles },
  ];

  const parentNav = [
    {
      href: "/parent",
      label: "Overview",
      shortLabel: "Overview",
      icon: LayoutDashboard,
    },
    {
      href: "/parent/home-learning",
      label: "Home Learning Hub",
      shortLabel: "Home Hub",
      icon: Home,
    },
    {
      href: "/parent/reports",
      label: "Weekly Reports",
      shortLabel: "Reports",
      icon: FileText,
    },
    {
      href: "/parent/settings",
      label: "Goals & Settings",
      shortLabel: "Settings",
      icon: Settings,
    },
    { href: "/kids", label: "Kids Mode", shortLabel: "Kids Mode", icon: Baby },
  ];

  const activePortal: "admin" | "teacher" | "parent" =
    pathname.startsWith("/admin") && roles.includes("admin")
      ? "admin"
      : pathname.startsWith("/teacher") &&
          (roles.includes("teacher") || roles.includes("admin"))
        ? "teacher"
        : !roles.includes("parent") && roles.includes("teacher")
          ? "teacher"
          : !roles.includes("parent") && roles.includes("admin")
            ? "admin"
            : "parent";

  const uniqueNav =
    activePortal === "admin"
      ? adminNav
      : activePortal === "teacher"
        ? teacherNav
        : parentNav;

  const switchPortalLinks = [
    ...(roles.includes("admin") && activePortal !== "admin"
      ? [{ href: "/admin", label: "Admin Console", icon: Shield }]
      : []),
    ...((roles.includes("teacher") || roles.includes("admin")) &&
    activePortal !== "teacher"
      ? [{ href: "/teacher", label: "Teacher Portal", icon: Users }]
      : []),
    ...((roles.includes("parent") || roles.includes("admin")) &&
    activePortal !== "parent"
      ? [{ href: "/parent", label: "Parent Portal", icon: LayoutDashboard }]
      : []),
    ...(!uniqueNav.some((item) => item.href === "/kids")
      ? [{ href: "/kids", label: "Kids Mode", icon: Baby }]
      : []),
  ];

  const isSidebarExpanded =
    sidebarMode === "expanded" ||
    (sidebarMode === "auto" && isDesktopViewport);

  function handleToggleSidebarWidth() {
    setSidebarMode((prev) => {
      const currentlyExpanded =
        prev === "expanded" || (prev === "auto" && isDesktopViewport);
      const next = currentlyExpanded ? "collapsed" : "expanded";
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem(SIDEBAR_MODE_KEY, next);
        } catch {
          // Ignore storage errors
        }
      }
      return next;
    });
  }

  function handleNavIntent(href: string) {
    router.prefetch?.(href);
    prefetchPortalData?.(href, activeChildId ?? null);
  }

  function handleNavClick(href: string) {
    setMobileDrawerOpen(false);
    if (href !== pathname) {
      setPendingHref(href);
    }
  }

  async function handleLogout() {
    setMobileDrawerOpen(false);
    const isStaff = roles.includes("admin") || roles.includes("teacher");
    await logout();
    router.push(isStaff ? "/" : "/login");
  }

  const asideWidthClass =
    sidebarMode === "collapsed"
      ? "md:w-20 px-2.5 py-4"
      : sidebarMode === "expanded"
        ? "md:w-64 p-5"
        : "md:w-20 lg:w-64 md:px-2.5 md:py-4 lg:p-5";

  const labelVisClass =
    sidebarMode === "collapsed"
      ? "sr-only"
      : sidebarMode === "expanded"
        ? "inline truncate"
        : "sr-only lg:not-sr-only lg:inline lg:truncate";

  const itemAlignClass =
    sidebarMode === "collapsed"
      ? "justify-center px-2"
      : sidebarMode === "expanded"
        ? "justify-start px-4"
        : "justify-center lg:justify-start px-2 lg:px-4";

  const compactFlexClass =
    sidebarMode === "collapsed"
      ? "flex"
      : sidebarMode === "expanded"
        ? "hidden"
        : "flex lg:hidden";

  const expandedOnlyClass =
    sidebarMode === "collapsed"
      ? "hidden"
      : sidebarMode === "expanded"
        ? "block"
        : "hidden lg:block";

  const initialChar =
    (user?.full_name?.trim()[0] || user?.email?.trim()[0] || "U").toUpperCase();

  return (
    <div className="min-h-dvh bg-[#FFF9F0] flex flex-col md:flex-row">
      {pendingHref && (
        <div
          aria-hidden="true"
          className="fixed inset-x-0 top-0 z-50 h-1 bg-gradient-to-r from-[#78C8F5] via-[#9BE7C4] to-[#FFE58A] animate-pulse print:hidden"
        />
      )}

      {/* Tablet & Desktop Adaptive Sidebar */}
      <aside
        aria-label="Portal Sidebar"
        className={cn(
          "hidden md:flex md:flex-col md:sticky md:top-0 md:h-dvh md:shrink-0 md:overflow-y-auto md:overflow-x-hidden md:border-r md:border-[#24334D]/8 bg-white justify-between transition-[width] duration-200 print:hidden",
          asideWidthClass
        )}
      >
        <div className="space-y-5">
          <div
            className={cn(
              "flex items-center gap-2",
              sidebarMode === "collapsed"
                ? "flex-col"
                : sidebarMode === "expanded"
                  ? "justify-between"
                  : "flex-col lg:flex-row lg:justify-between"
            )}
          >
            <Link href="/" className="flex items-center px-0.5 min-w-0">
              <BrandLogo
                size="xs"
                className={cn(
                  sidebarMode === "collapsed"
                    ? "max-w-[56px] px-1 py-1"
                    : sidebarMode === "expanded"
                      ? "max-w-[152px]"
                      : "max-w-[56px] px-1 py-1 lg:max-w-[152px] lg:px-2"
                )}
              />
            </Link>
            <button
              type="button"
              onClick={handleToggleSidebarWidth}
              aria-label="Toggle sidebar width"
              aria-expanded={isSidebarExpanded}
              title={isSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#24334D]/65 hover:bg-[#FFF9F0] hover:text-[#24334D] transition-colors cursor-pointer"
            >
              {sidebarMode === "collapsed" ? (
                <PanelLeftOpen className="h-5 w-5" />
              ) : sidebarMode === "expanded" ? (
                <PanelLeftClose className="h-5 w-5" />
              ) : (
                <>
                  <PanelLeftOpen className="h-5 w-5 lg:hidden" />
                  <PanelLeftClose className="h-5 w-5 hidden lg:block" />
                </>
              )}
            </button>
          </div>

          <nav className="space-y-1.5" aria-label="Portal Navigation">
            {uniqueNav.map((item) => {
              const Icon = item.icon;
              const active = pendingHref
                ? pendingHref === item.href
                : pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  onMouseEnter={() => handleNavIntent(item.href)}
                  onFocus={() => handleNavIntent(item.href)}
                  onClick={() => handleNavClick(item.href)}
                  className={cn(
                    "group flex items-center gap-3 rounded-2xl min-h-11 py-2.5 text-sm font-bold transition-colors",
                    itemAlignClass,
                    active
                      ? "bg-[#DCF2FD] text-[#175B82]"
                      : "text-[#24334D]/75 hover:bg-[#FFF9F0]"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className={labelVisClass}>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {switchPortalLinks.length > 0 && (
            <div className="border-t border-[#24334D]/8 pt-4 space-y-1.5">
              <p
                className={cn(
                  "px-3 text-[11px] font-bold uppercase tracking-wider text-[#24334D]/45",
                  expandedOnlyClass
                )}
              >
                Switch Portal
              </p>
              {switchPortalLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    onMouseEnter={() => handleNavIntent(item.href)}
                    onFocus={() => handleNavIntent(item.href)}
                    onClick={() => handleNavClick(item.href)}
                    className={cn(
                      "group flex items-center gap-3 rounded-2xl min-h-10 py-2 text-xs font-bold text-[#24334D]/70 hover:bg-[#FFF9F0]",
                      itemAlignClass
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className={labelVisClass}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-[#24334D]/8 pt-4">
          <div className={cn("rounded-2xl bg-[#FFF9F0] p-3", expandedOnlyClass)}>
            <p className="text-sm font-bold text-[#24334D] truncate">
              {user?.full_name}
            </p>
            <p className="text-xs text-[#24334D]/60 truncate">{user?.email}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {roles.map((r) => (
                <Badge key={r} variant="lavender" className="capitalize">
                  {r}
                </Badge>
              ))}
            </div>
          </div>

          <div
            data-testid="sidebar-compact-avatar"
            className={cn(
              "mx-auto h-10 w-10 items-center justify-center rounded-full bg-[#EDE7FE] font-display text-sm font-bold text-[#4C328B]",
              compactFlexClass
            )}
            title={`${user?.full_name || "Account"} (${user?.email || ""})`}
          >
            {initialChar}
          </div>

          <Button
            variant="outline"
            size="sm"
            className={cn("w-full", itemAlignClass)}
            onClick={handleLogout}
            title="Sign Out"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={labelVisClass}>Sign Out</span>
          </Button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-2 bg-white border-b border-[#24334D]/10 px-3.5 py-2.5 print:hidden">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/" className="flex items-center shrink-0">
            <BrandLogo size="xs" />
          </Link>
          <Badge
            variant="lavender"
            className="hidden min-[380px]:inline-flex capitalize text-[11px]"
          >
            {activePortal}
          </Badge>
        </div>
        <button
          type="button"
          onClick={() => setMobileDrawerOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileDrawerOpen}
          aria-controls="portal-mobile-drawer"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#24334D]/12 bg-[#FFF9F0] text-[#24334D] hover:bg-[#DCF2FD]/50 cursor-pointer"
        >
          {mobileDrawerOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </header>

      {/* Mobile Slide-Over Drawer */}
      {mobileDrawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex bg-[#24334D]/55 animate-fade-in print:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileDrawerOpen(false);
          }}
        >
          <div
            id="portal-mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Portal Navigation Drawer"
            className="w-[min(86vw,20rem)] h-dvh bg-white shadow-2xl flex flex-col justify-between gap-4 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain animate-slide-in-left"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#24334D]/8">
                <Link
                  href="/"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex items-center"
                >
                  <BrandLogo size="xs" />
                </Link>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  aria-label="Close navigation menu"
                  className="flex h-11 w-11 items-center justify-center rounded-full text-[#24334D]/70 hover:bg-[#24334D]/8 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="rounded-2xl bg-[#FFF9F0] p-3">
                <p className="text-sm font-bold text-[#24334D] truncate">
                  {user?.full_name}
                </p>
                <p className="text-xs text-[#24334D]/65 truncate">
                  {user?.email}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {roles.map((r) => (
                    <Badge key={r} variant="lavender" className="capitalize">
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>

              <nav className="space-y-1" aria-label="Drawer Navigation">
                {uniqueNav.map((item) => {
                  const Icon = item.icon;
                  const active = pendingHref
                    ? pendingHref === item.href
                    : pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onTouchStart={() => handleNavIntent(item.href)}
                      onMouseEnter={() => handleNavIntent(item.href)}
                      onClick={() => handleNavClick(item.href)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl min-h-11 px-3.5 py-2.5 text-sm font-bold transition-colors",
                        active
                          ? "bg-[#DCF2FD] text-[#175B82]"
                          : "text-[#24334D]/80 hover:bg-[#FFF9F0]"
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              {switchPortalLinks.length > 0 && (
                <div className="border-t border-[#24334D]/8 pt-3 space-y-1">
                  <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#24334D]/45">
                    Switch Portal
                  </p>
                  {switchPortalLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onTouchStart={() => handleNavIntent(item.href)}
                        onMouseEnter={() => handleNavIntent(item.href)}
                        onClick={() => handleNavClick(item.href)}
                        className="flex items-center gap-3 rounded-2xl min-h-11 px-3.5 py-2 text-xs font-bold text-[#24334D]/75 hover:bg-[#FFF9F0]"
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#24334D]/8">
              <Button
                variant="outline"
                size="md"
                className="w-full justify-start"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Quick-Navigation Bar */}
      <nav
        aria-label="Mobile quick navigation"
        className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-white border-t border-[#24334D]/10 px-1 pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(36,51,77,0.06)] print:hidden"
      >
        <div className="grid grid-cols-5 gap-1">
          {uniqueNav.map((item) => {
            const Icon = item.icon;
            const active = pendingHref
              ? pendingHref === item.href
              : pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                onTouchStart={() => handleNavIntent(item.href)}
                onMouseEnter={() => handleNavIntent(item.href)}
                onClick={() => handleNavClick(item.href)}
                className={cn(
                  "min-w-0 flex flex-col items-center justify-center gap-0.5 min-h-[48px] rounded-2xl px-1 py-1 text-[10px] min-[375px]:text-[11px] font-bold transition-colors",
                  active
                    ? "bg-[#DCF2FD] text-[#175B82]"
                    : "text-[#24334D]/70 hover:bg-[#FFF9F0]"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate max-w-full">{item.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <div className="mx-auto w-full max-w-[1440px] 2xl:max-w-[1600px] px-3.5 sm:px-6 lg:px-8 xl:px-10 pt-4 sm:pt-6 lg:pt-8 safe-pb-nav md:pb-10 space-y-5 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-4">
            <div className="min-w-0">
              <h1 className="font-display text-fluid-h1 font-bold text-[#24334D] break-words">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs sm:text-sm text-[#24334D]/70 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-[#24334D]/60 shrink-0">
              <Users className="h-4 w-4 text-[#78C8F5]" />
              Child-Safe Environment
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
