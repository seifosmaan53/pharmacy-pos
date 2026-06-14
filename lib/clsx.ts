// Tiny className combiner — avoids a dependency for a one-liner.
export function clsx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
