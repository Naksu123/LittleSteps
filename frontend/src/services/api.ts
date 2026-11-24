import type {
  ActivityItem,
  AdminAnalytics,
  AdminChildSummary,
  AdminClass,
  AdminContentSummary,
  AdminStorageOverview,
  AdminSubject,
  AdminUser,
  Announcement,
  Artwork,
  AuditLogItem,
  Child,
  ChildProgress,
  Game,
  HomeActivityProgressResult,
  LearningGoal,
  Lesson,
  LessonDetail,
  LessonResource,
  MeResponse,
  NotificationItem,
  NotificationList,
  ParentDashboardData,
  ParentHomeLearningTheme,
  ParentReflection,
  ParentSettings,
  PlatformSetting,
  ProgressResult,
  ProgressSummary,
  Quiz,
  Subject,
  SystemHealth,
  TeacherAnalytics,
  TeacherAssignment,
  TeacherClass,
  TeacherFeedbackItem,
  TeacherObservation,
  TeacherStudent,
  TeacherStudentDetail,
  Theme,
  ThemeDetail,
  TokenResponse,
  UserRole,
  WeeklyReport,
} from "@/types";

function getApiBase(): string {
  const configured = (process.env.NEXT_PUBLIC_API_URL || "")
    .trim()
    .replace(/\/$/, "");
  const isRemoteBrowser =
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";

  if (configured) {
    if (
      isRemoteBrowser &&
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured)
    ) {
      return "";
    }
    return configured;
  }
  if (isRemoteBrowser) {
    return "";
  }
  return "http://127.0.0.1:8000";
}

const CONTENT_CACHE_TTL_MS = 60_000;
const PORTAL_CACHE_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 200;
const GET_TIMEOUT_MS = 15_000;
const MUTATION_TIMEOUT_MS = 25_000;
const responseCache = new Map<string, { expiresAt: number; value: unknown }>();
const inflightRequests = new Map<string, Promise<unknown>>();
const staleBrowserContentPaths = new Set<string>();

function deleteKeysMatching(predicate: (key: string) => boolean): void {
  for (const key of responseCache.keys()) {
    if (predicate(key)) {
      responseCache.delete(key);
    }
  }
  for (const key of inflightRequests.keys()) {
    if (predicate(key)) {
      inflightRequests.delete(key);
    }
  }
}

export function invalidatePortalCache(): void {
  deleteKeysMatching((key) => !key.startsWith("content:"));
}

export function invalidateApiCache(): void {
  invalidatePortalCache();
}

export function invalidateContentCache(): void {
  deleteKeysMatching(
    (key) =>
      key.startsWith("content:") ||
      key === "admin:content" ||
      key === "teacher:lessons" ||
      key.startsWith("teacher:themes")
  );
  staleBrowserContentPaths.add("/api/subjects");
  staleBrowserContentPaths.add("/api/themes");
  staleBrowserContentPaths.add("/api/lessons");
  staleBrowserContentPaths.add("/api/games");
}

function setBoundedCache(key: string, value: unknown, ttlMs: number): void {
  if (!responseCache.has(key) && responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey !== undefined) {
      responseCache.delete(oldestKey);
    }
  }
  responseCache.set(key, {
    expiresAt: Date.now() + ttlMs,
    value,
  });
}

async function cachedGet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = CONTENT_CACHE_TTL_MS
): Promise<T> {
  if (process.env.NODE_ENV === "test") {
    return fetcher();
  }
  const now = Date.now();
  const hit = responseCache.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.value as T;
  }
  const inflight = inflightRequests.get(key);
  if (inflight) {
    return inflight as Promise<T>;
  }
  const promise = fetcher()
    .then((res) => {
      setBoundedCache(key, res, ttlMs);
      return res;
    })
    .finally(() => {
      inflightRequests.delete(key);
    });
  inflightRequests.set(key, promise);
  return promise;
}

const ACCESS_TOKEN_KEY = "littlesteps_access_token";
const REFRESH_TOKEN_KEY = "littlesteps_refresh_token";
const AUTH_EXPIRED_EVENT = "littlesteps-auth-expired";

let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function onAuthExpired(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(AUTH_EXPIRED_EVENT, listener);
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, listener);
}

function notifyAuthExpired(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  } catch {
    // Ignore event dispatch errors
  }
}

function isJwtExpiredOrExpiring(token: string, bufferSeconds = 20): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof window !== "undefined" && typeof window.atob === "function"
        ? window.atob(base64)
        : Buffer.from(base64, "base64").toString("utf-8");
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== "number") return false;
    return payload.exp * 1000 <= Date.now() + bufferSeconds * 1000;
  } catch {
    return false;
  }
}

