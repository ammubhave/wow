/** `items` in consecutive batches of at most `size`. */
export function chunks<T>(items: T[], size: number) {
  return Array.from({length: Math.ceil(items.length / size)}, (_, i) =>
    items.slice(i * size, (i + 1) * size)
  );
}
