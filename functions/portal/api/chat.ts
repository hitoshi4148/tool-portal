import {
  askHelpdesk,
  mapHelpdeskError,
  parseSseToText,
  type HelpdeskEnv,
} from "../../../src/advisor/helpdesk-chat";
import type { ChatRequestBody } from "../../../src/advisor/types";

interface Env extends HelpdeskEnv {}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = (await context.request.json()) as ChatRequestBody;
    const message = body.message?.trim();
    if (!message) {
      return Response.json(
        { success: false, error: "message is required" },
        { status: 400 }
      );
    }

    const settings = body.settings ?? {};
    const accept = context.request.headers.get("Accept") ?? "";
    const wantsStream = accept.includes("text/event-stream");
    const upstream = await askHelpdesk(
      context.env,
      {
        messages: [{ role: "user", content: message }],
        settings,
        ...(Array.isArray(body.sources) ? { sources: body.sources } : {}),
        ...(wantsStream ? {} : { stream: false }),
      },
      { accept: wantsStream ? "text/event-stream" : "application/json" },
    );

    const contentType = upstream.headers.get("content-type") || "";
    if (wantsStream && upstream.ok && contentType.includes("text/event-stream") && upstream.body) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store",
        },
      });
    }

    const raw = await upstream.text();

    if (contentType.includes("application/json")) {
      let parsed: {
        success?: boolean;
        response?: unknown;
        error?: { message?: string; code?: string } | string;
      };
      try {
        parsed = JSON.parse(raw) as typeof parsed;
      } catch {
        const mapped = mapHelpdeskError(upstream.status, raw);
        return Response.json(
          { success: false, error: mapped.message, details: mapped.details },
          { status: mapped.statusCode }
        );
      }

      if (parsed.success === true && typeof parsed.response === "string" && parsed.response.trim()) {
        return Response.json({ success: true, response: parsed.response.trim() });
      }

      const errorMessage =
        typeof parsed.error === "string"
          ? parsed.error
          : parsed.error?.message;
      if (errorMessage) {
        return Response.json(
          { success: false, error: errorMessage },
          { status: upstream.status >= 400 ? upstream.status : 502 }
        );
      }
    }

    if (contentType.includes("text/event-stream") || raw.includes("data:")) {
      const text = parseSseToText(raw);
      if (text) {
        return Response.json({ success: true, response: text });
      }
    }

    const mapped = mapHelpdeskError(upstream.status, raw);
    return Response.json(
      { success: false, error: mapped.message, details: mapped.details },
      { status: mapped.statusCode }
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return Response.json(
      {
        success: false,
        error: "芝しごとAIへの接続に失敗しました。時間をおいて再試行してください。",
        details: detail,
      },
      { status: 502 }
    );
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
    },
  });
};
