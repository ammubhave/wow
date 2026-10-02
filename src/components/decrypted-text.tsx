import {Fragment, useEffect, useState} from "react";
import {cn} from "tailwind-variants";

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
  animate = true,
}: {
  text: string;
  /** false: show the text as is, with no decrypting. */
  animate?: boolean;
  /** Milliseconds per revealed character. */
  speed?: number;
  className?: string;
  /** Classes for the characters still scrambled. */
  encryptedClassName?: string;
}) {
  const length = Array.from(text).length;
  // Start scrambled (this app only renders in the browser), so the real text never flashes first.
  const [reduceMotion] = useState(
    () => !animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches
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

  const scrambled = Array.from(display);
  // Each character keeps the real one's width (drawn transparent) with the scrambled one laid
  // over it, so the text never changes size or wraps differently while it decrypts.
  let index = 0;
  const words = text.split(" ").map(word => {
    const chars = Array.from(word).map(char => {
      const i = index++;
      if (i < revealed) return char;
      return (
        // oxlint-disable-next-line react/no-array-index-key -- characters of a fixed string; position is the identity.
        <span key={i} className="relative">
          <span className="text-transparent">{char}</span>
          <span className={cn("absolute inset-0 flex justify-center", encryptedClassName)}>
            {scrambled[i]}
          </span>
        </span>
      );
    });
    index++; // the space after the word
    return chars;
  });
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((chars, w) => (
          // oxlint-disable-next-line react/no-array-index-key -- words of a fixed string.
          <Fragment key={w}>
            {w > 0 && " "}
            <span className="whitespace-nowrap">{chars}</span>
          </Fragment>
        ))}
      </span>
    </span>
  );
}

// Whether the site name has already decrypted in this page load. Module state survives in-app
// navigation, where different layouts mount their own header, and resets on a full reload.
let brandTitlePlayed = false;

/** The site name in page headers; decrypts once per page load, not on every navigation. */
export function BrandTitle({className}: {className?: string}) {
  const [animate] = useState(() => !brandTitlePlayed);
  useEffect(() => {
    brandTitlePlayed = true;
  }, []);
  return (
    <DecryptedText
      animate={animate}
      text="Wafflehaüs Organized Workspaces"
      speed={25}
      className={className}
      encryptedClassName="text-accent"
    />
  );
}
