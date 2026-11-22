export type UserRole = "parent" | "teacher" | "admin";

export interface UserSummary {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  roles: UserRole[];
  last_login_at?: string | null;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: UserSummary;
}

export interface Child {
  id: string;
  display_name: string;
  birth_year?: number;
  age_group: string;
  avatar_key: string;
  favorite_color: string;
  mascot_name?: string;
  daily_goal_minutes?: number;
  streak_days: number;
  total_stars: number;
  is_active?: boolean;
}

export interface MeResponse {
  user: UserSummary;
  children: Child[];
}

export interface Subject {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon_key: string;
  color_hex: string;
  sort_order: number;
  lesson_count: number;
}

export interface LearningObjective {
  id: string;
  statement: string;
  sort_order: number;
}

export interface ParentGuide {
  id: string;
  what_child_learns: string;
  why_it_matters: string;
  materials_needed_json: string[];
  conversation_prompts_json: string[];
  learning_tip: string;
  estimated_duration_mins: number;
  teacher_notes?: string | null;
}

export interface HomeActivity {
  id: string;
  title: string;
  instructions_json: string[];
  materials_json: string[];
  estimated_minutes: number;
  sort_order: number;
  completed: boolean;
}

export interface Theme {
  id: string;
  week_number: number;
  slug: string;
  title: string;
  summary: string;
  color_hex: string;
  status: string;
  published_at?: string | null;
}

export interface LessonSlide {
  title: string;
  text: string;
  emoji: string;
  narration?: string;
}

export interface ActivityItem {
  id: string;
  title: string;
  activity_type: string;
  instructions: string;
  payload_json: ChoiceConfig | Record<string, unknown>;
  sort_order: number;
}

export interface Lesson {
  id: string;
  subject_id: string;
  theme_id?: string | null;
  slug: string;
  title: string;
  summary: string;
  content_json: {
    skill?: string;
    slides?: LessonSlide[];
    encouragement?: string;
    [key: string]: unknown;
  };
  age_group: string;
  estimated_minutes: number;
  audio_narration_text?: string | null;
  status: string;
}

export interface LessonDetail extends Lesson {
  activities: ActivityItem[];
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options_json: string[];
  correct_option_index: number;
  encouragement_text: string;
  sort_order: number;
}

export interface Quiz {
  id: string;
  title: string;
  instructions: string;
  passing_stars: number;
  questions: QuizQuestion[];
}

export interface ChoiceOption {
  key: string;
  text?: string;
  emoji?: string;
  label?: string;
  hex?: string;
}

export type ChoiceVisual =
  | null
  | { kind: "emoji"; value: string }
  | { kind: "count"; emoji: string; count: number }
  | { kind: "sequence"; items: string[] }
  | { kind: "sound"; text: string; animal?: string; label?: string };

export interface ChoiceRound {
  prompt: string;
  speak?: string;
  visual?: ChoiceVisual;
  choices: ChoiceOption[];
  answer: string;
}

export interface ChoiceConfig {
  engine: "choice";
  skill?: string;
  feedback?: string[];
  weekly_key?: string;
  weekly_label?: string;
  rounds: ChoiceRound[];
}

export interface SortBin {
  key: string;
  label: string;
  emoji?: string;
  shape?: string;
}

export interface SortItem {
  id: string;
  label: string;
  emoji?: string;
  shape?: string;
  color?: string;
  bin: string;
}

export interface SortConfig {
  engine: "sort";
  skill?: string;
  feedback?: string[];
  weekly_key?: string;
  weekly_label?: string;
  bins: SortBin[];
  items: SortItem[];
}

export interface MemoryPair {
  key: string;
  emoji: string;
  label: string;
}

export interface MemoryConfig {
  engine: "memory";
  skill?: string;
  feedback?: string[];
  weekly_key?: string;
  weekly_label?: string;
  pairs: MemoryPair[];
}

export interface PuzzlePicture {
  emoji: string;
  label: string;
  bg: string;
}

export interface PuzzleConfig {
  engine: "puzzle";
  skill?: string;
  feedback?: string[];
  weekly_key?: string;
  weekly_label?: string;
  grid: number;
  pictures: PuzzlePicture[];
}

export type GameConfig =
  | ChoiceConfig
  | SortConfig
  | MemoryConfig
  | PuzzleConfig;

export interface GameResult {
  score_pct: number;
  attempts_count: number;
  duration_seconds: number;
}

export interface ThemeDetail extends Theme {
  objectives: LearningObjective[];
  parent_guide?: ParentGuide | null;
  home_activities: HomeActivity[];
  lessons: Lesson[];
}

export interface Game {
  id: string;
  slug: string;
  title: string;
  game_type: string;
  subject_id: string;
  theme_id?: string | null;
  instructions: string;
  difficulty_level: string;
  config_json: GameConfig | Record<string, unknown>;
  status: string;
}

