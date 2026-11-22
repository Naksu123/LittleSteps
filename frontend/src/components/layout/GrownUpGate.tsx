"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, RefreshCw } from "lucide-react";
import {
  generateGrownUpChallenge,
  type GrownUpChallenge,
} from "@/lib/grownUpGate";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface GrownUpGateProps {
  exitHref?: string;
}

export function GrownUpGate({ exitHref = "/parent" }: GrownUpGateProps) {
  const router = useRouter();
  const [gateOpen, setGateOpen] = useState(false);
  const [challenge, setChallenge] = useState<GrownUpChallenge>(() =>
    generateGrownUpChallenge()
  );
  const [answer, setAnswer] = useState("");
  const [gateError, setGateError] = useState("");

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
  }

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = answer.trim();
    if (trimmed !== "" && Number(trimmed) === challenge.answer) {
      setGateOpen(false);
      setAnswer("");
      setGateError("");
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
        title="Grown-Up Check"
        description="To leave Kids Mode and return to the adult portal, please answer:"
      >
        <form onSubmit={handleUnlock} className="space-y-4">
          <div className="rounded-2xl bg-[#FFF9F0] p-4 flex items-center justify-between gap-2">
            <span
              data-testid="grownup-prompt"
              className="font-display text-2xl font-bold text-[#24334D] flex-1 text-center"
            >
              {challenge.prompt}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleNewQuestion}
              aria-label="New Question"
              title="New Question"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="Enter answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            aria-label="Grown-Up Gate Math Answer"
          />
          {gateError && (
            <p className="text-sm font-semibold text-[#8E3022]">{gateError}</p>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setGateOpen(false)}
              className="w-full sm:w-auto"
            >
              Stay in Kids Mode
            </Button>
            <Button type="submit" variant="primary" className="w-full sm:w-auto">
              Unlock Portal
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
