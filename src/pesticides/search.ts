import {
  getCropMatcher,
  isValidCropForCategory,
  normalizeSearch,
  sqlCropPrefilter,
  toHalfwidthKatakana,
} from "./crop-rules";

function likeBindings(raw: string): string[] {
  const q = raw.trim();
  const hw = toHalfwidthKatakana(q.normalize("NFKC"));
  const patterns = new Set([`%${q}%`, `%${hw}%`]);
  return Array.from(patterns);
}
import { formatRacCode, sortRacCodes } from "./rac-format";
import type {
  ApplicationRow,
  CropCategory,
  CropKey,
  CropPreset,
  ProductDetail,
  RacEntry,
  RotationPeer,
  SearchHit,
  SearchParams,
} from "./types";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

type AppRowSql = {
  id: number;
  reg_no: string;
  crop_name: string;
  place: string | null;
  target_pest: string | null;
  purpose: string | null;
  dilution: string | null;
  spray_volume: string | null;
  timing: string | null;
  times_per_crop: string | null;
  method: string | null;
  ingredient1_total_uses: string | null;
  ingredient2_total_uses: string | null;
  ingredient3_total_uses: string | null;
  ingredient4_total_uses: string | null;
  ingredient5_total_uses: string | null;
  name: string | null;
  holder: string | null;
  use_category: string | null;
  pesticide_type: string | null;
  concentration: string | null;
  formulation: string | null;
  registered_on: string | null;
};

function mapApp(row: AppRowSql): ApplicationRow {
  return {
    id: row.id,
    regNo: row.reg_no,
    cropName: row.crop_name,
    place: row.place,
    targetPest: row.target_pest,
    purpose: row.purpose,
    dilution: row.dilution,
    sprayVolume: row.spray_volume,
    timing: row.timing,
    timesPerCrop: row.times_per_crop,
    method: row.method,
    ingredient1TotalUses: row.ingredient1_total_uses,
    ingredient2TotalUses: row.ingredient2_total_uses,
    ingredient3TotalUses: row.ingredient3_total_uses,
    ingredient4TotalUses: row.ingredient4_total_uses,
    ingredient5TotalUses: row.ingredient5_total_uses,
  };
}

export function parseSearchParams(url: URL): { ok: true; params: SearchParams } | { ok: false; error: string } {
  const category = (url.searchParams.get("category") ?? "").trim() as CropCategory;
  const crop = (url.searchParams.get("crop") ?? "").trim() as CropKey;
  const cropText = (url.searchParams.get("cropText") ?? url.searchParams.get("crop_text") ?? "").trim();
  const pesticide = (url.searchParams.get("pesticide") ?? "").trim();
  const target = (url.searchParams.get("target") ?? "").trim();
  const limitRaw = url.searchParams.get("limit");

  if (!category || !["turf", "fruit", "other"].includes(category)) {
    return { ok: false, error: "category は turf / fruit / other のいずれかが必須です" };
  }
  if (!crop) {
    return { ok: false, error: "crop は必須です" };
  }
  if (!isValidCropForCategory(category, crop)) {
    return { ok: false, error: `crop=${crop} は category=${category} と組み合わせられません` };
  }
  if ((crop === "other" || crop === "other_fruit") && cropText.length < 2) {
    return { ok: false, error: "その他を選んだ場合は作物名を2文字以上入力してください" };
  }
  if (pesticide && pesticide.length < 2) {
    return { ok: false, error: "農薬名は2文字以上で検索してください" };
  }
  if (target && target.length < 2) {
    return { ok: false, error: "病害虫・雑草名は2文字以上で検索してください" };
  }

  let limit = DEFAULT_LIMIT;
  if (limitRaw) {
    const n = Number.parseInt(limitRaw, 10);
    if (!Number.isFinite(n) || n < 1) {
      return { ok: false, error: "limit が不正です" };
    }
    limit = Math.min(n, MAX_LIMIT);
  }

  return {
    ok: true,
    params: { category, crop, cropText: cropText || undefined, pesticide: pesticide || undefined, target: target || undefined, limit },
  };
}

