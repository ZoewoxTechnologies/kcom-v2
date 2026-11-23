const QUOTES = /^[\s"'“”‘’«»]+|[\s"'“”‘’«»]+$/g;

/** Verse text without any surrounding quote marks (straight or curly), so callers add their own. */
export function stripQuotes(text: string): string {
  return text.replace(QUOTES, "");
}

/** A verse wrapped in curly quotes, however it was stored. Empty stays empty. */
export function quoteVerse(text: string): string {
  const bare = stripQuotes(text);
  return bare ? `“${bare}”` : "";
}
