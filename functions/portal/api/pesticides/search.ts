import { parseSearchParams, searchPesticides } from "../../../../src/pesticides/search";
import type { Env } from "../../../../src/pesticides/types";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const db = context.env.PESTICIDES_DB;
    if (!db) {
      return Response.json({ success: false, error: "PESTICIDES_DB が未設定です" }, { status: 503 });
    }

    const url = new URL(context.request.url);
    const parsed = parseSearchParams(url);
    if (!parsed.ok) {
      return Response.json({ success: false, error: parsed.error }, { status: 400 });
    }

    const result = await searchPesticides(db, parsed.params);
    return Response.json({
      success: true,
      query: parsed.params,
      total: result.total,
      truncated: result.truncated,
      note: result.note,
      items: result.items,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
};