export async function listCropPresets(db: D1Database): Promise<CropPreset[]> {
  const res = await db
    .prepare(
      `SELECT key, category, label, sort_order, is_free_text, notes
       FROM crop_presets ORDER BY sort_order`
    )
    .all<{
      key: CropKey;
      category: CropCategory;
      label: string;
      sort_order: number;
      is_free_text: number;
      notes: string | null;
    }>();

  return (res.results ?? []).map((r) => ({
    key: r.key,
    category: r.category,
    label: r.label,
    sortOrder: r.sort_order,
    isFreeText: r.is_free_text === 1,
    notes: r.notes,
  }));
}

async function fetchRacMap(db: D1Database, regNos: string[]): Promise<Map<string, RacEntry[]>> {
  const map = new Map<string, RacEntry[]>();
  if (regNos.length === 0) return map;

  // D1 bind limit — chunk
  const chunkSize = 80;
  for (let i = 0; i < regNos.length; i += chunkSize) {
    const chunk = regNos.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "?").join(",");
    const res = await db
      .prepare(
        `SELECT reg_no, slot, ingredient, rac_code, use_category
         FROM croplife_rac WHERE reg_no IN (${placeholders}) ORDER BY reg_no, slot`
      )
      .bind(...chunk)
      .all<{
        reg_no: string;
        slot: number;
        ingredient: string | null;
        rac_code: string | null;
        use_category: string | null;
      }>();

    for (const row of res.results ?? []) {
      const display = formatRacCode(row.rac_code, row.use_category);
      const entry: RacEntry = {
        slot: row.slot,
        ingredient: row.ingredient,
        racCode: row.rac_code,
        displayCode: display ?? (row.rac_code ?? ""),
        useCategory: row.use_category,
      };
      const list = map.get(row.reg_no) ?? [];
      list.push(entry);
      map.set(row.reg_no, list);
    }
  }
  return map;
}

function codesFromRac(entries: RacEntry[] | undefined): string[] {
  if (!entries || entries.length === 0) return [];
  const set = new Set<string>();
  for (const e of entries) {
    if (e.displayCode) set.add(e.displayCode);
  }
  return sortRacCodes(Array.from(set));
}

async function loadMatchedApplications(
  db: D1Database,
  params: SearchParams
): Promise<AppRowSql[]> {
  const prefilter = sqlCropPrefilter(params.crop, params.cropText);
  if (!prefilter) return [];

  const where: string[] = [prefilter.sql];
  const binds: string[] = [...prefilter.binds];

  if (params.pesticide) {
    const likes = likeBindings(params.pesticide);
    const parts: string[] = [];
    for (const like of likes) {
      parts.push("(a.name LIKE ? OR a.holder_short LIKE ? OR p.name LIKE ? OR p.holder LIKE ?)");
      binds.push(like, like, like, like);
    }
    where.push(`(${parts.join(" OR ")})`);
  }
  if (params.target) {
    const likes = likeBindings(params.target);
    const parts: string[] = [];
    for (const like of likes) {
      parts.push("(a.target_pest LIKE ? OR a.purpose LIKE ?)");
      binds.push(like, like);
    }
    where.push(`(${parts.join(" OR ")})`);
  }

  const sql = `
    SELECT
      a.id, a.reg_no, a.crop_name, a.place, a.target_pest, a.purpose,
      a.dilution, a.spray_volume, a.timing, a.times_per_crop, a.method,
      a.ingredient1_total_uses, a.ingredient2_total_uses, a.ingredient3_total_uses,
      a.ingredient4_total_uses, a.ingredient5_total_uses,
      COALESCE(p.name, a.name) AS name,
      COALESCE(p.holder, a.holder_short) AS holder,
      COALESCE(p.use_category, a.use_category) AS use_category,
      COALESCE(p.pesticide_type, a.pesticide_type) AS pesticide_type,
      p.concentration, p.formulation, p.registered_on
    FROM applications a
    LEFT JOIN products p ON p.reg_no = a.reg_no
    WHERE ${where.join(" AND ")}
  `;

  const res = await db.prepare(sql).bind(...binds).all<AppRowSql>();
  const matcher = getCropMatcher(params.crop, params.cropText);
  return (res.results ?? []).filter((row) => matcher(row.crop_name || ""));
}

