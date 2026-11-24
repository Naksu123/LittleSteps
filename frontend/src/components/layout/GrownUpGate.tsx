"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Lock, RefreshCw, ShieldCheck } from "lucide-react";
import { useOptionalAuth } from "@/hooks/authContext";
import {
  generateGrownUpChallenge,
  type GrownUpChallenge,
} from "@/lib/grownUpGate";
import { stopBackgroundMusic } from "@/lib/sound";
import { parentApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface GrownUpGateProps {
  exitHref?: string;
}

export function GrownUpGate({ exitHref = "/parent" }: GrownUpGateProps) {
  const router = useRouter();
  const auth = useOptionalAuth();
  const hasPin = Boolean(auth?.parentPreferences?.has_parent_pin);
  const inputRef = useRef<HTMLInputElement>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [challenge, setChallenge] = useState<GrownUpChallenge>(() =>
    generateGrownUpChallenge()
  );
  const [answer, setAnswer] = useState("");
  const [gateError, setGateError] = useState("");
  const [verifyingPin, setVerifyingPin] = useState(false);

  useEffect(() => {
    if (!gateOpen) return;
    const rafId = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(rafId);
  }, [gateOpen]);

  function openGate() {
    setChallenge((prev) => generateGrownUpChallenge(prev.expression));
    setAnswer("");
    setGateError("");
    setGateOpen(true);
  }

  function handleNewQuestion() {
    setChallenge((prev) => generateGrownUpChallenge(prev.expression));
    setAnswer("");
    setGateError("");
    inputRef.current?.focus();
  }

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = answer.trim();

    if (hasPin) {
      if (!/^\d{4}$/.test(trimmed)) {
        setGateError("Please enter your 4-digit Parent PIN to exit Kids Mode.");
        return;
      }
      setVerifyingPin(true);
      try {
        const res = await parentApi.verifyPin(trimmed);
        if (!res.valid) {
          setGateError("Incorrect 4-digit Parent PIN. Please try again.");
          return;
        }
      } catch {
        setGateError("Unable to verify Parent PIN right now.");
        return;
      } finally {
        setVerifyingPin(false);
      }
      setGateOpen(false);
      setAnswer("");
      setGateError("");
      stopBackgroundMusic();
      router.push(exitHref);
      return;
    }

    if (trimmed !== "" && Number(trimmed) === challenge.answer) {
      setGateOpen(false);
      setAnswer("");
      setGateError("");
      stopBackgroundMusic();
      router.push(exitHref);
    } else {
      setGateError(
        `Ask a grown-up to solve ${challenge.expression} to exit Kids Mode.`
      );
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="md"
        onClick={openGate}
        aria-label="Grown-Up Exit"
        className="rounded-2xl min-h-11 px-3 sm:px-4 text-xs sm:text-sm shrink-0"
      >
        <Lock className="h-4 w-4 shrink-0" />
        <span>
          <span className="hidden min-[380px]:inline">Grown-Up </span>Exit
        </span>
      </Button>

      <Dialog
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        size="md"
        title="Grown-Up Check"
        description={
          hasPin
            ? "Enter your 4-digit Parent PIN to leave Kids Mode."
            : "To leave Kids Mode and return to the adult portal, please solve the quick check below."
        }
      >
        <form onSubmit={handleUnlock} className="space-y-4">
          {hasPin ? (
            <div className="rounded-2xl bg-[#FFF9F0] border-2 border-[#78C8F5] px-4 py-4 text-center space-y-1">
              <p className="inline-flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#175B82]">
                <KeyRound className="h-3.5 w-3.5" />
                Parent PIN Protected
              </p>
              <span className="block font-display text-xl font-bold text-[#24334D]">
                Enter 4-Digit Parent PIN
              </span>
            </div>
          ) : (
            <div className="rounded-2xl bg-[#FFF9F0] border-2 border-[#FFE58A] px-4 py-4 sm:py-5 flex items-center justify-between gap-3">
              <div className="flex-1 text-center space-y-1">
                <p className="inline-flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#9A7100]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Solve to Unlock
                </p>
                <span
                  data-testid="grownup-prompt"
                  className="block font-display text-2xl sm:text-3xl font-bold text-[#24334D]"
                >
                  {challenge.prompt}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleNewQuestion}
                aria-label="New Question"
                title="New Question"
                className="rounded-xl shrink-0"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="grownup-gate-answer"
              className="block text-xs font-bold text-[#24334D]/75"
            >
              {hasPin ? "4-digit PIN" : "Enter your answer"}
            </label>
            <Input
              ref={inputRef}
              id="grownup-gate-answer"
              type={hasPin ? "password" : "number"}
              inputMode="numeric"
              maxLength={hasPin ? 4 : undefined}
              placeholder={hasPin ? "••••" : "Type answer..."}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              aria-label={hasPin ? "Parent PIN" : "Grown-Up Gate Math Answer"}
              className="text-center font-display text-xl font-bold h-12"
            />
          </div>

          {gateError && (
            <p className="rounded-xl bg-[#FFE3DE] border border-[#FF9C8C] px-3.5 py-2.5 text-sm font-semibold text-[#8E3022]">
              {gateError}
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setGateOpen(false)}
              className="w-full sm:w-auto"
            >
              Stay in Kids Mode
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={verifyingPin}
              className="w-full sm:w-auto"
            >
              {verifyingPin ? "Checking..." : "Unlock Portal"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
