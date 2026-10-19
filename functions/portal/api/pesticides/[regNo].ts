import { getProductDetail } from "../../../../src/pesticides/search";
import type { CropKey, Env } from "../../../../src/pesticides/types";
import { isValidCropForCategory } from "../../../../src/pesticides/crop-rules";

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
    const crop = (url.searchParams.get("crop") ?? "").trim() as CropKey;
    const cropText = (url.searchParams.get("cropText") ?? url.searchParams.get("crop_text") ?? "").trim();
    const category = (url.searchParams.get("category") ?? "").trim();

    let cropFilter: { crop: CropKey; cropText?: string } | undefined;
    if (crop) {
      if (category && !isValidCropForCategory(category, crop)) {
        return Response.json({ success: false, error: "category と crop の組み合わせが不正です" }, { status: 400 });
      }
      cropFilter = { crop, cropText: cropText || undefined };
    }

    const detail = await getProductDetail(db, regNo, cropFilter);
    if (!detail) {
      return Response.json({ success: false, error: "農薬が見つかりません" }, { status: 404 });
    }

    return Response.json({ success: true, product: detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
};
