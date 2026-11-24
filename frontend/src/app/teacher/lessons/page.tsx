"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  BookOpen,
  Eye,
  FileUp,
  Layers,
  Plus,
  Sparkles,
} from "lucide-react";
import { formatAgeGroupLabel } from "@/lib/utils";
import {
  createLessonSchema,
  createThemeSchema,
  type CreateLessonFormValues,
  type CreateThemeFormValues,
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
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Lesson, LessonResource, Subject, Theme } from "@/types";

function TeacherLessonsContent() {
  const [tab, setTab] = useState<"lessons" | "themes">("lessons");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [themeModalOpen, setThemeModalOpen] = useState(false);

  // Resource modal
  const [resourceLesson, setResourceLesson] = useState<Lesson | null>(null);
  const [resources, setResources] = useState<LessonResource[]>([]);
  const [resTitle, setResTitle] = useState("");
  const [resFile, setResFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Practice activity modal
  const [activityLesson, setActivityLesson] = useState<Lesson | null>(null);
  const [actPrompt, setActPrompt] = useState("");
  const [actChoices, setActChoices] = useState("Option A, Option B, Option C");
  const [actCorrect, setActCorrect] = useState(0);
  const [savingAct, setSavingAct] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, l, t] = await Promise.all([
        contentApi.subjects(),
        teacherApi.lessons(),
        teacherApi.themes(),
      ]);
      setSubjects(s);
      setLessons(l);
      setThemes(t);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not load curriculum studio."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const {
    register: regLesson,
    handleSubmit: handleLessonSubmit,
    reset: resetLesson,
    formState: { errors: lessonErrors, isSubmitting: savingLesson },
  } = useForm<CreateLessonFormValues>({
    resolver: zodResolver(createLessonSchema),
    defaultValues: {
      title: "",
      subject_id: "",
      theme_id: "",
      summary: "",
      age_group: "Pre-School",
      estimated_minutes: 10,
      audio_narration_text: "",
      status: "published",
      slide_title: "Let's Explore!",
      slide_text: "",
      slide_emoji: "🌟",
    },
  });

  const {
    register: regTheme,
    handleSubmit: handleThemeSubmit,
    reset: resetTheme,
    formState: { errors: themeErrors, isSubmitting: savingTheme },
  } = useForm<CreateThemeFormValues>({
    resolver: zodResolver(createThemeSchema),
    defaultValues: {
      week_number: 13,
      title: "",
      summary: "",
      color_hex: "#78C8F5",
      status: "published",
      what_child_learns: "",
      learning_tip: "",
    },
  });

  async function onCreateLesson(values: CreateLessonFormValues) {
    setError(null);
    setToast(null);
    try {
      await teacherApi.createLesson({
        title: values.title,
        subject_id: values.subject_id,
        theme_id: values.theme_id || null,
        summary: values.summary,
        age_group: values.age_group,
        estimated_minutes: values.estimated_minutes,
        audio_narration_text: values.audio_narration_text || values.slide_text,
        status: values.status,
        slides: [
          {
            title: values.slide_title,
            text: values.slide_text,
            emoji: values.slide_emoji,
            narration: values.slide_text,
          },
        ],
      });
      resetLesson();
      setLessonModalOpen(false);
      setToast("Lesson created!");
      await loadAll();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not create lesson."
      );
    }
  }

  async function handleToggleLessonStatus(lesson: Lesson) {
    const nextStatus = lesson.status === "published" ? "draft" : "published";
    try {
      await teacherApi.updateLesson(lesson.id, { status: nextStatus });
      setToast(`Lesson marked as ${nextStatus}.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update status.");
    }
  }

  async function onCreateTheme(values: CreateThemeFormValues) {
    setError(null);
    setToast(null);
    try {
      await teacherApi.createTheme(values);
      resetTheme();
      setThemeModalOpen(false);
      setToast("Weekly theme saved!");
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create theme.");
    }
  }

  async function handleToggleThemeStatus(theme: Theme) {
    const nextStatus = theme.status === "published" ? "draft" : "published";
    try {
      await teacherApi.updateTheme(theme.id, { status: nextStatus });
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update theme.");
    }
  }

  async function openResourceModal(lesson: Lesson) {
    setResourceLesson(lesson);
    setResTitle("");
    setResFile(null);
    try {
      const list = await teacherApi.lessonResources(lesson.id);
      setResources(list);
    } catch {
      setResources([]);
    }
  }

  async function handleUploadResource(e: React.FormEvent) {
    e.preventDefault();
    if (!resourceLesson || !resFile || !resTitle.trim()) return;
    setUploading(true);
    setError(null);
    try {
      await teacherApi.uploadLessonResource(
        resourceLesson.id,
        resTitle.trim(),
        resFile
      );
      setResTitle("");
      setResFile(null);
      const list = await teacherApi.lessonResources(resourceLesson.id);
      setResources(list);
      setToast("Media resource uploaded cleanly!");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleAddActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!activityLesson || !actPrompt.trim()) return;
    const choices = actChoices
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (choices.length < 2) {
      setError("Enter at least 2 comma-separated choices.");
      return;
    }
    setSavingAct(true);
    setError(null);
    try {
      await teacherApi.createActivity({
        lesson_id: activityLesson.id,
        title: `${activityLesson.title} Question`,
        instructions: actPrompt.trim(),
        prompt: actPrompt.trim(),
        choices: choices.slice(0, 4),
        correct_index: Math.min(actCorrect, choices.length - 1),
      });
      setActivityLesson(null);
      setActPrompt("");
      setToast("Practice question added to lesson!");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not add practice activity."
      );
    } finally {
      setSavingAct(false);
    }
  }

  return (
    <PortalShell
      title="Lessons, Themes & Media"
      subtitle="Create age-appropriate lessons, organize weekly themes, and upload learning media."
    >
      {error && <Alert tone="warning">{error}</Alert>}
      {toast && <Alert tone="success">{toast}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={tab === "lessons" ? "primary" : "outline"}
            onClick={() => setTab("lessons")}
          >
            <BookOpen className="h-4 w-4" />
            Lessons ({lessons.length})
          </Button>
          <Button
            type="button"
            variant={tab === "themes" ? "primary" : "outline"}
            onClick={() => setTab("themes")}
          >
            <Layers className="h-4 w-4" />
            Weekly Themes ({themes.length})
          </Button>
        </div>

        {tab === "lessons" ? (
          <Button
            type="button"
            variant="kids"
            onClick={() => setLessonModalOpen(true)}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Create Lesson
          </Button>
        ) : (
          <Button
            type="button"
            variant="kids"
            onClick={() => setThemeModalOpen(true)}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Create Weekly Theme
          </Button>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-72 w-full" />
      ) : tab === "lessons" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lessons.map((lesson) => (
            <Card key={lesson.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge
                    variant={lesson.status === "published" ? "mint" : "sunshine"}
                    className="capitalize"
                  >
                    {lesson.status}
                  </Badge>
                  <span className="text-xs font-bold text-[#24334D]/60">
                    {lesson.estimated_minutes} mins ·{" "}
                    {formatAgeGroupLabel(lesson.age_group)}
                  </span>
                </div>
                <CardTitle className="pt-1">{lesson.title}</CardTitle>
                <CardDescription>{lesson.summary}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleLessonStatus(lesson)}
                >
                  {lesson.status === "published" ? "Move to Draft" : "Publish"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => openResourceModal(lesson)}
                >
                  <FileUp className="h-3.5 w-3.5" />
                  Media
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActivityLesson(lesson)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Add Question
                </Button>
                <Link href={`/kids/lesson/${lesson.id}`}>
                  <Button type="button" variant="ghost" size="sm">
                    <Eye className="h-3.5 w-3.5" />
                    Preview
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {themes.map((theme) => (
            <Card key={theme.id}>
              <div
                className="h-2.5 rounded-t-3xl"
                style={{ backgroundColor: theme.color_hex }}
              />
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="lavender">Week {theme.week_number}</Badge>
                  <Badge
                    variant={theme.status === "published" ? "mint" : "sunshine"}
                    className="capitalize"
                  >
                    {theme.status}
                  </Badge>
                </div>
                <CardTitle className="pt-1 text-lg">{theme.title}</CardTitle>
                <CardDescription>{theme.summary}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleThemeStatus(theme)}
                >
                  {theme.status === "published" ? "Set Draft" : "Publish Theme"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Lesson Dialog */}
      <Dialog
        open={lessonModalOpen}
        onClose={() => setLessonModalOpen(false)}
        size="lg"
        title="Create Kindergarten Lesson"
        description="Build a child-friendly lesson with an opening story slide."
      >
        <form
          onSubmit={handleLessonSubmit(onCreateLesson)}
          className="space-y-3"
        >
          <div className="space-y-1">
            <label htmlFor="lesson_title" className="text-sm font-bold">
              Lesson Title
            </label>
            <Input
              id="lesson_title"
              placeholder="Meet Friendly Letter C"
              {...regLesson("title")}
            />
            {lessonErrors.title && (
              <p className="text-xs font-bold text-[#8E3022]">
                {lessonErrors.title.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="lesson_subject" className="text-sm font-bold">
                Learning Module
              </label>
              <select
                id="lesson_subject"
                className="h-11 w-full rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-sm font-semibold"
                {...regLesson("subject_id")}
              >
                <option value="">Select subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {lessonErrors.subject_id && (
                <p className="text-xs font-bold text-[#8E3022]">
                  {lessonErrors.subject_id.message}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label htmlFor="lesson_theme" className="text-sm font-bold">
                Weekly Theme
              </label>
              <select
                id="lesson_theme"
                className="h-11 w-full rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-sm font-semibold"
                {...regLesson("theme_id")}
              >
                <option value="">Optional</option>
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    Wk {t.week_number}: {t.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="lesson_summary" className="text-sm font-bold">
              Short Summary
            </label>
            <Input
              id="lesson_summary"
              placeholder="Discover words starting with /c/ like cat and cloud!"
              {...regLesson("summary")}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label htmlFor="lesson_age" className="text-xs font-bold">
                Age Group
              </label>
              <select
                id="lesson_age"
                className="h-11 w-full rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-sm font-semibold"
                {...regLesson("age_group")}
              >
                <option value="Pre-School">Pre-School</option>
                <option value="3-4">Pre-School (Ages 3–4)</option>
                <option value="4-5">Pre-School (Ages 4–5)</option>
                <option value="5-6">Pre-School (Ages 5–6)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="lesson_mins" className="text-xs font-bold">
                Minutes
              </label>
              <Input
                id="lesson_mins"
                type="number"
                {...regLesson("estimated_minutes")}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="lesson_status" className="text-xs font-bold">
                Status
              </label>
              <select
                id="lesson_status"
                className="h-11 w-full rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-sm font-semibold"
                {...regLesson("status")}
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <div className="rounded-2xl bg-[#FFF9F0] p-3 space-y-2 border border-[#24334D]/8">
            <p className="text-xs font-bold text-[#175B82]">Opening Slide</p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <Input
                placeholder="Emoji"
                {...regLesson("slide_emoji")}
              />
              <Input
                className="sm:col-span-3"
                placeholder="Slide Title"
                {...regLesson("slide_title")}
              />
            </div>
            <Input
              placeholder="Story text read aloud to the child..."
              {...regLesson("slide_text")}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setLessonModalOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={savingLesson}
              className="w-full sm:w-auto"
            >
              {savingLesson ? "Saving..." : "Save Lesson"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Create Theme Dialog */}
      <Dialog
        open={themeModalOpen}
        onClose={() => setThemeModalOpen(false)}
        title="Create Weekly Learning Theme"
      >
        <form onSubmit={handleThemeSubmit(onCreateTheme)} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <label htmlFor="wk_num" className="text-xs font-bold">
                Week #
              </label>
              <Input id="wk_num" type="number" {...regTheme("week_number")} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <label htmlFor="th_title" className="text-xs font-bold">
                Theme Title
              </label>
              <Input id="th_title" {...regTheme("title")} />
              {themeErrors.title && (
                <p className="text-xs font-bold text-[#8E3022]">
                  {themeErrors.title.message}
                </p>
              )}
            </div>
          </div>
          <Input
            placeholder="Friendly summary for families..."
            {...regTheme("summary")}
          />
          <Input
            placeholder="What your child learns (Parent Guide)"
            {...regTheme("what_child_learns")}
          />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setThemeModalOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={savingTheme}
              className="w-full sm:w-auto"
            >
              {savingTheme ? "Saving..." : "Save Theme"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Upload Resource Dialog */}
      <Dialog
        open={Boolean(resourceLesson)}
        onClose={() => setResourceLesson(null)}
        title={`Media Resources — ${resourceLesson?.title || ""}`}
        description="Upload PNG/JPEG/WEBP illustrations, MP3/WAV audio, or PDF worksheets (max 10 MB)."
      >
        <div className="space-y-4">
          <form onSubmit={handleUploadResource} className="space-y-3">
            <Input
              placeholder="Resource title (e.g., Color Flashcard)"
              value={resTitle}
              onChange={(e) => setResTitle(e.target.value)}
            />
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,audio/mpeg,audio/wav,application/pdf"
              onChange={(e) => setResFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-[#24334D]"
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={uploading || !resFile || !resTitle.trim()}
            >
              {uploading ? "Uploading..." : "Upload File"}
            </Button>
          </form>

          <div className="space-y-2 border-t border-[#24334D]/8 pt-3">
            <p className="text-xs font-bold text-[#24334D]/70">
              Attached Resources ({resources.length})
            </p>
            {resources.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl bg-[#FFF9F0] px-3 py-2 text-xs"
              >
                <span className="font-bold">{r.title}</span>
                <Badge variant="neutral">{r.resource_type}</Badge>
              </div>
            ))}
          </div>
        </div>
      </Dialog>

      {/* Add Practice Question Dialog */}
      <Dialog
        open={Boolean(activityLesson)}
        onClose={() => setActivityLesson(null)}
        title={`Add Practice Question — ${activityLesson?.title || ""}`}
      >
        <form onSubmit={handleAddActivity} className="space-y-3">
          <Input
            placeholder="Question prompt (e.g., Which fruit is yellow?)"
            value={actPrompt}
            onChange={(e) => setActPrompt(e.target.value)}
          />
          <Input
            placeholder="Comma-separated choices (e.g., Banana, Apple, Grape)"
            value={actChoices}
            onChange={(e) => setActChoices(e.target.value)}
          />
          <div className="space-y-1">
            <label htmlFor="correct_idx" className="text-xs font-bold">
              Correct Choice Index (0 = first)
            </label>
            <Input
              id="correct_idx"
              type="number"
              min={0}
              max={3}
              value={actCorrect}
              onChange={(e) => setActCorrect(Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setActivityLesson(null)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={savingAct}
              className="w-full sm:w-auto"
            >
              {savingAct ? "Saving..." : "Add Question"}
            </Button>
          </div>
        </form>
      </Dialog>
    </PortalShell>
  );
}

export default function TeacherLessonsPage() {
  return (
    <ProtectedRoute allowedRoles={["teacher", "admin"]}>
      <TeacherLessonsContent />
    </ProtectedRoute>
  );
}
