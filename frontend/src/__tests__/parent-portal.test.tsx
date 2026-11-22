import { render, screen } from "@testing-library/react";
import {
  learningGoalSchema,
  parentSettingsSchema,
  reflectionSchema,
} from "@/lib/validation";

describe("Parent Portal validation schemas", () => {
  it("validates parent reflections and rejects overly long notes", () => {
    expect(
      reflectionSchema.safeParse({
        enjoyed: true,
        easy_concepts: "Primary colors",
        discovery_notes: "Matched red apples and toys!",
      }).success
    ).toBe(true);

    expect(
      reflectionSchema.safeParse({
        enjoyed: false,
        discovery_notes: "a".repeat(1600),
      }).success
    ).toBe(false);
  });

  it("enforces safe bounds on learning goals and screen-time settings", () => {
    expect(
      learningGoalSchema.safeParse({
        title: "20 minutes of playful reading",
        target_minutes_per_day: 20,
        target_lessons_per_week: 4,
      }).success
    ).toBe(true);

    expect(
      learningGoalSchema.safeParse({
        title: "Too intense",
        target_minutes_per_day: 240,
        target_lessons_per_week: 3,
      }).success
    ).toBe(false);

    expect(
      parentSettingsSchema.safeParse({
        preferred_language: "en",
        daily_screen_limit_mins: 5,
        notifications_enabled: true,
      }).success
    ).toBe(false);

    expect(
      parentSettingsSchema.safeParse({
        preferred_language: "fil",
        daily_screen_limit_mins: 30,
        notifications_enabled: true,
      }).success
    ).toBe(true);
  });

  it("renders encouraging non-competitive parent progress summary", () => {
    render(
      <section aria-label="Weekly Report Summary">
        <h2>Mia&apos;s Weekly Report</h2>
        <p>Mia spent 29 minutes exploring colors and letters this week!</p>
      </section>
    );

    expect(screen.getByText("Mia's Weekly Report")).toBeInTheDocument();
    expect(screen.queryByText(/rank|leaderboard|percentile/i)).toBeNull();
  });
});
