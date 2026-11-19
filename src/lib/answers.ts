/**
 * A puzzle's answers, stored in its one `answer` column, one per line: most puzzles have a single
 * answer, some several (see `answerCount`).
 */

/** Its answers, in order (none when unsolved). */
export const splitAnswers = (answer: string | null | undefined) =>
  (answer ?? "")
    .split("\n")
    .map(a => a.trim())
    .filter(Boolean);

/** Answers back into the column (null for none), uppercased as answers are. */
export function joinAnswers(answers: string[]) {
  const kept = answers.map(a => a.trim().toUpperCase()).filter(Boolean);
  return kept.length > 0 ? kept.join("\n") : null;
}

/** For reading: "FOO · BAR". */
export const formatAnswers = (answer: string | null | undefined) =>
  splitAnswers(answer).join(" · ");

/**
 * What someone typed into one box for several answers ("FOO; BAR", or "FOO · BAR" as it's shown),
 * as the column holds them.
 */
export const parseTypedAnswers = (typed: string) => joinAnswers(typed.split(/[;\n·]/));

/** For comparing guesses: case, spaces and punctuation don't matter ("Ice-cream" = "ICECREAM"). */
export const normalizeAnswer = (answer: string) =>
  answer.toUpperCase().replace(/[^\p{L}\p{N}]/gu, "");
