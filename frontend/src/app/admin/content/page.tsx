"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Archive,
  BookOpen,
  Database,
  HardDrive,
  Layers,
  Plus,
  Trash2,
  Volume2,
} from "lucide-react";
import { formatAgeGroupLabel, formatShortDate } from "@/lib/utils";
import {
  adminCreateSubjectSchema,
  type AdminCreateSubjectFormValues,
} from "@/lib/validation";
import { adminApi, ApiError } from "@/services/api";
import { AnimalAudioAuditPanel } from "@/components/admin/AnimalAudioAuditPanel";
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
  AdminStorageItem,
  AdminStorageOverview,
  AdminSubject,
  Lesson,
  Theme,
} from "@/types";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function AdminContentStoragePageContent() {
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [storage, setStorage] = useState<AdminStorageOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AdminCreateSubjectFormValues>({
    resolver: zodResolver(adminCreateSubjectSchema),
    defaultValues: {
      name: "",
      description: "",
      icon_key: "book-open",
      color_hex: "#78C8F5",
      sort_order: 7,
    },
  });

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [subj, content, st] = await Promise.all([
        adminApi.subjects(),
        adminApi.content(),
        adminApi.storage(),
      ]);
      setSubjects(subj);
      setLessons(content.lessons);
      setThemes(content.themes);
      setStorage(st);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not load curriculum and storage overview."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function onCreateSubject(values: AdminCreateSubjectFormValues) {
    setError(null);
    setToast(null);
    try {
      const created = await adminApi.createSubject({
        name: values.name,
        description: values.description,
        icon_key: values.icon_key,
        color_hex: values.color_hex,
        sort_order: values.sort_order,
        is_active: true,
      });
      reset({
        name: "",
        description: "",
        icon_key: "book-open",
        color_hex: "#78C8F5",
        sort_order: subjects.length + 1,
      });
      setSubjects((prev) =>
        [...prev, created].sort((a, b) => a.sort_order - b.sort_order)
      );
      setToast(`Added learning module "${created.name}".`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not create subject."
      );
    }
  }

  async function handleToggleSubject(subject: AdminSubject) {
    setBusyId(subject.id);
    setError(null);
    setToast(null);
    try {
      const updated = await adminApi.updateSubject(subject.id, {
        is_active: !subject.is_active,
      });
      setSubjects((prev) =>
        prev.map((s) => (s.id === subject.id ? updated : s))
      );
      setToast(
        `${subject.name} marked ${!subject.is_active ? "active" : "hidden"}.`
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not update subject."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleLessonStatusChange(
    lessonId: string,
    status: "draft" | "published" | "archived"
  ) {
    setBusyId(lessonId);
    setError(null);
    setToast(null);
    try {
      const updated = await adminApi.updateLessonStatus(lessonId, status);
      setLessons((prev) =>
        prev.map((l) => (l.id === lessonId ? updated : l))
      );
      setToast(`Lesson status changed to ${status}.`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not update lesson status."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleThemeStatusChange(
    themeId: string,
    status: "draft" | "published" | "archived"
  ) {
    setBusyId(themeId);
    setError(null);
    setToast(null);
    try {
      const updated = await adminApi.updateThemeStatus(themeId, status);
      setThemes((prev) =>
        prev.map((t) => (t.id === themeId ? updated : t))
      );
      setToast(`Weekly theme status changed to ${status}.`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not update theme status."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteStorageItem(item: AdminStorageItem) {
    const key = `${item.item_type}:${item.id}`;
    if (confirmDeleteKey !== key) {
      setConfirmDeleteKey(key);
      return;
    }

    setBusyId(item.id);
    setError(null);
    setToast(null);
    try {
      await adminApi.deleteStorageItem(item.item_type, item.id);
      setConfirmDeleteKey(null);
      setStorage((prev) =>
        prev
          ? {
              ...prev,
              total_items: Math.max(0, prev.total_items - 1),
              total_bytes: Math.max(0, prev.total_bytes - item.file_size_bytes),
              items: prev.items.filter(
                (i) => !(i.id === item.id && i.item_type === item.item_type)
              ),
            }
          : prev
      );
      setToast(`Removed "${item.title}" from cloud storage.`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not remove stored media item."
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PortalShell
      title="Subjects, Content & Cloud Storage"
      subtitle="Manage kindergarten learning modules, govern lesson visibility, and inspect uploaded cloud media."
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

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          {/* Create Subject & Subject Directory */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-[#175B82]" />
                Curriculum Learning Modules ({subjects.length})
              </CardTitle>
              <CardDescription>
                Add new early learning subjects or toggle visibility for young learners.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form
                onSubmit={handleSubmit(onCreateSubject)}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-start rounded-3xl bg-[#FFF9F0] p-4 border border-[#24334D]/8"
              >
                <div className="lg:col-span-1">
                  <label className="text-xs font-bold block mb-1">Module Name</label>
                  <Input placeholder="Music & Rhythm" {...register("name")} />
                  {errors.name && (
                    <p className="text-xs text-[#A32E24] mt-1">
                      {errors.name.message}
                    </p>
                  )}
                </div>
                <div className="lg:col-span-2">
                  <label className="text-xs font-bold block mb-1">
                    Description
                  </label>
                  <Input
                    placeholder="Gentle songs and rhythm clapping..."
                    {...register("description")}
                  />
                  {errors.description && (
                    <p className="text-xs text-[#A32E24] mt-1">
                      {errors.description.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Icon Key</label>
                  <Input placeholder="music" {...register("icon_key")} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold block mb-1">Color</label>
                    <Input placeholder="#B8A5F5" {...register("color_hex")} />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">Order</label>
                    <Input type="number" {...register("sort_order")} />
                  </div>
                </div>
                <div className="pt-1 lg:pt-5 sm:col-span-2 lg:col-span-1">
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={isSubmitting}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4" />
                    Add Module
                  </Button>
                </div>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {subjects.map((subj) => (
                  <div
                    key={subj.id}
                    className="rounded-3xl border border-[#24334D]/10 bg-white p-4 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-4 w-4 rounded-full border border-[#24334D]/15"
                            style={{ backgroundColor: subj.color_hex }}
                          />
                          <h3 className="font-display font-bold text-[#24334D]">
                            {subj.name}
                          </h3>
                        </div>
                        <Badge variant={subj.is_active ? "mint" : "neutral"}>
                          {subj.is_active ? "Active" : "Hidden"}
                        </Badge>
                      </div>
                      <p className="text-xs text-[#24334D]/70 mt-2">
                        {subj.description}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-[#24334D]/8 text-xs">
                      <span className="font-bold text-[#24334D]/65">
                        {subj.lesson_count} lessons • {subj.game_count} games
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === subj.id}
                        onClick={() => handleToggleSubject(subj)}
                      >
                        {subj.is_active ? "Hide" : "Activate"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Content Governance: Lessons & Themes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-[#166041] shrink-0" />
                  <span>Lesson Publication Control ({lessons.length})</span>
                </CardTitle>
                <CardDescription>
                  Publish, draft, or archive kindergarten lessons school-wide.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5 max-h-80 sm:max-h-96 overflow-y-auto scrollbar-subtle">
                {lessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-2xl bg-[#FFF9F0] px-4 py-3 border border-[#24334D]/8"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">
                        {lesson.title}
                      </p>
                      <p className="text-xs text-[#24334D]/60">
                        {formatAgeGroupLabel(lesson.age_group)} •{" "}
                        {lesson.estimated_minutes} min
                      </p>
                    </div>
                    <select
                      aria-label={`Status for ${lesson.title}`}
                      value={lesson.status}
                      disabled={busyId === lesson.id}
                      onChange={(e) =>
                        handleLessonStatusChange(
                          lesson.id,
                          e.target.value as "draft" | "published" | "archived"
                        )
                      }
                      className="h-10 w-full sm:w-auto rounded-xl border border-[#24334D]/15 bg-white px-2.5 text-xs font-bold shrink-0"
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Archive className="h-5 w-5 text-[#9A7100] shrink-0" />
                  <span>Weekly Learning Themes ({themes.length})</span>
                </CardTitle>
                <CardDescription>
                  Control visibility for weekly family themes and home guides.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5 max-h-80 sm:max-h-96 overflow-y-auto scrollbar-subtle">
                {themes.map((theme) => (
                  <div
                    key={theme.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-2xl bg-[#FFF9F0] px-4 py-3 border border-[#24334D]/8"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">
                        Week {theme.week_number}: {theme.title}
                      </p>
                      <p className="text-xs text-[#24334D]/60 truncate">
                        {theme.summary}
                      </p>
                    </div>
                    <select
                      aria-label={`Status for Week ${theme.week_number}`}
                      value={theme.status}
                      disabled={busyId === theme.id}
                      onChange={(e) =>
                        handleThemeStatusChange(
                          theme.id,
                          e.target.value as "draft" | "published" | "archived"
                        )
                      }
                      className="h-10 w-full sm:w-auto rounded-xl border border-[#24334D]/15 bg-white px-2.5 text-xs font-bold shrink-0"
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Cloud Storage Overview */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5 text-[#4C328B] shrink-0" />
                    <span>Cloud Storage &amp; Uploaded Media</span>
                  </CardTitle>
                  <CardDescription>
                    Opaque asset keys protect child privacy while allowing safe cleanup.
                  </CardDescription>
                </div>
                {storage && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="sky">
                      <Database className="h-3.5 w-3.5" />
                      Backend: {storage.storage_backend}
                    </Badge>
                    <Badge variant="mint">
                      {storage.total_items} files • {formatBytes(storage.total_bytes)}
                    </Badge>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!storage || storage.items.length === 0 ? (
                <p className="text-sm text-[#24334D]/65 py-6 text-center">
                  No uploaded lesson media or saved artworks in storage yet.
                </p>
              ) : (
                <>
                  {/* Mobile Stacked Cards */}
                  <div className="md:hidden space-y-3">
                    {storage.items.map((item) => {
                      const key = `${item.item_type}:${item.id}`;
                      const confirming = confirmDeleteKey === key;
                      return (
                        <div
                          key={key}
                          className="rounded-2xl bg-[#FFF9F0] p-4 border border-[#24334D]/10 space-y-2.5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-[#24334D] break-words">
                                {item.title}
                              </p>
                              <p className="text-xs text-[#24334D]/65">
                                {item.parent_label}
                              </p>
                            </div>
                            <Badge
                              variant={
                                item.item_type === "child_artwork"
                                  ? "lavender"
                                  : "sky"
                              }
                              className="shrink-0"
                            >
                              {item.item_type === "child_artwork"
                                ? "Artwork"
                                : "Lesson Media"}
                            </Badge>
                          </div>

                          <div className="text-xs text-[#24334D]/70 space-y-1">
                            <p>
                              {item.mime_type} • {formatBytes(item.file_size_bytes)} •{" "}
                              {formatShortDate(item.created_at)}
                            </p>
                            <p className="font-mono text-[11px] text-[#24334D]/60 truncate">
                              {item.storage_key}
                            </p>
                          </div>

                          <div className="pt-1">
                            {confirming ? (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="coral"
                                  disabled={busyId === item.id}
                                  onClick={() => handleDeleteStorageItem(item)}
                                  className="flex-1"
                                >
                                  Confirm
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setConfirmDeleteKey(null)}
                                  className="flex-1"
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setConfirmDeleteKey(key)}
                                className="w-full"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Remove
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tablet / Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full min-w-[700px] text-sm text-left">
                      <thead>
                        <tr className="border-b border-[#24334D]/10 text-xs uppercase text-[#24334D]/60">
                          <th className="py-3 pr-4">Title</th>
                          <th className="py-3 pr-4">Type</th>
                          <th className="py-3 pr-4">Source</th>
                          <th className="py-3 pr-4">MIME / Size</th>
                          <th className="py-3 pr-4">Storage Key</th>
                          <th className="py-3 pr-4">Uploaded</th>
                          <th className="py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {storage.items.map((item) => {
                          const key = `${item.item_type}:${item.id}`;
                          const confirming = confirmDeleteKey === key;
                          return (
                            <tr
                              key={key}
                              className="border-b border-[#24334D]/6 last:border-none"
                            >
                              <td className="py-3 pr-4 font-bold">{item.title}</td>
                              <td className="py-3 pr-4">
                                <Badge
                                  variant={
                                    item.item_type === "child_artwork"
                                      ? "lavender"
                                      : "sky"
                                  }
                                >
                                  {item.item_type === "child_artwork"
                                    ? "Artwork"
                                    : "Lesson Media"}
                                </Badge>
                              </td>
                              <td className="py-3 pr-4 text-xs text-[#24334D]/75">
                                {item.parent_label}
                              </td>
                              <td className="py-3 pr-4 text-xs text-[#24334D]/75">
                                {item.mime_type} • {formatBytes(item.file_size_bytes)}
                              </td>
                              <td className="py-3 pr-4 text-xs font-mono text-[#24334D]/60 max-w-[180px] truncate">
                                {item.storage_key}
                              </td>
                              <td className="py-3 pr-4 text-xs text-[#24334D]/60">
                                {formatShortDate(item.created_at)}
                              </td>
                              <td className="py-3 text-right whitespace-nowrap">
                                {confirming ? (
                                  <div className="inline-flex items-center gap-1.5">
                                    <Button
                                      size="sm"
                                      variant="coral"
                                      disabled={busyId === item.id}
                                      onClick={() => handleDeleteStorageItem(item)}
                                    >
                                      Confirm
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setConfirmDeleteKey(null)}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setConfirmDeleteKey(key)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Remove
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-[#24334D]/65">
                Pre-publish Audio QA Workflow
              </p>
              <Link href="/admin/audio-audit">
                <Button variant="outline" size="sm">
                  <Volume2 className="h-4 w-4" />
                  Open Full Audio QA Studio
                </Button>
              </Link>
            </div>
            <AnimalAudioAuditPanel />
          </div>
        </>
      )}
    </PortalShell>
  );
}

export default function AdminContentPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminContentStoragePageContent />
    </ProtectedRoute>
  );
}