export function getStoredTokens(): {
  accessToken: string | null;
  refreshToken: string | null;
} {
  if (typeof window === "undefined") {
    return {
      accessToken: memoryAccessToken,
      refreshToken: memoryRefreshToken,
    };
  }
  try {
    const lsAccess = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    const lsRefresh = window.localStorage.getItem(REFRESH_TOKEN_KEY);
    if (lsAccess) memoryAccessToken = lsAccess;
    if (lsRefresh) memoryRefreshToken = lsRefresh;
    if (!lsAccess && memoryAccessToken) {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, memoryAccessToken);
    }
    if (!lsRefresh && memoryRefreshToken) {
      window.localStorage.setItem(REFRESH_TOKEN_KEY, memoryRefreshToken);
    }
  } catch {
    // Fall back to in-memory tokens if storage is restricted
  }
  return {
    accessToken: memoryAccessToken,
    refreshToken: memoryRefreshToken,
  };
}

export function setStoredTokens(accessToken: string, refreshToken: string): void {
  memoryAccessToken = accessToken;
  memoryRefreshToken = refreshToken;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } catch {
    // Keep in-memory tokens active
  }
}

export function clearStoredTokens(): void {
  memoryAccessToken = null;
  memoryRefreshToken = null;
  responseCache.clear();
  inflightRequests.clear();
  staleBrowserContentPaths.clear();
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Ignore storage removal errors
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function attemptTokenRefresh(): Promise<string | null> {
  const { refreshToken } = getStoredTokens();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${getApiBase()}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            clearStoredTokens();
          }
          return null;
        }
        const data = (await res.json()) as TokenResponse;
        setStoredTokens(data.access_token, data.refresh_token);
        return data.access_token;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

async function ensureAccessToken(retryOnAuth: boolean): Promise<string | null> {
  let { accessToken } = getStoredTokens();
  const { refreshToken } = getStoredTokens();

  if (
    retryOnAuth &&
    refreshToken &&
    (!accessToken || isJwtExpiredOrExpiring(accessToken))
  ) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      accessToken = refreshed;
    }
  }
  return accessToken;
}

