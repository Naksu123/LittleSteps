import { fireEvent, render, screen } from "@testing-library/react";
import { stopBackgroundMusic } from "@/lib/sound";
import { Mascot } from "@/components/brand/Mascot";
import { KidsHeader } from "@/components/kids/KidsHeader";
import { KidsNav } from "@/components/layout/KidsNav";
import { Button } from "@/components/ui/button";

const pushMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: jest.fn(),
  }),
}));

function solvePrompt(promptText: string): number {
  const match = promptText.match(/What is\s+(\d+)\s*([+\-×])\s*(\d+)\?/);
  if (!match) throw new Error(`Unexpected prompt: ${promptText}`);
  const a = Number(match[1]);
  const op = match[2];
  const b = Number(match[3]);
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  return a * b;
}

describe("LittleSteps UI Components", () => {
  it("renders accessible kids button and Pip mascot speech bubble", () => {
    render(
      <div>
        <Mascot message="Tap to hear instructions!" />
        <Button variant="kids" size="kid">
          Start Adventure
        </Button>
      </div>
    );

    expect(screen.getByText("Tap to hear instructions!")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start Adventure" })
    ).toBeInTheDocument();
  });

  it("opens dynamic Grown-Up Gate math check in a body portal outside the header", () => {
    pushMock.mockClear();
    const onSelectTab = jest.fn();
    render(<KidsNav activeTab="home" onSelectTab={onSelectTab} exitHref="/parent" />);

    fireEvent.click(screen.getByRole("button", { name: "Grown-Up Exit" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.parentElement).toBe(document.body);
    const firstPrompt = screen.getByTestId("grownup-prompt").textContent || "";
    const firstAnswer = solvePrompt(firstPrompt);

    // Wrong answer stays in Kids Mode
    const input = screen.getByLabelText("Grown-Up Gate Math Answer");
    fireEvent.change(input, { target: { value: String(firstAnswer + 1) } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock Portal" }));
    expect(pushMock).not.toHaveBeenCalled();

    // Refreshing question yields a new challenge
    fireEvent.click(screen.getByRole("button", { name: "New Question" }));
    const nextPrompt = screen.getByTestId("grownup-prompt").textContent || "";
    expect(nextPrompt).not.toBe(firstPrompt);
    const nextAnswer = solvePrompt(nextPrompt);

    fireEvent.change(input, { target: { value: String(nextAnswer) } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock Portal" }));

    expect(pushMock).toHaveBeenCalledWith("/parent");
  });

  it("toggles background music and switches to next random preschool song in KidsHeader", () => {
    window.localStorage.clear();
    const { unmount } = render(
      <KidsHeader child={null} backHref="/kids" backLabel="Back" />
    );

    const nextBtn = screen.getByRole("button", { name: "Play next random song" });
    fireEvent.click(nextBtn);
    const titleEl = screen.getByTestId("current-bgm-title");
    const firstTitle = titleEl.textContent || "";
    expect(firstTitle.length).toBeGreaterThan(2);

    fireEvent.click(nextBtn);
    const secondTitle = screen.getByTestId("current-bgm-title").textContent || "";
    expect(secondTitle).not.toBe(firstTitle);

    fireEvent.click(screen.getByRole("button", { name: "Turn background music off" }));
    expect(screen.queryByRole("button", { name: "Play next random song" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Turn background music on" }));
    expect(screen.getByRole("button", { name: "Play next random song" })).toBeInTheDocument();

    unmount();
    stopBackgroundMusic();
    window.localStorage.clear();
  });
});
