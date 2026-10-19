import { isValidCropForCategory } from "../../../../../src/pesticides/crop-rules";
import { getRotation, parseSearchParams } from "../../../../../src/pesticides/search";
import type { CropCategory, CropKey, Env } from "../../../../../src/pesticides/types";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const db = context.env.PESTICIDES_DB;
    if (!db) {
      return Response.json({ success: false, error: "PESTICIDES_DB が未設定です" }, { status: 503 });
    }

    const regNo = String(context.params.regNo ?? "").trim();
    if (!regNo) {
      return Response.json({ success: false, error: "登録番号が必要です" }, { status: 400 });
    }

    const url = new URL(context.request.url);
    // Reuse search param validation for crop context
    if (!url.searchParams.get("category")) url.searchParams.set("category", "turf");
    if (!url.searchParams.get("crop")) url.searchParams.set("crop", "shiba");
    const parsed = parseSearchParams(url);
    if (!parsed.ok) {
      return Response.json({ success: false, error: parsed.error }, { status: 400 });
    }

    const { category, crop, cropText } = parsed.params;
    if (!isValidCropForCategory(category, crop)) {
      return Response.json({ success: false, error: "category と crop の組み合わせが不正です" }, { status: 400 });
    }

    const result = await getRotation(db, regNo, {
      category: category as CropCategory,
      crop: crop as CropKey,
      cropText,
    });
    if (!result) {
      return Response.json({ success: false, error: "農薬が見つかりません" }, { status: 404 });
    }

    return Response.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
};
