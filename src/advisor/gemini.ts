export interface GeminiErrorInfo {
  message: string;
  statusCode?: number;
  details: string;
}

export async function generateGeminiResponse(
  apiKey: string,
  modelName: string,
  prompt: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string; code?: number; status?: string };
  };

  if (!response.ok) {
    const err = new Error(
      data.error?.message ?? `Gemini API error: ${response.status}`
    ) as Error & { statusCode?: number };
    err.statusCode = response.status;
    throw err;
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("AIからの応答が空でした");
  }

  return text;
}

export function mapGeminiError(error: unknown): {
  message: string;
  statusCode?: number;
  details: string;
} {
  const err = error as Error & { statusCode?: number };
  const statusCode = err.statusCode;
  const detail = err.message ?? "不明なエラー";
  let message = "AIからの応答を取得できませんでした。";

  if (detail.includes("API_KEY") || detail.includes("API key")) {
    message =
      "APIキーが無効です。GEMINI_API_KEY の設定を確認してください。";
  } else if (statusCode === 403) {
    message = "APIキーにアクセス権限がありません。";
  } else if (statusCode === 429) {
    message =
      "リクエスト制限を超えました。しばらく時間をおいてから再試行してください。";
  } else if (statusCode === 503) {
    message =
      "Geminiが高負荷のため一時的に利用できません。しばらく時間をおいてから再試行してください。";
  } else if (
    statusCode === 404 ||
    (detail.toLowerCase().includes("model") &&
      (detail.includes("not found") || detail.includes("NOT_FOUND")))
  ) {
    message = "モデル名が正しくありません。GEMINI_MODEL を確認してください。";
  }

  return { message, statusCode, details: detail };
}
