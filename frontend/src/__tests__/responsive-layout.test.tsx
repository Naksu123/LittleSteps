import fs from "fs";
import path from "path";
import { fireEvent, render, screen } from "@testing-library/react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { PortalShell } from "@/components/layout/PortalShell";
import { KidsNav } from "@/components/layout/KidsNav";
import { Dialog } from "@/components/ui/dialog";
import { formatCompactSubjectLabel } from "@/lib/utils";

const pushMock = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/parent",
  useRouter: () => ({
    push: pushMock,
    replace: jest.fn(),
  }),
}));

jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: "parent-1",
      email: "maria@littlesteps.edu",
      full_name: "Maria Reyes",
      is_active: true,
      roles: ["parent"],
    },
    logout: jest.fn(),
  }),
}));

describe("Responsive layout, adaptive navigation, and viewport-safe dialogs", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("supports PortalShell mobile drawer toggle, Escape close, sidebar width toggle, and quick nav", () => {
    const { container } = render(
      <PortalShell title="Parent Portal" subtitle="Responsive smoke check">
        <div>Portal body</div>
      </PortalShell>
    );

    const aside = screen.getByLabelText("Portal Sidebar");
    expect(aside).toHaveClass("md:overflow-x-hidden");
    expect(aside.querySelector(".left-full")).toBeNull();

    // Desktop & Tablet sidebar collapse toggle
    const collapseBtn = screen.getByRole("button", {
      name: "Toggle sidebar width",
    });
    expect(collapseBtn).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(collapseBtn);
    expect(collapseBtn).toHaveAttribute("aria-expanded", "false");
    const compactAvatar = screen.getByTestId("sidebar-compact-avatar");
    expect(compactAvatar).toHaveClass("flex");
    expect(compactAvatar).not.toHaveClass("block");

    fireEvent.click(collapseBtn);
    expect(collapseBtn).toHaveAttribute("aria-expanded", "true");

    // Clicking another route triggers immediate active & progress bar feedback
    const reportsLinks = screen.getAllByRole("link", {
      name: /Weekly Reports/i,
    });
    fireEvent.click(reportsLinks[0]);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();

    // Mobile hamburger opens slide-over drawer and Escape closes it
    const menuBtn = screen.getByRole("button", {
      name: "Toggle navigation menu",
    });
    expect(menuBtn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(menuBtn);
    expect(menuBtn).toHaveAttribute("aria-expanded", "true");
    const drawer = screen.getByRole("dialog", {
      name: "Portal Navigation Drawer",
    });
    expect(drawer).toBeInTheDocument();
    expect(drawer).toHaveClass("animate-slide-in-left");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Portal Navigation Drawer" })
    ).not.toBeInTheDocument();

    // Mobile bottom quick navigation bar is present cleanly
    expect(
      screen.getByRole("navigation", { name: "Mobile quick navigation" })
    ).toBeInTheDocument();
  });

  it("closes Dialog on Escape key, backdrop click, and accessible close button", () => {
    const onClose = jest.fn();
    render(
      <Dialog
        open={true}
        onClose={onClose}
        title="Responsive Form"
        description="Fits inside viewport"
      >
        <p>Form contents</p>
      </Dialog>
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("renders a single KidsNav tab bar and single Grown-Up Exit button", () => {
    render(
      <KidsNav activeTab="learn" onSelectTab={jest.fn()} exitHref="/parent" />
    );

    expect(
      screen.getAllByRole("navigation", { name: "Kids Navigation" })
    ).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Grown-Up Exit" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /My Rewards/i })).toBeInTheDocument();
  });

  it("formats long subject labels cleanly for mobile/tablet chart axes", () => {
    expect(formatCompactSubjectLabel("Alphabet & Language")).toBe("Alphabet");
    expect(formatCompactSubjectLabel("Mathematics")).toBe("Math");
    expect(formatCompactSubjectLabel("Science & Discovery")).toBe("Science");
    expect(formatCompactSubjectLabel("Social & Emotional")).toBe("Social");
    expect(formatCompactSubjectLabel("Arts & Creativity")).toBe("Arts");
    expect(formatCompactSubjectLabel("Life Skills")).toBe("Life");
    expect(formatCompactSubjectLabel("Very Long Custom Subject Name")).toBe(
      "Very Long …"
    );
  });

  it("keeps BrandLogo bounded across viewports without unlayered globals.css media overrides", () => {
    render(<BrandLogo size="sm" />);
    const logoImg = screen.getByRole("img", {
      name: "LittleSteps — Small Steps, Big Discoveries.",
    });
    expect(logoImg).toHaveClass("h-9", "sm:h-11", "w-auto", "max-w-full", "object-contain");
    expect(logoImg.parentElement).toHaveClass("overflow-hidden");

    const globalsCss = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/globals.css"),
      "utf8"
    );
    expect(globalsCss).not.toMatch(/^\s*(?:img|video)\s*[,{]/m);
    expect(globalsCss).toContain("@layer base");
    expect(globalsCss).toContain("@layer components");
  });
});