export async function searchPesticides(
  db: D1Database,
  params: SearchParams
): Promise<{ items: SearchHit[]; total: number; truncated: boolean; note: string | null }> {
  const rows = await loadMatchedApplications(db, params);
  if (rows.length === 0) {
    const note =
      params.crop === "other" || params.crop === "other_fruit"
        ? "作物名の候補が見つかりません。FAMICの表記（例: かんきつ、日本なし）で試し、ラベルで最終確認してください"
        : null;
    return { items: [], total: 0, truncated: false, note };
  }

  type Agg = {
    regNo: string;
    name: string;
    holder: string | null;
    useCategory: string | null;
    pesticideType: string | null;
    crops: Set<string>;
    targets: Set<string>;
  };

  const byReg = new Map<string, Agg>();
  for (const row of rows) {
    let agg = byReg.get(row.reg_no);
    if (!agg) {
      agg = {
        regNo: row.reg_no,
        name: row.name || "－",
        holder: row.holder,
        useCategory: row.use_category,
        pesticideType: row.pesticide_type,
        crops: new Set(),
        targets: new Set(),
      };
      byReg.set(row.reg_no, agg);
    }
    if (row.crop_name) agg.crops.add(row.crop_name);
    if (row.target_pest) agg.targets.add(row.target_pest);
  }

  const allRegs = Array.from(byReg.keys());
  const racMap = await fetchRacMap(db, allRegs);
  const limit = params.limit ?? DEFAULT_LIMIT;

  const items: SearchHit[] = allRegs.map((regNo) => {
    const agg = byReg.get(regNo)!;
    const rac = racMap.get(regNo);
    const racCodes = codesFromRac(rac);
    return {
      regNo,
      name: agg.name,
      holder: agg.holder,
      useCategory: agg.useCategory,
      pesticideType: agg.pesticideType,
      matchedCrops: Array.from(agg.crops).sort(),
      matchedTargets: Array.from(agg.targets).slice(0, 12),
      racCodes,
      racMissing: racCodes.length === 0,
    };
  });

  items.sort((a, b) => a.name.localeCompare(b.name, "ja") || a.regNo.localeCompare(b.regNo));

  const truncated = items.length > limit;
  return {
    items: items.slice(0, limit),
    total: items.length,
    truncated,
    note: null,
  };
}

export async function getProductDetail(
  db: D1Database,
  regNo: string,
  cropFilter?: { crop: CropKey; cropText?: string }
): Promise<ProductDetail | null> {
  const product = await db
    .prepare(
      `SELECT reg_no, name, holder, use_category, pesticide_type, concentration, formulation, registered_on
       FROM products WHERE reg_no = ?`
    )
    .bind(regNo)
    .first<{
      reg_no: string;
      name: string;
      holder: string | null;
      use_category: string | null;
      pesticide_type: string | null;
      concentration: string | null;
      formulation: string | null;
      registered_on: string | null;
    }>();

  if (!product) return null;

  const appRes = await db
    .prepare(
      `SELECT id, reg_no, crop_name, place, target_pest, purpose, dilution, spray_volume,
              timing, times_per_crop, method,
              ingredient1_total_uses, ingredient2_total_uses, ingredient3_total_uses,
              ingredient4_total_uses, ingredient5_total_uses
       FROM applications WHERE reg_no = ? ORDER BY id`
    )
    .bind(regNo)
    .all<AppRowSql>();

  let applications = (appRes.results ?? []).map(mapApp);
  if (cropFilter) {
    const matcher = getCropMatcher(cropFilter.crop, cropFilter.cropText);
    const filtered = applications.filter((a) => matcher(a.cropName));
    if (filtered.length > 0) applications = filtered;
  }

  const ingRes = await db
    .prepare(
      `SELECT ingredient, ingredient_for_total_use FROM product_ingredients WHERE reg_no = ? ORDER BY id`
    )
    .bind(regNo)
    .all<{ ingredient: string; ingredient_for_total_use: string | null }>();

  const racMap = await fetchRacMap(db, [regNo]);
  const rac = racMap.get(regNo) ?? [];
  const racCodes = codesFromRac(rac);

  return {
    regNo: product.reg_no,
    name: product.name,
    holder: product.holder,
    useCategory: product.use_category,
    pesticideType: product.pesticide_type,
    concentration: product.concentration,
    formulation: product.formulation,
    registeredOn: product.registered_on,
    ingredients: (ingRes.results ?? []).map((r) => ({
      ingredient: r.ingredient,
      ingredientForTotalUse: r.ingredient_for_total_use,
    })),
    applications,
    rac,
    racCodes,
    racMissing: racCodes.length === 0,
  };
}

