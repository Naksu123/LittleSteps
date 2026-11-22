import { loginSchema, registerSchema } from "@/lib/validation";

describe("Authentication validation schemas", () => {
  it("validates valid login input and rejects empty password", () => {
    expect(
      loginSchema.safeParse({
        email: "parent@littlesteps.edu",
        password: "LittleSteps2026!",
      }).success
    ).toBe(true);

    expect(
      loginSchema.safeParse({
        email: "not-an-email",
        password: "",
      }).success
    ).toBe(false);
  });

  it("requires guardian privacy consent and matching passwords on registration", () => {
    const missingConsent = registerSchema.safeParse({
      full_name: "Maria Reyes",
      email: "maria@example.com",
      password: "Password123!",
      confirm_password: "Password123!",
      privacy_consent_accepted: false,
    });
    expect(missingConsent.success).toBe(false);

    const mismatchedPasswords = registerSchema.safeParse({
      full_name: "Maria Reyes",
      email: "maria@example.com",
      password: "Password123!",
      confirm_password: "DifferentPassword!",
      privacy_consent_accepted: true,
    });
    expect(mismatchedPasswords.success).toBe(false);

    const valid = registerSchema.safeParse({
      full_name: "Maria Reyes",
      email: "maria@example.com",
      password: "Password123!",
      confirm_password: "Password123!",
      privacy_consent_accepted: true,
    });
    expect(valid.success).toBe(true);
  });
});
