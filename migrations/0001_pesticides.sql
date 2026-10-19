-- 楽RAC / 農薬検索 API 用 D1 スキーマ（作業範囲B）
-- FAMIC 現行登録 + CropLife 製品名順 RAC 表

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  reg_no TEXT PRIMARY KEY,
  pesticide_type TEXT,
  name TEXT NOT NULL,
  holder TEXT,
  concentration TEXT,
  mix_count INTEGER,
  use_category TEXT,
  formulation TEXT,
  registered_on TEXT
);

CREATE TABLE IF NOT EXISTS product_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reg_no TEXT NOT NULL,
  ingredient TEXT NOT NULL,
  ingredient_for_total_use TEXT,
  FOREIGN KEY (reg_no) REFERENCES products(reg_no) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_product_ingredients_reg ON product_ingredients(reg_no);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reg_no TEXT NOT NULL,
  use_category TEXT,
  pesticide_type TEXT,
  name TEXT,
  holder_short TEXT,
  crop_name TEXT NOT NULL,
  place TEXT,
  target_pest TEXT,
  purpose TEXT,
  dilution TEXT,
  spray_volume TEXT,
  timing TEXT,
  times_per_crop TEXT,
  method TEXT,
  fumigation_time TEXT,
  fumigation_temp TEXT,
  applicable_soil TEXT,
  zone TEXT,
  applicable_pesticide_name TEXT,
  mix_count TEXT,
  ingredient1_total_uses TEXT,
  ingredient2_total_uses TEXT,
  ingredient3_total_uses TEXT,
  ingredient4_total_uses TEXT,
  ingredient5_total_uses TEXT,
  FOREIGN KEY (reg_no) REFERENCES products(reg_no) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_applications_reg ON applications(reg_no);
CREATE INDEX IF NOT EXISTS idx_applications_crop ON applications(crop_name);
CREATE INDEX IF NOT EXISTS idx_applications_pest ON applications(target_pest);
CREATE INDEX IF NOT EXISTS idx_applications_name ON applications(name);

CREATE TABLE IF NOT EXISTS croplife_rac (
  reg_no TEXT NOT NULL,
  slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 5),
  ingredient TEXT,
  rac_code TEXT,
  product_name TEXT,
  use_category TEXT,
  PRIMARY KEY (reg_no, slot)
);
CREATE INDEX IF NOT EXISTS idx_croplife_rac_code ON croplife_rac(rac_code);

-- UI 案Aの作物プリセット（マッチングロジック本体は API 側コード）
CREATE TABLE IF NOT EXISTS crop_presets (
  key TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('turf', 'fruit', 'other')),
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_free_text INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS import_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR REPLACE INTO crop_presets (key, category, label, sort_order, is_free_text, notes) VALUES
  ('shiba', 'turf', '芝', 10, 0, '作物名に「芝」を含む（多品目列挙の末尾「等」行は除外）'),
  ('mikan', 'fruit', 'みかん', 20, 0, 'みかん・温州みかん・なつみかん・かんきつ（みかん除外句の行は除く）'),
  ('ringo', 'fruit', 'りんご', 30, 0, 'りんご・仁果類。除外句にりんごがある行は除く'),
  ('nashi', 'fruit', 'なし', 40, 0, 'なし・日本なし・西洋なし・仁果類。くちなし・さるなしは除外'),
  ('kaki', 'fruit', 'かき', 50, 0, 'かき。さかき・ひさかきは除外'),
  ('budo', 'fruit', 'ぶどう', 60, 0, 'ぶどう・大粒種ぶどう・小粒種ぶどう'),
  ('other_fruit', 'fruit', 'その他', 90, 1, '果樹・自由記述'),
  ('other', 'other', 'その他', 100, 1, '野菜・その他・自由記述');
