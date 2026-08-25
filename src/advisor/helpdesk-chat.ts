const DEFAULT_CHAT_URL = "https://www.turf-tools.jp/aihelpdesk/api/chat";

export type HelpdeskEnv = {
  HELPDESK_CHAT_URL?: string;
};

export async function askHelpdesk(env: HelpdeskEnv, body: unknown): Promise<Response> {
  const url = env.HELPDESK_CHAT_URL?.trim() || DEFAULT_CHAT_URL;
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
}

export function parseSseToText(raw: string): string {
  let output = "";
  const chunks = raw.split("\n\n");
  for (const chunk of chunks) {
    for (const line of chunk.split("\n")) {
      const payload = line.startsWith("data:") ? line.slice(5).trim() : "";
      if (!payload || payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload) as {
          response?: unknown;
          choices?: Array<{ delta?: { content?: unknown } }>;
        };
        if (typeof parsed.response === "string" && parsed.response) {
          output += parsed.response;
        } else {
          const content = parsed.choices?.[0]?.delta?.content;
          if (typeof content === "string") output += content;
        }
      } catch {
        /* ignore partial JSON */
      }
    }
  }
  return output.trim();
}

export function mapHelpdeskError(status: number, raw: string): {
  message: string;
  details: string;
  statusCode: number;
} {
  let details = raw.slice(0, 500);
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string; code?: string };
      message?: string;
    };
    const message = parsed.error?.message || parsed.message;
    if (typeof message === "string" && message.trim()) {
      return { message: message.trim(), details, statusCode: status || 502 };
    }
  } catch {
    /* use fallback */
  }
  if (status === 429) {
    return {
      message: "本日の無料枠を使い切ったか、混雑しています。UTC 0時にリセットされます。",
      details,
      statusCode: 429,
    };
  }
  return {
    message: "モデルの応答に失敗しました。時間をおいて再試行してください。",
    details,
    statusCode: status || 502,
  };
}
