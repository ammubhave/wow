/**
 * Whether a hunt's puzzle page says the puzzle is solved, and as what: read by the Chrome extension
 * from the page's visible text (`document.body.innerText`), so it works on any hunt site you're
 * logged in to, with no scraping on WOW's side.
 *
 * Hunt sites say it in a handful of ways: a banner ("Solved: LANTERN", "Answer: LANTERN"), the
 * reply to a guess ("LANTERN is correct!", "Correct! The answer is LANTERN"), or a row in the
 * guess log ("LANTERN  Correct"). Most hunt sites show answers in capitals, so a banner's answer
 * must be in capitals too: that keeps prose ("Answer: in the grid") from counting. A guess's reply
 * or log row is clear enough to take the guess as typed ("lantern is correct!"), as long as it's
 * short and isn't the sentence's own subject ("Your answer is correct").
 *
 * Returns the answer (trimmed, without closing punctuation, in capitals), or null when the page
 * doesn't say.
 * When it says several things, the first: the banner at the top, or the newest row of the log.
 */
export function findHuntSolve(text: string): string | null {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > 200) continue;
    for (const pattern of PATTERNS) {
      const answer = asAnswer(pattern.exec(trimmed)?.groups?.answer);
      if (answer) return answer;
    }
    for (const pattern of GUESS_PATTERNS) {
      const answer = asGuess(pattern.exec(trimmed)?.groups?.answer);
      if (answer) return answer;
    }
  }
  return null;
}

/** Answer-shaped: capitals, digits, spaces and a little punctuation. Lowercase means prose. */
const ANSWER = String.raw`(?<answer>[A-Z0-9][A-Z0-9 '’&.,!?-]{0,79})`;

const PATTERNS = [
  // A banner: "Solved: LANTERN", "Answer: LANTERN", "Solution — LANTERN", "Solved! LANTERN".
  new RegExp(
    String.raw`^(?:✓|✔|☑)?\s*(?:[Ss]olved|SOLVED|[Aa]nswer|ANSWER|[Ss]olution|SOLUTION)\s*(?:[:：—–-]|!)\s*${ANSWER}$`
  ),
  // A guess's reply: "LANTERN is correct!", "LANTERN was correct.".
  new RegExp(String.raw`^(?:✓|✔)?\s*${ANSWER}\s+(?:is|was|IS|WAS)\s+(?:correct|CORRECT)\b`),
  // "Correct! The answer is LANTERN", "You solved it! The answer was LANTERN.".
  new RegExp(
    String.raw`(?:[Cc]orrect|CORRECT|[Ss]olved|SOLVED)\b.*?\b(?:[Tt]he )?(?:answer|ANSWER) (?:is|was|IS|WAS):?\s+${ANSWER}$`
  ),
  // A guess log row (table cells come out tab-separated): "LANTERN\tCorrect", "✓ LANTERN".
  new RegExp(
    String.raw`^${ANSWER}\s*(?:\t|\s[|·—–-]\s)\s*(?:[Cc]orrect|CORRECT|[Ss]olved|SOLVED)\b`
  ),
];

/** A guess as typed: any case, short. */
const GUESS = String.raw`(?<answer>[\p{L}0-9][\p{L}0-9 '’&.,!?-]{0,59})`;

/** The guess-reply and guess-log patterns again, for guesses shown as typed (see asGuess). */
const GUESS_PATTERNS = [
  new RegExp(String.raw`^(?:✓|✔)?\s*${GUESS}\s+(?:is|was|IS|WAS)\s+(?:correct|CORRECT)\b`, "u"),
  new RegExp(
    String.raw`(?:[Cc]orrect|CORRECT|[Ss]olved|SOLVED)\b.*?\b(?:[Tt]he )?(?:answer|ANSWER) (?:is|was|IS|WAS):?\s+${GUESS}$`,
    "u"
  ),
  // Log rows only with a table's tab: "lantern - correct" could be anything.
  new RegExp(String.raw`^${GUESS}\t+(?:[Cc]orrect|CORRECT|[Ss]olved|SOLVED)\b`, "u"),
];

/** Words a sentence about the guess starts with, rather than the guess itself. */
const NOT_A_GUESS =
  /^(?:your|my|our|the|that|this|it|which|what|guess|answer|submission|everything|all|so|yes|not|in|on|at|from|of|to|hidden|below|above|here|there|now|still|also|correct)\b/i;

function asGuess(raw: string | undefined) {
  if (!raw) return null;
  const guess = raw.replace(/[\s.,!?]+$/, "").trim();
  // A few words at most: a longer stretch of lowercase is a sentence.
  if (!guess || NOT_A_GUESS.test(guess) || guess.split(/\s+/).length > 5) return null;
  return asAnswer(guess.toUpperCase());
}

function asAnswer(raw: string | undefined) {
  if (!raw) return null;
  // Closing punctuation ("LANTERN!") is the page's, not the answer's.
  const answer = raw.replace(/[\s.,!?]+$/, "").trim();
  const letters = answer.replace(/[^A-Z0-9]/g, "");
  // Two characters at least, so a stray capital ("Answer: A") isn't an answer, and a letter among
  // them, so a count ("Solved: 12") isn't either.
  if (letters.length < 2 || !/[A-Z]/.test(letters)) return null;
  // Placeholders hunt sites show before you've solved it.
  if (
    /^(?:N\/?A|NONE|TBD|UNSOLVED|UNKNOWN|NOT SOLVED|NOT YET|PENDING|LOCKED|HIDDEN|REDACTED|SUBMIT|CHECK|SEE BELOW|\?+)$/.test(
      answer
    )
  ) {
    return null;
  }
  return answer;
}
