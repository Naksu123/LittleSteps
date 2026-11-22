import { render, screen } from "@testing-library/react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

const mockUseAuth = jest.fn();

jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: jest.fn(),
    push: jest.fn(),
  }),
}));

describe("ProtectedRoute role guard", () => {
  it("blocks parent from accessing admin-only portal", () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: "u1",
        email: "parent@littlesteps.edu",
        full_name: "Maria Reyes",
        is_active: true,
        roles: ["parent"],
      },
      isLoading: false,
      isAuthenticated: true,
    });

    render(
      <ProtectedRoute allowedRoles={["admin"]}>
        <div>Secret Admin Console</div>
      </ProtectedRoute>
    );

    expect(screen.queryByText("Secret Admin Console")).not.toBeInTheDocument();
    expect(screen.getByText("Portal Access Restricted")).toBeInTheDocument();
  });

  it("renders protected portal content when role matches", () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: "u2",
        email: "admin@littlesteps.edu",
        full_name: "Principal Elena",
        is_active: true,
        roles: ["admin"],
      },
      isLoading: false,
      isAuthenticated: true,
    });

    render(
      <ProtectedRoute allowedRoles={["admin"]}>
        <div>Secret Admin Console</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("Secret Admin Console")).toBeInTheDocument();
  });
});
