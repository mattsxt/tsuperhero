const firstLetter = (word: string | null | undefined) =>
  (word ?? "").trim().charAt(0).toUpperCase();

export function initials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallback = "?",
): string {
  const first = (firstName ?? "").trim().split(/\s+/)[0];
  return `${firstLetter(first)}${firstLetter(lastName)}` || fallback;
}

export function initialsOf(name: string | null | undefined, fallback = "?"): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return fallback;
  return words.length === 1
    ? firstLetter(words[0])
    : `${firstLetter(words[0])}${firstLetter(words[1])}`;
}
