/** Extract a human-readable message from thrown values (incl. TanStack / MP shapes). */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message.trim()) return error.message;

  if (error && typeof error === "object") {
    const e = error as {
      message?: unknown;
      cause?: unknown;
      error?: unknown;
      data?: { message?: unknown };
    };

    if (typeof e.message === "string" && e.message.trim()) return e.message;
    if (typeof e.error === "string" && e.error.trim()) return e.error;
    if (typeof e.data?.message === "string" && e.data.message.trim()) {
      return e.data.message;
    }

    if (Array.isArray(e.cause) && e.cause[0] && typeof e.cause[0] === "object") {
      const cause = e.cause[0] as {
        description?: unknown;
        message?: unknown;
      };
      if (typeof cause.description === "string" && cause.description.trim()) {
        return cause.description;
      }
      if (typeof cause.message === "string" && cause.message.trim()) {
        return cause.message;
      }
    }
  }

  return fallback;
}
