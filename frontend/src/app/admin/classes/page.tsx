"use client";

import { useCallback, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Baby,
  GraduationCap,
  Plus,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { formatAgeGroupLabel } from "@/lib/utils";
import {
  adminCreateClassSchema,
  type AdminCreateClassFormValues,
} from "@/lib/validation";
import { adminApi, ApiError } from "@/services/api";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminChildSummary, AdminClass, AdminUser } from "@/types";

function AdminClassesPageContent() {
  const [classes, setClasses] = useState<AdminClass[]>([]);
  const [children, setChildren] = useState<AdminChildSummary[]>([]);
  const [educators, setEducators] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [selectedTeacherByClass, setSelectedTeacherByClass] = useState<
    Record<string, string>
  >({});
  const [selectedChildByClass, setSelectedChildByClass] = useState<
    Record<string, string>
  >({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AdminCreateClassFormValues>({
    resolver: zodResolver(adminCreateClassSchema),
    defaultValues: {
      name: "",
      age_group: "Pre-School",
      academic_year: "2026-2027",
      room_label: "",
    },
  });

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [clsList, childList, userList] = await Promise.all([
        adminApi.classes(),
        adminApi.children(),
        adminApi.users({ is_active: true }),
      ]);
      setClasses(clsList);
      setChildren(childList);
      setEducators(
        userList.filter(
          (u) => u.roles.includes("teacher") || u.roles.includes("admin")
        )
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not load classes and learner enrollments."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function onCreateClass(values: AdminCreateClassFormValues) {
    setError(null);
    setToast(null);
    try {
      const created = await adminApi.createClass({
        name: values.name,
        age_group: values.age_group,
        academic_year: values.academic_year,
        room_label: values.room_label?.trim() || undefined,
        is_active: true,
      });
      reset({
        name: "",
        age_group: "Pre-School",
        academic_year: "2026-2027",
        room_label: "",
      });
      setClasses((prev) => [...prev, created]);
      setToast(`Created class "${created.name}".`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not create class."
      );
    }
  }

  async function handleToggleClassActive(cls: AdminClass) {
    setBusyId(cls.id);
    setError(null);
    setToast(null);
    try {
      const updated = await adminApi.updateClass(cls.id, {
        is_active: !cls.is_active,
      });
      setClasses((prev) => prev.map((c) => (c.id === cls.id ? updated : c)));
      setToast(
        `${cls.name} marked ${!cls.is_active ? "active" : "archived/inactive"}.`
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not update class."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleAssignTeacher(cls: AdminClass) {
    const teacherId = selectedTeacherByClass[cls.id];
    if (!teacherId) return;
    setBusyId(`teacher-${cls.id}`);
    setError(null);
    setToast(null);
    try {
      const updated = await adminApi.assignTeacher(cls.id, {
        teacher_user_id: teacherId,
        is_lead: cls.teachers.length === 0,
      });
      setClasses((prev) => prev.map((c) => (c.id === cls.id ? updated : c)));
      setSelectedTeacherByClass((prev) => ({ ...prev, [cls.id]: "" }));
      setToast(`Assigned educator to ${cls.name}.`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not assign educator."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemoveTeacher(cls: AdminClass, teacherId: string) {
    setBusyId(`rm-teacher-${cls.id}-${teacherId}`);
    setError(null);
    setToast(null);
    try {
      await adminApi.removeTeacher(cls.id, teacherId);
      setClasses((prev) =>
        prev.map((c) =>
          c.id === cls.id
            ? {
                ...c,
                teachers: c.teachers.filter(
                  (t) => t.teacher_user_id !== teacherId
                ),
              }
            : c
        )
      );
      setToast(`Unassigned educator from ${cls.name}.`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not remove educator."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleEnrollChild(cls: AdminClass) {
    const childId = selectedChildByClass[cls.id];
    if (!childId) return;
    setBusyId(`enroll-${cls.id}`);
    setError(null);
    setToast(null);
    try {
      const updated = await adminApi.enrollChild(cls.id, { child_id: childId });
      setClasses((prev) => prev.map((c) => (c.id === cls.id ? updated : c)));
      setSelectedChildByClass((prev) => ({ ...prev, [cls.id]: "" }));
      setToast(`Enrolled learner into ${cls.name}.`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not enroll learner."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnenrollChild(cls: AdminClass, childId: string) {
    setBusyId(`rm-child-${cls.id}-${childId}`);
    setError(null);
    setToast(null);
    try {
      await adminApi.unenrollChild(cls.id, childId);
      setClasses((prev) =>
        prev.map((c) =>
          c.id === cls.id
            ? { ...c, students: c.students.filter((s) => s.child_id !== childId) }
            : c
        )
      );
      setToast(`Removed learner enrollment from ${cls.name}.`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not unenroll learner."
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PortalShell
      title="Classes & Learner Enrollment"
      subtitle="Organize kindergarten cohorts, assign teachers, and enroll learners safely."
    >
      {error && (
        <Alert tone="warning" title="Notice">
          {error}
        </Alert>
      )}
      {toast && (
        <Alert tone="success" title="Updated">
          {toast}
        </Alert>
      )}

      {/* Create Class Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-[#166041]" />
            Create Kindergarten Class
          </CardTitle>
          <CardDescription>
            Add a new cohort before assigning teachers and enrolling students.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(onCreateClass)}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-start"
          >
            <div>
              <label className="text-xs font-bold block mb-1">Class Name</label>
              <Input
                placeholder="Starlight Kinders"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-[#A32E24] mt-1">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">Age Group</label>
              <select
                {...register("age_group")}
                className="h-11 w-full rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-sm font-semibold"
              >
                <option value="Pre-School">Pre-School</option>
                <option value="3-4">Pre-School (Ages 3–4)</option>
                <option value="4-5">Pre-School (Ages 4–5)</option>
                <option value="5-6">Pre-School (Ages 5–6)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">
                Academic Year
              </label>
              <Input placeholder="2026-2027" {...register("academic_year")} />
              {errors.academic_year && (
                <p className="text-xs text-[#A32E24] mt-1">
                  {errors.academic_year.message}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">
                Room Label (Optional)
              </label>
              <Input placeholder="Room C-3" {...register("room_label")} />
            </div>

            <div className="pt-1 lg:pt-5 sm:col-span-2 lg:col-span-1">
              <Button
                type="submit"
                variant="secondary"
                disabled={isSubmitting}
                className="w-full"
              >
                <Plus className="h-4 w-4" />
                {isSubmitting ? "Creating..." : "Create Class"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          {/* Class Roster Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {classes.map((cls) => {
              const assignedIds = new Set(
                cls.teachers.map((t) => t.teacher_user_id)
              );
              const availableTeachers = educators.filter(
                (e) => !assignedIds.has(e.id)
              );
              const enrolledIds = new Set(cls.students.map((s) => s.child_id));
              const availableChildren = children.filter(
                (c) => !enrolledIds.has(c.id)
              );

              return (
                <Card key={cls.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {cls.name}
                          <Badge variant={cls.is_active ? "mint" : "neutral"}>
                            {cls.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          {formatAgeGroupLabel(cls.age_group)} • {cls.academic_year}
                          {cls.room_label ? ` • ${cls.room_label}` : ""}
                        </CardDescription>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === cls.id}
                        onClick={() => handleToggleClassActive(cls)}
                      >
                        {cls.is_active ? "Set Inactive" : "Activate"}
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    {/* Assigned Teachers */}
                    <div className="space-y-2.5">
                      <p className="text-xs font-bold uppercase tracking-wide text-[#24334D]/60 flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        Assigned Educators ({cls.teachers.length})
                      </p>
                      {cls.teachers.length === 0 ? (
                        <p className="text-xs text-[#24334D]/60">
                          No teacher assigned yet.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {cls.teachers.map((t) => (
                            <div
                              key={t.teacher_user_id}
                              className="flex items-center justify-between gap-2 rounded-2xl bg-[#FFF9F0] px-3 py-2 text-xs border border-[#24334D]/8"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-bold truncate">
                                  {t.full_name}
                                </span>
                                {t.is_lead && (
                                  <Badge variant="sky">Lead Teacher</Badge>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={
                                  busyId ===
                                  `rm-teacher-${cls.id}-${t.teacher_user_id}`
                                }
                                onClick={() =>
                                  handleRemoveTeacher(cls, t.teacher_user_id)
                                }
                                aria-label={`Remove ${t.full_name} from ${cls.name}`}
                              >
                                <UserMinus className="h-3.5 w-3.5 text-[#A32E24]" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <select
                          aria-label={`Select teacher for ${cls.name}`}
                          value={selectedTeacherByClass[cls.id] ?? ""}
                          onChange={(e) =>
                            setSelectedTeacherByClass((prev) => ({
                              ...prev,
                              [cls.id]: e.target.value,
                            }))
                          }
                          className="h-11 sm:h-10 flex-1 min-w-0 rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-xs font-semibold"
                        >
                          <option value="">Select teacher to assign...</option>
                          {availableTeachers.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.full_name} ({e.roles.join(", ")})
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={
                            !selectedTeacherByClass[cls.id] ||
                            busyId === `teacher-${cls.id}`
                          }
                          onClick={() => handleAssignTeacher(cls)}
                          className="w-full sm:w-auto shrink-0"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Assign
                        </Button>
                      </div>
                    </div>

                    {/* Enrolled Students */}
                    <div className="space-y-2.5 border-t border-[#24334D]/8 pt-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-[#24334D]/60 flex items-center gap-1.5">
                        <Baby className="h-3.5 w-3.5" />
                        Enrolled Learners ({cls.students.length})
                      </p>
                      {cls.students.length === 0 ? (
                        <p className="text-xs text-[#24334D]/60">
                          No learners enrolled yet.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {cls.students.map((s) => (
                            <div
                              key={s.child_id}
                              className="flex items-center justify-between gap-2 rounded-2xl bg-[#FFF9F0] px-3 py-2 text-xs border border-[#24334D]/8"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <ChildAvatar avatarKey={s.avatar_key} size="sm" className="shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-bold text-[#24334D] truncate">
                                    {s.display_name}
                                  </p>
                                  <p className="text-[11px] text-[#24334D]/60">
                                    {formatAgeGroupLabel(s.age_group)}
                                  </p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={
                                  busyId === `rm-child-${cls.id}-${s.child_id}`
                                }
                                onClick={() =>
                                  handleUnenrollChild(cls, s.child_id)
                                }
                                aria-label={`Unenroll ${s.display_name} from ${cls.name}`}
                              >
                                <UserMinus className="h-3.5 w-3.5 text-[#A32E24]" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <select
                          aria-label={`Select learner to enroll in ${cls.name}`}
                          value={selectedChildByClass[cls.id] ?? ""}
                          onChange={(e) =>
                            setSelectedChildByClass((prev) => ({
                              ...prev,
                              [cls.id]: e.target.value,
                            }))
                          }
                          className="h-11 sm:h-10 flex-1 min-w-0 rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-xs font-semibold"
                        >
                          <option value="">Select learner to enroll...</option>
                          {availableChildren.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.display_name} ({formatAgeGroupLabel(c.age_group)})
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          variant="mint"
                          disabled={
                            !selectedChildByClass[cls.id] ||
                            busyId === `enroll-${cls.id}`
                          }
                          onClick={() => handleEnrollChild(cls)}
                          className="w-full sm:w-auto shrink-0"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Enroll
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* School-wide Learner Directory */}
          <Card>
            <CardHeader>
              <CardTitle>School-Wide Learner Directory ({children.length})</CardTitle>
              <CardDescription>
                Overview of all kindergarten profiles, guardians, class placements, and stars.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {children.length === 0 ? (
                <p className="text-sm text-[#24334D]/65 py-6 text-center">
                  No kindergarten learners enrolled yet.
                </p>
              ) : (
                <>
                  {/* Mobile Stacked Cards */}
                  <div className="md:hidden space-y-3">
                    {children.map((child) => (
                      <div
                        key={child.id}
                        className="rounded-2xl bg-[#FFF9F0] p-4 border border-[#24334D]/10 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <ChildAvatar
                              avatarKey={child.avatar_key}
                              size="sm"
                              className="shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-[#24334D] truncate">
                                {child.display_name}
                              </p>
                              <p className="text-xs text-[#24334D]/65 truncate">
                                Guardian:{" "}
                                {child.parent_names.length > 0
                                  ? child.parent_names.join(", ")
                                  : "—"}
                              </p>
                            </div>
                          </div>
                          <Badge variant="neutral" className="shrink-0">
                            {formatAgeGroupLabel(child.age_group)}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#24334D]/8 text-xs">
                          <div className="flex flex-wrap gap-1">
                            {child.class_names.length > 0 ? (
                              child.class_names.map((cn) => (
                                <Badge key={cn} variant="sky">
                                  {cn}
                                </Badge>
                              ))
                            ) : (
                              <Badge variant="neutral">Unassigned</Badge>
                            )}
                          </div>
                          <span className="font-bold text-[#24334D]">
                            {child.total_stars} ⭐ · {child.streak_days}d
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Tablet / Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm text-left">
                      <thead>
                        <tr className="border-b border-[#24334D]/10 text-xs uppercase text-[#24334D]/60">
                          <th className="py-3 pr-4">Learner</th>
                          <th className="py-3 pr-4">Age Group</th>
                          <th className="py-3 pr-4">Parent / Guardian</th>
                          <th className="py-3 pr-4">Enrolled Classes</th>
                          <th className="py-3 pr-4">Stars</th>
                          <th className="py-3 text-right">Streak</th>
                        </tr>
                      </thead>
                      <tbody>
                        {children.map((child) => (
                          <tr
                            key={child.id}
                            className="border-b border-[#24334D]/6 last:border-none"
                          >
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2.5 font-bold">
                                <ChildAvatar avatarKey={child.avatar_key} size="sm" />
                                <span>{child.display_name}</span>
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-xs font-bold">
                              {formatAgeGroupLabel(child.age_group)}
                            </td>
                            <td className="py-3 pr-4 text-xs text-[#24334D]/75">
                              {child.parent_names.length > 0
                                ? child.parent_names.join(", ")
                                : "—"}
                            </td>
                            <td className="py-3 pr-4">
                              <div className="flex flex-wrap gap-1">
                                {child.class_names.length > 0 ? (
                                  child.class_names.map((cn) => (
                                    <Badge key={cn} variant="sky">
                                      {cn}
                                    </Badge>
                                  ))
                                ) : (
                                  <Badge variant="neutral">Unassigned</Badge>
                                )}
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-xs font-bold">
                              {child.total_stars} ⭐
                            </td>
                            <td className="py-3 text-right text-xs font-bold">
                              {child.streak_days}d
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
        </>
      )}
    </PortalShell>
  );
}

export default function AdminClassesPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminClassesPageContent />
    </ProtectedRoute>
  );
}