function formatFriendlyErrorMessage(
  status: number,
  rawDetail: string | undefined,
  isPublicAuthEndpoint: boolean,
  path = ""
): string {
  if (isPublicAuthEndpoint && rawDetail) {
    return rawDetail;
  }
  if (status === 401) {
    if (
      !rawDetail ||
      rawDetail.includes("Authentication credentials were not provided")
    ) {
      return "We couldn't verify your account. Please sign in again.";
    }
    return "Your session has expired. Please sign in again.";
  }
  if (status === 403) {
    if (
      !rawDetail ||
      rawDetail.includes("permission") ||
      rawDetail.includes("not authorized")
    ) {
      return "You don't have permission to perform this action.";
    }
    return rawDetail;
  }
  if (status === 503) {
    return "The LittleSteps service is temporarily unavailable while the database is being configured. Please try again shortly.";
  }
  if (status >= 500) {
    return path.startsWith("/api/children")
      ? "Something went wrong while saving the profile. Please try again."
      : "Something went wrong on our server. Please try again.";
  }
  return rawDetail || "Something went wrong. Please try again.";
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  retryOnAuth = true
): Promise<T> {
  const isPublicAuthEndpoint =
    path === "/api/auth/login" ||
    path === "/api/auth/staff-login" ||
    path === "/api/auth/register" ||
    path === "/api/auth/refresh";

  const accessToken = isPublicAuthEndpoint
    ? null
    : await ensureAccessToken(retryOnAuth);

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const method = (options.method || "GET").toUpperCase();
  const basePath = path.split("?")[0];
  let cacheMode = options.cache;
  if (!cacheMode && method === "GET" && staleBrowserContentPaths.size > 0) {
    const matchedPrefix = Array.from(staleBrowserContentPaths).find((p) =>
      basePath.startsWith(p)
    );
    if (matchedPrefix) {
      cacheMode = "no-cache";
      if (basePath === matchedPrefix) {
        staleBrowserContentPaths.delete(matchedPrefix);
      }
    }
  }

  let controller: AbortController | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  if (!options.signal && typeof AbortController !== "undefined") {
    controller = new AbortController();
    const timeoutMs = method === "GET" ? GET_TIMEOUT_MS : MUTATION_TIMEOUT_MS;
    timeoutId = setTimeout(() => controller?.abort(), timeoutMs);
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBase()}${path}`, {
      ...options,
      headers,
      ...(cacheMode ? { cache: cacheMode } : {}),
      ...(controller ? { signal: controller.signal } : {}),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(
        "The request took too long. Please check your connection and try again.",
        408
      );
    }
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  if (response.status === 401 && retryOnAuth && !isPublicAuthEndpoint) {
    const newAccess = await attemptTokenRefresh();
    if (newAccess) {
      return apiRequest<T>(path, options, false);
    }
    notifyAuthExpired();
  }

  if (response.ok && method !== "GET") {
    invalidatePortalCache();
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const rawDetail =
      typeof data?.detail === "string" ? data.detail : undefined;
    const detail = formatFriendlyErrorMessage(
      response.status,
      rawDetail,
      isPublicAuthEndpoint,
      path
    );
    throw new ApiError(detail, response.status);
  }

  return data as T;
}

export async function apiFetchBlob(
  path: string,
  retryOnAuth = true
): Promise<string> {
  const accessToken = await ensureAccessToken(retryOnAuth);
  const headers = new Headers();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${getApiBase()}${path}`, { headers });

  if (response.status === 401 && retryOnAuth) {
    const newAccess = await attemptTokenRefresh();
    if (newAccess) {
      return apiFetchBlob(path, false);
    }
    notifyAuthExpired();
  }

  if (!response.ok) {
    throw new ApiError("Could not load artwork image.", response.status);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

async function apiUpload<T>(
  path: string,
  formData: FormData,
  retryOnAuth = true
): Promise<T> {
  const accessToken = await ensureAccessToken(retryOnAuth);
  const headers = new Headers();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${getApiBase()}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (response.status === 401 && retryOnAuth) {
    const newAccess = await attemptTokenRefresh();
    if (newAccess) {
      return apiUpload<T>(path, formData, false);
    }
    notifyAuthExpired();
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      typeof data?.detail === "string"
        ? data.detail
        : "File upload failed. Please check file type and size.";
    throw new ApiError(detail, response.status);
  }
  invalidateApiCache();
  return data as T;
}

export const authApi = {
  register: (payload: {
    email: string;
    password: string;
    full_name: string;
    privacy_consent_accepted: boolean;
  }) =>
    apiRequest<TokenResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  login: (payload: { email: string; password: string }) =>
    apiRequest<TokenResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  staffLogin: (payload: {
    email: string;
    password: string;
    access_code: string;
  }) =>
    apiRequest<TokenResponse>("/api/auth/staff-login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  logout: (refreshToken: string | null) =>
    apiRequest<void>(
      "/api/auth/logout",
      {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
      false
    ),
  me: () => apiRequest<MeResponse>("/api/auth/me"),
};

export const childrenApi = {
  list: () =>
    cachedGet(
      "children:list",
      () => apiRequest<Child[]>("/api/children"),
      PORTAL_CACHE_TTL_MS
    ),
  progress: (childId: string) =>
    cachedGet(
      `children:progress:${childId}`,
      () => apiRequest<ChildProgress>(`/api/children/${childId}/progress`),
      PORTAL_CACHE_TTL_MS
    ),
  create: (payload: {
    display_name: string;
    birth_year: number;
    age_group: string;
    avatar_key: string;
    favorite_color: string;
    daily_goal_minutes: number;
  }) =>
    apiRequest<Child>("/api/children", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (
    childId: string,
    payload: {
      display_name?: string;
      birth_year?: number;
      age_group?: string;
      avatar_key?: string;
      favorite_color?: string;
      daily_goal_minutes?: number;
    }
  ) =>
    apiRequest<Child>(`/api/children/${childId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  growGarden: (
    childId: string,
    payload: {
      crop_key: "kalabasa" | "kamatis" | "sitaw" | "talong" | "saging" | "sampaguita";
      use_resource: "sunbeam" | "raindrop";
    }
  ) =>
    apiRequest<Child>(`/api/children/${childId}/garden/grow`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  exportData: (childId: string) =>
    apiRequest<Record<string, unknown>>(`/api/children/${childId}/export`),
  remove: (childId: string) =>
    apiRequest<void>(`/api/children/${childId}`, {
      method: "DELETE",
    }),
};

export const contentApi = {
  subjects: () =>
    cachedGet("content:subjects", () => apiRequest<Subject[]>("/api/subjects")),
  themes: () =>
    cachedGet("content:themes", () => apiRequest<Theme[]>("/api/themes")),
  themeDetail: (id: string) =>
    cachedGet(`content:theme:${id}`, () =>
      apiRequest<ThemeDetail>(`/api/themes/${id}`)
    ),
  lessons: () =>
    cachedGet("content:lessons", () => apiRequest<Lesson[]>("/api/lessons")),
  lessonDetail: (id: string) =>
    cachedGet(`content:lesson:${id}`, () =>
      apiRequest<LessonDetail>(`/api/lessons/${id}`)
    ),
  lessonQuiz: (id: string) =>
    cachedGet(`content:lesson-quiz:${id}`, () =>
      apiRequest<Quiz | null>(`/api/lessons/${id}/quiz`)
    ),
  games: () =>
    cachedGet("content:games", async () => {
      const list = await apiRequest<Game[]>("/api/games");
      for (const g of list) {
        setBoundedCache(`content:game:${g.id}`, g, CONTENT_CACHE_TTL_MS);
      }
      return list;
    }),
  gamesSummary: () =>
    cachedGet("content:games-summary", () =>
      apiRequest<Game[]>("/api/games?include_config=false")
    ),
  game: (id: string) =>
    cachedGet(`content:game:${id}`, () => apiRequest<Game>(`/api/games/${id}`)),
};

export const progressApi = {
  lesson: (payload: {
    child_id: string;
    lesson_id: string;
    status: "in_progress" | "completed";
    completion_pct: number;
    time_spent_seconds: number;
  }) =>
    apiRequest<ProgressResult>("/api/progress/lesson", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  activity: (payload: {
    child_id: string;
    game_id?: string;
    activity_id?: string;
    score_pct: number;
    attempts_count: number;
    duration_seconds: number;
    completed: boolean;
  }) =>
    apiRequest<ProgressResult>("/api/progress/activity", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  quiz: (payload: { child_id: string; quiz_id: string; answers: number[] }) =>
    apiRequest<ProgressResult>("/api/progress/quiz", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  summary: (childId: string) =>
    cachedGet(
      `progress:summary:${childId}`,
      () => apiRequest<ProgressSummary>(`/api/progress/summary/${childId}`),
      PORTAL_CACHE_TTL_MS
    ),
};

export const artworkApi = {
  list: (childId: string) =>
    apiRequest<Artwork[]>(`/api/children/${childId}/artworks`),
  create: (
    childId: string,
    payload: { title: string; image_data: string; palette_used: string[] }
  ) =>
    apiRequest<Artwork>(`/api/children/${childId}/artworks`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  remove: (childId: string, artworkId: string) =>
    apiRequest<void>(`/api/children/${childId}/artworks/${artworkId}`, {
      method: "DELETE",
    }),
  updateApproval: (childId: string, artworkId: string, approved: boolean) =>
    apiRequest<Artwork>(
      `/api/children/${childId}/artworks/${artworkId}/approval`,
      {
        method: "PATCH",
        body: JSON.stringify({ approved_by_parent: approved }),
      }
    ),
  imageUrl: (childId: string, artworkId: string) =>
    apiFetchBlob(`/api/children/${childId}/artworks/${artworkId}/image`),
};

export const parentApi = {
  dashboard: () =>
    cachedGet(
      "parent:dashboard",
      () => apiRequest<ParentDashboardData>("/api/parent/dashboard"),
      PORTAL_CACHE_TTL_MS
    ),
  homeLearning: (childId?: string) => {
    const query = childId ? `?child_id=${encodeURIComponent(childId)}` : "";
    return cachedGet(
      `parent:home-learning:${childId || "default"}`,
      () =>
        apiRequest<ParentHomeLearningTheme[]>(
          `/api/parent/home-learning${query}`
        ),
      PORTAL_CACHE_TTL_MS
    );
  },
  toggleHomeActivity: (
    homeActivityId: string,
    payload: { child_id: string; completed: boolean }
  ) =>
    apiRequest<HomeActivityProgressResult>(
      `/api/parent/home-activities/${homeActivityId}/progress`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),
  reflections: (childId?: string, themeId?: string) => {
    const params = new URLSearchParams();
    if (childId) params.set("child_id", childId);
    if (themeId) params.set("theme_id", themeId);
    const qs = params.toString();
    return cachedGet(
      `parent:reflections:${childId || "all"}:${themeId || "all"}`,
      () =>
        apiRequest<ParentReflection[]>(
          `/api/parent/reflections${qs ? `?${qs}` : ""}`
        ),
      PORTAL_CACHE_TTL_MS
    );
  },
  createReflection: (payload: {
    child_id: string;
    theme_id: string;
    enjoyed: boolean;
    easy_concepts?: string;
    challenging_concepts?: string;
    discovery_notes?: string;
  }) =>
    apiRequest<ParentReflection>("/api/parent/reflections", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  goals: (childId?: string) => {
    const query = childId ? `?child_id=${encodeURIComponent(childId)}` : "";
    return cachedGet(
      `parent:goals:${childId || "all"}`,
      () => apiRequest<LearningGoal[]>(`/api/parent/goals${query}`),
      PORTAL_CACHE_TTL_MS
    );
  },
  createGoal: (payload: {
    child_id: string;
    title: string;
    target_minutes_per_day: number;
    target_lessons_per_week: number;
    is_active?: boolean;
  }) =>
    apiRequest<LearningGoal>("/api/parent/goals", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateGoal: (
    goalId: string,
    payload: {
      title?: string;
      target_minutes_per_day?: number;
      target_lessons_per_week?: number;
      is_active?: boolean;
    }
  ) =>
    apiRequest<LearningGoal>(`/api/parent/goals/${goalId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteGoal: (goalId: string) =>
    apiRequest<void>(`/api/parent/goals/${goalId}`, {
      method: "DELETE",
    }),
  settings: () =>
    cachedGet(
      "parent:settings",
      () => apiRequest<ParentSettings>("/api/parent/settings"),
      PORTAL_CACHE_TTL_MS
    ),
  updateSettings: (payload: {
    preferred_language?: "en" | "fil" | "bilingual";
    daily_screen_limit_mins?: number;
    notifications_enabled?: boolean;
    parent_pin?: string;
    clear_parent_pin?: boolean;
  }) =>
    apiRequest<ParentSettings>("/api/parent/settings", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  verifyPin: (pin: string) =>
    apiRequest<{ valid: boolean }>("/api/parent/verify-pin", {
      method: "POST",
      body: JSON.stringify({ pin }),
    }),
  notifications: () =>
    cachedGet(
      "parent:notifications",
      () => apiRequest<NotificationList>("/api/parent/notifications"),
      PORTAL_CACHE_TTL_MS
    ),
  markNotificationRead: (id: string) =>
    apiRequest<NotificationItem>(`/api/parent/notifications/${id}/read`, {
      method: "PATCH",
    }),
  markAllNotificationsRead: () =>
    apiRequest<{ updated: number }>("/api/parent/notifications/read-all", {
      method: "POST",
    }),
  report: (childId?: string) => {
    const query = childId ? `?child_id=${encodeURIComponent(childId)}` : "";
    return cachedGet(
      `parent:report:${childId || "default"}`,
      () => apiRequest<WeeklyReport>(`/api/parent/reports${query}`),
      PORTAL_CACHE_TTL_MS
    );
  },
};

export const teacherApi = {
  classes: () =>
    cachedGet(
      "teacher:classes",
      () => apiRequest<TeacherClass[]>("/api/teacher/classes"),
      PORTAL_CACHE_TTL_MS
    ),
  students: (classId?: string) => {
    const query = classId ? `?class_id=${encodeURIComponent(classId)}` : "";
    return cachedGet(
      `teacher:students:${classId || "all"}`,
      () => apiRequest<TeacherStudent[]>(`/api/teacher/students${query}`),
      PORTAL_CACHE_TTL_MS
    );
  },
  studentProgress: (childId: string) =>
    cachedGet(
      `teacher:student-progress:${childId}`,
      () =>
        apiRequest<TeacherStudentDetail>(
          `/api/teacher/students/${childId}/progress`
        ),
      PORTAL_CACHE_TTL_MS
    ),
  analytics: (classId?: string) => {
    const query = classId ? `?class_id=${encodeURIComponent(classId)}` : "";
    return cachedGet(
      `teacher:analytics:${classId || "all"}`,
      () => apiRequest<TeacherAnalytics>(`/api/teacher/analytics${query}`),
      PORTAL_CACHE_TTL_MS
    );
  },
  lessons: () =>
    cachedGet(
      "teacher:lessons",
      () => apiRequest<Lesson[]>("/api/teacher/lessons"),
      PORTAL_CACHE_TTL_MS
    ),
  createLesson: async (payload: {
    title: string;
    subject_id: string;
    theme_id?: string | null;
    summary: string;
    age_group: string;
    estimated_minutes: number;
    audio_narration_text?: string;
    status: "draft" | "published" | "archived";
    skill?: string;
    slides: Array<{
      title: string;
      text: string;
      emoji: string;
      narration?: string;
    }>;
  }) => {
    const res = await apiRequest<Lesson>("/api/teacher/lessons", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    invalidateContentCache();
    return res;
  },
  updateLesson: async (
    lessonId: string,
    payload: {
      title?: string;
      summary?: string;
      status?: "draft" | "published" | "archived";
    }
  ) => {
    const res = await apiRequest<Lesson>(`/api/teacher/lessons/${lessonId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    invalidateContentCache();
    return res;
  },
  createActivity: (payload: {
    lesson_id: string;
    title: string;
    instructions: string;
    prompt: string;
    choices: string[];
    correct_index: number;
  }) =>
    apiRequest<ActivityItem>("/api/teacher/activities", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  lessonResources: (lessonId: string) =>
    cachedGet(
      `teacher:lesson-resources:${lessonId}`,
      () =>
        apiRequest<LessonResource[]>(
          `/api/teacher/lessons/${lessonId}/resources`
        ),
      PORTAL_CACHE_TTL_MS
    ),
  uploadLessonResource: (lessonId: string, title: string, file: File) => {
    const fd = new FormData();
    fd.append("title", title);
    fd.append("file", file);
    return apiUpload<LessonResource>(
      `/api/teacher/lessons/${lessonId}/resources`,
      fd
    );
  },
  themes: () =>
    cachedGet(
      "teacher:themes",
      () => apiRequest<Theme[]>("/api/teacher/themes"),
      PORTAL_CACHE_TTL_MS
    ),
  createTheme: async (payload: {
    week_number: number;
    title: string;
    summary: string;
    color_hex: string;
    status: "draft" | "published" | "archived";
    what_child_learns?: string;
    learning_tip?: string;
  }) => {
    const res = await apiRequest<Theme>("/api/teacher/themes", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    invalidateContentCache();
    return res;
  },
  updateTheme: async (
    themeId: string,
    payload: { status?: "draft" | "published" | "archived"; title?: string }
  ) => {
    const res = await apiRequest<Theme>(`/api/teacher/themes/${themeId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    invalidateContentCache();
    return res;
  },
  assignments: () =>
    cachedGet(
      "teacher:assignments",
      () => apiRequest<TeacherAssignment[]>("/api/teacher/assignments"),
      PORTAL_CACHE_TTL_MS
    ),
  createAssignment: (payload: {
    title: string;
    class_id?: string | null;
    child_id?: string | null;
    lesson_id?: string | null;
    game_id?: string | null;
    due_date?: string | null;
  }) =>
    apiRequest<TeacherAssignment>("/api/teacher/assignments", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteAssignment: (id: string) =>
    apiRequest<void>(`/api/teacher/assignments/${id}`, {
      method: "DELETE",
    }),
  observations: (childId?: string) => {
    const query = childId ? `?child_id=${encodeURIComponent(childId)}` : "";
    return cachedGet(
      `teacher:observations:${childId || "all"}`,
      () =>
        apiRequest<TeacherObservation[]>(
          `/api/teacher/observations${query}`
        ),
      PORTAL_CACHE_TTL_MS
    );
  },
  createObservation: (payload: {
    child_id: string;
    class_id?: string | null;
    category: string;
    observation_text: string;
  }) =>
    apiRequest<TeacherObservation>("/api/teacher/observations", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  feedback: (childId?: string) => {
    const query = childId ? `?child_id=${encodeURIComponent(childId)}` : "";
    return cachedGet(
      `teacher:feedback:${childId || "all"}`,
      () =>
        apiRequest<TeacherFeedbackItem[]>(`/api/teacher/feedback${query}`),
      PORTAL_CACHE_TTL_MS
    );
  },
  createFeedback: (payload: { child_id: string; message: string }) =>
    apiRequest<TeacherFeedbackItem>("/api/teacher/feedback", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  reflections: (childId?: string) => {
    const query = childId ? `?child_id=${encodeURIComponent(childId)}` : "";
    return cachedGet(
      `teacher:reflections:${childId || "all"}`,
      () => apiRequest<ParentReflection[]>(`/api/teacher/reflections${query}`),
      PORTAL_CACHE_TTL_MS
    );
  },
  announcements: () =>
    cachedGet(
      "teacher:announcements",
      () => apiRequest<Announcement[]>("/api/teacher/announcements"),
      PORTAL_CACHE_TTL_MS
    ),
  createAnnouncement: (payload: {
    title: string;
    body: string;
    class_id?: string | null;
  }) =>
    apiRequest<Announcement>("/api/teacher/announcements", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export const adminApi = {
  users: (
    params?:
      | string
      | { search?: string; role?: string; is_active?: boolean }
  ) => {
    const query = new URLSearchParams();
    if (typeof params === "string") {
      if (params.trim()) query.set("search", params.trim());
    } else if (params) {
      if (params.search?.trim()) query.set("search", params.search.trim());
      if (params.role?.trim()) query.set("role", params.role.trim());
      if (params.is_active !== undefined) {
        query.set("is_active", String(params.is_active));
      }
    }
    const qs = query.toString();
    return cachedGet(
      `admin:users:${qs || "all"}`,
      () => apiRequest<AdminUser[]>(`/api/admin/users${qs ? `?${qs}` : ""}`),
      PORTAL_CACHE_TTL_MS
    );
  },
  createUser: (payload: {
    email: string;
    full_name: string;
    password: string;
    role: UserRole;
    is_active?: boolean;
  }) =>
    apiRequest<AdminUser>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateUser: (
    userId: string,
    payload: { is_active?: boolean; full_name?: string; roles?: UserRole[] }
  ) =>
    apiRequest<AdminUser>(`/api/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  updateUserStatus: (userId: string, is_active: boolean) =>
    apiRequest<AdminUser>(`/api/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active }),
    }),
  children: () =>
    cachedGet(
      "admin:children",
      () => apiRequest<AdminChildSummary[]>("/api/admin/children"),
      PORTAL_CACHE_TTL_MS
    ),
  classes: () =>
    cachedGet(
      "admin:classes",
      () => apiRequest<AdminClass[]>("/api/admin/classes"),
      PORTAL_CACHE_TTL_MS
    ),
  createClass: (payload: {
    name: string;
    age_group: "Pre-School" | "3-4" | "4-5" | "5-6" | "4-6";
    academic_year: string;
    room_label?: string;
    is_active?: boolean;
  }) =>
    apiRequest<AdminClass>("/api/admin/classes", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateClass: (
    classId: string,
    payload: {
      name?: string;
      age_group?: "Pre-School" | "3-4" | "4-5" | "5-6" | "4-6";
      academic_year?: string;
      room_label?: string | null;
      is_active?: boolean;
    }
  ) =>
    apiRequest<AdminClass>(`/api/admin/classes/${classId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  assignTeacher: (
    classId: string,
    payload: { teacher_user_id: string; is_lead?: boolean }
  ) =>
    apiRequest<AdminClass>(`/api/admin/classes/${classId}/teachers`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  removeTeacher: (classId: string, teacherId: string) =>
    apiRequest<void>(`/api/admin/classes/${classId}/teachers/${teacherId}`, {
      method: "DELETE",
    }),
  enrollChild: (classId: string, payload: { child_id: string }) =>
    apiRequest<AdminClass>(`/api/admin/classes/${classId}/enrollments`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  unenrollChild: (classId: string, childId: string) =>
    apiRequest<void>(`/api/admin/classes/${classId}/enrollments/${childId}`, {
      method: "DELETE",
    }),
  subjects: () =>
    cachedGet(
      "admin:subjects",
      () => apiRequest<AdminSubject[]>("/api/admin/subjects"),
      PORTAL_CACHE_TTL_MS
    ),
  createSubject: async (payload: {
    name: string;
    description: string;
    icon_key: string;
    color_hex: string;
    sort_order: number;
    is_active?: boolean;
  }) => {
    const res = await apiRequest<AdminSubject>("/api/admin/subjects", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    invalidateContentCache();
    return res;
  },
  updateSubject: async (
    subjectId: string,
    payload: {
      name?: string;
      description?: string;
      icon_key?: string;
      color_hex?: string;
      sort_order?: number;
      is_active?: boolean;
    }
  ) => {
    const res = await apiRequest<AdminSubject>(`/api/admin/subjects/${subjectId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    invalidateContentCache();
    return res;
  },
  content: () =>
    cachedGet(
      "admin:content",
      () => apiRequest<AdminContentSummary>("/api/admin/content"),
      PORTAL_CACHE_TTL_MS
    ),
  updateLessonStatus: async (
    lessonId: string,
    status: "draft" | "published" | "archived"
  ) => {
    const res = await apiRequest<Lesson>(`/api/admin/lessons/${lessonId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    invalidateContentCache();
    return res;
  },
  updateThemeStatus: async (
    themeId: string,
    status: "draft" | "published" | "archived"
  ) => {
    const res = await apiRequest<Theme>(`/api/admin/themes/${themeId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    invalidateContentCache();
    return res;
  },
  analytics: () =>
    cachedGet(
      "admin:analytics",
      () => apiRequest<AdminAnalytics>("/api/admin/analytics"),
      PORTAL_CACHE_TTL_MS
    ),
  storage: () =>
    cachedGet(
      "admin:storage",
      () => apiRequest<AdminStorageOverview>("/api/admin/storage"),
      PORTAL_CACHE_TTL_MS
    ),
  deleteStorageItem: (
    itemType: "lesson_resource" | "child_artwork",
    itemId: string
  ) =>
    apiRequest<void>(`/api/admin/storage/${itemType}/${itemId}`, {
      method: "DELETE",
    }),
  settings: () =>
    cachedGet(
      "admin:settings",
      () => apiRequest<PlatformSetting[]>("/api/admin/settings"),
      PORTAL_CACHE_TTL_MS
    ),
  upsertSetting: (
    key: string,
    payload: { value_json: Record<string, unknown>; description?: string }
  ) =>
    apiRequest<PlatformSetting>(`/api/admin/settings/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  systemHealth: () =>
    cachedGet(
      "admin:system-health",
      () => apiRequest<SystemHealth>("/api/admin/system-health"),
      PORTAL_CACHE_TTL_MS
    ),
  auditLogs: (params?: {
    limit?: number;
    action?: string;
    resource_type?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.action?.trim()) query.set("action", params.action.trim());
    if (params?.resource_type?.trim()) {
      query.set("resource_type", params.resource_type.trim());
    }
    const qs = query.toString();
    return cachedGet(
      `admin:audit-logs:${qs || "default"}`,
      () =>
        apiRequest<AuditLogItem[]>(
          `/api/admin/audit-logs${qs ? `?${qs}` : ""}`
        ),
      PORTAL_CACHE_TTL_MS
    );
  },
};

export function prefetchPortalData(
  href: string,
  activeChildId?: string | null
): void {
  if (typeof window === "undefined" || process.env.NODE_ENV === "test") {
    return;
  }
  if (!getStoredTokens().accessToken) {
    return;
  }
  const cleanPath = href.split("?")[0];
  const cid = activeChildId || undefined;
  switch (cleanPath) {
    case "/parent":
      void parentApi.dashboard().catch(() => {});
      break;
    case "/parent/home-learning":
      void parentApi.homeLearning(cid).catch(() => {});
      break;
    case "/parent/reports":
      void parentApi.report(cid).catch(() => {});
      break;
    case "/parent/settings":
      void parentApi.goals(cid).catch(() => {});
      void parentApi.settings().catch(() => {});
      break;
    case "/kids":
      void contentApi.subjects().catch(() => {});
      void contentApi.themes().catch(() => {});
      void contentApi.lessons().catch(() => {});
      void contentApi.gamesSummary().catch(() => {});
      if (cid) {
        void progressApi.summary(cid).catch(() => {});
      }
      break;
    case "/teacher":
      void teacherApi.classes().catch(() => {});
      void teacherApi.students().catch(() => {});
      void contentApi.themes().catch(() => {});
      void teacherApi.reflections().catch(() => {});
      break;
    case "/teacher/lessons":
      void teacherApi.lessons().catch(() => {});
      void teacherApi.themes().catch(() => {});
      void contentApi.subjects().catch(() => {});
      break;
    case "/teacher/assignments":
      void teacherApi.assignments().catch(() => {});
      void teacherApi.classes().catch(() => {});
      void teacherApi.students().catch(() => {});
      void contentApi.lessons().catch(() => {});
      void contentApi.gamesSummary().catch(() => {});
      break;
    case "/teacher/analytics":
      void teacherApi.analytics().catch(() => {});
      void teacherApi.classes().catch(() => {});
      break;
    case "/admin":
      void adminApi.systemHealth().catch(() => {});
      void adminApi.analytics().catch(() => {});
      void adminApi.auditLogs({ limit: 8 }).catch(() => {});
      break;
    case "/admin/users":
      void adminApi.users().catch(() => {});
      break;
    case "/admin/classes":
      void adminApi.classes().catch(() => {});
      void adminApi.children().catch(() => {});
      void adminApi.users({ is_active: true }).catch(() => {});
      break;
    case "/admin/content":
      void adminApi.subjects().catch(() => {});
      void adminApi.content().catch(() => {});
      void adminApi.storage().catch(() => {});
      break;
    case "/admin/settings":
      void adminApi.settings().catch(() => {});
      void adminApi.systemHealth().catch(() => {});
      void adminApi.auditLogs({ limit: 30 }).catch(() => {});
      break;
    default:
      break;
  }
}
