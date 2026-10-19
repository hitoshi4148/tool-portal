import { listCropPresets } from "../../../../src/pesticides/search";
import type { Env } from "../../../../src/pesticides/types";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const db = context.env.PESTICIDES_DB;
    if (!db) {
      return Response.json({ success: false, error: "PESTICIDES_DB が未設定です" }, { status: 503 });
    }
    const presets = await listCropPresets(db);
    return Response.json({ success: true, presets });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
};