export interface ProgressResult {
  stars_awarded: number;
  total_stars: number;
  streak_days: number;
  new_rewards: Reward[];
  encouragement: string;
  score_pct?: number | null;
  correct_count?: number | null;
  total_questions?: number | null;
}

export interface LessonStatusItem {
  lesson_id: string;
  status: string;
  completion_pct: number;
  stars_earned: number;
}

export interface ProgressSummary {
  child: Child;
  lesson_statuses: LessonStatusItem[];
  completed_game_ids: string[];
  rewards: Reward[];
  today_minutes: number;
}

export interface Artwork {
  id: string;
  title: string;
  palette_used_json: string[];
  approved_by_parent: boolean;
  created_at: string;
  image_url: string;
}

export interface Reward {
  id: string;
  badge_key: string;
  title: string;
  description: string;
  stars_value: number;
  awarded_at: string;
}

export interface SkillProgress {
  id: string;
  subject_id: string;
  subject_name: string;
  skill_name: string;
  mastery_pct: number;
  practice_count: number;
}

export interface ChildProgress {
  child: Child;
  lessons_completed: number;
  total_lessons: number;
  games_played: number;
  home_activities_completed: number;
  total_time_minutes: number;
  rewards: Reward[];
  skills: SkillProgress[];
}

export interface WeeklyActivityPoint {
  day: string;
  minutes: number;
  lessons: number;
}

