"use client";

import { useCallback, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  ClipboardList,
  Megaphone,
  MessageSquareHeart,
  Trash2,
} from "lucide-react";
import { formatShortDate } from "@/lib/utils";
import {
  announcementSchema,
  createAssignmentSchema,
  teacherFeedbackSchema,
  teacherObservationSchema,
  type AnnouncementFormValues,
  type CreateAssignmentFormValues,
  type TeacherFeedbackFormValues,
  type TeacherObservationFormValues,
} from "@/lib/validation";
import { ApiError, contentApi, teacherApi } from "@/services/api";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PortalShell } from "@/components/layout/PortalShell";
import { Alert } from "@/components/ui/alert";
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
import type {
  Announcement,
  Game,
  Lesson,
  TeacherAssignment,
  TeacherClass,
  TeacherFeedbackItem,
  TeacherObservation,
  TeacherStudent,
} from "@/types";

function TeacherAssignmentsContent() {
  const [tab, setTab] = useState<"assignments" | "notes" | "announcements">(
    "assignments"
  );
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [observations, setObservations] = useState<TeacherObservation[]>([]);
  const [feedbackList, setFeedbackList] = useState<TeacherFeedbackItem[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cls, stu, les, gam, asg, obs, fb, ann] = await Promise.all([
        teacherApi.classes(),
        teacherApi.students(),
        teacherApi.lessons(),
        contentApi.games(),
        teacherApi.assignments(),
        teacherApi.observations(),
        teacherApi.feedback(),
        teacherApi.announcements(),
      ]);
      setClasses(cls);
      setStudents(stu);
      setLessons(les);
      setGames(gam);
      setAssignments(asg);
      setObservations(obs);
      setFeedbackList(fb);
      setAnnouncements(ann);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not load classroom communications."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const {
    register: regAsg,
    handleSubmit: handleAsgSubmit,
    reset: resetAsg,
    formState: { errors: asgErrors, isSubmitting: savingAsg },
  } = useForm<CreateAssignmentFormValues>({
    resolver: zodResolver(createAssignmentSchema),
    defaultValues: {
      title: "",
      class_id: "",
      child_id: "",
      lesson_id: "",
      game_id: "",
      due_date: "",
    },
  });

  const {
    register: regObs,
    handleSubmit: handleObsSubmit,
    reset: resetObs,
    formState: { errors: obsErrors, isSubmitting: savingObs },
  } = useForm<TeacherObservationFormValues>({
    resolver: zodResolver(teacherObservationSchema),
    defaultValues: {
      child_id: "",
      category: "encouragement",
      observation_text: "",
    },
  });

  const {
    register: regFb,
    handleSubmit: handleFbSubmit,
    reset: resetFb,
    formState: { errors: fbErrors, isSubmitting: savingFb },
  } = useForm<TeacherFeedbackFormValues>({
    resolver: zodResolver(teacherFeedbackSchema),
    defaultValues: {
      child_id: "",
      message: "",
    },
  });

  const {
    register: regAnn,
    handleSubmit: handleAnnSubmit,
    reset: resetAnn,
    formState: { errors: annErrors, isSubmitting: savingAnn },
  } = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementSchema),
    defaultValues: {
      title: "",
      body: "",
      class_id: "",
    },
  });

  async function onCreateAssignment(values: CreateAssignmentFormValues) {
    setError(null);
    setToast(null);
    try {
      await teacherApi.createAssignment({
        title: values.title,
        class_id: values.class_id || null,
        child_id: values.child_id || null,
        lesson_id: values.lesson_id || null,
        game_id: values.game_id || null,
        due_date: values.due_date || null,
      });
      resetAsg();
      setToast("Activity assigned and families notified!");
      await loadAll();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not assign activity."
      );
    }
  }

  async function onDeleteAssignment(id: string) {
    try {
      await teacherApi.deleteAssignment(id);
      await loadAll();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not delete assignment."
      );
    }
  }

  async function onCreateObservation(values: TeacherObservationFormValues) {
    setError(null);
    setToast(null);
    try {
      await teacherApi.createObservation({
        child_id: values.child_id,
        category: values.category,
        observation_text: values.observation_text,
      });
      resetObs();
      setToast("Classroom observation recorded!");
      await loadAll();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not record observation."
      );
    }
  }

  async function onCreateFeedback(values: TeacherFeedbackFormValues) {
    setError(null);
    setToast(null);
    try {
      await teacherApi.createFeedback(values);
      resetFb();
      setToast("Feedback sent to parent!");
      await loadAll();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not send feedback."
      );
    }
  }

  async function onCreateAnnouncement(values: AnnouncementFormValues) {
    setError(null);
    setToast(null);
    try {
      await teacherApi.createAnnouncement({
        title: values.title,
        body: values.body,
        class_id: values.class_id || null,
      });
      resetAnn();
      setToast("Class announcement published!");
      await loadAll();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not post announcement."
      );
    }
  }

  return (
    <PortalShell
      title="Assignments, Notes & Announcements"
      subtitle="Assign activities, record gentle classroom observations, and communicate with families."
    >
      {error && <Alert tone="warning">{error}</Alert>}
      {toast && <Alert tone="success">{toast}</Alert>}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={tab === "assignments" ? "primary" : "outline"}
          onClick={() => setTab("assignments")}
        >
          <ClipboardList className="h-4 w-4" />
          Assignments ({assignments.length})
        </Button>
        <Button
          type="button"
          variant={tab === "notes" ? "primary" : "outline"}
          onClick={() => setTab("notes")}
        >
          <MessageSquareHeart className="h-4 w-4" />
          Observations & Feedback
        </Button>
        <Button
          type="button"
          variant={tab === "announcements" ? "primary" : "outline"}
          onClick={() => setTab("announcements")}
        >
          <Megaphone className="h-4 w-4" />
          Announcements ({announcements.length})
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-80 w-full" />
      ) : tab === "assignments" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle>Assign Activity</CardTitle>
              <CardDescription>
                Assign a lesson or educational game to a class or student.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleAsgSubmit(onCreateAssignment)}
                className="space-y-3"
              >
                <div className="space-y-1">
                  <label htmlFor="asg_title" className="text-xs font-bold">
                    Assignment Title
                  </label>
                  <Input
                    id="asg_title"
                    placeholder="Week 1 Color Pop Practice"
                    {...regAsg("title")}
                  />
                  {asgErrors.title && (
                    <p className="text-xs font-bold text-[#8E3022]">
                      {asgErrors.title.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="asg_cls" className="text-xs font-bold">
                      Target Class
                    </label>
                    <select
                      id="asg_cls"
                      className="h-11 w-full rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-sm font-semibold"
                      {...regAsg("class_id")}
                    >
                      <option value="">Optional</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="asg_stu" className="text-xs font-bold">
                      Or Student
                    </label>
                    <select
                      id="asg_stu"
                      className="h-11 w-full rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-sm font-semibold"
                      {...regAsg("child_id")}
                    >
                      <option value="">Optional</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.display_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {asgErrors.class_id && (
                  <p className="text-xs font-bold text-[#8E3022]">
                    {asgErrors.class_id.message}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="asg_les" className="text-xs font-bold">
                      Lesson
                    </label>
                    <select
                      id="asg_les"
                      className="h-11 w-full rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-sm font-semibold"
                      {...regAsg("lesson_id")}
                    >
                      <option value="">Optional</option>
                      {lessons.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="asg_game" className="text-xs font-bold">
                      Or Game
                    </label>
                    <select
                      id="asg_game"
                      className="h-11 w-full rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-sm font-semibold"
                      {...regAsg("game_id")}
                    >
                      <option value="">Optional</option>
                      {games.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {asgErrors.lesson_id && (
                  <p className="text-xs font-bold text-[#8E3022]">
                    {asgErrors.lesson_id.message}
                  </p>
                )}

                <div className="space-y-1">
                  <label htmlFor="asg_due" className="text-xs font-bold">
                    Suggested Due Date
                  </label>
                  <Input id="asg_due" type="date" {...regAsg("due_date")} />
                </div>

                <Button type="submit" variant="primary" disabled={savingAsg}>
                  {savingAsg ? "Assigning..." : "Create Assignment"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle>Active Assignments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {assignments.length > 0 ? (
                assignments.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-2xl bg-[#FFF9F0] p-4 border border-[#24334D]/8 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <p className="font-bold text-sm">{a.title}</p>
                      <p className="text-xs text-[#24334D]/70">
                        Target: {a.child_name || a.class_name || "Class"} ·{" "}
                        {a.completed_count} / {a.target_count} completed
                        {a.due_date ? ` · Due ${formatShortDate(a.due_date)}` : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${a.title}`}
                      onClick={() => onDeleteAssignment(a.id)}
                    >
                      <Trash2 className="h-4 w-4 text-[#8E3022]" />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#24334D]/65">
                  No assignments created yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : tab === "notes" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Record Classroom Observation</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handleObsSubmit(onCreateObservation)}
                  className="space-y-3"
                >
                  <select
                    className="h-11 w-full rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-sm font-semibold"
                    {...regObs("child_id")}
                  >
                    <option value="">Select enrolled student</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.display_name} ({s.class_name})
                      </option>
                    ))}
                  </select>
                  {obsErrors.child_id && (
                    <p className="text-xs font-bold text-[#8E3022]">
                      {obsErrors.child_id.message}
                    </p>
                  )}

                  <select
                    className="h-11 w-full rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-sm font-semibold"
                    {...regObs("category")}
                  >
                    <option value="encouragement">Encouragement</option>
                    <option value="confidence">Confidence & Social</option>
                    <option value="curiosity">Curiosity & Discovery</option>
                    <option value="practice">Extra Practice Cue</option>
                  </select>

                  <textarea
                    rows={3}
                    placeholder="Share a warm classroom observation..."
                    className="w-full rounded-2xl border-2 border-[#24334D]/12 bg-white px-4 py-2 text-sm"
                    {...regObs("observation_text")}
                  />
                  <Button type="submit" variant="primary" disabled={savingObs}>
                    {savingObs ? "Saving..." : "Save Observation"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Send Parent Feedback</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handleFbSubmit(onCreateFeedback)}
                  className="space-y-3"
                >
                  <select
                    className="h-11 w-full rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-sm font-semibold"
                    {...regFb("child_id")}
                  >
                    <option value="">Select enrolled student</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.display_name} ({s.class_name})
                      </option>
                    ))}
                  </select>
                  {fbErrors.child_id && (
                    <p className="text-xs font-bold text-[#8E3022]">
                      {fbErrors.child_id.message}
                    </p>
                  )}

                  <textarea
                    rows={4}
                    placeholder="Write an encouraging update for the family..."
                    className="w-full rounded-2xl border-2 border-[#24334D]/12 bg-white px-4 py-2 text-sm"
                    {...regFb("message")}
                  />
                  <Button type="submit" variant="secondary" disabled={savingFb}>
                    {savingFb ? "Sending..." : "Send Feedback to Parent"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Observations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {observations.map((o) => (
                  <div
                    key={o.id}
                    className="rounded-2xl bg-[#FFF9F0] p-3.5 text-sm space-y-1"
                  >
                    <div className="flex justify-between text-xs text-[#24334D]/60">
                      <Badge variant="sky">{o.category}</Badge>
                      <span>{formatShortDate(o.observed_at)}</span>
                    </div>
                    <p>{o.observation_text}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sent Parent Feedback</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {feedbackList.map((f) => (
                  <div
                    key={f.id}
                    className="rounded-2xl bg-[#DDF8EC]/45 p-3.5 text-sm space-y-1"
                  >
                    <p>{f.message}</p>
                    <p className="text-xs text-[#24334D]/60">
                      {formatShortDate(f.created_at)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle>Post Class Announcement</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleAnnSubmit(onCreateAnnouncement)}
                className="space-y-3"
              >
                <Input
                  placeholder="Announcement Title"
                  {...regAnn("title")}
                />
                {annErrors.title && (
                  <p className="text-xs font-bold text-[#8E3022]">
                    {annErrors.title.message}
                  </p>
                )}
                <select
                  className="h-11 w-full rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-sm font-semibold"
                  {...regAnn("class_id")}
                >
                  <option value="">All My Classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <textarea
                  rows={4}
                  placeholder="Share class updates or upcoming theme reminders..."
                  className="w-full rounded-2xl border-2 border-[#24334D]/12 bg-white px-4 py-2 text-sm"
                  {...regAnn("body")}
                />
                <Button type="submit" variant="primary" disabled={savingAnn}>
                  {savingAnn ? "Publishing..." : "Publish Announcement"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle>Published Announcements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {announcements.map((a) => (
                <div
                  key={a.id}
                  className="rounded-2xl bg-[#FFF9F0] p-4 border border-[#24334D]/8 space-y-1"
                >
                  <div className="flex justify-between gap-2">
                    <p className="font-bold text-sm">{a.title}</p>
                    <span className="text-xs text-[#24334D]/60">
                      {formatShortDate(a.published_at)}
                    </span>
                  </div>
                  <p className="text-sm text-[#24334D]/80">{a.body}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </PortalShell>
  );
}

export default function TeacherAssignmentsPage() {
  return (
    <ProtectedRoute allowedRoles={["teacher", "admin"]}>
      <TeacherAssignmentsContent />
    </ProtectedRoute>
  );
}