function targetBlob(apps: ApplicationRow[]): string {
  return apps
    .map((a) => normalizeSearch(a.targetPest))
    .filter(Boolean)
    .join("|");
}

function targetsOverlap(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

export async function getRotation(
  db: D1Database,
  regNo: string,
  cropFilter: { crop: CropKey; cropText?: string; category: CropCategory }
): Promise<{
  source: { regNo: string; name: string; racCodes: string[] };
  sameGroup: RotationPeer[];
  recommended: RotationPeer[];
} | null> {
  const detail = await getProductDetail(db, regNo, cropFilter);
  if (!detail) return null;

  const sourceRac = new Set(detail.racCodes);
  const sourceTargets = targetBlob(detail.applications);

  const rows = await loadMatchedApplications(db, {
    category: cropFilter.category,
    crop: cropFilter.crop,
    cropText: cropFilter.cropText,
    limit: MAX_LIMIT,
  });

  type PeerAgg = {
    regNo: string;
    name: string;
    holder: string | null;
    targets: string;
  };
  const peers = new Map<string, PeerAgg>();
  for (const row of rows) {
    if (row.reg_no === regNo) continue;
    let p = peers.get(row.reg_no);
    if (!p) {
      p = {
        regNo: row.reg_no,
        name: row.name || "－",
        holder: row.holder,
        targets: "",
      };
      peers.set(row.reg_no, p);
    }
    const t = normalizeSearch(row.target_pest);
    if (t && !p.targets.includes(t)) {
      p.targets = p.targets ? `${p.targets}|${t}` : t;
    }
  }

  const peerRegs = Array.from(peers.keys());
  const racMap = await fetchRacMap(db, peerRegs);

  const sameGroup: RotationPeer[] = [];
  const recommended: RotationPeer[] = [];

  for (const peer of peers.values()) {
    const codes = codesFromRac(racMap.get(peer.regNo));
    if (codes.length === 0) continue;
    const matched = codes.filter((c) => sourceRac.has(c));
    if (matched.length > 0) {
      sameGroup.push({
        regNo: peer.regNo,
        name: peer.name,
        holder: peer.holder,
        racCodes: codes,
        matchedRacCodes: sortRacCodes(matched),
      });
      continue;
    }
    if (sourceTargets && targetsOverlap(sourceTargets, peer.targets)) {
      recommended.push({
        regNo: peer.regNo,
        name: peer.name,
        holder: peer.holder,
        racCodes: codes,
      });
    }
  }

  sameGroup.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  recommended.sort((a, b) => a.name.localeCompare(b.name, "ja"));

  return {
    source: { regNo: detail.regNo, name: detail.name, racCodes: detail.racCodes },
    sameGroup: sameGroup.slice(0, 100),
    recommended: recommended.slice(0, 100),
  };
}
