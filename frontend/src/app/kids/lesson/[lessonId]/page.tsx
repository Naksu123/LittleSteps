"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Volume2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ENCOURAGE_TRY, pick } from "@/lib/gameScoring";
import { getSoundEnabled, playChime } from "@/lib/sound";
import { speak } from "@/lib/speech";
import { cn, getDefaultPortalPath } from "@/lib/utils";
import { ApiError, contentApi, progressApi } from "@/services/api";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ChoiceGame } from "@/components/games/ChoiceGame";
import { RewardCelebration } from "@/components/games/RewardCelebration";
import { KidsHeader } from "@/components/kids/KidsHeader";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  ChoiceConfig,
  GameResult,
  LessonDetail,
  Quiz,
  Reward,
} from "@/types";

type LessonStage = "slides" | "activity" | "quiz" | "done";

function LessonViewerContent() {
  const params = useParams<{ lessonId: string }>();
  const router = useRouter();
  const { user, childrenList, activeChildId, refreshUser } = useAuth();

  const lessonId = params?.lessonId;
  const activeChild =
    childrenList.find((c) => c.id === activeChildId) || childrenList[0] || null;
  const exitHref = getDefaultPortalPath(user?.roles || ["parent"]);

  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stage, setStage] = useState<LessonStage>("slides");
  const [slideIdx, setSlideIdx] = useState(0);

  // Quiz state
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);
  const [quizFeedbackTone, setQuizFeedbackTone] = useState<
    "success" | "try" | null
  >(null);
  const [quizAnsweredCorrect, setQuizAnsweredCorrect] = useState(false);
  const firstAnswersRef = useRef<Record<number, number>>({});

  // Celebration totals across slides/activity/quiz
  const [celebration, setCelebration] = useState<{
    stars: number;
    rewards: Reward[];
    encouragement: string;
    note?: string | null;
  } | null>(null);
  const starsAccRef = useRef(0);
  const rewardsAccRef = useRef<Reward[]>([]);
  const startedAtRef = useRef(Date.now());
  const startedSentRef = useRef(false);

  useEffect(() => {
    if (!lessonId) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    Promise.all([
      contentApi.lessonDetail(lessonId),
      contentApi.lessonQuiz(lessonId),
    ])
      .then(([lessonData, quizData]) => {
        if (!mounted) return;
        setLesson(lessonData);
        setQuiz(quizData);
        startedAtRef.current = Date.now();
      })
      .catch((err) => {
        if (mounted) {
          setError(
            err instanceof ApiError ? err.message : "Could not load lesson."
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [lessonId]);

  useEffect(() => {
    if (!lesson || !activeChild || startedSentRef.current) return;
    startedSentRef.current = true;
    progressApi
      .lesson({
        child_id: activeChild.id,
        lesson_id: lesson.id,
        status: "in_progress",
        completion_pct: 10,
        time_spent_seconds: 0,
      })
      .catch(() => {
        // Non-blocking start progress ping
      });
  }, [lesson, activeChild]);

  const slides = lesson?.content_json?.slides || [];
  const currentSlide = slides[slideIdx];

  useEffect(() => {
    if (stage === "slides" && currentSlide && getSoundEnabled()) {
      speak(currentSlide.narration || currentSlide.text);
    }
  }, [stage, slideIdx, currentSlide]);

  const practiceActivity = lesson?.activities[0];
  const practiceConfig =
    practiceActivity?.payload_json &&
    (practiceActivity.payload_json as { engine?: string }).engine === "choice"
      ? (practiceActivity.payload_json as ChoiceConfig)
      : null;

  async function finishLesson() {
    if (!lesson || !activeChild) return;
    setStage("done");
    playChime("celebrate");
    const elapsed = Math.min(
      3600,
      Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
    );

    try {
      const res = await progressApi.lesson({
        child_id: activeChild.id,
        lesson_id: lesson.id,
        status: "completed",
        completion_pct: 100,
        time_spent_seconds: elapsed,
      });
      starsAccRef.current += res.stars_awarded;
      rewardsAccRef.current = [...rewardsAccRef.current, ...res.new_rewards];
      await refreshUser();
      setCelebration({
        stars: starsAccRef.current,
        rewards: rewardsAccRef.current,
        encouragement: res.encouragement,
      });
    } catch {
      setCelebration({
        stars: starsAccRef.current || 3,
        rewards: rewardsAccRef.current,
        encouragement: "Wonderful effort!",
        note: "We couldn't save this one, but wonderful effort!",
      });
    }
  }

  function advanceFromSlides() {
    if (practiceConfig) {
      setStage("activity");
    } else if (quiz && quiz.questions.length > 0) {
      setStage("quiz");
    } else {
      void finishLesson();
    }
  }

  async function handleActivityComplete(result: GameResult) {
    if (practiceActivity && activeChild) {
      try {
        const res = await progressApi.activity({
          child_id: activeChild.id,
          activity_id: practiceActivity.id,
          score_pct: result.score_pct,
          attempts_count: result.attempts_count,
          duration_seconds: result.duration_seconds,
          completed: true,
        });
        starsAccRef.current += res.stars_awarded;
        rewardsAccRef.current = [...rewardsAccRef.current, ...res.new_rewards];
      } catch {
        // Continue smoothly to quiz or completion
      }
    }

    if (quiz && quiz.questions.length > 0) {
      setStage("quiz");
    } else {
      await finishLesson();
    }
  }

  function handleQuizOption(optionIdx: number) {
    if (!quiz || quizAnsweredCorrect) return;
    const question = quiz.questions[quizIdx];
    if (!question) return;

    if (firstAnswersRef.current[quizIdx] === undefined) {
      firstAnswersRef.current[quizIdx] = optionIdx;
    }

    if (optionIdx === question.correct_option_index) {
      playChime("success");
      setQuizFeedbackTone("success");
      setQuizFeedback(question.encouragement_text || "Great job!");
      setQuizAnsweredCorrect(true);
    } else {
      playChime("try");
      setQuizFeedbackTone("try");
      setQuizFeedback(pick(ENCOURAGE_TRY));
    }
  }

  async function handleNextQuizQuestion() {
    if (!quiz || !activeChild) return;
    if (quizIdx + 1 < quiz.questions.length) {
      setQuizIdx((q) => q + 1);
      setQuizFeedback(null);
      setQuizFeedbackTone(null);
      setQuizAnsweredCorrect(false);
      return;
    }

    const answers = quiz.questions.map(
      (_, idx) => firstAnswersRef.current[idx] ?? 0
    );
    try {
      const res = await progressApi.quiz({
        child_id: activeChild.id,
        quiz_id: quiz.id,
        answers,
      });
      starsAccRef.current += res.stars_awarded;
      rewardsAccRef.current = [...rewardsAccRef.current, ...res.new_rewards];
    } catch {
      // Non-blocking quiz submission fallback
    }
    await finishLesson();
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#DDF8EC]/50 via-[#FFF9F0] to-[#FFF5CF]/45 px-3.5 sm:px-6 py-4 sm:py-6">
      <div className="mx-auto max-w-4xl 2xl:max-w-5xl space-y-5 sm:space-y-6">
        <KidsHeader
          child={activeChild}
          backHref="/kids?tab=learn"
          backLabel="All Lessons"
          exitHref={exitHref}
        />

        {!activeChild ? (
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <p className="font-display text-2xl font-bold">
                Pick a Learner Profile First
              </p>
              <Link href="/kids" className="inline-block">
                <Button variant="secondary" size="kid">
                  Back to Kids Home
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : loading ? (
          <Skeleton className="h-80 w-full" />
        ) : error || !lesson ? (
          <Alert tone="warning" title="Lesson Unavailable">
            {error || "We could not find this lesson."}
          </Alert>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Badge variant="mint" className="mb-1">
                  {stage === "slides"
                    ? "Story Slides"
                    : stage === "activity"
                      ? "Practice Time"
                      : stage === "quiz"
                        ? "Mini Check-In"
                        : "Completed!"}
                </Badge>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#24334D]">
                  {lesson.title}
                </h1>
              </div>
            </div>

            {stage === "slides" && (
              <Card className="border-2 border-[#9BE7C4]/70">
                <CardContent className="p-6 sm:p-8 space-y-6">
                  {slides.length === 0 ? (
                    <div className="text-center space-y-4">
                      <p className="text-lg font-semibold">{lesson.summary}</p>
                      <Button
                        variant="kids"
                        size="kid"
                        onClick={advanceFromSlides}
                      >
                        Continue
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {slides.map((_, idx) => (
                            <span
                              key={idx}
                              className={cn(
                                "h-3.5 rounded-full transition-all",
                                idx === slideIdx
                                  ? "w-8 bg-[#9BE7C4]"
                                  : idx < slideIdx
                                    ? "w-3.5 bg-[#166041]"
                                    : "w-3.5 bg-[#24334D]/12"
                              )}
                            />
                          ))}
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            speak(
                              currentSlide?.narration ||
                                currentSlide?.text ||
                                ""
                            )
                          }
                        >
                          <Volume2 className="h-4 w-4" />
                          Read Aloud
                        </Button>
                      </div>

                      <div className="rounded-3xl bg-[#FFF9F0] p-5 sm:p-8 text-center space-y-3 sm:space-y-4">
                        <div className="text-5xl sm:text-7xl select-none">
                          {currentSlide?.emoji}
                        </div>
                        <h2 className="font-display text-xl sm:text-3xl font-bold text-[#24334D]">
                          {currentSlide?.title}
                        </h2>
                        <p className="text-sm sm:text-lg font-semibold text-[#24334D]/80 max-w-xl mx-auto">
                          {currentSlide?.text}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="kid"
                          disabled={slideIdx === 0}
                          onClick={() => setSlideIdx((s) => Math.max(0, s - 1))}
                          className="flex-1 sm:flex-initial"
                        >
                          <ArrowLeft className="h-5 w-5" />
                          Back
                        </Button>

                        {slideIdx + 1 < slides.length ? (
                          <Button
                            type="button"
                            variant="kids"
                            size="kid"
                            onClick={() => setSlideIdx((s) => s + 1)}
                            className="flex-1 sm:flex-initial"
                          >
                            Next
                            <ArrowRight className="h-5 w-5" />
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="kids"
                            size="kid"
                            onClick={advanceFromSlides}
                            className="flex-1 sm:flex-initial"
                          >
                            {practiceConfig ? "Practice Time!" : "Finish"}
                            <ArrowRight className="h-5 w-5" />
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {stage === "activity" && practiceConfig && (
              <ChoiceGame
                config={practiceConfig}
                onComplete={handleActivityComplete}
              />
            )}

            {stage === "quiz" && quiz && quiz.questions[quizIdx] && (
              <Card className="border-2 border-[#B8A5F5]">
                <CardContent className="p-6 sm:p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <Badge variant="lavender">
                      Question {quizIdx + 1} / {quiz.questions.length}
                    </Badge>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => speak(quiz.questions[quizIdx].prompt)}
                    >
                      <Volume2 className="h-4 w-4" />
                      Listen
                    </Button>
                  </div>

                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#24334D]">
                    {quiz.questions[quizIdx].prompt}
                  </h2>

                  {quizFeedback && (
                    <div
                      role="status"
                      className={cn(
                        "rounded-2xl px-5 py-3 font-display text-lg font-bold text-center",
                        quizFeedbackTone === "success"
                          ? "bg-[#DDF8EC] text-[#166041]"
                          : "bg-[#FFF5CF] text-[#785700]"
                      )}
                    >
                      {quizFeedback}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3">
                    {quiz.questions[quizIdx].options_json.map((opt, oIdx) => (
                      <button
                        key={oIdx}
                        type="button"
                        onClick={() => handleQuizOption(oIdx)}
                        className={cn(
                          "min-h-14 sm:min-h-16 rounded-2xl border-2 px-4 sm:px-5 py-3 text-left font-display text-base sm:text-xl font-bold transition-all cursor-pointer flex items-center justify-between gap-2",
                          quizAnsweredCorrect &&
                            oIdx ===
                              quiz.questions[quizIdx].correct_option_index
                            ? "bg-[#DDF8EC] border-[#9BE7C4] text-[#166041]"
                            : "bg-[#FFF9F0] border-[#24334D]/12 hover:bg-[#DCF2FD]"
                        )}
                      >
                        <span>{opt}</span>
                        {quizAnsweredCorrect &&
                          oIdx ===
                            quiz.questions[quizIdx].correct_option_index && (
                            <CheckCircle2 className="h-6 w-6 shrink-0" />
                          )}
                      </button>
                    ))}
                  </div>

                  {quizAnsweredCorrect && (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="kids"
                        size="kid"
                        onClick={handleNextQuizQuestion}
                      >
                        {quizIdx + 1 < quiz.questions.length
                          ? "Next Question"
                          : "Finish Lesson!"}
                        <ArrowRight className="h-5 w-5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {celebration && (
          <RewardCelebration
            starsAwarded={celebration.stars}
            encouragement={celebration.encouragement}
            newRewards={celebration.rewards}
            note={celebration.note}
            onBack={() => router.push("/kids?tab=learn")}
            backLabel="Back to Lessons"
          />
        )}
      </div>
    </div>
  );
}

export default function LessonPage() {
  return (
    <ProtectedRoute allowedRoles={["parent", "teacher", "admin"]}>
      <LessonViewerContent />
    </ProtectedRoute>
  );
}
