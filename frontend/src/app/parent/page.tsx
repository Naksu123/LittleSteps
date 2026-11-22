"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  Baby,
  Bell,
  BookOpen,
  CheckCheck,
  CheckCircle2,
  Clock,
  FileText,
  Flame,
  Home,
  Pencil,
  Plus,
  Settings,
  Sparkles,
  Star,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatShortDate } from "@/lib/utils";
import {
  addChildSchema,
  editChildSchema,
  type AddChildFormValues,
  type EditChildFormValues,
} from "@/lib/validation";
import { ApiError, childrenApi, parentApi } from "@/services/api";
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
  NotificationList,
  ParentDashboardData,
  ParentHomeLearningTheme,
  WeeklyReport,
} from "@/types";

const ADD_CHILD_DRAFT_KEY = "littlesteps_add_child_draft";

function ParentPortalContent() {
  const router = useRouter();
  const { activeChildId, setActiveChildId, refreshUser, isLoading: authLoading, isAuthenticated } = useAuth();
  const [dashboard, setDashboard] = useState<ParentDashboardData | null>(null);
  const [homeThemes, setHomeThemes] = useState<ParentHomeLearningTheme[]>([]);
  const [notifList, setNotifList] = useState<NotificationList | null>(null);
  const [childReport, setChildReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const submittingChildRef = useRef(false);

  const loadParentData = useCallback(async () => {
    if (authLoading || !isAuthenticated) return;
    if (!hasLoadedRef.current) {
      setLoading(true);
    }
    setError(null);
    try {
      const [dash, notifs] = await Promise.all([
        parentApi.dashboard(),
        parentApi.notifications(),
      ]);
      hasLoadedRef.current = true;
      setDashboard(dash);
      setNotifList(notifs);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not load parent dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      void loadParentData();
    }
  }, [authLoading, isAuthenticated, loadParentData]);

  const childItems = dashboard?.children || [];
  const activeItem =
    childItems.find((c) => c.child.id === activeChildId) || childItems[0] || null;
  const currentChildId = activeItem?.child.id;
  const targetChildId = currentChildId || activeChildId || null;

  const loadChildSpecific = useCallback(async (cid: string) => {
    try {
      const [home, rep] = await Promise.all([
        parentApi.homeLearning(cid),
        parentApi.report(cid),
      ]);
      setHomeThemes(home);
      setChildReport(rep);
    } catch {
      // Keep page resilient on secondary load
    }
  }, []);

  useEffect(() => {
    if (targetChildId) {
      void loadChildSpecific(targetChildId);
    }
  }, [targetChildId, loadChildSpecific]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddChildFormValues>({
    resolver: zodResolver(addChildSchema),
    defaultValues: {
      display_name: "",
      birth_year: 2021,
      age_group: "4-5",
      avatar_key: "bunny",
      favorite_color: "#78C8F5",
      daily_goal_minutes: 20,
    },
  });

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    formState: { errors: editErrors, isSubmitting: isEditing },
  } = useForm<EditChildFormValues>({
    resolver: zodResolver(editChildSchema),
  });

  function openEditModal() {
    if (!activeItem) return;
    resetEdit({
      display_name: activeItem.child.display_name,
      age_group: (activeItem.child.age_group as "4-5" | "5-6" | "4-6") || "4-5",
      avatar_key: activeItem.child.avatar_key,
      favorite_color: activeItem.child.favorite_color,
      daily_goal_minutes: activeItem.child.daily_goal_minutes ?? 20,
    });
    setEditError(null);
    setEditOpen(true);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedDraft = window.sessionStorage.getItem(ADD_CHILD_DRAFT_KEY);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft) as Partial<AddChildFormValues>;
        reset({
          display_name: parsed.display_name || "",
          birth_year: parsed.birth_year || 2021,
          age_group: parsed.age_group || "4-5",
          avatar_key: parsed.avatar_key || "bunny",
          favorite_color: parsed.favorite_color || "#78C8F5",
          daily_goal_minutes: parsed.daily_goal_minutes || 20,
        });
        setAddOpen(true);
      }
    } catch {
      // Ignore draft parse errors
    }
  }, [reset]);

  async function handleAddChild(values: AddChildFormValues) {
    if (submittingChildRef.current) return;
    submittingChildRef.current = true;
    setAddError(null);

    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(ADD_CHILD_DRAFT_KEY, JSON.stringify(values));
      } catch {
        // Ignore sessionStorage errors
      }
    }

    try {
      const created = await childrenApi.create(values);
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.removeItem(ADD_CHILD_DRAFT_KEY);
        } catch {
          // Ignore sessionStorage errors
        }
      }
      setActiveChildId(created.id);
      reset({
        display_name: "",
        birth_year: 2021,
        age_group: "4-5",
        avatar_key: "bunny",
        favorite_color: "#78C8F5",
        daily_goal_minutes: 20,
      });
      setAddOpen(false);
      setActionToast(`Added ${created.display_name}'s learner profile!`);
      await Promise.all([refreshUser(), loadParentData()]);
    } catch (err) {
      setAddError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong while saving the profile. Please try again."
      );
    } finally {
      submittingChildRef.current = false;
    }
  }

  async function handleEditChild(values: EditChildFormValues) {
    if (!activeItem) return;
    setEditError(null);
    try {
      await childrenApi.update(activeItem.child.id, values);
      setEditOpen(false);
      await Promise.all([refreshUser(), loadParentData()]);
    } catch (err) {
      setEditError(
        err instanceof ApiError ? err.message : "Could not update learner profile."
      );
    }
  }

  async function handleToggleHomeActivity(homeActivityId: string, nextVal: boolean) {
    if (!activeItem) return;
    setTogglingId(homeActivityId);
    setActionToast(null);
    try {
      const res = await parentApi.toggleHomeActivity(homeActivityId, {
        child_id: activeItem.child.id,
        completed: nextVal,
      });
      if (res.stars_awarded > 0) {
        setActionToast(
          `Awesome family time! ${activeItem.child.display_name} earned +${res.stars_awarded} ⭐!`
        );
      }
      await Promise.all([
        loadChildSpecific(activeItem.child.id),
        loadParentData(),
        refreshUser(),
      ]);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not update activity status."
      );
    } finally {
      setTogglingId(null);
    }
  }

  async function handleMarkRead(notifId: string) {
    try {
      await parentApi.markNotificationRead(notifId);
      const updated = await parentApi.notifications();
      setNotifList(updated);
    } catch {
      // ignore transient error
    }
  }

  async function handleMarkAllRead() {
    try {
      await parentApi.markAllNotificationsRead();
      const updated = await parentApi.notifications();
      setNotifList(updated);
    } catch {
      // ignore
    }
  }

  const featuredHome = homeThemes[0];
  const featuredActivity = featuredHome?.home_activities[0];

  function launchKidsMode(childId: string) {
    setActiveChildId(childId);
    router.push("/kids");
  }

  return (
    <PortalShell
      title="Parent & Guardian Portal"
      subtitle="Follow your child's playful milestones and guide learning together at home."
    >
      {error && (
        <Alert tone="warning" title="Unable to Load">
          {error}
        </Alert>
      )}
      {actionToast && (
        <Alert tone="success" title="Celebration">
          {actionToast}
        </Alert>
      )}

      {/* Quick Hub Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Link href="/parent/home-learning" className="min-w-0">
          <Card className="h-full hover:border-[#FF9C8C] transition-colors cursor-pointer bg-[#FFE3DE]/35">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Home className="h-5 w-5 text-[#8E3022] shrink-0" />
                <div className="min-w-0">
                  <p className="font-display font-bold text-sm truncate">
                    12-Week Home Learning Hub
                  </p>
                  <p className="text-xs text-[#24334D]/65 truncate">
                    Guides, materials & reflections
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-[#24334D]/60 shrink-0" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/parent/reports" className="min-w-0">
          <Card className="h-full hover:border-[#78C8F5] transition-colors cursor-pointer bg-[#DCF2FD]/45">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-5 w-5 text-[#175B82] shrink-0" />
                <div className="min-w-0">
                  <p className="font-display font-bold text-sm truncate">
                    Weekly Learning Reports
                  </p>
                  <p className="text-xs text-[#24334D]/65 truncate">
                    Printable & downloadable summaries
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-[#24334D]/60 shrink-0" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/parent/settings" className="min-w-0 sm:col-span-2 lg:col-span-1">
          <Card className="h-full hover:border-[#9BE7C4] transition-colors cursor-pointer bg-[#DDF8EC]/45">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Settings className="h-5 w-5 text-[#166041] shrink-0" />
                <div className="min-w-0">
                  <p className="font-display font-bold text-sm truncate">
                    Goals & Screen Time
                  </p>
                  <p className="text-xs text-[#24334D]/65 truncate">
                    Manage schedules & family limits
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-[#24334D]/60 shrink-0" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Child Switcher + Actions */}
      <div className="flex flex-col md:flex-row md:flex-wrap md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {childItems.map((item) => {
            const selected = activeItem?.child.id === item.child.id;
            return (
              <button
                key={item.child.id}
                type="button"
                onClick={() => setActiveChildId(item.child.id)}
                className={`inline-flex items-center gap-2 rounded-2xl min-h-11 px-3.5 sm:px-4 py-1.5 text-sm font-bold transition-all cursor-pointer ${
                  selected
                    ? "bg-[#24334D] text-white shadow-sm"
                    : "bg-white text-[#24334D] border border-[#24334D]/12 hover:bg-[#DCF2FD]"
                }`}
              >
                <ChildAvatar
                  avatarKey={item.child.avatar_key}
                  colorHex={item.child.favorite_color}
                  size="sm"
                />
                <span>
                  {item.child.display_name} ({item.child.age_group})
                </span>
              </button>
            );
          })}
          <Button variant="outline" size="md" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Child
          </Button>
          {activeItem && (
            <Button variant="ghost" size="md" onClick={openEditModal}>
              <Pencil className="h-4 w-4" />
              Edit Profile
            </Button>
          )}
        </div>

        {activeItem && (
          <Button
            variant="kids"
            size="md"
            onClick={() => launchKidsMode(activeItem.child.id)}
            className="w-full sm:w-auto"
          >
            <Baby className="h-5 w-5 shrink-0" />
            <span className="truncate">
              Launch Kids Mode for {activeItem.child.display_name}
            </span>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : !activeItem ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <h2 className="font-display text-2xl font-bold">
              Add Your First Kindergarten Learner
            </h2>
            <p className="text-sm text-[#24334D]/75 max-w-md mx-auto">
              Only a first name or nickname, birth year, and avatar are needed—no
              unnecessary personal information is ever collected.
            </p>
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Create Learner Profile
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Metrics */}
          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardContent className="p-4 sm:p-5 flex items-center gap-3">
                <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-[#FFF5CF] flex items-center justify-center shrink-0">
                  <Star className="h-5 w-5 sm:h-6 sm:w-6 text-[#9A7100]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#24334D]/60">Total Stars</p>
                  <p className="font-display text-xl sm:text-2xl font-bold">
                    {activeItem.child.total_stars}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-5 flex items-center gap-3">
                <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-[#DDF8EC] flex items-center justify-center shrink-0">
                  <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-[#166041]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#24334D]/60">
                    Lessons Done
                  </p>
                  <p className="font-display text-xl sm:text-2xl font-bold">
                    {activeItem.lessons_completed} / {activeItem.total_lessons}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-5 flex items-center gap-3">
                <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-[#DCF2FD] flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-[#175B82]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#24334D]/60">
                    Learning Time
                  </p>
                  <p className="font-display text-xl sm:text-2xl font-bold">
                    {activeItem.total_time_minutes} min
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-5 flex items-center gap-3">
                <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-[#FFE3DE] flex items-center justify-center shrink-0">
                  <Flame className="h-5 w-5 sm:h-6 sm:w-6 text-[#8E3022]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#24334D]/60">
                    Joyful Streak
                  </p>
                  <p className="font-display text-xl sm:text-2xl font-bold">
                    {activeItem.child.streak_days} days
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            {/* Weekly Learning Minutes Chart */}
            <Card className="lg:col-span-7">
              <CardHeader>
                <CardTitle>Weekly Learning Rhythm</CardTitle>
                <CardDescription>
                  Minutes spent exploring lessons and games over the past 7 days.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-56 sm:h-64 lg:h-72 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={activeItem.weekly_activity}
                    margin={{ top: 8, right: 8, left: -12, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#24334D14" />
                    <XAxis dataKey="day" tick={{ fill: "#24334D", fontSize: 11 }} />
                    <YAxis width={36} tick={{ fill: "#24334D", fontSize: 11 }} />
                    <Tooltip />
                    <Bar
                      dataKey="minutes"
                      name="Minutes"
                      fill="#78C8F5"
                      radius={[10, 10, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Strengths & Skills */}
            <Card className="lg:col-span-5">
              <CardHeader>
                <CardTitle>Confidence & Skills Practiced</CardTitle>
                <CardDescription>
                  Individual growth highlights without peer comparisons.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeItem.skills.length > 0 ? (
                  activeItem.skills.map((skill) => (
                    <div key={skill.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm font-bold">
                        <span>{skill.skill_name}</span>
                        <span className="text-[#175B82]">{skill.mastery_pct}%</span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-[#24334D]/8 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#9BE7C4]"
                          style={{ width: `${skill.mastery_pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-[#24334D]/60">
                        {skill.subject_name} · Practiced {skill.practice_count} times
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#24334D]/70">
                    Skills practiced will appear as {activeItem.child.display_name}{" "}
                    explores lessons!
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Featured Home Learning Hub */}
          {featuredHome && (
            <Card className="border-2 border-[#FF9C8C]/40 bg-gradient-to-br from-white to-[#FFE3DE]/25">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="coral">
                    <Home className="h-3.5 w-3.5" />
                    Home Learning Hub · Week {featuredHome.theme.week_number}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Badge variant="mint">
                      {featuredHome.parent_guide?.estimated_duration_mins ?? 15}{" "}
                      mins · Screen-Free
                    </Badge>
                    <Link href="/parent/home-learning">
                      <Button variant="outline" size="sm">
                        Explore All 12 Weeks
                      </Button>
                    </Link>
                  </div>
                </div>
                <CardTitle className="text-2xl pt-1">
                  {featuredHome.theme.title}
                </CardTitle>
                <CardDescription>
                  {featuredHome.parent_guide?.what_child_learns}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-display text-base font-semibold">
                    What You Need at Home
                  </h4>
                  <ul className="flex flex-wrap gap-2">
                    {(featuredHome.parent_guide?.materials_needed_json ?? []).map(
                      (mat) => (
                        <li
                          key={mat}
                          className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold border border-[#24334D]/10"
                        >
                          {mat}
                        </li>
                      )
                    )}
                  </ul>
                  <div className="rounded-2xl bg-[#FFF5CF]/70 p-4 text-sm">
                    <p className="font-bold text-[#785700] inline-flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4" /> Learning Tip
                    </p>
                    <p className="mt-1 text-[#24334D]/85">
                      {featuredHome.parent_guide?.learning_tip}
                    </p>
                  </div>
                </div>

                {featuredActivity && (
                  <div className="space-y-3 rounded-2xl bg-white p-5 border border-[#24334D]/8">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-display text-lg font-semibold">
                        {featuredActivity.title}
                      </h4>
                      <Button
                        type="button"
                        size="sm"
                        variant={featuredActivity.completed ? "mint" : "secondary"}
                        disabled={togglingId === featuredActivity.id}
                        onClick={() =>
                          handleToggleHomeActivity(
                            featuredActivity.id,
                            !featuredActivity.completed
                          )
                        }
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {featuredActivity.completed
                          ? "Completed ✓"
                          : "Mark Completed"}
                      </Button>
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 text-sm text-[#24334D]/85">
                      {featuredActivity.instructions_json.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Assigned Activities + Notifications + Announcements */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-[#78C8F5]" />
                    Notifications
                    {notifList && notifList.unread_count > 0 && (
                      <Badge variant="coral">{notifList.unread_count} new</Badge>
                    )}
                  </CardTitle>
                  {notifList && notifList.unread_count > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleMarkAllRead}
                    >
                      <CheckCheck className="h-4 w-4" />
                      Mark All Read
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {notifList?.items.length ? (
                  notifList.items.slice(0, 6).map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        if (!n.is_read) void handleMarkRead(n.id);
                      }}
                      className={`w-full text-left rounded-2xl p-3.5 border transition-colors cursor-pointer ${
                        n.is_read
                          ? "bg-[#FFF9F0]/60 border-[#24334D]/8 opacity-75"
                          : "bg-[#DCF2FD]/45 border-[#78C8F5]/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-sm">{n.title}</p>
                        {!n.is_read && <Badge variant="sky">New</Badge>}
                      </div>
                      <p className="text-xs text-[#24334D]/75 mt-1">
                        {n.message}
                      </p>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-[#24334D]/65">
                    You&apos;re all caught up!
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Assigned Activities & Teacher Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {childReport?.assigned_activities.length ? (
                  childReport.assigned_activities.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-2xl bg-[#FFF9F0] p-3.5 border border-[#24334D]/8 flex items-center justify-between gap-2"
                    >
                      <div>
                        <p className="font-bold text-sm">{a.title}</p>
                        {a.due_date && (
                          <p className="text-xs text-[#24334D]/60">
                            Suggested by {formatShortDate(a.due_date)}
                          </p>
                        )}
                      </div>
                      <Badge variant={a.completed ? "mint" : "sunshine"}>
                        {a.completed ? "Completed" : "Upcoming"}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#24334D]/65">
                    No teacher assignments yet.
                  </p>
                )}

                {dashboard?.announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className="rounded-2xl bg-[#DDF8EC]/40 p-3.5 border border-[#9BE7C4]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-sm">{ann.title}</p>
                      <span className="text-xs text-[#24334D]/60">
                        {formatShortDate(ann.published_at)}
                      </span>
                    </div>
                    <p className="text-xs text-[#24334D]/80 mt-1">{ann.body}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Add Child Dialog */}
      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Child Learner Profile"
        description="Only a nickname or first name and avatar are collected to protect child privacy."
      >
        <form onSubmit={handleSubmit(handleAddChild)} className="space-y-4">
          {addError && <Alert tone="warning">{addError}</Alert>}
          <div className="space-y-1">
            <label htmlFor="display_name" className="text-sm font-bold">
              First Name / Nickname
            </label>
            <Input
              id="display_name"
              placeholder="Lucas"
              {...register("display_name")}
            />
            {errors.display_name && (
              <p className="text-xs font-bold text-[#8E3022]">
                {errors.display_name.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="birth_year" className="text-sm font-bold">
                Birth Year
              </label>
              <Input
                id="birth_year"
                type="number"
                {...register("birth_year")}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="age_group" className="text-sm font-bold">
                Age Group
              </label>
              <select
                id="age_group"
                className="h-11 w-full rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-sm font-semibold"
                {...register("age_group")}
              >
                <option value="4-5">Ages 4–5</option>
                <option value="5-6">Ages 5–6</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="avatar_key" className="text-sm font-bold">
                Avatar Friend
              </label>
              <select
                id="avatar_key"
                className="h-11 w-full rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-sm font-semibold"
                {...register("avatar_key")}
              >
                <option value="bunny">🐰 Bunny</option>
                <option value="dino">🦕 Dino</option>
                <option value="fox">🦊 Fox</option>
                <option value="bear">🐻 Bear</option>
                <option value="owl">🦉 Owl</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="daily_goal_minutes" className="text-sm font-bold">
                Daily Goal (mins)
              </label>
              <Input
                id="daily_goal_minutes"
                type="number"
                {...register("daily_goal_minutes")}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAddOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Child Dialog */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Learner Profile"
        description="Update nickname, avatar, age group, or daily learning goal."
      >
        <form onSubmit={handleEditSubmit(handleEditChild)} className="space-y-4">
          {editError && <Alert tone="warning">{editError}</Alert>}
          <div className="space-y-1">
            <label htmlFor="edit_display_name" className="text-sm font-bold">
              First Name / Nickname
            </label>
            <Input
              id="edit_display_name"
              {...registerEdit("display_name")}
            />
            {editErrors.display_name && (
              <p className="text-xs font-bold text-[#8E3022]">
                {editErrors.display_name.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="edit_age_group" className="text-sm font-bold">
                Age Group
              </label>
              <select
                id="edit_age_group"
                className="h-11 w-full rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-sm font-semibold"
                {...registerEdit("age_group")}
              >
                <option value="4-5">Ages 4–5</option>
                <option value="5-6">Ages 5–6</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="edit_avatar_key" className="text-sm font-bold">
                Avatar Friend
              </label>
              <select
                id="edit_avatar_key"
                className="h-11 w-full rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-sm font-semibold"
                {...registerEdit("avatar_key")}
              >
                <option value="bunny">🐰 Bunny</option>
                <option value="dino">🦕 Dino</option>
                <option value="fox">🦊 Fox</option>
                <option value="bear">🐻 Bear</option>
                <option value="owl">🦉 Owl</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="edit_daily_goal" className="text-sm font-bold">
              Daily Goal (minutes)
            </label>
            <Input
              id="edit_daily_goal"
              type="number"
              {...registerEdit("daily_goal_minutes")}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isEditing}
              className="w-full sm:w-auto"
            >
              {isEditing ? "Saving..." : "Update Profile"}
            </Button>
          </div>
        </form>
      </Dialog>
    </PortalShell>
  );
}

export default function ParentPage() {
  return (
    <ProtectedRoute allowedRoles={["parent", "admin"]}>
      <ParentPortalContent />
    </ProtectedRoute>
  );
}
