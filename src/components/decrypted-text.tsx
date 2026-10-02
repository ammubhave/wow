import {useEffect, useState} from "react";

// Adapted from React Bits' Decrypted Text (https://reactbits.dev/text-animations/decrypted-text),
// reduced to the one mode used here: on mount, scrambled letters lock in one by one from the start
// until the real text shows. Held still for reduced motion.

const CHARACTERS = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789?!#&*+=<>/");

function scramble(text: string, revealed: number) {
  return Array.from(text, (char, i) =>
    i < revealed || char === " " ? char : CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]!
  ).join("");
}

/** Text that decrypts itself once when it mounts. */
export function DecryptedText({
  text,
  speed = 40,
  className,
  encryptedClassName,
}: {
  text: string;
  /** Milliseconds per revealed character. */
  speed?: number;
  className?: string;
  /** Classes for the characters still scrambled. */
  encryptedClassName?: string;
}) {
  const length = Array.from(text).length;
  // Start scrambled (this app only renders in the browser), so the real text never flashes first.
  const [reduceMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [revealed, setRevealed] = useState(reduceMotion ? length : 0);
  const [display, setDisplay] = useState(() => (reduceMotion ? text : scramble(text, 0)));

  useEffect(() => {
    if (reduceMotion) return undefined;
    let count = 0;
    const id = setInterval(() => {
      count += 1;
      setRevealed(count);
      setDisplay(scramble(text, count));
      if (count >= length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, length, speed, reduceMotion]);

  const chars = Array.from(revealed >= length ? text : display);
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {chars.map((char, i) => (
          // oxlint-disable-next-line react/no-array-index-key -- characters of a fixed string; position is the identity.
          <span key={i} className={i < revealed ? undefined : encryptedClassName}>
            {char}
          </span>
        ))}
      </span>
    </span>
  );
}

/** The site name in page headers; decrypts when the header mounts (once per page load). */
export function BrandTitle({className}: {className?: string}) {
  return (
    <DecryptedText
      text="Wafflehaüs Organized Workspaces"
      speed={25}
      className={className}
      encryptedClassName="text-accent"
    />
  );
}
