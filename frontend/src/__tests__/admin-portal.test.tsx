import { render, screen, waitFor } from "@testing-library/react";
import {
  adminCreateClassSchema,
  adminCreateSubjectSchema,
  adminCreateUserSchema,
} from "@/lib/validation";
import AdminPage from "@/app/admin/page";

const systemHealthMock = jest.fn();
const analyticsMock = jest.fn();
const auditLogsMock = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: "admin-1",
      email: "admin@littlesteps.edu",
      full_name: "Principal Elena Santos",
      is_active: true,
      roles: ["admin"],
    },
    isLoading: false,
    isAuthenticated: true,
    logout: jest.fn(),
  }),
}));

jest.mock("@/services/api", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
  adminApi: {
    systemHealth: (...args: unknown[]) => systemHealthMock(...args),
    analytics: (...args: unknown[]) => analyticsMock(...args),
    auditLogs: (...args: unknown[]) => auditLogsMock(...args),
  },
}));

jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="recharts-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="recharts-barchart">{children}</div>
  ),
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
}));

describe("Admin Portal validation schemas & console", () => {
  beforeEach(() => {
    systemHealthMock.mockResolvedValue({
      status: "healthy",
      database_status: "connected",
      storage_backend: "local",
      environment: "development",
      counts: {
        users: 4,
        children: 3,
        classes: 2,
        subjects: 6,
        themes: 12,
        lessons: 6,
        games: 10,
      },
    });
    analyticsMock.mockResolvedValue({
      users_by_role: { admin: 1, teacher: 1, parent: 2 },
      active_users: 4,
      inactive_users: 0,
      total_children: 3,
      active_learners_7d: 3,
      total_lessons_completed: 5,
      total_game_attempts: 8,
      total_home_activities_completed: 2,
      total_storage_items: 2,
      total_storage_bytes: 2048,
      daily_activity: [
        { day: "Mon 17", lessons: 2, games: 3, home_activities: 1 },
      ],
      subject_distribution: [
        { subject_name: "Mathematics", lessons: 2, games: 3, color_hex: "#78C8F5" },
      ],
    });
    auditLogsMock.mockResolvedValue([
      {
        id: "log-1",
        actor_email: "admin@littlesteps.edu",
        action: "admin.setting_updated",
        resource_type: "platform_setting",
        resource_id: "max_upload_mb",
        details_json: { value_keys: ["limit"] },
        created_at: "2026-11-22T08:00:00Z",
      },
    ]);
  });

  it("validates admin user, class, and subject creation schemas", () => {
    expect(
      adminCreateUserSchema.safeParse({
        full_name: "Teacher Ana",
        email: "ana@littlesteps.edu",
        password: "Password123!",
        role: "teacher",
      }).success
    ).toBe(true);

    expect(
      adminCreateUserSchema.safeParse({
        full_name: "A",
        email: "not-an-email",
        password: "123",
        role: "teacher",
      }).success
    ).toBe(false);

    expect(
      adminCreateClassSchema.safeParse({
        name: "Starlight Kinders",
        age_group: "4-5",
        academic_year: "2026-2027",
        room_label: "Room B",
      }).success
    ).toBe(true);

    expect(
      adminCreateSubjectSchema.safeParse({
        name: "Music & Rhythm",
        description: "Sing along and clap rhythms.",
        icon_key: "music",
        color_hex: "#B8A5F5",
        sort_order: 7,
      }).success
    ).toBe(true);
  });

  it("renders Cloud System Health, Analytics KPIs, and Audit Logs", async () => {
    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText("Cloud System Health")).toBeInTheDocument();
    });

    expect(screen.getByText("healthy")).toBeInTheDocument();
    expect(screen.getByText("DB: connected")).toBeInTheDocument();
    expect(screen.getByText("Storage: local")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
    expect(screen.getByText("admin.setting_updated")).toBeInTheDocument();
  });
});
