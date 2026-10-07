const genericMessages = {
  network:
    "Can't connect right now. Check your internet connection and try again.",
  unavailable:
    "This feature isn't available right now. Please try again later.",
  access: "You don't have access to do that. Try signing in again.",
  duplicate: "That's already been saved.",
  timeout: "This is taking too long. Please try again.",
  unknown: "Something went wrong. Please try again.",
} as const;

type Category = keyof typeof genericMessages;

const userFacingCodes = new Set(["P0001", "22023", "42501"]);

const codeCategories: Record<string, Category> = {
  PGRST202: "unavailable",
  PGRST205: "unavailable",
  PGRST200: "unavailable",
  "42883": "unavailable",
  "42P01": "unavailable",
  "42703": "unavailable",
  PGRST301: "access",
  PGRST302: "access",
  "23505": "duplicate",
  "57014": "timeout",
};

const technicalPatterns: [RegExp, Category][] = [
  [
    /network request failed|failed to fetch|fetch failed|networkerror|ECONN|ENOTFOUND|offline/i,
    "network",
  ],
  [/timed? ?out|timeout/i, "timeout"],
  [
    /schema cache|does not exist|could not find|relation |column |PGRST|postgrest/i,
    "unavailable",
  ],
  [
    /row-level security|permission denied|JWT|jwt|not authorized|unauthorized/i,
    "access",
  ],
  [/duplicate key|unique constraint/i, "duplicate"],
  [
    /violates|constraint|syntax|invalid input|null value|operator|function |sqlstate|undefined|is not a function|cannot read|unexpected token|JSON|TypeError|ReferenceError|API key|REQUEST_DENIED|PERMISSION_DENIED|quota|internal server|status code|\bHTTP\b/i,
    "unknown",
  ],
];

type ErrorShape = {
  message?: unknown;
  code?: unknown;
  status?: unknown;
  name?: unknown;
};

function describe(error: unknown): ErrorShape {
  return error && typeof error === "object" ? (error as ErrorShape) : {};
}

function categorize(message: string): Category | null {
  for (const [pattern, category] of technicalPatterns) {
    if (pattern.test(message)) return category;
  }
  return null;
}

export function toUserMessage(error: unknown): string {
  const shown = resolve(error);
  if (__DEV__ && error && shown !== describe(error).message) {
    console.log("[Tsuperhero] Hidden technical error:", error);
  }
  return shown;
}

function resolve(error: unknown): string {
  const { message, code, status, name } = describe(error);
  const text = typeof message === "string" ? message.trim() : "";
  const errorCode = typeof code === "string" ? code : null;

  if (!text) return genericMessages.unknown;

  if (errorCode && userFacingCodes.has(errorCode)) {
    const category = categorize(text);
    return category ? genericMessages[category] : text;
  }

  if (errorCode && codeCategories[errorCode]) {
    return genericMessages[codeCategories[errorCode]];
  }

  if (errorCode && /^[0-9A-Z]{5}$/.test(errorCode)) {
    return genericMessages.unknown;
  }

  const isAuthError = typeof name === "string" && name.startsWith("Auth");
  if (isAuthError && typeof status === "number" && status >= 500) {
    return genericMessages.unknown;
  }

  const category = categorize(text);
  return category ? genericMessages[category] : text;
}
