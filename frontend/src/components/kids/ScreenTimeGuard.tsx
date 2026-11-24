"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, MoonStar, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { generateGrownUpChallenge, type GrownUpChallenge } from "@/lib/grownUpGate";
import { KIDS_UI, normalizeLanguage, tText } from "@/lib/i18n";
import {
  addScreenSecondsUsed,
  getScreenBonusSeconds,
  getScreenSecondsUsed,
  grantScreenTimeBonus,
} from "@/lib/screenTime";
import { stopBackgroundMusic } from "@/lib/sound";
import { speak, setActiveSpeechLanguage } from "@/lib/speech";
import { parentApi } from "@/services/api";
import { Mascot } from "@/components/brand/Mascot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ScreenTimeGuard() {
  const router = useRouter();
  const { activeChildId, childrenList, parentPreferences } = useAuth();
  const activeChild =
    childrenList.find((c) => c.id === activeChildId) || childrenList[0] || null;
  const childId = activeChild?.id || "";

  const lang = normalizeLanguage(parentPreferences?.preferred_language);
  const limitMins = parentPreferences?.daily_screen_limit_mins ?? 30;
  const hasPin = Boolean(parentPreferences?.has_parent_pin);

  const [usedSecs, setUsedSecs] = useState(0);
  const [bonusSecs, setBonusSecs] = useState(0);
  const [challenge, setChallenge] = useState<GrownUpChallenge>(() =>
    generateGrownUpChallenge()
  );
  const [unlockInput, setUnlockInput] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Sync preferred speech language whenever preferences change
  useEffect(() => {
    setActiveSpeechLanguage(lang);
  }, [lang]);

  // Foreground active screen clock (counts only while tab is visible)
  useEffect(() => {
    if (!childId) return;
    setUsedSecs(getScreenSecondsUsed(childId));
    setBonusSecs(getScreenBonusSeconds(childId));

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setUsedSecs(addScreenSecondsUsed(childId, 5));
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [childId]);

  if (!childId || !parentPreferences) return null;

  const allowedSecs = limitMins * 60 + bonusSecs;
  const remainingSecs = Math.max(0, allowedSecs - usedSecs);
  const remainingMins = Math.ceil(remainingSecs / 60);
  const isWarning = remainingSecs > 0 && remainingSecs <= 120;
  const isLimitReached = remainingSecs <= 0;

  async function handleUnlockAction(mode: "extend" | "parent", e: React.FormEvent) {
    e.preventDefault();
    setUnlockError("");
    const trimmed = unlockInput.trim();

    if (hasPin) {
      if (!/^\d{4}$/.test(trimmed)) {
        setUnlockError("Enter your 4-digit Parent PIN.");
        return;
      }
      setVerifying(true);
      try {
        const res = await parentApi.verifyPin(trimmed);
        if (!res.valid) {
          setUnlockError("Incorrect Parent PIN. Please try again.");
          return;
        }
      } catch {
        setUnlockError("Could not verify PIN right now.");
        return;
      } finally {
        setVerifying(false);
      }
    } else if (trimmed === "" || Number(trimmed) !== challenge.answer) {
      setUnlockError(`Ask a grown-up to solve ${challenge.expression}.`);
      return;
    }

    setUnlockInput("");
    if (mode === "extend") {
      setBonusSecs(grantScreenTimeBonus(childId, 10));
      setChallenge((prev) => generateGrownUpChallenge(prev.expression));
    } else {
      stopBackgroundMusic();
      router.push("/parent/home-learning");
    }
  }

  return (
    <>
      {/* Gentle status / wind-down warning banner */}
      {isWarning && (
        <div
          role="status"
          className="fixed bottom-16 md:bottom-4 right-4 z-40 rounded-2xl bg-[#FFF5CF] border-2 border-[#FFE58A] px-4 py-2.5 shadow-lg flex items-center gap-2 text-xs sm:text-sm font-bold text-[#24334D]"
        >
          <Clock className="h-4 w-4 text-[#9A7100]" />
          <span>
            {tText(
              lang,
              `${remainingMins} min left today — finish this activity, then rest eyes!`,
              `${remainingMins} minuto na lang — tapusin ito at magpahinga muna!`
            )}
          </span>
        </div>
      )}

      {/* Calm Sleepy-Owl Rest & Offline Play Lock */}
      {isLimitReached && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#24334D]/75 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-md rounded-3xl bg-[#FFF9F0] border-4 border-[#FFE58A] p-6 sm:p-7 text-center space-y-4 shadow-2xl">
            <div className="flex justify-center">
              <Mascot size="md" message="" />
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#EDE7FE] px-3 py-1 text-xs font-bold text-[#4C328B]">
              <MoonStar className="h-3.5 w-3.5" />
              {limitMins} {tText(lang, "Minute Daily Goal Reached!", "Minutong Oras Na!")}
            </div>
            <h2 className="font-display text-2xl font-bold text-[#24334D]">
              {tText(lang, KIDS_UI.restHeadline.en, KIDS_UI.restHeadline.fil)}
            </h2>
            <p className="text-sm font-semibold text-[#24334D]/80">
              {tText(lang, KIDS_UI.restMessage.en, KIDS_UI.restMessage.fil)}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                speak(
                  tText(lang, KIDS_UI.restMessage.en, KIDS_UI.restMessage.fil),
                  { lang }
                )
              }
            >
              Hear Message
            </Button>

            <form
              onSubmit={(e) => handleUnlockAction("extend", e)}
              className="rounded-2xl bg-white border border-[#24334D]/12 p-4 space-y-3 text-left"
            >
              <p className="text-xs font-bold text-[#24334D]/75">
                {hasPin
                  ? "Grown-Up PIN (4 digits) to grant +10 mins or open Home Ideas:"
                  : `Grown-Up Check: ${challenge.prompt}`}
              </p>
              <Input
                type={hasPin ? "password" : "number"}
                inputMode="numeric"
                maxLength={hasPin ? 4 : undefined}
                value={unlockInput}
                onChange={(e) => setUnlockInput(e.target.value)}
                placeholder={hasPin ? "••••" : "Answer"}
                className="text-center font-bold"
              />
              {unlockError && (
                <p className="text-xs font-bold text-[#8E3022]">{unlockError}</p>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  disabled={verifying}
                  className="flex-1"
                >
                  <Sparkles className="h-4 w-4" />
                  +10 More Mins
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={verifying}
                  onClick={(e) => void handleUnlockAction("parent", e)}
                  className="flex-1"
                >
                  Open Offline Activities
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
