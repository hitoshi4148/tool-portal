import { buildFullPrompt } from "../../../src/advisor/prompt";
import { generateGeminiResponse, mapGeminiError } from "../../../src/advisor/gemini";
import type { ChatRequestBody } from "../../../src/advisor/types";

interface Env {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const apiKey = context.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        {
          success: false,
          error:
            "Gemini APIキーが設定されていません。ローカルでは .dev.vars に GEMINI_API_KEY を設定して wrangler を再起動してください。本番では Cloudflare Pages の Environment variables に GEMINI_API_KEY を追加してください。",
        },
        { status: 500 }
      );
    }

    const body = (await context.request.json()) as ChatRequestBody;
    const message = body.message?.trim();
    if (!message) {
      return Response.json(
        { success: false, error: "message is required" },
        { status: 400 }
      );
    }

    const settings = body.settings ?? {};
    const modelName = context.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    const fullPrompt = buildFullPrompt(message, settings);
    const text = await generateGeminiResponse(apiKey, modelName, fullPrompt);

    return Response.json({ success: true, response: text });
  } catch (error) {
    const mapped = mapGeminiError(error);
    return Response.json(
      {
        success: false,
        error: mapped.message,
        details: mapped.details,
        statusCode: mapped.statusCode,
      },
      { status: 500 }
    );
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};
