import { fetchWithTimeout } from "./fetch-with-timeout";

const DEFAULT_ATTEMPTS = 3;
const RETRY_BASE_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  const message = error.message;

  const statusMatch = message.match(/(?:API error|error):\s*(\d{3})\b/i);
  if (statusMatch) {
    const status = Number(statusMatch[1]);
    return status === 408 || status === 425 || status === 429 || status >= 500;
  }

  return (
    error instanceof SyntaxError ||
    /Invalid JSON|Unterminated|Unexpected end|Unexpected token|JSON at position|Incomplete response|Empty response|timed out|network/i.test(
      message
    )
  );
}

function looksLikeCompleteJsonObject(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("{") && trimmed.endsWith("}");
}

export async function fetchJsonWithRetry<T>(
  input: string,
  init: RequestInit = {},
  options: {
    timeoutMs?: number;
    attempts?: number;
    label?: string;
  } = {}
): Promise<T> {
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const label = options.label ?? "Upstream";
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        input,
        init,
        options.timeoutMs
      );

      if (!response.ok) {
        throw new Error(`${label} API error: ${response.status}`);
      }

      const text = await response.text();
      if (!text.trim()) {
        throw new Error(`Empty response body from ${label}`);
      }

      const contentLengthHeader = response.headers.get("content-length");
      if (contentLengthHeader) {
        const expected = Number(contentLengthHeader);
        // Content-Length may be compressed size; only treat as truncated when
        // the decoded body is clearly shorter and does not look complete.
        if (
          Number.isFinite(expected) &&
          expected > text.length + 64 &&
          !looksLikeCompleteJsonObject(text)
        ) {
          throw new Error(
            `Incomplete response body: got ${text.length} of ${expected}`
          );
        }
      }

      try {
        return JSON.parse(text) as T;
      } catch (parseError) {
        const detail =
          parseError instanceof Error ? parseError.message : String(parseError);
        throw new Error(`Invalid JSON response: ${detail}`);
      }
    } catch (error) {
      lastError = error;
      if (attempt >= attempts - 1 || !isRetryableFetchError(error)) {
        break;
      }
      const delay =
        RETRY_BASE_MS * 2 ** attempt + Math.floor(Math.random() * 200);
      await sleep(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