export interface ParentChildDashboardItem {
  child: Child;
  lessons_completed: number;
  total_lessons: number;
  total_time_minutes: number;
  recent_rewards: Reward[];
  skills: SkillProgress[];
  weekly_activity: WeeklyActivityPoint[];
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  published_at: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationList {
  unread_count: number;
  items: NotificationItem[];
}

export interface Worksheet {
  id: string;
  title: string;
  description: string;
  storage_key: string;
  age_group: string;
}

export interface ParentReflection {
  id: string;
  child_id: string;
  theme_id: string;
  theme_title: string;
  week_number: number;
  enjoyed: boolean;
  easy_concepts?: string | null;
  challenging_concepts?: string | null;
  discovery_notes?: string | null;
  created_at: string;
}

export interface HomeActivityProgressResult {
  home_activity_id: string;
  child_id: string;
  completed: boolean;
  completed_at?: string | null;
  stars_awarded: number;
  total_stars: number;
}

export interface LearningGoal {
  id: string;
  child_id: string;
  title: string;
  target_minutes_per_day: number;
  target_lessons_per_week: number;
  is_active: boolean;
  created_at: string;
}

export interface ParentSettings {
  preferred_language: "en" | "fil" | string;
  daily_screen_limit_mins: number;
  notifications_enabled: boolean;
}

export interface ActivityHistoryItem {
  activity_type: "lesson" | "game" | "quiz" | "home_activity";
  title: string;
  occurred_at: string;
  stars_earned: number;
  minutes: number;
}

export interface TeacherObservation {
  id: string;
  teacher_name: string;
  category: string;
  observation_text: string;
  observed_at: string;
}

export interface TeacherFeedbackItem {
  id: string;
  teacher_name: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface AssignedActivity {
  id: string;
  title: string;
  lesson_id?: string | null;
  game_id?: string | null;
  due_date?: string | null;
  completed: boolean;
}

export interface RecommendedHomeActivity {
  home_activity_id: string;
  theme_id: string;
  week_number: number;
  theme_title: string;
  title: string;
  materials: string[];
  estimated_minutes: number;
}

export interface WeeklyReport {
  generated_at: string;
  week_start: string;
  week_end: string;
  child: Child;
  this_week_minutes: number;
  previous_week_minutes: number;
  this_week_lessons: number;
  previous_week_lessons: number;
  games_played_this_week: number;
  home_activities_completed_this_week: number;
  encouraging_summary: string;
  strengths: SkillProgress[];
  areas_to_practice: SkillProgress[];
  activity_history: ActivityHistoryItem[];
  rewards: Reward[];
  recommended_home_activities: RecommendedHomeActivity[];
  teacher_observations: TeacherObservation[];
  teacher_feedback: TeacherFeedbackItem[];
  assigned_activities: AssignedActivity[];
  reflections: ParentReflection[];
}

export interface ParentDashboardData {
  children: ParentChildDashboardItem[];
  current_theme?: ThemeDetail | null;
  announcements: Announcement[];
  notifications: NotificationItem[];
}

export interface ParentHomeLearningTheme {
  theme: Theme;
  parent_guide?: ParentGuide | null;
  home_activities: HomeActivity[];
  objectives?: LearningObjective[];
  worksheets?: Worksheet[];
  reflections?: ParentReflection[];
}

export interface TeacherClass {
  id: string;
  name: string;
  age_group: string;
  academic_year: string;
  room_label?: string | null;
  student_count: number;
}

export interface TeacherStudent {
  id: string;
  display_name: string;
  age_group: string;
  avatar_key: string;
  class_name: string;
  total_stars: number;
  streak_days: number;
  lessons_completed: number;
}

export interface LessonResource {
  id: string;
  lesson_id: string;
  title: string;
  resource_type: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
}

export interface TeacherAssignment {
  id: string;
  title: string;
  class_id?: string | null;
  class_name?: string | null;
  child_id?: string | null;
  child_name?: string | null;
  lesson_id?: string | null;
  game_id?: string | null;
  due_date?: string | null;
  completed_count: number;
  target_count: number;
  created_at: string;
}

export interface TeacherStudentDetail {
  child: Child;
  class_names: string[];
  lessons_completed: number;
  total_lessons: number;
  games_played: number;
  total_time_minutes: number;
  skills: SkillProgress[];
  rewards: Reward[];
  observations: TeacherObservation[];
  reflections: ParentReflection[];
}

export interface ClassPerformanceSummary {
  class_id: string;
  class_name: string;
  student_count: number;
  avg_stars: number;
  total_lessons_completed: number;
  active_learners: number;
}

export interface SubjectMasteryPoint {
  subject_name: string;
  avg_mastery_pct: number;
  color_hex: string;
}

export interface StudentGuidanceItem {
  child_id: string;
  display_name: string;
  avatar_key: string;
  class_name: string;
  reason: string;
  lessons_completed: number;
  lowest_skill?: string | null;
}

export interface WeeklyCompletionPoint {
  day: string;
  lessons: number;
  games: number;
}

export interface TeacherAnalytics {
  total_classes: number;
  total_students: number;
  active_learners_this_week: number;
  average_lessons_completed: number;
  completion_rate_pct: number;
  class_summaries: ClassPerformanceSummary[];
  subject_averages: SubjectMasteryPoint[];
  students_needing_guidance: StudentGuidanceItem[];
  weekly_completions: WeeklyCompletionPoint[];
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  roles: UserRole[];
  last_login_at?: string | null;
  created_at: string;
}

export interface AdminClassTeacher {
  teacher_user_id: string;
  full_name: string;
  email: string;
  is_lead: boolean;
}

export interface AdminClassStudent {
  child_id: string;
  display_name: string;
  age_group: string;
  avatar_key: string;
  status: string;
}

export interface AdminClass {
  id: string;
  name: string;
  age_group: string;
  academic_year: string;
  room_label?: string | null;
  is_active: boolean;
  teachers: AdminClassTeacher[];
  students: AdminClassStudent[];
  created_at: string;
}

export interface AdminChildSummary {
  id: string;
  display_name: string;
  age_group: string;
  avatar_key: string;
  is_active: boolean;
  parent_names: string[];
  class_ids: string[];
  class_names: string[];
  total_stars: number;
  streak_days: number;
}

export interface AdminSubject {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon_key: string;
  color_hex: string;
  sort_order: number;
  is_active: boolean;
  lesson_count: number;
  game_count: number;
}

export interface AdminContentSummary {
  lessons: Lesson[];
  themes: Theme[];
}

export interface AdminStorageItem {
  id: string;
  item_type: "lesson_resource" | "child_artwork";
  title: string;
  storage_key: string;
  mime_type: string;
  file_size_bytes: number;
  parent_label: string;
  created_at: string;
}

export interface AdminStorageOverview {
  storage_backend: string;
  total_items: number;
  total_bytes: number;
  items: AdminStorageItem[];
}

export interface AdminDailyActivityPoint {
  day: string;
  lessons: number;
  games: number;
  home_activities: number;
}

export interface AdminSubjectDistributionPoint {
  subject_name: string;
  lessons: number;
  games: number;
  color_hex: string;
}

export interface AdminAnalytics {
  users_by_role: Record<string, number>;
  active_users: number;
  inactive_users: number;
  total_children: number;
  active_learners_7d: number;
  total_lessons_completed: number;
  total_game_attempts: number;
  total_home_activities_completed: number;
  total_storage_items: number;
  total_storage_bytes: number;
  daily_activity: AdminDailyActivityPoint[];
  subject_distribution: AdminSubjectDistributionPoint[];
}

export interface PlatformSetting {
  key: string;
  value_json: Record<string, unknown>;
  description?: string | null;
  updated_at: string;
}

export interface SystemHealth {
  status: string;
  database_status: string;
  storage_backend: string;
  environment: string;
  counts: Record<string, number>;
}

export interface AuditLogItem {
  id: string;
  actor_email?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  details_json: Record<string, unknown>;
  created_at: string;
}
