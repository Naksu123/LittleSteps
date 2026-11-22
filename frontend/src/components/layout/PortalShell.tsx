"use client";

import { useState } from "react";
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
  Settings,
  Shield,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PortalShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function PortalShell({ title, subtitle, children }: PortalShellProps) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const roles = user?.roles || [];
  const adminNav = [
    { href: "/admin", label: "Overview & Health", icon: Shield },
    { href: "/admin/users", label: "Users & Roles", icon: Users },
    {
      href: "/admin/classes",
      label: "Classes & Enrollment",
      icon: GraduationCap,
    },
    { href: "/admin/content", label: "Subjects & Storage", icon: Database },
    { href: "/admin/settings", label: "Settings & Audit", icon: Settings },
  ];

  const teacherNav = [
    { href: "/teacher", label: "Class Overview", icon: Users },
    { href: "/teacher/lessons", label: "Lessons & Content", icon: BookOpen },
    {
      href: "/teacher/assignments",
      label: "Assignments & Notes",
      icon: ClipboardList,
    },
    {
      href: "/teacher/analytics",
      label: "Class Analytics",
      icon: BarChart3,
    },
    { href: "/kids", label: "Kids Preview", icon: Sparkles },
  ];

  const parentNav = [
    { href: "/parent", label: "Overview", icon: LayoutDashboard },
    {
      href: "/parent/home-learning",
      label: "Home Learning Hub",
      icon: Home,
    },
    {
      href: "/parent/reports",
      label: "Weekly Reports",
      icon: FileText,
    },
    {
      href: "/parent/settings",
      label: "Goals & Settings",
      icon: Settings,
    },
    { href: "/kids", label: "Kids Mode", icon: Baby },
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

  async function handleLogout() {
    const isStaff = roles.includes("admin") || roles.includes("teacher");
    await logout();
    router.push(isStaff ? "/" : "/login");
  }

  return (
    <div className="min-h-screen bg-[#FFF9F0] flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-[#24334D]/8 bg-white p-5 justify-between print:hidden">
        <div className="space-y-6">
          <Link href="/" className="flex items-center px-1">
            <BrandLogo size="sm" />
          </Link>

          <nav className="space-y-1.5" aria-label="Portal Navigation">
            {uniqueNav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-colors",
                    active
                      ? "bg-[#DCF2FD] text-[#175B82]"
                      : "text-[#24334D]/75 hover:bg-[#FFF9F0]"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {switchPortalLinks.length > 0 && (
            <div className="border-t border-[#24334D]/8 pt-4 space-y-1.5">
              <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#24334D]/45">
                Switch Portal
              </p>
              {switchPortalLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-2xl px-4 py-2 text-xs font-bold text-[#24334D]/70 hover:bg-[#FFF9F0]"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-[#24334D]/8 pt-4">
          <div className="rounded-2xl bg-[#FFF9F0] p-3">
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
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden flex items-center justify-between bg-white border-b border-[#24334D]/8 px-4 py-2.5 print:hidden">
        <Link href="/" className="flex items-center">
          <BrandLogo size="xs" />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation menu"
          className="rounded-xl p-2 hover:bg-[#24334D]/5 cursor-pointer"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {mobileOpen && (
        <div className="lg:hidden bg-white border-b border-[#24334D]/8 px-4 py-3 space-y-2 print:hidden">
          {uniqueNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold hover:bg-[#FFF9F0]"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          {switchPortalLinks.length > 0 && (
            <div className="border-t border-[#24334D]/8 pt-2 space-y-1">
              <p className="px-3 text-[11px] font-bold uppercase text-[#24334D]/45">
                Switch Portal
              </p>
              {switchPortalLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold text-[#24334D]/75 hover:bg-[#FFF9F0]"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-5 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#24334D]">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-[#24334D]/70 mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-[#24334D]/60">
            <Users className="h-4 w-4 text-[#78C8F5]" />
            Child-Safe Environment
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
