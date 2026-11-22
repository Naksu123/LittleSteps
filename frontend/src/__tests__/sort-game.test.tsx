import { fireEvent, render, screen } from "@testing-library/react";
import { SortGame } from "@/components/games/SortGame";
import type { SortConfig } from "@/types";

const SORT_CONFIG: SortConfig = {
  engine: "sort",
  skill: "Tidying",
  bins: [
    { key: "toys", label: "Toy Box", emoji: "🧺" },
    { key: "books", label: "Bookshelf", emoji: "📚" },
  ],
  items: [
    { id: "i1", label: "Teddy Bear", emoji: "🧸", bin: "toys" },
    { id: "i2", label: "Story Book", emoji: "📖", bin: "books" },
  ],
};

describe("SortGame engine", () => {
  it("supports accessible tap-to-select then tap-to-place sorting", () => {
    const onComplete = jest.fn();
    render(<SortGame config={SORT_CONFIG} onComplete={onComplete} />);

    fireEvent.click(screen.getByRole("button", { name: /Teddy Bear/i }));
    fireEvent.click(screen.getByRole("button", { name: /Toy Box/i }));

    fireEvent.click(screen.getByRole("button", { name: /Story Book/i }));
    fireEvent.click(screen.getByRole("button", { name: /Bookshelf/i }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        score_pct: 100,
        attempts_count: 2,
      })
    );
  });
});
