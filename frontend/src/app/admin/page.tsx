"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Database,
  GraduationCap,
  HardDrive,
  Settings,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { formatShortDate } from "@/lib/utils";
import { adminApi, ApiError } from "@/services/api";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PortalShell } from "@/components/layout/PortalShell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminAnalytics, AuditLogItem, SystemHealth } from "@/types";

const AdminCharts = dynamic(
  () => import("@/components/charts/AdminCharts"),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    ),
  }
);

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function AdminPortalContent() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setError(null);
    try {
      const [h, a, logs] = await Promise.all([
        adminApi.systemHealth(),
        adminApi.analytics(),
        adminApi.auditLogs({ limit: 8 }),
      ]);
      setHealth(h);
      setAnalytics(a);
      setAuditLogs(logs);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to load school admin overview."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const totalCompletions = analytics
    ? analytics.total_lessons_completed +
      analytics.total_game_attempts +
      analytics.total_home_activities_completed
    : 0;

  return (
    <PortalShell
      title="School Admin Console"
      subtitle="Monitor cloud system health, platform engagement, curriculum resources, and security audit trails."
    >
      {error && (
        <Alert tone="warning" title="Admin Notice">
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          {/* System Health */}
          {health && (
            <Card className="bg-gradient-to-r from-[#DDF8EC]/60 via-white to-[#DCF2FD]/60">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-[#166041]" />
                    Cloud System Health
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="mint" className="uppercase">
                      {health.status}
                    </Badge>
                    <Badge variant="sky">
                      <Database className="h-3.5 w-3.5" />
                      DB: {health.database_status}
                    </Badge>
                    <Badge variant="neutral">
                      Storage: {health.storage_backend}
                    </Badge>
                    <Badge variant="lavender">Env: {health.environment}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-2 min-[480px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
                {Object.entries(health.counts).map(([key, count]) => (
                  <div
                    key={key}
                    className="rounded-2xl bg-white p-3 sm:p-3.5 border border-[#24334D]/8 text-center min-w-0"
                  >
                    <p className="font-display text-xl sm:text-2xl font-bold text-[#24334D]">
                      {count}
                    </p>
                    <p className="text-xs font-bold capitalize text-[#24334D]/60 truncate">
                      {key}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* KPI Summary Cards */}
          {analytics && (
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card>
                <CardContent className="p-5 flex items-start gap-3">
                  <Users className="h-8 w-8 text-[#175B82] shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-[#24334D]/60">
                      Active Accounts
                    </p>
                    <p className="font-display text-2xl font-bold">
                      {analytics.active_users}
                      <span className="text-xs font-semibold text-[#24334D]/55 ml-1">
                        ({analytics.inactive_users} inactive)
                      </span>
                    </p>
                    <p className="text-xs text-[#24334D]/70 mt-1">
                      {analytics.users_by_role.parent ?? 0} parents •{" "}
                      {analytics.users_by_role.teacher ?? 0} teachers •{" "}
                      {analytics.users_by_role.admin ?? 0} admins
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5 flex items-start gap-3">
                  <GraduationCap className="h-8 w-8 text-[#166041] shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-[#24334D]/60">
                      Active Learners (7d)
                    </p>
                    <p className="font-display text-2xl font-bold">
                      {analytics.active_learners_7d}{" "}
                      <span className="text-sm font-semibold text-[#24334D]/55">
                        / {analytics.total_children}
                      </span>
                    </p>
                    <p className="text-xs text-[#24334D]/70 mt-1">
                      Kindergarten children engaged this week
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5 flex items-start gap-3">
                  <Sparkles className="h-8 w-8 text-[#9A7100] shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-[#24334D]/60">
                      Learning Completions
                    </p>
                    <p className="font-display text-2xl font-bold">
                      {totalCompletions}
                    </p>
                    <p className="text-xs text-[#24334D]/70 mt-1">
                      {analytics.total_lessons_completed} lessons •{" "}
                      {analytics.total_game_attempts} games •{" "}
                      {analytics.total_home_activities_completed} home
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5 flex items-start gap-3">
                  <HardDrive className="h-8 w-8 text-[#4C328B] shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-[#24334D]/60">
                      Media Storage Footprint
                    </p>
                    <p className="font-display text-2xl font-bold">
                      {formatBytes(analytics.total_storage_bytes)}
                    </p>
                    <p className="text-xs text-[#24334D]/70 mt-1">
                      {analytics.total_storage_items} uploaded assets & artworks
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Quick Governance Links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                href: "/admin/users",
                title: "Users & Roles",
                desc: "Create parent, teacher, or admin accounts and assign roles.",
                icon: Users,
                tint: "bg-[#DCF2FD] text-[#175B82]",
              },
              {
                href: "/admin/classes",
                title: "Classes & Enrollment",
                desc: "Manage cohorts, assign lead teachers, and enroll learners.",
                icon: GraduationCap,
                tint: "bg-[#DDF8EC] text-[#166041]",
              },
              {
                href: "/admin/content",
                title: "Subjects & Storage",
                desc: "Organize modules, moderate lessons, and inspect cloud media.",
                icon: Database,
                tint: "bg-[#FFF5D1] text-[#9A7100]",
              },
              {
                href: "/admin/settings",
                title: "Settings & Audit",
                desc: "Configure platform safety policies and filter audit trails.",
                icon: Settings,
                tint: "bg-[#EBE5FC] text-[#4C328B]",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="group block">
                  <Card className="h-full transition-transform group-hover:-translate-y-0.5">
                    <CardContent className="p-5 flex flex-col justify-between h-full gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-2xl ${item.tint}`}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <ArrowRight className="h-4 w-4 text-[#24334D]/40 group-hover:text-[#24334D]" />
                      </div>
                      <div>
                        <p className="font-display font-bold text-[#24334D]">
                          {item.title}
                        </p>
                        <p className="text-xs text-[#24334D]/70 mt-1">
                          {item.desc}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* Analytics Charts */}
          {analytics && <AdminCharts analytics={analytics} />}

          {/* Recent Audit Logs Preview */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-[#4C328B] shrink-0" />
                  <span>Recent Security Audit Logs</span>
                </CardTitle>
                <CardDescription>
                  Immutable non-PII record of authentication and administrative changes.
                </CardDescription>
              </div>
              <Link
                href="/admin/settings"
                className="text-sm font-bold text-[#175B82] hover:underline self-start sm:self-auto shrink-0"
              >
                Full Audit Log →
              </Link>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {auditLogs.length === 0 ? (
                <p className="text-sm text-[#24334D]/65">
                  No audit events recorded yet.
                </p>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl bg-[#FFF9F0] px-4 py-3 text-xs border border-[#24334D]/8"
                  >
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <Badge variant="sky">{log.action}</Badge>
                      <span className="font-bold text-[#24334D] break-all">
                        {log.actor_email || "system"}
                      </span>
                      <span className="text-[#24334D]/65">
                        on {log.resource_type}
                      </span>
                    </div>
                    <span className="text-[#24334D]/60 shrink-0">
                      {formatShortDate(log.created_at)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </PortalShell>
  );
}

export default function AdminPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminPortalContent />
    </ProtectedRoute>
  );
}
