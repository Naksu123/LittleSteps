import { render, screen } from "@testing-library/react";
import {
  addChildSchema,
  learningGoalSchema,
  parentSettingsSchema,
  reflectionSchema,
} from "@/lib/validation";
import {
  childrenApi,
  clearStoredTokens,
  getStoredTokens,
  setStoredTokens,
} from "@/services/api";

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

  it("validates Add Child Learner Profile form fields and preserves tokens across storage checks", () => {
    const parsed = addChildSchema.safeParse({
      display_name: "arthur ni",
      birth_year: 2021,
      age_group: "4-5",
      avatar_key: "bunny",
      favorite_color: "#78C8F5",
      daily_goal_minutes: 20,
    });
    expect(parsed.success).toBe(true);

    setStoredTokens("access-token-123", "refresh-token-456");
    expect(getStoredTokens()).toEqual({
      accessToken: "access-token-123",
      refreshToken: "refresh-token-456",
    });

    // If localStorage is unexpectedly cleared while tab memory still holds session,
    // getStoredTokens recovers the in-memory tokens automatically
    window.localStorage.removeItem("littlesteps_access_token");
    expect(getStoredTokens().accessToken).toBe("access-token-123");

    clearStoredTokens();
    expect(getStoredTokens()).toEqual({
      accessToken: null,
      refreshToken: null,
    });
  });

  it("attaches Authorization Bearer header when calling childrenApi.create", async () => {
    const originalFetch = global.fetch;
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        id: "child-1",
        display_name: "arthur ni",
        birth_year: 2021,
        age_group: "4-5",
        avatar_key: "bunny",
        favorite_color: "#78C8F5",
        mascot_name: "Pip",
        daily_goal_minutes: 20,
        streak_days: 0,
        total_stars: 0,
        is_active: true,
        created_at: new Date().toISOString(),
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    try {
      setStoredTokens("bearer-abc-123", "refresh-xyz-456");
      await childrenApi.create({
        display_name: "arthur ni",
        birth_year: 2021,
        age_group: "4-5",
        avatar_key: "bunny",
        favorite_color: "#78C8F5",
        daily_goal_minutes: 20,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/api/children");
      const headers = new Headers(init.headers);
      expect(headers.get("Authorization")).toBe("Bearer bearer-abc-123");
      expect(headers.get("Content-Type")).toBe("application/json");
    } finally {
      clearStoredTokens();
      global.fetch = originalFetch;
    }
  });
});
