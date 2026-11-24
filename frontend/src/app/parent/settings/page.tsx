"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Palette, Pause, Play, Plus, ShieldCheck, Target, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  learningGoalSchema,
  parentSettingsSchema,
  type LearningGoalFormValues,
  type ParentSettingsFormValues,
} from "@/lib/validation";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { LearningGoal } from "@/types";

function ParentSettingsContent() {
  const { childrenList, activeChildId, setActiveChildId, refreshUser } = useAuth();
  const activeChild =
    childrenList.find((c) => c.id === activeChildId) || childrenList[0] || null;

  const [goals, setGoals] = useState<LearningGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const {
    register: regGoal,
    handleSubmit: handleGoalSubmit,
    reset: resetGoal,
    formState: { errors: goalErrors, isSubmitting: savingGoal },
  } = useForm<LearningGoalFormValues>({
    resolver: zodResolver(learningGoalSchema),
    defaultValues: {
      title: "",
      target_minutes_per_day: 20,
      target_lessons_per_week: 3,
    },
  });

  const {
    register: regSettings,
    handleSubmit: handleSettingsSubmit,
    reset: resetSettings,
    formState: { errors: settingsErrors, isSubmitting: savingSettings },
  } = useForm<ParentSettingsFormValues>({
    resolver: zodResolver(parentSettingsSchema),
    defaultValues: {
      preferred_language: "en",
      daily_screen_limit_mins: 30,
      notifications_enabled: true,
    },
  });

  const loadData = useCallback(
    async (cid?: string) => {
      setLoading(true);
      setError(null);
      try {
        const [goalsData, settingsData] = await Promise.all([
          parentApi.goals(cid),
          parentApi.settings(),
        ]);
        setGoals(goalsData);
        resetSettings({
          preferred_language:
            settingsData.preferred_language === "fil" ? "fil" : "en",
          daily_screen_limit_mins: settingsData.daily_screen_limit_mins,
          notifications_enabled: settingsData.notifications_enabled,
        });
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : "Could not load goals & settings."
        );
      } finally {
        setLoading(false);
      }
    },
    [resetSettings]
  );

  useEffect(() => {
    void loadData(activeChild?.id);
  }, [activeChild?.id, loadData]);

  async function onCreateGoal(values: LearningGoalFormValues) {
    if (!activeChild) return;
    setError(null);
    setToast(null);
    try {
      const created = await parentApi.createGoal({
        child_id: activeChild.id,
        title: values.title,
        target_minutes_per_day: values.target_minutes_per_day,
        target_lessons_per_week: values.target_lessons_per_week,
        is_active: true,
      });
      resetGoal({
        title: "",
        target_minutes_per_day: 20,
        target_lessons_per_week: 3,
      });
      setGoals((prev) => [created, ...prev]);
      setToast("Learning goal added!");
      void refreshUser();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not save learning goal."
      );
    }
  }

  async function toggleGoalActive(goal: LearningGoal) {
    try {
      const updated = await parentApi.updateGoal(goal.id, {
        is_active: !goal.is_active,
      });
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? updated : g)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update goal.");
    }
  }

  async function deleteGoal(goalId: string) {
    try {
      await parentApi.deleteGoal(goalId);
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete goal.");
    }
  }

  async function onSaveSettings(values: ParentSettingsFormValues) {
    setError(null);
    setToast(null);
    try {
      await parentApi.updateSettings(values);
      setToast("Family screen time and notification preferences saved!");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not update settings."
      );
    }
  }

  return (
    <PortalShell
      title="Learning Goals & Screen Time"
      subtitle="Set gentle daily learning goals and manage healthy screen-time schedules."
    >
      {error && <Alert tone="warning">{error}</Alert>}
      {toast && <Alert tone="success">{toast}</Alert>}

      {childrenList.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5">
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
      )}

      {loading ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Learning Goals */}
          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-[#175B82]" />
                {activeChild
                  ? `Learning Goals for ${activeChild.display_name}`
                  : "Learning Goals"}
              </CardTitle>
              <CardDescription>
                Active goals sync directly to your child&apos;s daily target
                minutes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {activeChild ? (
                <form
                  onSubmit={handleGoalSubmit(onCreateGoal)}
                  className="space-y-3 rounded-2xl bg-[#FFF9F0] p-4 border border-[#24334D]/8"
                >
                  <div className="space-y-1">
                    <label htmlFor="goal_title" className="text-sm font-bold">
                      Goal Description
                    </label>
                    <Input
                      id="goal_title"
                      placeholder="e.g., 15 minutes of story & color play daily"
                      {...regGoal("title")}
                    />
                    {goalErrors.title && (
                      <p className="text-xs font-bold text-[#8E3022]">
                        {goalErrors.title.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="goal_mins" className="text-sm font-bold">
                        Minutes / Day
                      </label>
                      <Input
                        id="goal_mins"
                        type="number"
                        {...regGoal("target_minutes_per_day")}
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="goal_lessons" className="text-sm font-bold">
                        Lessons / Week
                      </label>
                      <Input
                        id="goal_lessons"
                        type="number"
                        {...regGoal("target_lessons_per_week")}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={savingGoal}
                    className="w-full sm:w-auto"
                  >
                    <Plus className="h-4 w-4" />
                    {savingGoal ? "Adding..." : "Add Learning Goal"}
                  </Button>
                </form>
              ) : (
                <p className="text-sm text-[#24334D]/65">
                  Add a child profile in the Parent Overview first to create
                  goals.
                </p>
              )}

              <div className="space-y-2.5">
                {goals.length > 0 ? (
                  goals.map((g) => (
                    <div
                      key={g.id}
                      className="rounded-2xl bg-white p-4 border border-[#24334D]/10 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={g.is_active ? "mint" : "neutral"}>
                            {g.is_active ? "Active" : "Paused"}
                          </Badge>
                          <span className="font-bold text-sm">{g.title}</span>
                        </div>
                        <p className="text-xs text-[#24334D]/65">
                          {g.target_minutes_per_day} mins/day ·{" "}
                          {g.target_lessons_per_week} lessons/week
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => toggleGoalActive(g)}
                        >
                          {g.is_active ? (
                            <>
                              <Pause className="h-3.5 w-3.5" /> Pause
                            </>
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5" /> Resume
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete goal ${g.title}`}
                          onClick={() => deleteGoal(g.id)}
                        >
                          <Trash2 className="h-4 w-4 text-[#8E3022]" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#24334D]/65">
                    No goals saved yet for this learner.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Screen Time & Artwork Moderation */}
          <div className="lg:col-span-5 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[#166041]" />
                  Screen Time & Family Preferences
                </CardTitle>
                <CardDescription>
                  Healthy daily limits tailored for Pre-School learners.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handleSettingsSubmit(onSaveSettings)}
                  className="space-y-4"
                >
                  <div className="space-y-1">
                    <label htmlFor="screen_limit" className="text-sm font-bold">
                      Daily Screen Limit (minutes)
                    </label>
                    <Input
                      id="screen_limit"
                      type="number"
                      {...regSettings("daily_screen_limit_mins")}
                    />
                    {settingsErrors.daily_screen_limit_mins && (
                      <p className="text-xs font-bold text-[#8E3022]">
                        {settingsErrors.daily_screen_limit_mins.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="pref_lang" className="text-sm font-bold">
                      Preferred Guide Language
                    </label>
                    <select
                      id="pref_lang"
                      className="h-11 w-full rounded-2xl border-2 border-[#24334D]/12 bg-white px-3 text-sm font-semibold"
                      {...regSettings("preferred_language")}
                    >
                      <option value="en">English</option>
                      <option value="fil">Filipino / Tagalog</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-2.5 text-sm font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded accent-[#24334D]"
                      {...regSettings("notifications_enabled")}
                    />
                    Receive weekly theme & milestone notifications
                  </label>

                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={savingSettings}
                    className="w-full"
                  >
                    {savingSettings ? "Saving..." : "Save Preferences"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-[#FFE3DE]/35 border-2 border-[#FF9C8C]/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Palette className="h-5 w-5 text-[#8E3022]" />
                  Child Artworks & Gallery Controls
                </CardTitle>
                <CardDescription>
                  Review or remove saved drawings created in Kids Art Studio.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/kids/art">
                  <Button variant="coral" size="md">
                    Open Art Gallery
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </PortalShell>
  );
}

export default function ParentSettingsPage() {
  return (
    <ProtectedRoute allowedRoles={["parent", "admin"]}>
      <ParentSettingsContent />
    </ProtectedRoute>
  );
}
