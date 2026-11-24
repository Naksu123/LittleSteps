"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, Printer, Sparkles, Star } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatAgeGroupLabel, formatShortDate } from "@/lib/utils";
import { ApiError, parentApi } from "@/services/api";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PortalShell } from "@/components/layout/PortalShell";
import { Alert } from "@/components/ui/alert";
import { ChildAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { WeeklyReport } from "@/types";

function WeeklyReportContent() {
  const { childrenList, activeChildId, setActiveChildId } = useAuth();
  const activeChild =
    childrenList.find((c) => c.id === activeChildId) || childrenList[0] || null;

  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async (cid?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await parentApi.report(cid);
      setReport(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not load weekly learning report."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReport(activeChild?.id);
  }, [activeChild?.id, loadReport]);

  function handleDownloadText() {
    if (!report) return;
    const lines = [
      `LittleSteps Weekly Learning Report — ${report.child.display_name}`,
      `Period: ${report.week_start} to ${report.week_end}`,
      "",
      report.encouraging_summary,
      "",
      `This Week: ${report.this_week_minutes} mins | ${report.this_week_lessons} lessons | ${report.games_played_this_week} games | ${report.home_activities_completed_this_week} home activities`,
      `Previous Week: ${report.previous_week_minutes} mins | ${report.previous_week_lessons} lessons`,
      "",
      "Strengths:",
      ...(report.strengths.length
        ? report.strengths.map((s) => `- ${s.skill_name} (${s.mastery_pct}%)`)
        : ["- Building new foundations"]),
      "",
      "Recommended Home Activities:",
      ...report.recommended_home_activities.map(
        (h) => `- Week ${h.week_number}: ${h.title} (${h.estimated_minutes} mins)`
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `littlesteps-report-${report.child.display_name.toLowerCase()}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PortalShell
      title="Weekly Learning Reports"
      subtitle="Warm, child-centered summaries highlighting personal growth and home guidance."
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          {childrenList.map((child) => {
            const selected = activeChild?.id === child.id;
            return (
              <button
                key={child.id}
                type="button"
                onClick={() => setActiveChildId(child.id)}
                className={`inline-flex items-center gap-2 rounded-2xl min-h-11 px-3.5 sm:px-4 py-1.5 text-sm font-bold cursor-pointer ${
                  selected
                    ? "bg-[#24334D] text-white"
                    : "bg-white text-[#24334D] border border-[#24334D]/12"
                }`}
              >
                <ChildAvatar
                  avatarKey={child.avatar_key}
                  colorHex={child.favorite_color}
                  size="sm"
                />
                {child.display_name}
              </button>
            );
          })}
        </div>

        {report && (
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleDownloadText}
              className="flex-1 sm:flex-initial"
            >
              <Download className="h-4 w-4" />
              Download Summary (.txt)
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => window.print()}
              className="flex-1 sm:flex-initial"
            >
              <Printer className="h-4 w-4" />
              Print / Save PDF
            </Button>
          </div>
        )}
      </div>

      {error && <Alert tone="warning">{error}</Alert>}

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : !report ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-[#24334D]/70">
            Add a learner profile first to generate weekly learning reports.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Header Banner */}
          <Card className="border-2 border-[#78C8F5]/40 print-break-inside-avoid">
            <CardContent className="p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <ChildAvatar
                    avatarKey={report.child.avatar_key}
                    colorHex={report.child.favorite_color}
                    size="lg"
                  />
                  <div>
                    <h2 className="font-display text-2xl font-bold">
                      {report.child.display_name}&apos;s Weekly Report
                    </h2>
                    <p className="text-xs font-bold text-[#24334D]/65">
                      {formatAgeGroupLabel(
                        report.child.age_group,
                        report.child.birth_year
                      )}{" "}
                      · {report.week_start} to {report.week_end}
                    </p>
                  </div>
                </div>
                <Badge variant="sunshine" className="text-sm px-3.5 py-1.5">
                  <Star className="h-4 w-4 fill-current" />
                  {report.child.total_stars} Total Stars
                </Badge>
              </div>

              <div className="rounded-2xl bg-[#FFF5CF]/65 p-4 text-sm font-semibold text-[#24334D]">
                <span className="inline-flex items-center gap-1.5 text-[#785700] font-bold mr-1">
                  <Sparkles className="h-4 w-4" /> Weekly Highlight:
                </span>
                {report.encouraging_summary}
              </div>
            </CardContent>
          </Card>

          {/* Personal Progress Comparison */}
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 print-break-inside-avoid">
            <Card>
              <CardContent className="p-4 sm:p-5">
                <p className="text-xs font-bold text-[#24334D]/60">
                  Learning Time (7 Days)
                </p>
                <p className="font-display text-2xl font-bold mt-1">
                  {report.this_week_minutes} min
                </p>
                <p className="text-xs text-[#24334D]/60 mt-1">
                  Previous week: {report.previous_week_minutes} min
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-bold text-[#24334D]/60">
                  Lessons Completed
                </p>
                <p className="font-display text-2xl font-bold mt-1">
                  {report.this_week_lessons}
                </p>
                <p className="text-xs text-[#24334D]/60 mt-1">
                  Previous week: {report.previous_week_lessons}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-bold text-[#24334D]/60">
                  Games Played
                </p>
                <p className="font-display text-2xl font-bold mt-1">
                  {report.games_played_this_week}
                </p>
                <p className="text-xs text-[#24334D]/60 mt-1">
                  Playful practice sessions
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-bold text-[#24334D]/60">
                  Home Activities
                </p>
                <p className="font-display text-2xl font-bold mt-1">
                  {report.home_activities_completed_this_week}
                </p>
                <p className="text-xs text-[#24334D]/60 mt-1">
                  Screen-free family play
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Strengths & Gentle Practice */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print-break-inside-avoid">
            <Card>
              <CardHeader>
                <CardTitle>Areas of Confidence</CardTitle>
                <CardDescription>
                  Skills {report.child.display_name} is shining in!
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.strengths.length > 0 ? (
                  report.strengths.map((s) => (
                    <div key={s.id} className="space-y-1">
                      <div className="flex justify-between text-sm font-bold">
                        <span>{s.skill_name}</span>
                        <span className="text-[#166041]">{s.mastery_pct}%</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-[#24334D]/8 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#9BE7C4]"
                          style={{ width: `${s.mastery_pct}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#24334D]/70">
                    Confidence highlights will grow with each new lesson!
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Gentle Practice Opportunities</CardTitle>
                <CardDescription>
                  Concepts to revisit slowly through playful games.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.areas_to_practice.length > 0 ? (
                  report.areas_to_practice.map((s) => (
                    <div key={s.id} className="space-y-1">
                      <div className="flex justify-between text-sm font-bold">
                        <span>{s.skill_name}</span>
                        <span className="text-[#175B82]">{s.mastery_pct}%</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-[#24334D]/8 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#78C8F5]"
                          style={{ width: `${s.mastery_pct}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#24334D]/70">
                    Everything practiced so far is above 75% mastery—keep exploring
                    new weekly themes!
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Teacher Observations & Feedback + Recommended Home Activities */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print-break-inside-avoid">
            <Card>
              <CardHeader>
                <CardTitle>Teacher Observations & Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.teacher_observations.map((obs) => (
                  <div
                    key={obs.id}
                    className="rounded-2xl bg-[#FFF9F0] p-4 border border-[#24334D]/8 text-sm space-y-1"
                  >
                    <div className="flex justify-between text-xs text-[#24334D]/60">
                      <span className="font-bold text-[#24334D]">
                        {obs.teacher_name}
                      </span>
                      <span>{formatShortDate(obs.observed_at)}</span>
                    </div>
                    <p>{obs.observation_text}</p>
                  </div>
                ))}
                {report.teacher_feedback.map((fb) => (
                  <div
                    key={fb.id}
                    className="rounded-2xl bg-[#DDF8EC]/45 p-4 border border-[#9BE7C4] text-sm space-y-1"
                  >
                    <div className="flex justify-between text-xs text-[#166041]">
                      <span className="font-bold">{fb.teacher_name}</span>
                      <span>{formatShortDate(fb.created_at)}</span>
                    </div>
                    <p>{fb.message}</p>
                  </div>
                ))}
                {report.teacher_observations.length === 0 &&
                  report.teacher_feedback.length === 0 && (
                    <p className="text-sm text-[#24334D]/65">
                      No teacher notes recorded yet for this learner.
                    </p>
                  )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recommended Home Activities</CardTitle>
                <CardDescription>
                  Easy screen-free ideas for your next cozy family session.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.recommended_home_activities.map((rec) => (
                  <div
                    key={rec.home_activity_id}
                    className="rounded-2xl bg-[#FFE3DE]/35 p-4 border border-[#FF9C8C]/40 text-sm space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="coral">Week {rec.week_number}</Badge>
                      <span className="text-xs font-bold text-[#24334D]/65">
                        {rec.estimated_minutes} mins
                      </span>
                    </div>
                    <p className="font-display font-bold pt-1">{rec.title}</p>
                    <p className="text-xs text-[#24334D]/75">
                      Needs: {rec.materials.join(", ")}
                    </p>
                  </div>
                ))}
                <Link
                  href="/parent/home-learning"
                  className="inline-block print:hidden"
                >
                  <Button variant="secondary" size="sm">
                    Open Home Learning Hub
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Activity History */}
          <Card className="print-break-inside-avoid">
            <CardHeader>
              <CardTitle>Recent Activity History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {report.activity_history.length > 0 ? (
                report.activity_history.map((act, idx) => (
                  <div
                    key={`${act.title}-${idx}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#FFF9F0] px-4 py-3 text-sm border border-[#24334D]/8"
                  >
                    <div className="flex items-center gap-2.5">
                      <Badge variant="sky" className="capitalize">
                        {act.activity_type.replace("_", " ")}
                      </Badge>
                      <span className="font-bold">{act.title}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#24334D]/70">
                      <span>⭐ {act.stars_earned}</span>
                      <span>{act.minutes} min</span>
                      <span>{formatShortDate(act.occurred_at)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#24334D]/65">
                  Completed lessons, games, and home activities will appear here.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PortalShell>
  );
}

export default function ReportsPage() {
  return (
    <ProtectedRoute allowedRoles={["parent", "admin"]}>
      <WeeklyReportContent />
    </ProtectedRoute>
  );
}
