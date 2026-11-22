export interface GrownUpChallenge {
  prompt: string;
  expression: string;
  answer: number;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildOnce(): GrownUpChallenge {
  const kind = randomInt(0, 2);
  if (kind === 0) {
    const a = randomInt(11, 24);
    const b = randomInt(5, 14);
    const expression = `${a} + ${b}`;
    return { expression, prompt: `What is ${expression}?`, answer: a + b };
  }
  if (kind === 1) {
    const a = randomInt(15, 29);
    const b = randomInt(6, 12);
    const expression = `${a} - ${b}`;
    return { expression, prompt: `What is ${expression}?`, answer: a - b };
  }
  const a = randomInt(3, 9);
  const b = randomInt(3, 7);
  const expression = `${a} × ${b}`;
  return { expression, prompt: `What is ${expression}?`, answer: a * b };
}

export function generateGrownUpChallenge(
  previousExpression?: string
): GrownUpChallenge {
  let next = buildOnce();
  for (let i = 0; i < 10; i++) {
    if (!previousExpression || next.expression !== previousExpression) {
      return next;
    }
    next = buildOnce();
  }
  return next;
}
