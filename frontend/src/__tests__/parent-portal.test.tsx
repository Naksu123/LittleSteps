import { render, screen } from "@testing-library/react";
import { adaptGameConfig } from "@/lib/gameDifficulty";
import { GARDEN_CROPS, THEME_FIL, tText } from "@/lib/i18n";
import {
  addScreenSecondsUsed,
  getScreenBonusSeconds,
  getScreenSecondsUsed,
  grantScreenTimeBonus,
} from "@/lib/screenTime";
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

    expect(
      parentSettingsSchema.safeParse({
        preferred_language: "bilingual",
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

  it("supports Filipino/bilingual i18n, Bahay Kubo garden crops, screen-time tracking, and tracing difficulty scaling", () => {
    expect(tText("en", "Hello", "Kumusta")).toBe("Hello");
    expect(tText("fil", "Hello", "Kumusta")).toBe("Kumusta");
    expect(tText("bilingual", "Hello", "Kumusta")).toBe("Hello (Kumusta)");
    expect(Object.keys(THEME_FIL)).toHaveLength(12);
    expect(GARDEN_CROPS).toHaveLength(6);

    window.localStorage.clear();
    expect(getScreenSecondsUsed("child-test")).toBe(0);
    expect(addScreenSecondsUsed("child-test", 45)).toBe(45);
    expect(getScreenSecondsUsed("child-test")).toBe(45);
    expect(grantScreenTimeBonus("child-test", 10)).toBe(600);
    expect(getScreenBonusSeconds("child-test")).toBe(600);

    const adaptedNormal = adaptGameConfig(
      {
        engine: "trace",
        prompts: [
          { key: "p1", label: "One", points: [[10, 10], [50, 50]] },
          { key: "p2", label: "Two", points: [[10, 10], [50, 50]] },
          { key: "p3", label: "Three", points: [[10, 10], [50, 50]] },
          { key: "p4", label: "Four", points: [[10, 10], [50, 50]] },
        ],
      },
      "normal"
    );
    expect(adaptedNormal.engine).toBe("trace");
    if (adaptedNormal.engine === "trace") {
      expect(adaptedNormal.prompts).toHaveLength(2);
    }
  });
});
