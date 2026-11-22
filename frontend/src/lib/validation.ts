import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
  password: z.string().min(1, "Please enter your password."),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const staffLoginSchema = z.object({
  email: z.string().trim().email("Please enter a valid staff email address."),
  password: z.string().min(1, "Please enter your password."),
  access_code: z.string().trim().min(1, "Please enter the staff access code."),
});

export type StaffLoginFormValues = z.infer<typeof staffLoginSchema>;

export const registerSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(2, "Please enter your full name (at least 2 characters).")
      .max(150),
    email: z.string().trim().email("Please enter a valid email address."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long.")
      .max(128),
    confirm_password: z.string().min(1, "Please confirm your password."),
    privacy_consent_accepted: z
      .boolean()
      .refine((val) => val === true, {
        message: "Parent/guardian privacy consent is required to register.",
      }),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match.",
    path: ["confirm_password"],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const addChildSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, "Please enter your child's first name or nickname.")
    .max(80),
  birth_year: z.coerce
    .number()
    .int()
    .min(2018, "Birth year must be 2018 or later.")
    .max(2024, "Birth year must be 2024 or earlier."),
  age_group: z.enum(["4-5", "5-6", "4-6"]),
  avatar_key: z.string().min(1),
  favorite_color: z.string().min(4),
  daily_goal_minutes: z.coerce.number().int().min(5).max(120),
});

export type AddChildFormValues = z.infer<typeof addChildSchema>;

export const editChildSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, "Please enter your child's first name or nickname.")
    .max(80),
  age_group: z.enum(["4-5", "5-6", "4-6"]),
  avatar_key: z.string().min(1),
  favorite_color: z.string().min(4),
  daily_goal_minutes: z.coerce.number().int().min(5).max(120),
});

export type EditChildFormValues = z.infer<typeof editChildSchema>;

export const reflectionSchema = z.object({
  enjoyed: z.boolean(),
  easy_concepts: z.string().max(1000).optional(),
  challenging_concepts: z.string().max(1000).optional(),
  discovery_notes: z.string().max(1500).optional(),
});

export type ReflectionFormValues = z.infer<typeof reflectionSchema>;

export const learningGoalSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Please describe the learning goal.")
    .max(160),
  target_minutes_per_day: z.coerce
    .number()
    .int()
    .min(5, "Minimum is 5 minutes per day.")
    .max(120, "Maximum is 120 minutes per day."),
  target_lessons_per_week: z.coerce
    .number()
    .int()
    .min(1, "At least 1 lesson per week.")
    .max(21, "Maximum is 21 lessons per week."),
});

export type LearningGoalFormValues = z.infer<typeof learningGoalSchema>;

export const parentSettingsSchema = z.object({
  preferred_language: z.enum(["en", "fil"]),
  daily_screen_limit_mins: z.coerce
    .number()
    .int()
    .min(10, "Screen limit must be at least 10 minutes.")
    .max(120, "Screen limit cannot exceed 120 minutes."),
  notifications_enabled: z.boolean(),
});

export type ParentSettingsFormValues = z.infer<typeof parentSettingsSchema>;

export const createLessonSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Please enter a lesson title.")
    .max(160),
  subject_id: z.string().min(1, "Please select a subject."),
  theme_id: z.string().optional(),
  summary: z
    .string()
    .trim()
    .min(2, "Please enter a brief summary.")
    .max(1000),
  age_group: z.enum(["4-5", "5-6", "4-6"]),
  estimated_minutes: z.coerce.number().int().min(3).max(60),
  audio_narration_text: z.string().max(1500).optional(),
  status: z.enum(["draft", "published"]),
  slide_title: z.string().trim().min(1, "Slide title is required.").max(120),
  slide_text: z.string().trim().min(1, "Slide story text is required.").max(600),
  slide_emoji: z.string().trim().min(1).max(16),
});

export type CreateLessonFormValues = z.infer<typeof createLessonSchema>;

export const createThemeSchema = z.object({
  week_number: z.coerce.number().int().min(1).max(52),
  title: z.string().trim().min(2, "Please enter a theme title.").max(150),
  summary: z.string().trim().min(2, "Please enter a summary.").max(1000),
  color_hex: z.string().min(4),
  status: z.enum(["draft", "published"]),
  what_child_learns: z.string().max(1000).optional(),
  learning_tip: z.string().max(1000).optional(),
});

export type CreateThemeFormValues = z.infer<typeof createThemeSchema>;

export const createAssignmentSchema = z
  .object({
    title: z.string().trim().min(2, "Please enter an assignment title.").max(160),
    class_id: z.string().optional(),
    child_id: z.string().optional(),
    lesson_id: z.string().optional(),
    game_id: z.string().optional(),
    due_date: z.string().optional(),
  })
  .refine((d) => Boolean(d.class_id || d.child_id), {
    message: "Please select a class or individual student.",
    path: ["class_id"],
  })
  .refine((d) => Boolean(d.lesson_id || d.game_id), {
    message: "Please select a lesson or game.",
    path: ["lesson_id"],
  });

export type CreateAssignmentFormValues = z.infer<typeof createAssignmentSchema>;

export const teacherObservationSchema = z.object({
  child_id: z.string().min(1, "Please select a student."),
  class_id: z.string().optional(),
  category: z.string().min(1),
  observation_text: z
    .string()
    .trim()
    .min(2, "Please write a brief classroom observation.")
    .max(1500),
});

export type TeacherObservationFormValues = z.infer<
  typeof teacherObservationSchema
>;

export const teacherFeedbackSchema = z.object({
  child_id: z.string().min(1, "Please select a student."),
  message: z
    .string()
    .trim()
    .min(2, "Please write an encouraging message for the parent.")
    .max(1500),
});

export type TeacherFeedbackFormValues = z.infer<typeof teacherFeedbackSchema>;

export const announcementSchema = z.object({
  title: z.string().trim().min(2, "Please enter an announcement title.").max(160),
  body: z.string().trim().min(2, "Please write the announcement message.").max(2000),
  class_id: z.string().optional(),
});

export type AnnouncementFormValues = z.infer<typeof announcementSchema>;

export const adminCreateUserSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters.")
    .max(150),
  email: z.string().trim().email("Please enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long.")
    .max(128),
  role: z.enum(["parent", "teacher", "admin"]),
});

export type AdminCreateUserFormValues = z.infer<typeof adminCreateUserSchema>;

export const adminCreateClassSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter a class name.")
    .max(120),
  age_group: z.enum(["4-5", "5-6", "4-6"]),
  academic_year: z
    .string()
    .trim()
    .min(4, "Please enter an academic year (e.g., 2026-2027).")
    .max(30),
  room_label: z.string().max(50).optional(),
});

export type AdminCreateClassFormValues = z.infer<typeof adminCreateClassSchema>;

export const adminCreateSubjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter a subject module name.")
    .max(120),
  description: z
    .string()
    .trim()
    .min(2, "Please enter a brief subject description.")
    .max(1000),
  icon_key: z.string().trim().min(1, "Icon key is required.").max(50),
  color_hex: z.string().trim().min(4, "Please pick a color hex value.").max(20),
  sort_order: z.coerce.number().int().min(0).max(999),
});

export type AdminCreateSubjectFormValues = z.infer<typeof adminCreateSubjectSchema>;
