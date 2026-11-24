"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  ClipboardList,
  Eye,
  GraduationCap,
  MessageCircleHeart,
  Search,
  Users,
} from "lucide-react";
import { formatAgeGroupLabel, formatShortDate } from "@/lib/utils";
import { ApiError, contentApi, teacherApi } from "@/services/api";
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
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  ParentReflection,
  TeacherClass,
  TeacherStudent,
  TeacherStudentDetail,
  Theme,
} from "@/types";

function TeacherPortalContent() {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [reflections, setReflections] = useState<ParentReflection[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [studentDetail, setStudentDetail] =
    useState<TeacherStudentDetail | null>(null);

  const loadStudents = useCallback(async (clsId: string | null) => {
    try {
      const stu = await teacherApi.students(clsId || undefined);
      setStudents(stu);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not load enrolled students."
      );
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [cls, stu, thm, refl] = await Promise.all([
          teacherApi.classes(),
          teacherApi.students(),
          contentApi.themes(),
          teacherApi.reflections(),
        ]);
        if (!mounted) return;
        setClasses(cls);
        setStudents(stu);
        setThemes(thm);
        setReflections(refl);
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Could not load teacher classroom data."
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSelectClass(clsId: string | null) {
    setSelectedClassId(clsId);
    await loadStudents(clsId);
  }

  async function openStudentDetail(childId: string) {
    setDetailOpen(true);
    setDetailLoading(true);
    setStudentDetail(null);
    try {
      const detail = await teacherApi.studentProgress(childId);
      setStudentDetail(detail);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not load learner progress."
      );
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  const filteredStudents = students.filter(
    (s) =>
      s.display_name.toLowerCase().includes(search.toLowerCase()) ||
      s.class_name.toLowerCase().includes(search.toLowerCase())
  );

  const studentNameMap = new Map(students.map((s) => [s.id, s.display_name]));

  return (
    <PortalShell
      title="Teacher Classroom Portal"
      subtitle="Manage classes, create lessons & assignments, record observations, and track class growth."
    >
      {error && (
        <Alert tone="warning" title="Error">
          {error}
        </Alert>
      )}

      {/* Quick Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Link href="/teacher/lessons" className="min-w-0">
          <Card className="h-full hover:border-[#9BE7C4] transition-colors cursor-pointer bg-[#DDF8EC]/35">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <BookOpen className="h-5 w-5 text-[#166041] shrink-0" />
                <div className="min-w-0">
                  <p className="font-display font-bold text-sm truncate">
                    Lessons & Themes Studio
                  </p>
                  <p className="text-xs text-[#24334D]/65 truncate">
                    Create, publish & upload media
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-[#24334D]/60 shrink-0" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/teacher/assignments" className="min-w-0">
          <Card className="h-full hover:border-[#FFE58A] transition-colors cursor-pointer bg-[#FFF5CF]/45">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <ClipboardList className="h-5 w-5 text-[#9A7100] shrink-0" />
                <div className="min-w-0">
                  <p className="font-display font-bold text-sm truncate">
                    Assignments & Notes
                  </p>
                  <p className="text-xs text-[#24334D]/65 truncate">
                    Observations, feedback & notices
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-[#24334D]/60 shrink-0" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/teacher/analytics" className="min-w-0 sm:col-span-2 lg:col-span-1">
          <Card className="h-full hover:border-[#78C8F5] transition-colors cursor-pointer bg-[#DCF2FD]/45">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <BarChart3 className="h-5 w-5 text-[#175B82] shrink-0" />
                <div className="min-w-0">
                  <p className="font-display font-bold text-sm truncate">
                    Class Analytics
                  </p>
                  <p className="text-xs text-[#24334D]/65 truncate">
                    Completion charts & guidance
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-[#24334D]/60 shrink-0" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4 sm:p-5 flex items-center gap-3">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-[#DCF2FD] flex items-center justify-center shrink-0">
              <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 text-[#175B82]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#24334D]/60">Assigned Classes</p>
              <p className="font-display text-xl sm:text-2xl font-bold">{classes.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5 flex items-center gap-3">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-[#DDF8EC] flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-[#166041]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#24334D]/60">Enrolled Students</p>
              <p className="font-display text-xl sm:text-2xl font-bold">{students.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="min-[420px]:col-span-2 sm:col-span-1">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-[#FFF5CF] flex items-center justify-center shrink-0">
              <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-[#9A7100]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#24334D]/60">Published Themes</p>
              <p className="font-display text-xl sm:text-2xl font-bold">{themes.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          {/* Interactive Class Filters */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">
                Your Assigned Classes
              </h2>
              {selectedClassId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSelectClass(null)}
                >
                  Show All Classes
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {classes.map((cls) => {
                const active = selectedClassId === cls.id;
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() =>
                      handleSelectClass(active ? null : cls.id)
                    }
                    className="text-left cursor-pointer"
                  >
                    <Card
                      className={
                        active
                          ? "border-2 border-[#24334D] ring-2 ring-[#78C8F5]/50"
                          : "hover:border-[#78C8F5]"
                      }
                    >
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <Badge variant="sky">
                            {formatAgeGroupLabel(cls.age_group)}
                          </Badge>
                          <span className="text-xs font-bold text-[#24334D]/60">
                            {cls.academic_year}
                          </span>
                        </div>
                        <CardTitle className="pt-1">{cls.name}</CardTitle>
                        <CardDescription>
                          {cls.room_label || "Kindergarten Classroom"} ·{" "}
                          {cls.student_count} learners enrolled
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Enrolled Students */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle>Enrolled Students</CardTitle>
                <CardDescription>
                  Click Inspect Progress to view skills, badges, and family
                  reflections.
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="h-4 w-4 absolute left-3.5 top-3.5 text-[#24334D]/50" />
                <Input
                  placeholder="Search learner or class..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {filteredStudents.length === 0 ? (
                <p className="text-sm text-[#24334D]/65 py-6 text-center">
                  No enrolled learners matched your search.
                </p>
              ) : (
                <>
                  {/* Mobile Stacked Cards */}
                  <div className="md:hidden space-y-3">
                    {filteredStudents.map((stu) => (
                      <div
                        key={stu.id}
                        className="rounded-2xl bg-[#FFF9F0] p-4 border border-[#24334D]/10 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <ChildAvatar
                              avatarKey={stu.avatar_key}
                              size="sm"
                              className="shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-sm truncate">
                                {stu.display_name}
                              </p>
                              <p className="text-xs text-[#24334D]/65 truncate">
                                {stu.class_name}
                              </p>
                            </div>
                          </div>
                          <Badge variant="neutral" className="shrink-0">
                            {formatAgeGroupLabel(stu.age_group)}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-3 gap-2 rounded-xl bg-white p-2.5 text-center border border-[#24334D]/8 text-xs">
                          <div>
                            <p className="text-[11px] text-[#24334D]/60">Stars</p>
                            <p className="font-bold">⭐ {stu.total_stars}</p>
                          </div>
                          <div>
                            <p className="text-[11px] text-[#24334D]/60">Lessons</p>
                            <p className="font-bold">{stu.lessons_completed}</p>
                          </div>
                          <div>
                            <p className="text-[11px] text-[#24334D]/60">Streak</p>
                            <p className="font-bold">{stu.streak_days}d</p>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openStudentDetail(stu.id)}
                          className="w-full"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Inspect Progress
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Tablet / Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm text-left">
                      <thead>
                        <tr className="border-b border-[#24334D]/10 text-xs uppercase text-[#24334D]/60">
                          <th className="py-3 pr-4">Learner</th>
                          <th className="py-3 pr-4">Class</th>
                          <th className="py-3 pr-4">Age Group</th>
                          <th className="py-3 pr-4">Stars</th>
                          <th className="py-3 pr-4">Lessons</th>
                          <th className="py-3 pr-4">Streak</th>
                          <th className="py-3 text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((stu) => (
                          <tr
                            key={stu.id}
                            className="border-b border-[#24334D]/6 last:border-none"
                          >
                            <td className="py-3 pr-4 font-bold flex items-center gap-2.5">
                              <ChildAvatar avatarKey={stu.avatar_key} size="sm" />
                              {stu.display_name}
                            </td>
                            <td className="py-3 pr-4 text-[#24334D]/80">
                              {stu.class_name}
                            </td>
                            <td className="py-3 pr-4">
                              <Badge variant="neutral">
                                {formatAgeGroupLabel(stu.age_group)}
                              </Badge>
                            </td>
                            <td className="py-3 pr-4 font-bold">⭐ {stu.total_stars}</td>
                            <td className="py-3 pr-4">{stu.lessons_completed}</td>
                            <td className="py-3 pr-4">{stu.streak_days} days</td>
                            <td className="py-3 text-right whitespace-nowrap">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openStudentDetail(stu.id)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Inspect Progress
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Parent Reflections */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircleHeart className="h-5 w-5 text-[#B8A5F5]" />
                Recent Family Reflections
              </CardTitle>
              <CardDescription>
                Notes shared by parents after conducting Home Learning Hub
                activities.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {reflections.length > 0 ? (
                reflections.slice(0, 6).map((r) => (
                  <div
                    key={r.id}
                    className="rounded-2xl bg-[#FFF9F0] p-4 border border-[#24334D]/8 text-sm space-y-1"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="lavender">
                          Week {r.week_number}: {r.theme_title}
                        </Badge>
                        <span className="font-bold">
                          {studentNameMap.get(r.child_id) || "Learner"}
                        </span>
                      </div>
                      <span className="text-xs text-[#24334D]/60">
                        {formatShortDate(r.created_at)}
                      </span>
                    </div>
                    {r.discovery_notes && (
                      <p className="italic text-[#24334D]/85">
                        &ldquo;{r.discovery_notes}&rdquo;
                      </p>
                    )}
                    {r.challenging_concepts && (
                      <p className="text-xs text-[#24334D]/70">
                        <strong>Needs practice:</strong> {r.challenging_concepts}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#24334D]/65">
                  No parent reflections recorded yet.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Student Detail Modal */}
      <Dialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        size="lg"
        title={
          studentDetail
            ? `${studentDetail.child.display_name}'s Learning Progress`
            : "Loading Learner Progress..."
        }
        description="Classroom progress, skill mastery, and family updates."
      >
        {detailLoading ? (
          <Skeleton className="h-44 w-full" />
        ) : studentDetail ? (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 min-[360px]:grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-[#FFF5CF] p-3">
                <p className="font-display text-lg font-bold">
                  {studentDetail.child.total_stars}
                </p>
                <p className="text-xs font-bold text-[#24334D]/65">Stars</p>
              </div>
              <div className="rounded-2xl bg-[#DDF8EC] p-3">
                <p className="font-display text-lg font-bold">
                  {studentDetail.lessons_completed} / {studentDetail.total_lessons}
                </p>
                <p className="text-xs font-bold text-[#24334D]/65">Lessons</p>
              </div>
              <div className="rounded-2xl bg-[#DCF2FD] p-3">
                <p className="font-display text-lg font-bold">
                  {studentDetail.total_time_minutes}m
                </p>
                <p className="text-xs font-bold text-[#24334D]/65">Time</p>
              </div>
            </div>

            {studentDetail.skills.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-display font-bold">Skills Practiced</h4>
                {studentDetail.skills.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-xl bg-[#FFF9F0] px-3 py-2"
                  >
                    <span className="font-semibold">{s.skill_name}</span>
                    <Badge variant="mint">{s.mastery_pct}%</Badge>
                  </div>
                ))}
              </div>
            )}

            {studentDetail.observations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-display font-bold">Recent Observations</h4>
                {studentDetail.observations.map((obs) => (
                  <div
                    key={obs.id}
                    className="rounded-xl bg-[#FFF9F0] p-3 text-xs space-y-1"
                  >
                    <Badge variant="sky">{obs.category}</Badge>
                    <p>{obs.observation_text}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Link href="/teacher/assignments">
                <Button variant="secondary" size="sm">
                  Record Observation / Feedback
                </Button>
              </Link>
            </div>
          </div>
        ) : null}
      </Dialog>
    </PortalShell>
  );
}

export default function TeacherPage() {
  return (
    <ProtectedRoute allowedRoles={["teacher", "admin"]}>
      <TeacherPortalContent />
    </ProtectedRoute>
  );
}
