"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CheckCircle2, GraduationCap, HeartHandshake, Sparkles, Users } from "lucide-react";
import { ApiError, teacherApi } from "@/services/api";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PortalShell } from "@/components/layout/PortalShell";
import { Alert } from "@/components/ui/alert";
import { ChildAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TeacherAnalytics, TeacherClass } from "@/types";

function TeacherAnalyticsContent() {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [classId, setClassId] = useState("");
  const [analytics, setAnalytics] = useState<TeacherAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async (cid?: string) => {
    setLoading(true);
    setError(null);
    try {
      const [cls, data] = await Promise.all([
        teacherApi.classes(),
        teacherApi.analytics(cid || undefined),
      ]);
      setClasses(cls);
      setAnalytics(data);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not load class analytics."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  function handleFilterChange(nextClassId: string) {
    setClassId(nextClassId);
    void loadAnalytics(nextClassId);
  }

  return (
    <PortalShell
      title="Classroom Analytics & Support"
      subtitle="Meaningful weekly participation trends and gentle guidance cues across your classes."
    >
      {error && <Alert tone="warning">{error}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="text-sm font-bold flex items-center gap-2">
          <span>Filter Class:</span>
          <select
            value={classId}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="h-10 rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-sm font-semibold"
          >
            <option value="">All Assigned Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : !analytics ? null : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <GraduationCap className="h-8 w-8 text-[#175B82]" />
                <div>
                  <p className="text-xs font-bold text-[#24334D]/60">Classes</p>
                  <p className="font-display text-2xl font-bold">
                    {analytics.total_classes}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <Users className="h-8 w-8 text-[#166041]" />
                <div>
                  <p className="text-xs font-bold text-[#24334D]/60">Learners</p>
                  <p className="font-display text-2xl font-bold">
                    {analytics.total_students}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <Sparkles className="h-8 w-8 text-[#9A7100]" />
                <div>
                  <p className="text-xs font-bold text-[#24334D]/60">
                    Active This Week
                  </p>
                  <p className="font-display text-2xl font-bold">
                    {analytics.active_learners_this_week}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-[#4C328B]" />
                <div>
                  <p className="text-xs font-bold text-[#24334D]/60">
                    Completion Rate
                  </p>
                  <p className="font-display text-2xl font-bold">
                    {analytics.completion_rate_pct}%
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Classroom Activity (7 Days)</CardTitle>
                <CardDescription>
                  Completed lessons and educational games across students.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.weekly_completions}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#24334D14" />
                    <XAxis dataKey="day" tick={{ fill: "#24334D", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#24334D", fontSize: 12 }} />
                    <Tooltip />
                    <Bar
                      dataKey="lessons"
                      name="Lessons"
                      fill="#9BE7C4"
                      radius={[8, 8, 0, 0]}
                    />
                    <Bar
                      dataKey="games"
                      name="Games"
                      fill="#78C8F5"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Subject Skill Mastery Overview</CardTitle>
                <CardDescription>
                  Average mastery percentage by kindergarten domain.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.subject_averages}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#24334D14" />
                    <XAxis
                      dataKey="subject_name"
                      tick={{ fill: "#24334D", fontSize: 10 }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: "#24334D", fontSize: 12 }}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="avg_mastery_pct"
                      name="Avg Mastery %"
                      fill="#B8A5F5"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HeartHandshake className="h-5 w-5 text-[#8E3022]" />
                  Learners Ready for Gentle Guidance
                </CardTitle>
                <CardDescription>
                  Supportive check-in cues without punitive labels.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {analytics.students_needing_guidance.length > 0 ? (
                  analytics.students_needing_guidance.map((stu) => (
                    <div
                      key={stu.child_id}
                      className="rounded-2xl bg-[#FFF9F0] p-4 border border-[#24334D]/8 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <ChildAvatar avatarKey={stu.avatar_key} size="sm" />
                        <div>
                          <p className="font-bold text-sm">
                            {stu.display_name}{" "}
                            <span className="text-xs font-normal text-[#24334D]/65">
                              ({stu.class_name})
                            </span>
                          </p>
                          <p className="text-xs text-[#24334D]/80">{stu.reason}</p>
                        </div>
                      </div>
                      <Badge variant="sunshine">
                        {stu.lessons_completed} lessons
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#166041] font-semibold">
                    Every enrolled learner is actively progressing above 75%!
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Class Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analytics.class_summaries.map((cs) => (
                  <div
                    key={cs.class_id}
                    className="rounded-2xl bg-[#FFF9F0] p-4 border border-[#24334D]/8 space-y-1"
                  >
                    <p className="font-display font-bold">{cs.class_name}</p>
                    <p className="text-xs text-[#24334D]/75">
                      {cs.student_count} students · {cs.active_learners} active
                      this week · Avg ⭐ {cs.avg_stars} ·{" "}
                      {cs.total_lessons_completed} lessons done
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </PortalShell>
  );
}

export default function TeacherAnalyticsPage() {
  return (
    <ProtectedRoute allowedRoles={["teacher", "admin"]}>
      <TeacherAnalyticsContent />
    </ProtectedRoute>
  );
}
