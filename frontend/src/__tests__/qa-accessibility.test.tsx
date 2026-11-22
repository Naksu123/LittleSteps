import { fireEvent, render, screen } from "@testing-library/react";
import LandingPage from "@/app/page";
import LoginPage from "@/app/login/page";
import StaffGatePage from "@/app/staff-gate/page";
import { KidsNav } from "@/components/layout/KidsNav";

const loginMock = jest.fn();
const staffLoginMock = jest.fn();
const pushMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: jest.fn(),
  }),
  usePathname: () => "/",
}));

jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    login: loginMock,
    staffLogin: staffLoginMock,
    user: null,
    isLoading: false,
    isAuthenticated: false,
  }),
}));

describe("Phase 8 QA & Child-Safety Accessibility Checks", () => {
  it("renders public family portals and hides staff portals and demo banners on LandingPage", () => {
    render(<LandingPage />);

    expect(screen.getByText("Kids Learning Portal")).toBeInTheDocument();
    expect(screen.getByText("Parent & Guardian Hub")).toBeInTheDocument();
    expect(screen.getByText("Start Learning")).toBeInTheDocument();

    expect(screen.queryByText("Explore Demo Portals")).not.toBeInTheDocument();
    expect(screen.queryByText("Teacher Classroom")).not.toBeInTheDocument();
    expect(screen.queryByText("School Admin Console")).not.toBeInTheDocument();

    expect(screen.getByText("Alphabet & Language")).toBeInTheDocument();
    expect(screen.getByText("Mathematics")).toBeInTheDocument();
    expect(screen.getByText("Science & Discovery")).toBeInTheDocument();
    expect(screen.getByText("Social & Emotional")).toBeInTheDocument();
    expect(screen.getByText("Arts & Creativity")).toBeInTheDocument();
    expect(screen.getByText("Life Skills")).toBeInTheDocument();
  });

  it("provides accessible form labels, password toggle, and zero demo quick-fill accounts on LoginPage", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText("Email Address")).toBeInTheDocument();
    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
    expect(passwordInput.type).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(passwordInput.type).toBe("text");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(passwordInput.type).toBe("password");

    expect(screen.queryByText(/Academic Demo Quick-Fill/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Parent \(Maria/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Teacher \(Teacher Maya\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Admin \(Principal Elena\)/i)).not.toBeInTheDocument();
  });

  it("renders private staff gate form with access code toggles and zero demo hints", () => {
    render(<StaffGatePage />);

    expect(screen.getByLabelText("Email Address")).toBeInTheDocument();
    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
    const accessCodeInput = screen.getByLabelText("Staff Access Code") as HTMLInputElement;
    expect(passwordInput.type).toBe("password");
    expect(accessCodeInput.type).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(passwordInput.type).toBe("text");

    fireEvent.click(screen.getByRole("button", { name: "Show staff access code" }));
    expect(accessCodeInput.type).toBe("text");

    expect(screen.queryByText(/Academic Demo Quick-Fill/i)).not.toBeInTheDocument();
  });

  it("guarantees zero external URLs inside KidsNav child navigation", () => {
    const { container } = render(
      <KidsNav activeTab="home" onSelectTab={jest.fn()} exitHref="/parent" />
    );

    const anchors = Array.from(container.querySelectorAll("a"));
    const externalAnchors = anchors.filter((a) =>
      /^https?:\/\//i.test(a.getAttribute("href") || "")
    );
    expect(externalAnchors).toHaveLength(0);
    expect(screen.getByRole("button", { name: /Home/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /My Rewards/i })).toBeInTheDocument();
  });
});
