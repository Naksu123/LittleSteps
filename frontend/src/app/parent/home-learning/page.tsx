"use client";

import { useCallback, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  CheckCircle2,
  Clock,
  MessageCircleHeart,
  Printer,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatShortDate } from "@/lib/utils";
import { reflectionSchema, type ReflectionFormValues } from "@/lib/validation";
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
import type { ParentHomeLearningTheme } from "@/types";

function HomeLearningHubContent() {
  const { childrenList, activeChildId, setActiveChildId, refreshUser } = useAuth();
  const activeChild =
    childrenList.find((c) => c.id === activeChildId) || childrenList[0] || null;

  const [themes, setThemes] = useState<ParentHomeLearningTheme[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadHub = useCallback(async (cid?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await parentApi.homeLearning(cid);
      setThemes(data);
      setSelectedThemeId((prev) => prev || data[0]?.theme.id || null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not load Home Learning Hub."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHub(activeChild?.id);
  }, [activeChild?.id, loadHub]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<ReflectionFormValues>({
    resolver: zodResolver(reflectionSchema),
    defaultValues: {
      enjoyed: true,
      easy_concepts: "",
      challenging_concepts: "",
      discovery_notes: "",
    },
  });

  const selectedTheme =
    themes.find((t) => t.theme.id === selectedThemeId) || themes[0] || null;

  async function handleToggle(haId: string, nextCompleted: boolean) {
    if (!activeChild) return;
    setTogglingId(haId);
    setToast(null);
    setError(null);
    try {
      const res = await parentApi.toggleHomeActivity(haId, {
        child_id: activeChild.id,
        completed: nextCompleted,
      });
      if (res.stars_awarded > 0) {
        setToast(
          `Wonderful! ${activeChild.display_name} earned +${res.stars_awarded} ⭐ for completing this home activity!`
        );
      }
      await Promise.all([loadHub(activeChild.id), refreshUser()]);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not update activity."
      );
    } finally {
      setTogglingId(null);
    }
  }

  async function onSubmitReflection(values: ReflectionFormValues) {
    if (!activeChild || !selectedTheme) return;
    setError(null);
    setToast(null);
    try {
      await parentApi.createReflection({
        child_id: activeChild.id,
        theme_id: selectedTheme.theme.id,
        enjoyed: values.enjoyed,
        easy_concepts: values.easy_concepts,
        challenging_concepts: values.challenging_concepts,
        discovery_notes: values.discovery_notes,
      });
      reset({
        enjoyed: true,
        easy_concepts: "",
        challenging_concepts: "",
        discovery_notes: "",
      });
      setToast("Reflection saved and shared with your child's teacher!");
      await loadHub(activeChild.id);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not save reflection."
      );
    }
  }

  const enjoyedVal = watch("enjoyed");

  return (
    <PortalShell
      title="Home Learning Hub"
      subtitle="Simple, play-based, screen-free activities connecting classroom themes with home life."
    >
      {error && <Alert tone="warning">{error}</Alert>}
      {toast && <Alert tone="success">{toast}</Alert>}

      {/* Child Selector */}
      {childrenList.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5 print:hidden">
          {childrenList.map((child) => {
            const selected = activeChild?.id === child.id;
            return (
              <button
                key={child.id}
                type="button"
                onClick={() => setActiveChildId(child.id)}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold cursor-pointer ${
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
        <Skeleton className="h-96 w-full" />
      ) : !selectedTheme ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-[#24334D]/70">
            No weekly home learning themes published yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 12-Week Selector Sidebar */}
          <div className="lg:col-span-4 space-y-2.5 print:hidden">
            <h2 className="font-display text-lg font-bold px-1">
              12 Weekly Themes
            </h2>
            <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1">
              {themes.map((item) => {
                const isSelected = item.theme.id === selectedTheme.theme.id;
                const doneCount = item.home_activities.filter(
                  (a) => a.completed
                ).length;
                const totalCount = item.home_activities.length;
                return (
                  <button
                    key={item.theme.id}
                    type="button"
                    onClick={() => setSelectedThemeId(item.theme.id)}
                    className={`w-full text-left rounded-2xl p-3.5 border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-white border-[#24334D] shadow-sm ring-2 ring-[#78C8F5]/50"
                        : "bg-white/75 border-[#24334D]/10 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-xs font-bold text-[#24334D]/70">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: item.theme.color_hex }}
                        />
                        Week {item.theme.week_number}
                      </span>
                      <Badge
                        variant={
                          doneCount === totalCount && totalCount > 0
                            ? "mint"
                            : "neutral"
                        }
                      >
                        {doneCount}/{totalCount} done
                      </Badge>
                    </div>
                    <p className="font-display font-bold text-[#24334D] mt-1">
                      {item.theme.title}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Theme Detail */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="border-2 border-[#FF9C8C]/40">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="coral">
                    Week {selectedTheme.theme.week_number}
                  </Badge>
                  <Badge variant="mint">
                    <Clock className="h-3.5 w-3.5" />
                    {selectedTheme.parent_guide?.estimated_duration_mins ?? 15}{" "}
                    mins · Screen-Free
                  </Badge>
                </div>
                <CardTitle className="text-2xl sm:text-3xl pt-1">
                  {selectedTheme.theme.title}
                </CardTitle>
                <CardDescription>{selectedTheme.theme.summary}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {selectedTheme.parent_guide && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-[#FFF9F0] p-4 space-y-1.5">
                      <h3 className="font-display font-bold text-sm text-[#175B82]">
                        What Your Child Is Learning
                      </h3>
                      <p className="text-sm text-[#24334D]/85">
                        {selectedTheme.parent_guide.what_child_learns}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#FFF9F0] p-4 space-y-1.5">
                      <h3 className="font-display font-bold text-sm text-[#166041]">
                        Why It Matters
                      </h3>
                      <p className="text-sm text-[#24334D]/85">
                        {selectedTheme.parent_guide.why_it_matters}
                      </p>
                    </div>
                  </div>
                )}

                {selectedTheme.objectives && selectedTheme.objectives.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-display font-bold text-base">
                      Learning Objectives
                    </h3>
                    <ul className="space-y-1.5">
                      {selectedTheme.objectives.map((obj) => (
                        <li
                          key={obj.id}
                          className="flex items-start gap-2 text-sm text-[#24334D]/85"
                        >
                          <CheckCircle2 className="h-4 w-4 text-[#166041] shrink-0 mt-0.5" />
                          <span>{obj.statement}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedTheme.parent_guide && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h3 className="font-display font-bold text-base">
                        What You Need at Home
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedTheme.parent_guide.materials_needed_json.map(
                          (mat) => (
                            <Badge key={mat} variant="neutral">
                              {mat}
                            </Badge>
                          )
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-display font-bold text-base">
                        Ask Your Child
                      </h3>
                      <ul className="list-disc list-inside text-sm text-[#24334D]/80 space-y-1">
                        {selectedTheme.parent_guide.conversation_prompts_json.map(
                          (q) => (
                            <li key={q}>{q}</li>
                          )
                        )}
                      </ul>
                    </div>
                  </div>
                )}

                {selectedTheme.parent_guide && (
                  <div className="rounded-2xl bg-[#FFF5CF]/75 p-4 text-sm space-y-1">
                    <p className="font-bold text-[#785700] inline-flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4" /> Parent Learning Tip
                    </p>
                    <p>{selectedTheme.parent_guide.learning_tip}</p>
                    {selectedTheme.parent_guide.teacher_notes && (
                      <p className="text-xs text-[#24334D]/75 pt-1">
                        <strong>Teacher Note:</strong>{" "}
                        {selectedTheme.parent_guide.teacher_notes}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Guided Home Activities */}
            <div className="space-y-4">
              <h3 className="font-display text-xl font-bold">
                Guided Home Activities
              </h3>
              {selectedTheme.home_activities.map((ha) => (
                <Card key={ha.id}>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="font-display text-lg font-bold">
                          {ha.title}
                        </h4>
                        <p className="text-xs text-[#24334D]/65">
                          Estimated {ha.estimated_minutes} minutes · Materials:{" "}
                          {ha.materials_json.join(", ")}
                        </p>
                      </div>
                      {activeChild && (
                        <Button
                          type="button"
                          size="md"
                          variant={ha.completed ? "mint" : "secondary"}
                          disabled={togglingId === ha.id}
                          onClick={() => handleToggle(ha.id, !ha.completed)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {ha.completed ? "Completed ✓" : "Mark Completed"}
                        </Button>
                      )}
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 text-sm text-[#24334D]/85">
                      {ha.instructions_json.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Printable Worksheets */}
            {selectedTheme.worksheets && selectedTheme.worksheets.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Printable Activity Sheets</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedTheme.worksheets.map((ws) => (
                    <div
                      key={ws.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#FFF9F0] p-4 border border-[#24334D]/8"
                    >
                      <div>
                        <p className="font-bold text-sm">{ws.title}</p>
                        <p className="text-xs text-[#24334D]/70">
                          {ws.description} (Ages {ws.age_group})
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => window.print()}
                        className="print:hidden"
                      >
                        <Printer className="h-4 w-4" />
                        Print Sheet
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Parent Reflection Form + Saved History */}
            {activeChild && (
              <Card className="print:hidden">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircleHeart className="h-5 w-5 text-[#B8A5F5]" />
                    Parent Reflection for {activeChild.display_name}
                  </CardTitle>
                  <CardDescription>
                    Share what your child enjoyed or discovered during this week&apos;s
                    home play.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <form
                    onSubmit={handleSubmit(onSubmitReflection)}
                    className="space-y-4"
                  >
                    <div className="space-y-1.5">
                      <span className="text-sm font-bold block">
                        Did {activeChild.display_name} enjoy this activity?
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setValue("enjoyed", true)}
                          className={`rounded-2xl px-4 py-2 text-sm font-bold border cursor-pointer ${
                            enjoyedVal
                              ? "bg-[#DDF8EC] border-[#9BE7C4] text-[#166041]"
                              : "bg-white border-[#24334D]/12"
                          }`}
                        >
                          😊 Yes, loved it!
                        </button>
                        <button
                          type="button"
                          onClick={() => setValue("enjoyed", false)}
                          className={`rounded-2xl px-4 py-2 text-sm font-bold border cursor-pointer ${
                            !enjoyedVal
                              ? "bg-[#FFF5CF] border-[#FFE58A] text-[#785700]"
                              : "bg-white border-[#24334D]/12"
                          }`}
                        >
                          🤔 Needed extra help
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label
                          htmlFor="easy_concepts"
                          className="text-sm font-bold"
                        >
                          Which concept was easy?
                        </label>
                        <Input
                          id="easy_concepts"
                          placeholder="e.g., Finding red and yellow toys"
                          {...register("easy_concepts")}
                        />
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor="challenging_concepts"
                          className="text-sm font-bold"
                        >
                          Which concept needed practice?
                        </label>
                        <Input
                          id="challenging_concepts"
                          placeholder="e.g., Sorting shades of orange"
                          {...register("challenging_concepts")}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="discovery_notes"
                        className="text-sm font-bold"
                      >
                        What did your child discover?
                      </label>
                      <textarea
                        id="discovery_notes"
                        rows={3}
                        placeholder="Share a favorite moment or quote from your child..."
                        className="w-full rounded-2xl border-2 border-[#24334D]/12 bg-white px-4 py-2.5 text-sm text-[#24334D] placeholder:text-[#24334D]/45 focus-visible:outline-none focus-visible:border-[#78C8F5]"
                        {...register("discovery_notes")}
                      />
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Saving..." : "Save Reflection"}
                    </Button>
                  </form>

                  {selectedTheme.reflections &&
                    selectedTheme.reflections.length > 0 && (
                      <div className="space-y-2.5 border-t border-[#24334D]/8 pt-4">
                        <h4 className="font-display text-sm font-bold text-[#24334D]/75">
                          Saved Reflections for Week{" "}
                          {selectedTheme.theme.week_number}
                        </h4>
                        {selectedTheme.reflections.map((r) => (
                          <div
                            key={r.id}
                            className="rounded-2xl bg-[#FFF9F0] p-4 border border-[#24334D]/8 space-y-1 text-sm"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant={r.enjoyed ? "mint" : "sunshine"}>
                                {r.enjoyed ? "Enjoyed" : "Needs Practice"}
                              </Badge>
                              <span className="text-xs text-[#24334D]/60">
                                {formatShortDate(r.created_at)}
                              </span>
                            </div>
                            {r.easy_concepts && (
                              <p>
                                <strong>Easy:</strong> {r.easy_concepts}
                              </p>
                            )}
                            {r.challenging_concepts && (
                              <p>
                                <strong>Practicing:</strong>{" "}
                                {r.challenging_concepts}
                              </p>
                            )}
                            {r.discovery_notes && (
                              <p className="italic text-[#24334D]/85">
                                &ldquo;{r.discovery_notes}&rdquo;
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </PortalShell>
  );
}

export default function HomeLearningPage() {
  return (
    <ProtectedRoute allowedRoles={["parent", "admin"]}>
      <HomeLearningHubContent />
    </ProtectedRoute>
  );
}
