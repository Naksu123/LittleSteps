import { fireEvent, render, screen } from "@testing-library/react";
import { Mascot } from "@/components/brand/Mascot";
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

  it("opens dynamic Grown-Up Gate math check before exiting Kids Mode", () => {
    pushMock.mockClear();
    const onSelectTab = jest.fn();
    render(<KidsNav activeTab="home" onSelectTab={onSelectTab} exitHref="/parent" />);

    fireEvent.click(screen.getByRole("button", { name: "Grown-Up Exit" }));
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
});
