# 農薬データ取込（作業範囲B）

FAMIC の登録情報（xls）と CropLife の RAC 製品名順表（xlsx）を読み込み、ローカル SQLite（および任意で D1）へ投入します。

## 前提

```bash
pip install -r scripts/pesticides/requirements.txt
```

入力ディレクトリに次を置きます（サブフォルダでも可）。

- `登録基本部.xls`
- `登録適用部一.xls`
- `登録適用部二.xls`
- `mechanism_rac.xlsx`（シート名に「製品名順」を含むこと）

## 取込（推奨・最短）

```bash
npm run pesticides:import -- --input-dir "C:/Users/hitos/Documents/2026/202610/20261019"
```

生成物:

| パス | 内容 |
|---|---|
| `data/pesticides/local.sqlite` | 検証・開発用 SQLite |
| `data/pesticides/d1_batches/*.sql` | D1 投入用 SQL バッチ |
| `data/pesticides/last_import_summary.json` | 件数サマリ |

## ローカル D1 へも入れる場合

初回のみ（リモート作成。本番用 ID を `wrangler.toml` に反映）:

```bash
npx wrangler d1 create tool-portal-pesticides
```

ローカル D1 へスキーマ＋データ投入（件数が多いため数分かかることがあります）:

```bash
npm run pesticides:import -- --input-dir "..." --apply-d1-local
```

スキーマだけ先に当てる場合:

```bash
npm run pesticides:d1:migrate:local
```

## スキーマ

`migrations/0001_pesticides.sql`

- `products` / `product_ingredients` / `applications` / `croplife_rac`
- `crop_presets`（芝・みかん・りんご・なし・かき・ぶどう・その他）
- `import_meta`

## 検索 API（作業範囲C）

ローカル D1 投入後、`npm run dev`（`wrangler pages dev`）で利用できます。

| メソッド | パス | 内容 |
|---|---|---|
| GET | `/portal/api/pesticides/presets` | 作物プリセット |
| GET | `/portal/api/pesticides/search` | 検索（`category` / `crop` 必須） |
| GET | `/portal/api/pesticides/:regNo` | 製品詳細 |
| GET | `/portal/api/pesticides/:regNo/rotation` | 同一 RAC / ローテ候補 |

例: `/portal/api/pesticides/search?category=turf&crop=shiba&target=さび病`

楽RAC UI（`/portal/rac/`）は案A（芝 / 果樹 / 野菜・その他 → 作物）から上記を呼び出します。

## 注意

- PDF（IRAC/FRAC/HRAC）は取り込みません（製品名順 xlsx が RAC 正本）
- FAMIC 一括ダウンロードを現行登録とみなします
- `data/pesticides/` の生成物は gitignore 対象です
- 本番デプロイ前に `wrangler d1 create` で実 `database_id` を払い出し、リモートへデータ投入が必要です
