import { act, fireEvent, render, screen } from "@testing-library/react";
import { ChoiceGame } from "@/components/games/ChoiceGame";
import { ENCOURAGE_TRY } from "@/lib/gameScoring";
import type { ChoiceConfig } from "@/types";

const SAMPLE_CONFIG: ChoiceConfig = {
  engine: "choice",
  skill: "Alphabet",
  rounds: [
    {
      prompt: "Find the letter B!",
      choices: [
        { key: "B", text: "B" },
        { key: "D", text: "D" },
        { key: "P", text: "P" },
      ],
      answer: "B",
    },
    {
      prompt: "Find the letter A!",
      choices: [
        { key: "A", text: "A" },
        { key: "E", text: "E" },
        { key: "O", text: "O" },
      ],
      answer: "A",
    },
  ],
};

describe("ChoiceGame engine", () => {
  it("shows encouraging non-punitive feedback and scores first-try accuracy", () => {
    jest.useFakeTimers();
    const onComplete = jest.fn();

    render(
      <ChoiceGame config={SAMPLE_CONFIG} onComplete={onComplete} shuffle={false} />
    );

    // Miss round 1 first
    fireEvent.click(screen.getByRole("button", { name: "D" }));
    const statusText = screen.getByRole("status").textContent || "";
    expect(ENCOURAGE_TRY.some((phrase) => statusText.includes(phrase))).toBe(true);
    expect(screen.queryByText(/wrong|failed/i)).toBeNull();

    // Now pick the right answer on round 1
    fireEvent.click(screen.getByRole("button", { name: "B" }));
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Round 2 first-try correct
    fireEvent.click(screen.getByRole("button", { name: "A" }));
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        score_pct: 50,
        attempts_count: 3,
      })
    );

    jest.useRealTimers();
  });
});
