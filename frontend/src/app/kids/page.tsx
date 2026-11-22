"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Flame,
  Gamepad2,
  Palette,
  Play,
  Sparkles,
  Star,
  Volume2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  GAME_DIFFICULTY_META,
  getDefaultDifficultyForChild,
} from "@/lib/gameDifficulty";
import { speak } from "@/lib/speech";
import { getDefaultPortalPath } from "@/lib/utils";
import { contentApi, progressApi } from "@/services/api";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Mascot } from "@/components/brand/Mascot";
import { JourneyMap } from "@/components/kids/JourneyMap";
import { KidsNav, type KidsTabKey } from "@/components/layout/KidsNav";
import { Alert } from "@/components/ui/alert";
import { ChildAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Game, Lesson, ProgressSummary, Subject, Theme } from "@/types";

const SUBJECT_EMOJI: Record<string, string> = {
  "alphabet-language": "🔤",
  mathematics: "🔢",
  "science-discovery": "🌱",
  "social-emotional": "💛",
  "arts-creativity": "🎨",
  "life-skills": "☀️",
};

const VALID_TABS: KidsTabKey[] = ["home", "learn", "play", "stories", "rewards"];

function KidsPortalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, childrenList, activeChildId, setActiveChildId } = useAuth();

  const tabParam = searchParams.get("tab") as KidsTabKey | null;
  const initialTab: KidsTabKey =
    tabParam && VALID_TABS.includes(tabParam) ? tabParam : "home";

  const [activeTab, setActiveTab] = useState<KidsTabKey>(initialTab);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bannerTip, setBannerTip] = useState<string | null>(null);

  useEffect(() => {
    if (tabParam && VALID_TABS.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const activeChild =
    childrenList.find((c) => c.id === activeChildId) || childrenList[0] || null;
  const recommendedMode = getDefaultDifficultyForChild(activeChild);
  const recommendedModeMeta = GAME_DIFFICULTY_META[recommendedMode];

  useEffect(() => {
    let mounted = true;
    async function loadContent() {
      try {
        const [subjData, themeData, lessonData, gameData] = await Promise.all([
          contentApi.subjects(),
          contentApi.themes(),
          contentApi.lessons(),
          contentApi.games(),
        ]);
        if (!mounted) return;
        setSubjects(subjData);
        setThemes(themeData);
        setLessons(lessonData);
        setGames(gameData);
      } catch {
        if (mounted) {
          setError("Could not load learning activities. Please try again.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadContent();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!activeChild) {
      setSummary(null);
      return;
    }
    let mounted = true;
    progressApi
      .summary(activeChild.id)
      .then((res) => {
        if (mounted) setSummary(res);
      })
      .catch(() => {
        // Ignore transient fetch failure
      });
    return () => {
      mounted = false;
    };
  }, [activeChild]);

  function handleTabSelect(tab: KidsTabKey) {
    setActiveTab(tab);
    router.replace(`/kids?tab=${tab}`, { scroll: false });
  }

  function warmLesson(id: string) {
    router.prefetch?.(`/kids/lesson/${id}`);
    void contentApi.lessonDetail(id).catch(() => {});
    void contentApi.lessonQuiz(id).catch(() => {});
  }

  function warmGame(id: string) {
    router.prefetch?.(`/kids/play/${id}`);
    void contentApi.game(id).catch(() => {});
  }

  function speakGreeting() {
    const text = activeChild
      ? `Hello ${activeChild.display_name}! Welcome to LittleSteps. Tap any colorful card to learn and play!`
      : "Welcome to LittleSteps! Ask a grown-up to add your profile.";
    setBannerTip(text);
    speak(text);
  }

  const lessonStatusMap = useMemo(() => {
    const map = new Map<string, { status: string; stars: number }>();
    for (const item of summary?.lesson_statuses || []) {
      map.set(item.lesson_id, {
        status: item.status,
        stars: item.stars_earned,
      });
    }
    return map;
  }, [summary]);

  const completedThemeIds = useMemo(() => {
    const set = new Set<string>();
    for (const lesson of lessons) {
      if (
        lesson.theme_id &&
        lessonStatusMap.get(lesson.id)?.status === "completed"
      ) {
        set.add(lesson.theme_id);
      }
    }
    return set;
  }, [lessons, lessonStatusMap]);

  const inProgressLessons = useMemo(
    () =>
      lessons.filter(
        (l) => lessonStatusMap.get(l.id)?.status === "in_progress"
      ),
    [lessons, lessonStatusMap]
  );

  const missionLesson = useMemo(() => {
    for (const theme of themes) {
      const candidate = lessons.find(
        (l) =>
          l.theme_id === theme.id &&
          lessonStatusMap.get(l.id)?.status !== "completed"
      );
      if (candidate) return candidate;
    }
    return (
      lessons.find((l) => lessonStatusMap.get(l.id)?.status !== "completed") ||
      lessons[0] ||
      null
    );
  }, [themes, lessons, lessonStatusMap]);

  const filteredLessons = useMemo(
    () =>
      selectedSubjectId
        ? lessons.filter((l) => l.subject_id === selectedSubjectId)
        : lessons,
    [lessons, selectedSubjectId]
  );

  const exitHref = getDefaultPortalPath(user?.roles || ["parent"]);
  const displayStars = summary?.child.total_stars ?? activeChild?.total_stars ?? 0;
  const displayStreak = summary?.child.streak_days ?? activeChild?.streak_days ?? 0;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#DCF2FD]/55 via-[#FFF9F0] to-[#FFF5CF]/45 px-3.5 sm:px-6 pt-3.5 sm:pt-6 safe-pb-nav md:pb-12">
      <div className="mx-auto max-w-6xl 2xl:max-w-7xl space-y-5 sm:space-y-6">
        <KidsNav
          activeTab={activeTab}
          onSelectTab={handleTabSelect}
          exitHref={exitHref}
        />

        {error && <Alert tone="warning">{error}</Alert>}

        {/* Child Profile Switcher */}
        {childrenList.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-3xl bg-white/90 px-4 sm:px-5 py-3 shadow-xs border border-[#24334D]/8">
            <span className="font-display text-sm font-semibold text-[#24334D]/75">
              Who is playing?
            </span>
            {childrenList.map((child) => {
              const selected = activeChild?.id === child.id;
              return (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => setActiveChildId(child.id)}
                  className={`inline-flex items-center gap-2 rounded-full min-h-11 px-3.5 py-1.5 font-display text-sm sm:text-base font-semibold transition-all cursor-pointer ${
                    selected
                      ? "bg-[#FFE58A] text-[#24334D] ring-2 ring-[#24334D]"
                      : "bg-[#FFF9F0] hover:bg-[#DCF2FD]"
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

        {/* No Child Empty State */}
        {!loading && !activeChild && (
          <Card>
            <CardContent className="p-6 sm:p-8 text-center space-y-3">
              <h2 className="font-display text-2xl font-bold">
                No Learner Profile Yet
              </h2>
              <p className="text-sm text-[#24334D]/75">
                Ask a grown-up to add your profile in the Parent Portal to start
                saving stars and badges!
              </p>
              <Link href={exitHref} className="inline-block">
                <Button variant="primary" size="md">
                  Go to Parent Portal
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Personalized Kids Hero */}
        <Card className="bg-white border-2 border-[#78C8F5]/40 overflow-hidden">
          <CardContent className="p-5 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-5 sm:gap-6">
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5 text-center sm:text-left min-w-0">
              {activeChild ? (
                <ChildAvatar
                  avatarKey={activeChild.avatar_key}
                  colorHex={activeChild.favorite_color}
                  size="xl"
                  className="shrink-0"
                />
              ) : (
                <ChildAvatar avatarKey="owl" size="xl" className="shrink-0" />
              )}
              <div className="space-y-2 min-w-0">
                <h1 className="font-display text-fluid-hero font-bold text-[#24334D] break-words">
                  {activeChild
                    ? `Hello, ${activeChild.display_name}!`
                    : "Hello, Little Explorer!"}
                </h1>
                <p className="text-sm sm:text-base font-semibold text-[#24334D]/75">
                  {bannerTip ||
                    "Today's Adventure: Discover colors, letters, and friendly games!"}
                </p>
                <div className="flex flex-wrap justify-center sm:justify-start gap-2 sm:gap-2.5 pt-1">
                  <Badge variant="sunshine" className="text-xs sm:text-sm px-3 sm:px-3.5 py-1.5">
                    <Star className="h-4 w-4 fill-current" />
                    {displayStars} Stars
                  </Badge>
                  <Badge variant="coral" className="text-xs sm:text-sm px-3 sm:px-3.5 py-1.5">
                    <Flame className="h-4 w-4" />
                    {displayStreak} Day Streak!
                  </Badge>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={speakGreeting}
                  >
                    <Volume2 className="h-4 w-4" />
                    Hear Instructions
                  </Button>
                </div>
              </div>
            </div>

            <Mascot size="md" message="You're doing awesome! Tap a big card below." />
          </CardContent>
        </Card>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-44 w-full" />
          </div>
        ) : (
          <>
            {activeTab === "home" && (
              <div className="space-y-6">
                {/* Today's Mission + Art Studio */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  <Card className="lg:col-span-8 bg-gradient-to-r from-[#FFE58A] via-[#FFF5CF] to-[#9BE7C4]/70 border-2 border-[#24334D]/10">
                    <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4 h-full">
                      <div className="space-y-1.5">
                        <Badge variant="neutral">Today&apos;s Mission</Badge>
                        <h2 className="font-display text-2xl font-bold">
                          {missionLesson
                            ? missionLesson.title
                            : themes[0]
                              ? `Week ${themes[0].week_number}: ${themes[0].title}`
                              : "Colors Around Us"}
                        </h2>
                        <p className="text-sm sm:text-base font-semibold text-[#24334D]/80">
                          {missionLesson?.summary || themes[0]?.summary}
                        </p>
                      </div>
                      <Button
                        variant="primary"
                        size="kid"
                        onMouseEnter={() => {
                          if (missionLesson) warmLesson(missionLesson.id);
                        }}
                        onClick={() =>
                          missionLesson
                            ? router.push(`/kids/lesson/${missionLesson.id}`)
                            : handleTabSelect("learn")
                        }
                        className="w-full sm:w-auto shrink-0"
                      >
                        <Sparkles className="h-5 w-5" />
                        Start Adventure
                      </Button>
                    </CardContent>
                  </Card>

                  <Link href="/kids/art" className="lg:col-span-4 block">
                    <Card className="h-full bg-gradient-to-br from-[#FFE3DE] to-white border-2 border-[#FF9C8C]/50 hover:scale-[1.02] transition-transform cursor-pointer">
                      <CardContent className="p-6 flex flex-col justify-between h-full gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-4xl">🎨</span>
                          <Badge variant="coral">Creative</Badge>
                        </div>
                        <div>
                          <h2 className="font-display text-2xl font-bold text-[#24334D]">
                            Art Studio
                          </h2>
                          <p className="text-sm font-semibold text-[#24334D]/75">
                            Draw, color templates & save to your gallery!
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 font-display font-bold text-sm text-[#8E3022]">
                          <Palette className="h-4 w-4" /> Open Canvas →
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                </div>

                {/* Continue Learning */}
                {inProgressLessons.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="font-display text-2xl font-bold">
                      Continue Learning
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {inProgressLessons.map((lesson) => (
                        <Card
                          key={lesson.id}
                          className="border-2 border-[#78C8F5]/60 bg-white"
                        >
                          <CardContent className="p-5 flex items-center justify-between gap-3">
                            <div className="space-y-1">
                              <Badge variant="sky">In Progress</Badge>
                              <h3 className="font-display text-lg font-bold">
                                {lesson.title}
                              </h3>
                            </div>
                            <Button
                              variant="secondary"
                              size="md"
                              onMouseEnter={() => warmLesson(lesson.id)}
                              onClick={() =>
                                router.push(`/kids/lesson/${lesson.id}`)
                              }
                            >
                              <Play className="h-4 w-4" />
                              Resume
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Progress Map */}
                {themes.length > 0 && (
                  <JourneyMap
                    themes={themes}
                    completedThemeIds={completedThemeIds}
                    onSelectTheme={() => handleTabSelect("stories")}
                  />
                )}

                {/* 6 Learning Categories */}
                <div className="space-y-3">
                  <h2 className="font-display text-2xl font-bold">
                    Choose a Learning World
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {subjects.map((subj) => (
                      <button
                        key={subj.id}
                        type="button"
                        onClick={() => {
                          setSelectedSubjectId(subj.id);
                          handleTabSelect("learn");
                        }}
                        className="text-left rounded-3xl bg-white p-6 shadow-md border-b-4 border-[#24334D]/12 hover:scale-[1.02] transition-transform cursor-pointer space-y-3"
                      >
                        <div
                          className="h-16 w-16 rounded-2xl flex items-center justify-center text-4xl shadow-xs"
                          style={{ backgroundColor: `${subj.color_hex}55` }}
                        >
                          {SUBJECT_EMOJI[subj.slug] || "✨"}
                        </div>
                        <h3 className="font-display text-xl font-bold text-[#24334D]">
                          {subj.name}
                        </h3>
                        <p className="text-sm font-semibold text-[#24334D]/70">
                          {subj.description}
                        </p>
                        <Badge variant="sky">{subj.lesson_count} Lessons</Badge>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "learn" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-2xl font-bold">
                    Playful Lessons
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedSubjectId(null)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-bold border cursor-pointer ${
                        selectedSubjectId === null
                          ? "bg-[#24334D] text-white border-[#24334D]"
                          : "bg-white text-[#24334D] border-[#24334D]/15"
                      }`}
                    >
                      All Worlds
                    </button>
                    {subjects.map((subj) => (
                      <button
                        key={subj.id}
                        type="button"
                        onClick={() => setSelectedSubjectId(subj.id)}
                        className={`rounded-full min-h-10 sm:min-h-9 px-3.5 py-1.5 text-xs font-bold border cursor-pointer ${
                          selectedSubjectId === subj.id
                            ? "bg-[#24334D] text-white border-[#24334D]"
                            : "bg-white text-[#24334D] border-[#24334D]/15"
                        }`}
                      >
                        {SUBJECT_EMOJI[subj.slug] || "✨"} {subj.name}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredLessons.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center text-sm font-semibold text-[#24334D]/70">
                      No lessons in this category yet. Pick another Learning World!
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredLessons.map((lesson) => {
                      const st = lessonStatusMap.get(lesson.id);
                      const isDone = st?.status === "completed";
                      return (
                        <Card
                          key={lesson.id}
                          className="border-2 border-[#9BE7C4]/60"
                        >
                          <CardContent className="p-6 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Badge variant="mint">
                                {lesson.estimated_minutes} mins · Ages{" "}
                                {lesson.age_group}
                              </Badge>
                              {isDone && (
                                <Badge variant="sunshine">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  {st?.stars ?? 3} ⭐
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-display text-xl font-bold">
                              {lesson.title}
                            </h3>
                            <p className="text-sm text-[#24334D]/75">
                              {lesson.summary}
                            </p>
                            <Button
                              variant="kids"
                              size="kid"
                              className="w-full"
                              onMouseEnter={() => warmLesson(lesson.id)}
                              onClick={() =>
                                router.push(`/kids/lesson/${lesson.id}`)
                              }
                            >
                              <Play className="h-5 w-5" />
                              {isDone ? "Play Again" : "Start Lesson"}
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === "play" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-2xl font-bold">
                    Educational Games ({games.length})
                  </h2>
                  <Badge variant="sky" className="text-xs px-3 py-1">
                    {activeChild
                      ? `Recommended for ${activeChild.display_name}: ${recommendedModeMeta.label} (${recommendedModeMeta.ageTag})`
                      : `Modes: Normal • Medium • Hard`}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {games.map((game) => {
                    const played = summary?.completed_game_ids.includes(game.id);
                    return (
                      <Card key={game.id} className="border-2 border-[#FFE58A]">
                        <CardContent className="p-6 space-y-3">
                          <div className="flex items-center justify-between">
                            <Gamepad2 className="h-7 w-7 text-[#175B82]" />
                            <div className="flex items-center gap-1.5">
                              {played && (
                                <Badge variant="mint">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Played
                                </Badge>
                              )}
                              <Badge variant="sunshine">
                                Normal · Medium · Hard
                              </Badge>
                            </div>
                          </div>
                          <h3 className="font-display text-xl font-bold">
                            {game.title}
                          </h3>
                          <p className="text-sm text-[#24334D]/75">
                            {game.instructions}
                          </p>
                          <Button
                            variant="secondary"
                            size="kid"
                            className="w-full"
                            onMouseEnter={() => warmGame(game.id)}
                            onClick={() => router.push(`/kids/play/${game.id}`)}
                          >
                            <Play className="h-5 w-5" />
                            Play
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "stories" && (
              <div className="space-y-4">
                <h2 className="font-display text-2xl font-bold">
                  12 Weekly Adventure Themes
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {themes.map((theme) => (
                    <Card key={theme.id}>
                      <div
                        className="h-2.5 rounded-t-3xl"
                        style={{ backgroundColor: theme.color_hex }}
                      />
                      <CardContent className="p-5 space-y-3">
                        <Badge variant="lavender">Week {theme.week_number}</Badge>
                        <h3 className="font-display text-lg font-bold">
                          {theme.title}
                        </h3>
                        <p className="text-sm text-[#24334D]/75">
                          {theme.summary}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            speak(
                              `Week ${theme.week_number}: ${theme.title}. ${theme.summary}`
                            )
                          }
                        >
                          <Volume2 className="h-4 w-4" />
                          Read to me
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "rewards" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-2xl font-bold">
                    {activeChild
                      ? `${activeChild.display_name}'s Rewards`
                      : "My Rewards"}
                  </h2>
                  <div className="flex items-center gap-2">
                    <Badge variant="sunshine" className="text-sm px-3.5 py-1.5">
                      ⭐ {displayStars} Total Stars
                    </Badge>
                    <Badge variant="coral" className="text-sm px-3.5 py-1.5">
                      🔥 {displayStreak} Day Streak
                    </Badge>
                  </div>
                </div>

                {summary && summary.rewards.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {summary.rewards.map((reward) => (
                      <Card
                        key={reward.id}
                        className="bg-gradient-to-br from-[#FFF5CF] to-white border-2 border-[#FFE58A]"
                      >
                        <CardContent className="p-6 space-y-2">
                          <div className="text-4xl">🏆</div>
                          <h3 className="font-display text-xl font-bold">
                            {reward.title}
                          </h3>
                          <p className="text-sm text-[#24334D]/75">
                            {reward.description}
                          </p>
                          <Badge variant="sunshine">
                            +{reward.stars_value} Stars
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center space-y-2">
                      <p className="font-display text-xl font-semibold">
                        Your Treasure Chest is Ready!
                      </p>
                      <p className="text-sm text-[#24334D]/75">
                        Complete lessons, games, and drawings to collect shining
                        stars and badges.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function KidsPage() {
  return (
    <ProtectedRoute allowedRoles={["parent", "teacher", "admin"]}>
      <Suspense
        fallback={
          <div className="mx-auto max-w-6xl p-6 space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-44 w-full" />
          </div>
        }
      >
        <KidsPortalContent />
      </Suspense>
    </ProtectedRoute>
  );
}
