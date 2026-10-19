import type { CropKey } from "./types";

/** Normalize for keyword search (NFKC, strip spaces, lower). */
export function normalizeSearch(str: string | null | undefined): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .normalize("NFKC")
    .replace(/[\s\u3000]+/g, "")
    .toLowerCase();
}

/** ひらがな → カタカナ */
function hiraganaToKatakana(str: string): string {
  return str.replace(/[\u3041-\u3096]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}

/**
 * 全角カタカナ → 半角カタカナ（FAMIC xls の表記合わせ用）
 * 濁点・半濁点は結合文字に分解する。
 */
const FULL_TO_HALF_KANA: Record<string, string> = {
  ァ: "ｧ", ア: "ｱ", ィ: "ｨ", イ: "ｲ", ゥ: "ｩ", ウ: "ｳ", ェ: "ｪ", エ: "ｴ", ォ: "ｫ", オ: "ｵ",
  カ: "ｶ", キ: "ｷ", ク: "ｸ", ケ: "ｹ", コ: "ｺ",
  サ: "ｻ", シ: "ｼ", ス: "ｽ", セ: "ｾ", ソ: "ｿ",
  タ: "ﾀ", チ: "ﾁ", ッ: "ｯ", ツ: "ﾂ", テ: "ﾃ", ト: "ﾄ",
  ナ: "ﾅ", ニ: "ﾆ", ヌ: "ﾇ", ネ: "ﾈ", ノ: "ﾉ",
  ハ: "ﾊ", ヒ: "ﾋ", フ: "ﾌ", ヘ: "ﾍ", ホ: "ﾎ",
  マ: "ﾏ", ミ: "ﾐ", ム: "ﾑ", メ: "ﾒ", モ: "ﾓ",
  ャ: "ｬ", ヤ: "ﾔ", ュ: "ｭ", ユ: "ﾕ", ョ: "ｮ", ヨ: "ﾖ",
  ラ: "ﾗ", リ: "ﾘ", ル: "ﾙ", レ: "ﾚ", ロ: "ﾛ",
  ヮ: "ﾜ", ワ: "ﾜ", ヲ: "ｦ", ン: "ﾝ",
  ヴ: "ｳﾞ",
  ガ: "ｶﾞ", ギ: "ｷﾞ", グ: "ｸﾞ", ゲ: "ｹﾞ", ゴ: "ｺﾞ",
  ザ: "ｻﾞ", ジ: "ｼﾞ", ズ: "ｽﾞ", ゼ: "ｾﾞ", ゾ: "ｿﾞ",
  ダ: "ﾀﾞ", ヂ: "ﾁﾞ", ヅ: "ﾂﾞ", デ: "ﾃﾞ", ド: "ﾄﾞ",
  バ: "ﾊﾞ", ビ: "ﾋﾞ", ブ: "ﾌﾞ", ベ: "ﾍﾞ", ボ: "ﾎﾞ",
  パ: "ﾊﾟ", ピ: "ﾋﾟ", プ: "ﾌﾟ", ペ: "ﾍﾟ", ポ: "ﾎﾟ",
  ー: "ｰ", "・": "･", "「": "｢", "」": "｣",
};

export function toHalfwidthKatakana(str: string): string {
  const kata = hiraganaToKatakana(str.normalize("NFKC"));
  let out = "";
  for (const ch of kata) {
    out += FULL_TO_HALF_KANA[ch] ?? ch;
  }
  return out;
}

function exclusionClause(cropName: string): string | null {
  if (!cropName.includes("除く")) return null;
  const m = cropName.match(/[（(]([^）)]*除く)/);
  return m ? m[1] : cropName;
}

function excludesTarget(cropName: string, targets: string[]): boolean {
  const clause = exclusionClause(cropName);
  if (!clause) return false;
  const parts = clause.split(/[、,]|を除く|ただし/);
  for (const raw of parts) {
    const p = raw.trim();
    if (!p) continue;
    for (const t of targets) {
      if (t === "なし") {
        if (/(?<![くちさる])なし/.test(p) || p === "なし" || p === "日本なし" || p === "西洋なし") {
          return true;
        }
      } else if (t === "かき") {
        if (p === "かき" || (p.startsWith("かき") && !p.includes("さかき") && !p.includes("ひさかき"))) {
          return true;
        }
      } else if (t === "みかん" || t === "温州みかん") {
        if (p.includes(t) || (t === "みかん" && p.includes("温州みかん"))) {
          return true;
        }
      } else if (p.includes(t)) {
        return true;
      }
    }
  }
  return false;
}

export function matchShiba(c: string): boolean {
  if (!c.includes("芝")) return false;
  if (c.includes("等") && (c.includes("果樹") || c.includes("野菜"))) return false;
  return true;
}

export function matchMikan(c: string): boolean {
  if (excludesTarget(c, ["みかん", "温州みかん"])) return false;
  if (c.startsWith("みかん") || c.startsWith("温州みかん") || c.startsWith("なつみかん")) return true;
  if (c === "かんきつ" || c.startsWith("かんきつ(") || c.startsWith("かんきつ（")) return true;
  return false;
}

export function matchRingo(c: string): boolean {
  if (excludesTarget(c, ["りんご"])) return false;
  if (c.startsWith("りんご")) return true;
  if (c.includes("りんご") && !c.includes("除く")) return true;
  if (c.startsWith("仁果類")) return true;
  return false;
}

export function matchNashi(c: string): boolean {
  if ((c.includes("くちなし") || c.includes("さるなし")) && !c.startsWith("なし") && !c.startsWith("日本なし") && !c.startsWith("西洋なし")) {
    return false;
  }
  if (excludesTarget(c, ["なし", "日本なし", "西洋なし"])) return false;
  if (c.startsWith("なし") || c.startsWith("日本なし") || c.startsWith("西洋なし")) return true;
  if (c.includes("なし") && !c.includes("除く") && !c.includes("くちなし") && !c.includes("さるなし")) {
    return true;
  }
  if (c.startsWith("仁果類")) return true;
  return false;
}

export function matchKaki(c: string): boolean {
  if ((c.includes("さかき") || c.includes("ひさかき")) && !c.startsWith("かき")) return false;
  if (excludesTarget(c, ["かき"])) return false;
  if (c.startsWith("かき")) return true;
  if (/(?<![さひ])かき/.test(c) && !c.includes("除く")) return true;
  return false;
}

export function matchBudo(c: string): boolean {
  if (excludesTarget(c, ["ぶどう"])) return false;
  if (c.includes("ぶどう") && !c.includes("除く")) return true;
  return false;
}

export function matchFreeText(c: string, rawQuery: string): boolean {
  const q = normalizeSearch(rawQuery);
  if (q.length < 2) return false;
  const n = normalizeSearch(c);
  if (!n.includes(q)) return false;
  // Drop rows where the query appears only inside an exclusion clause
  const clause = exclusionClause(c);
  if (clause) {
    const beforeParen = c.split(/[（(]/)[0] ?? "";
    if (!normalizeSearch(beforeParen).includes(q) && normalizeSearch(clause).includes(q)) {
      return false;
    }
  }
  return true;
}

export type CropMatcher = (cropName: string) => boolean;

export function getCropMatcher(crop: CropKey, cropText?: string): CropMatcher {
  switch (crop) {
    case "shiba":
      return matchShiba;
    case "mikan":
      return matchMikan;
    case "ringo":
      return matchRingo;
    case "nashi":
      return matchNashi;
    case "kaki":
      return matchKaki;
    case "budo":
      return matchBudo;
    case "other_fruit":
    case "other":
      return (c) => matchFreeText(c, cropText ?? "");
    default:
      return () => false;
  }
}

/** Broad SQL LIKE patterns to prefilter before precise TS matching. */
export function sqlCropPrefilter(crop: CropKey, cropText?: string): { sql: string; binds: string[] } | null {
  switch (crop) {
    case "shiba":
      return { sql: "a.crop_name LIKE ?", binds: ["%芝%"] };
    case "mikan":
      return {
        sql: "(a.crop_name LIKE ? OR a.crop_name LIKE ? OR a.crop_name LIKE ? OR a.crop_name LIKE ?)",
        binds: ["みかん%", "温州みかん%", "なつみかん%", "かんきつ%"],
      };
    case "ringo":
      return {
        sql: "(a.crop_name LIKE ? OR a.crop_name LIKE ? OR a.crop_name LIKE ?)",
        binds: ["%りんご%", "りんご%", "仁果類%"],
      };
    case "nashi":
      return {
        sql: "(a.crop_name LIKE ? OR a.crop_name LIKE ?)",
        binds: ["%なし%", "仁果類%"],
      };
    case "kaki":
      return { sql: "a.crop_name LIKE ?", binds: ["%かき%"] };
    case "budo":
      return { sql: "a.crop_name LIKE ?", binds: ["%ぶどう%"] };
    case "other_fruit":
    case "other": {
      const q = (cropText ?? "").trim();
      if (q.length < 2) return null;
      const hw = toHalfwidthKatakana(q.normalize("NFKC"));
      if (hw !== q) {
        return {
          sql: "(a.crop_name LIKE ? OR a.crop_name LIKE ?)",
          binds: [`%${q}%`, `%${hw}%`],
        };
      }
      return { sql: "a.crop_name LIKE ?", binds: [`%${q}%`] };
    }
    default:
      return null;
  }
}

export const CROP_CATEGORY_MAP: Record<CropKey, "turf" | "fruit" | "other"> = {
  shiba: "turf",
  mikan: "fruit",
  ringo: "fruit",
  nashi: "fruit",
  kaki: "fruit",
  budo: "fruit",
  other_fruit: "fruit",
  other: "other",
};

export function isValidCropForCategory(category: string, crop: CropKey): boolean {
  return CROP_CATEGORY_MAP[crop] === category;
}
