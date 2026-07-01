# tool-portal

芝管理ツールを集約するポータルサイト（Cloudflare Pages + Functions）。

**現在のバージョン: v1.1.0**

## 本番 URL

| URL | 内容 |
|-----|------|
| https://www.turf-tools.jp/portal/ | 芝しごとポータル TOP（本番） |
| https://www.turf-tools.jp/portal/spray/ | ピンポイント天気で芝しごと（本番） |
| https://www.turf-tools.jp/portal/rac/ | 楽RAC農薬ローテ（本番） |
| https://www.turf-tools.jp/portal/risk/ | 病害リスク予報（本番） |
| https://tool-portal-9y2.pages.dev/portal/ | Pages 直接 URL（検証・フォールバック用） |

> `tool-portal-9y2` の `-9y2` は Cloudflare が付与した一意サフィックスで削除できません。  
> `tool-portal.pages.dev` は別プロジェクトの URL なので使用しないでください。

Wix ホームページ（https://www.turf-tools.jp/）は DNS 経由で従来どおり表示されます。Worker が介入するのは `/portal/*` のみです。

## URL 構成

| パス | 内容 |
|------|------|
| `/portal/` | 芝しごとポータル TOP |
| `/portal/spray/` | ピンポイント天気で芝しごと |
| `/portal/rac/` | 楽RAC農薬ローテ（クライアント完結・FAMIC JSON） |
| `/portal/risk/` | 病害リスク予報（Leaflet 地図・最大4施設） |
| `/portal/api/risk-map` | 病害リスク一括取得 API（地図用） |
| `/portal/api/dashboard` | ポータル TOP 用まとめ取得 API |
| `/portal/api/weather` | 天気予報 API（単体・デバッグ用） |
| `/portal/api/disease-risk` | 病害リスク API（単体・デバッグ用） |
| `/portal/api/growth-potential` | Growth Potential API（単体・デバッグ用） |
| `/portal/api/gdd` | 積算温度（GDD）API |
| `/portal/api/chat` | 芝しごと・AI質問箱 API（Gemini） |
| `/portal/api/geocode` | 逆ジオコーディング API |
| `/portal/spray/api/forecast` | 散布予報 API |

## ポータル TOP 機能

`/portal/` では以下を表示します。

### レイアウト

```
[[施設名](地名)] [芝しごとポータル PNG]          [⚙ 設定]
[AI質問箱（入力欄・注意4カ条）]
[48h 天気予報ウィジェット]  「もっと詳しく」→ /portal/spray/
┌─────────────────┬─────────────────┐
│ 病害リスク予測   │ PGR適時・発芽予測 │
└─────────────────┴─────────────────┘
┌─────────────────┬─────────────────┐
│ 成長能(Growth   │ 農薬検索         │
│  Potential)     │ → /portal/rac/  │
└─────────────────┴─────────────────┘
[芝しごとシリーズ（2列カードグリッド）]
[PR | ブログ | YouTube バナー（3列）]
[フッター: 気象クレジット / グロウアンドプログレス / v1.0.0]
```

| 機能 | 説明 |
|------|------|
| タイトル | `[施設名](地名)` + **芝しごとポータル PNG ロゴ**（横並び・中央寄せ）。地名は逆ジオコーディング（Nominatim）で取得し Cookie に保存 |
| タイトルアニメ | PNG ロゴにきらんと光る CSS アニメーション（`prefers-reduced-motion` 時は停止） |
| 設定 | 施設名・緯度経度・芝種・AI回答モードなど（Cookie `portalSettings` に保存） |
| AI質問箱 | タイトル下の入力欄から Gemini による芝管理 Q&A（Cloudflare Functions） |
| 天気予報 | 48h 横スクロールウィジェット。「もっと詳しく」から `/portal/spray/` へ（予報データはキャッシュ利用） |
| 病害リスク予測 | 翌日・明後日 朝6:00 時点の5病害リスク（%）。各病害名横に「判定ロジック」モーダル |
| PGR適時・発芽予測 | 除草剤（トリネキサパックエチル / グリーンフィールド）の散布日から昨日までの GDD ゲージ、および設定芝種の発芽積算温度ゲージ |
| 成長能(Growth Potential) | 昨年の月平均気温から算出した GP 曲線（暖地型・寒地型・未指定）。右隣に農薬検索パネル |
| 農薬検索 | 農薬名・病害虫名で検索し `/portal/rac/` へ遷移して結果一覧を自動表示（URL クエリ `pesticide` / `target`） |
| 芝しごとシリーズ | 外部アプリへのリンクカード（2列）。マウスオーバーで各アプリの説明文を表示 |
| 関連バナー | PR・ブログ・YouTube を 3 列 1 行（最大幅 720px）でフッター上に表示 |
| フッター | 気象データクレジット・グロウアンドプログレスリンク・**v1.0.0** |

### PGR適時・発芽予測（積算温度 GDD）

散布日は [agromap](https://github.com/hitoshi4148/agromap) と同じ Cookie 名で保存し、同一ドメイン上で共有可能です。

| Cookie 名 | 用途 |
|-----------|------|
| `agromap_primomax_date` | トリネキサパックエチル（プリモマックス）散布日 |
| `agromap_greenfield_date` | グリーンフィールド散布日 |
| `agromap_warm_seeding_date` | 暖地型芝種の播種日 |
| `agromap_cool_seeding_date` | 寒地型芝種の播種日 |

> 注: 上記 Cookie 名は agromap 側の実装に合わせています。プリモマックスの表記は **トリネキサパックエチル**（プロパミド表記から修正済み）。

| 項目 | 基準 |
|------|------|
| 除草剤 GDD | 基準温度 0℃ |
| トリネキサパックエチル | 閾値 200 GDD |
| グリーンフィールド | 閾値 300〜350 GDD |
| 発芽 GDD | 芝種ごとの基準温度・目標 GDD（`src/gdd/germination-config.ts`） |

API: `/portal/api/gdd`（NASA POWER daily）。dashboard とは独立して散布日ごとに呼び出します。

### 芝しごと・AI質問箱

[turf_advisor](https://github.com/hitoshi4148/turf_advisor) のチャット機能を Cloudflare Pages Functions に移植しています（Render のコールドスタートなし）。

- UI: タイトル下に注意4カ条（ℹ ボタンでホバー/フォーカス表示）・入力欄・「AIに質問」ボタン。初回送信でチャット欄が縦に展開
- 設定: ポータル設定（緯度経度・芝種等）＋ AI回答モード（デフォルト「慎重に回答」）をプロンプトに反映
- 履歴: ページを開いている間のみ（リロードで消える）
- API: `POST /portal/api/chat` → Gemini（`GEMINI_API_KEY` 必須）

#### 環境変数

| 変数 | 必須 | 説明 |
|------|------|------|
| `GEMINI_API_KEY` | はい | [Google AI Studio](https://aistudio.google.com/) の API キー |
| `GEMINI_MODEL` | いいえ | デフォルト `gemini-2.5-flash` |

**ローカル**: `.dev.vars.example` を `.dev.vars` にコピーしてキーを設定（`wrangler pages dev` が自動読み込み）

**本番**: Cloudflare Pages ダッシュボード → **tool-portal** → Settings → Environment variables → **Production**

### 病害リスク「判定ロジック」

各病害名の右に **判定ロジック** ボタンがあります。クリックするとモーダルで計算方法を表示します。

- 対象: ダラースポット / ブラウンパッチ / ピシウム / 炭疽病 / ラージパッチ
- 内容: [ai_forecast](https://github.com/hitoshi4148/ai_forecast) の「芝しごと・病害リスク予報」と同じ判定ロジック説明
- 閉じ方: ×ボタン、背景クリック、Esc キー

判定ロジックの文言は `public/portal/portal.js` の `DISEASE_LOGIC` に定義しています。

### 芝しごとシリーズ

外部アプリ（主に Render 上）へのリンクを 2 列カードグリッドで表示します。カードにマウスオーバー（またはキーボードフォーカス）すると説明文が重なって表示されます。

| アプリ | カテゴリ | 説明 |
|--------|----------|------|
| ターフプール | データ | 5か所のスマホ写真から緑の被覆率、芝緑度、芝活力度、色均一性、刈込品質を測定し、ピッチのプールビューを3D表示 |
| 楽RAC農薬ローテ | 管理 | 同一サイト `/portal/rac/` へリンク。RACコードでローテーション候補を提案（Render 不要） |
| 施肥設計ナビ | 管理 | 施設の管理方針、気象情報をもとにした成長能、土壌分析値などをもとに、月毎のNPK施肥量計算を支援（起動に30秒必要） |
| 病害リスク予報 | 予報 | 同一サイト `/portal/risk/` へリンク。地図上に翌日・明後日 朝6:00 の5病害リスク（最大4施設） |
| AI質問箱 | AI | 事前に登録した前提情報を使って、芝管理特化型AIチャットアシスタント（起動に30秒必要） |
| 病害画像診断AI | AI | 病斑写真から芝生の5大病害をAI診断（起動に30秒必要） |
| ピンポイント天気で芝しごと | 予報 | 同一サイト `/portal/spray/` へリンク。時間毎の芝管理作業アドバイス |
| 積算温度追跡マップ | マップ | 積算温度による病害、雑草、害虫発生や生育予察を地図上にアニメーション表示 |
| 温量指数気候区分マップ | マップ | 1981-2025の温量指数による気候区分の変化を地図上にアニメーション表示。地域によって育成しやすい芝種選択を支援 |
| クレームサバイバル | その他 | 選手と上司の板挟みで日々芝管理を行うグリーンキーパーのゲーム。絶対に勝てないのがポイント |

カテゴリラベルを非表示にする場合は `.series-section--no-category` クラスを `series-section` に追加します。

### ピンポイント天気への遷移と予報キャッシュ

ポータル TOP の `/portal/api/dashboard` 取得時に、同じ MET Norway データから **散布予報（sprayForecast）** もサーバー側で生成します。  
ブラウザは `sessionStorage`（キー: `portalSprayForecastCache`）に保存し、「もっと詳しく」や芝しごとシリーズから `/portal/spray/` へ遷移した際、**同一緯度経度・1時間以内** であれば MET Norway への再取得を省略します。

| 条件 | spray ページの動作 |
|------|-------------------|
| ポータル TOP 表示直後に遷移 | キャッシュから即表示 |
| 緯度経度を変更 | 再取得 |
| 1時間超過 | 再取得 |
| spray を直接開く | 再取得（キャッシュなし） |

spray ページは `portalSettings` Cookie の緯度経度を優先して読み込みます。

### 関連バナー（フッター上）

| バナー | リンク先 |
|--------|----------|
| PR（農薬・資材メーカー向け） | https://www.turf-tools.jp/services-4 |
| 芝管理技術ブログ | https://www.turf-tools.jp/blog |
| YouTube | https://www.youtube.com/channel/UCSRU0zk4Fj1ETWqMRlJDPJQ |

デスクトップ: 3 列 1 行（最大幅 720px・高さ 76px）。スマホ: 1 列縦積み（最大幅 280px）。

## 変更履歴

### v1.0.0（2026-06）

本番公開版。https://www.turf-tools.jp/portal/ で稼働。

**ポータル TOP**

- 48h 天気予報・病害リスク・積算温度（GDD）・Growth Potential を 1 画面に統合
- 設定（施設名・緯度経度・芝種・AI回答モード）を Cookie 保存
- AI質問箱（Gemini / Cloudflare Functions）
- 芝しごとシリーズ（10 アプリ・2 列カード・ホバー説明文）
- タイトルを PNG ロゴ化（施設名・地名と横並び、きらんと光る CSS アニメーション）
- フッター上に PR・ブログ・YouTube バナー（3 列コンパクト配置）
- Google Analytics（`G-68DQJX02K5`）
- フッターにバージョン表示（v1.0.0）

**API・データ**

- `/portal/api/dashboard` で MET Norway / NASA POWER の重複取得を統合
- dashboard 応答に `sprayForecast` を含め、spray ページへの遷移時キャッシュ利用
- 積算温度 API（`/portal/api/gdd`）、逆ジオコーディング API

**インフラ**

- Cloudflare Pages デプロイ（GitHub 連携）
- `turf-tools.jp/portal/*` を Cloudflare Worker（`turf-tools-router`）で Pages に振り分け
- DNS を Cloudflare に移行（レジストラ: お名前.com）、Wix ホームページは維持

**散布予報（`/portal/spray/`）**

- [spray-forecast](https://github.com/hitoshi4148/spray-forecast) を TypeScript 移植
- ポータル設定の緯度経度を優先読み込み
- ポータル TOP からの遷移時は sessionStorage キャッシュを利用

**楽RAC農薬ローテ（`/portal/rac/`）**

- [racrac](https://github.com/hitoshi4148/racrac) をクライアント完結型に移植（案A）
- FAMIC 由来 JSON（約 5.4 MB）を静的配信し、ブラウザ内で検索・RAC・ローテーション判定
- Render コールドスタート（約30秒）を解消。ポータルシリーズから `/portal/rac/` へ内部リンク

**楽RAC農薬ローテ v1.1.1（2026-07）**

- フッター表記を `Version 1.1.1 ｜ 2026.07` に更新
- 関連バナーをポータル TOP と同じレイアウトに統一（3 列グリッド・最大幅 720px・高さ 76px。スマホは 1 列・最大幅 280px）

**病害リスク予報（`/portal/risk/`）**

- [ai_forecast](https://github.com/hitoshi4148/ai_forecast) を Cloudflare Pages に移植
- Leaflet 地図 + 施設設定（CSV 最大3件 + 手動1件、`userFacilities` Cookie）
- `/portal/api/risk-map` で最大4施設の病害リスクを一括取得（既存 `fetchDiseaseRiskForecast` 再利用）
- 施設クリック時の Popup はポータル TOP と同じ2列表示（翌日・明後日 6:00）+ 判定ロジックモーダル（`disease-risk-ui.js` 共有）
- Render コールドスタート（約30秒）を解消

**病害リスク予報 v2.2.0（2026-07）**

- フッター表記を `Version 2.2.0 ｜ 2026.07` に更新
- 地図コンテナの高さをラッパー構造で修正（Leaflet タイルが表示されない問題）
- `portal.css` の紫グラデーション背景が残る問題を修正（ページ背景を薄いグレーに統一）
- ポータル TOP の `portalSettings` を初期施設表示に連携
- 施設設定パネルの JavaScript 構文エラーを修正
- 病害リスク UI を `disease-risk-ui.js` に共通化（ポータル TOP / risk ページ）

### ポータル TOP v1.1.0（2026-07）

**レイアウト・見出し**

- インサイト行の見出しを **病害リスク予測** / **PGR適時・発芽予測** に変更
- **成長能(Growth Potential)** と **農薬検索** を2列配置（GP 左・農薬検索右）
- GP グラフを横長化し高さを抑制。農薬検索パネルと高さを揃える flex レイアウト
- GP グラフの「今日」縦線アノテーション（日付ラベル）の見切れを修正

**農薬検索（ポータル TOP → `/portal/rac/`）**

- 農薬名・メーカー名 × 病害虫・雑草名（AND）の検索欄と「検索」ボタン
- バリデーション（2文字以上）後、`/portal/rac/?pesticide=…&target=…` へ遷移
- rac ページ側で URL パラメータを読み取り、データ読込後に自動検索

**UX**

- 緯度経度未設定時の4パネル表示を「右上の ⚙ 設定 から入力してください」に変更
- 未設定プレースホルダーの文字サイズを他の補助文言に合わせて調整

**楽RAC農薬ローテ v1.2.0（2026-07）**

- UI をポータル系列に統一（Bootstrap 削除、`portal.css` + 独自 `style.css`、薄グレー背景 `#f3f4f6`）
- 詳細画面で「同一グループを含む農薬」実行後、結果セクションまで自動スクロール
- ポータル TOP の農薬検索からの URL クエリ自動検索に対応

## npm スクリプト

| コマンド | 内容 |
|----------|------|
| `npm run dev` | ローカル開発サーバー（`http://127.0.0.1:8788`） |
| `npm run deploy` | Pages へ手動デプロイ（通常は Git push で自動デプロイ） |
| `npm run deploy:router` | `turf-tools.jp/portal*` 用 Worker ルートをデプロイ |

## ローカル開発

```powershell
npm install
npm run dev
```

ブラウザで以下を開いてください:

- http://127.0.0.1:8788/portal/
- http://127.0.0.1:8788/portal/spray/
- http://127.0.0.1:8788/portal/rac/
- http://127.0.0.1:8788/portal/risk/

AI質問箱をローカルで試す場合は `.dev.vars` に `GEMINI_API_KEY` が必要です。

### wrangler レジストリエラー（Windows）

`ENOENT` が出る場合:

```powershell
New-Item -ItemType Directory -Force -Path "$env:APPDATA\xdg.config\.wrangler\registry\tool-portal"
```

## Cloudflare Pages へのデプロイ

GitHub リポジトリ: https://github.com/hitoshi4148/tool-portal

`main` ブランチへの push で Cloudflare Pages が自動デプロイされます。

### 初回セットアップ（済）

1. GitHub リポジトリ `tool-portal` を Cloudflare Pages に接続
2. ビルド設定:
   - **Framework preset**: None
   - **Build command**: （空欄）
   - **Build output directory**: `public`
3. Production 環境変数に `GEMINI_API_KEY` を設定

## 本番ドメイン接続（`turf-tools.jp/portal/`）

Wix で `turf-tools.jp` 全体をホストしているため、**パス `/portal/` だけ** Cloudflare Pages に載せる構成です。DNS を Cloudflare に移し、Worker で `/portal/*` のみ Pages に振り分けます。

### 構成（稼働中）

```
ユーザー → Cloudflare DNS
            ├─ /portal/*  → Worker (turf-tools-router) → tool-portal-9y2.pages.dev
            └─ それ以外    → Cloudflare DNS → Wix（ホームページ・ブログ等）
```

- ホームページ・ブログは Worker を通さず、Cloudflare DNS レコード経由で Wix に直接届きます
- Worker ルートは `/portal*` のみ（`/*` 全体ではない）
- Worker ソース: `workers/turf-tools-router/`

### セットアップ手順

#### Step A: Cloudflare にドメインを追加

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **+ Add** → **Connect a domain**
2. `turf-tools.jp` を入力 → **Free** プラン → Continue

#### Step B: ネームサーバーを Cloudflare に変更（レジストラ側）

`turf-tools.jp` のレジストラは **お名前.com** です（`.jp` ドメインは [JPRS WHOIS](https://whois.jprs.jp/) で確認。ICANN Lookup は `.jp` 非対応）。

お名前.com の **ネームサーバー設定** で Wix NS を Cloudflare NS に差し替えます:

| 削除 | 追加（Cloudflare ダッシュボードに表示された値） |
|------|------------------------------------------------|
| `ns12.wixdns.net` | 例: `coco.ns.cloudflare.com` |
| `ns13.wixdns.net` | 例: `rene.ns.cloudflare.com` |

> **Wix 側で NS を削除する操作は不要**です。レジストラ（お名前.com）での差し替えだけで切り替わります。  
> Wix 管理画面に「ドメインが正しく接続されていない」等の警告が出ることがありますが、Cloudflare DNS で Wix 向けレコードを設定していればサイトは表示されます。

反映まで数時間〜最大 48 時間。Cloudflare Domains 画面で **Active** になれば OK です。DNSSEC が ON の場合はレジストラ側で OFF にしてください。

#### Step C: Cloudflare DNS レコード（Wix 本体用）

Cloudflare → **Domains** → `turf-tools.jp` → **DNS** → **Records**（**プロキシ ON = オレンジ雲**）:

| Type | Name | Content |
|------|------|---------|
| A | `@` | `185.230.63.107` |
| A | `@` | `185.230.63.186` |
| A | `@` | `185.230.63.171` |
| CNAME | `www` | `cdn1.wixdns.net`（Wix 管理画面の表示値を優先） |

#### Step D: Worker ルートをデプロイ

DNS が Active になったら:

```powershell
cd C:\Users\hitos\tool-portal
npm run deploy:router
```

成功時の出力例:

```
Deployed turf-tools-router triggers
  turf-tools.jp/portal*
  www.turf-tools.jp/portal*
```

## 外部 API の利用方針

ポータル TOP は **1 回の `/portal/api/dashboard` 呼び出し** で天気・病害リスク・GP をまとめて取得します。  
Met Norway / NASA POWER への重複アクセスを避けるため、サーバー側でデータを共有しています。

### MET Norway（Locationforecast 2.0）

| 利用箇所 | 呼び出し回数（1リクエストあたり） | 用途 |
|----------|-----------------------------------|------|
| ポータル TOP（`/portal/api/dashboard`） | **1 回** | 48h 天気ウィジェット + 72h 病害リスク予測 + spray 用キャッシュ生成 |
| 散布予報（`/portal/spray/`） | 0〜1 回 | キャッシュがあれば省略。なければ散布タイミング判定 |

`fetchMet` は dashboard 内で **1 回だけ** 実行し、返却データから天気（48h）・病害用 forecast（72h）・散布予報（`judge`）を切り出します。

### NASA POWER

| 利用箇所 | 呼び出し回数 | 期間 | 用途 |
|----------|--------------|------|------|
| Daily（統合） | **1 回** | 昨年 1/1 〜 昨日 | GP 用の昨年月平均気温 + 病害用の過去日次 |
| Hourly | **1 回** | 過去 7 日 〜 昨日 | 病害リスク計算用の時間別気温・湿度 |
| Daily（GDD） | 散布日・播種日ごと | 散布日 〜 昨日 | 積算温度ゲージ（`/portal/api/gdd`） |

### その他

| サービス | 利用箇所 | 備考 |
|----------|----------|------|
| Nominatim (OSM) | `/portal/api/geocode` | 設定保存時・現在地取得時のみ |
| Google Gemini | `/portal/api/chat` | AI質問箱（`GEMINI_API_KEY` 必須） |

### データフロー（ポータル TOP）

```
ブラウザ
  └─ GET /portal/api/dashboard?lat=&lon=&warmGrass=&coolGrass=
       ├─ MET Norway ............... 1 回 → 天気 + 病害 forecast + sprayForecast
       ├─ NASA POWER daily ......... 1 回 → GP + 病害 daily
       └─ NASA POWER hourly ........ 1 回 → 病害 hourly

  └─ GET /portal/api/gdd?... ....... 散布日・播種日ごと → GDD ゲージ

  └─ /portal/spray/ 遷移時 ........ sessionStorage キャッシュ → MET 再取得省略（条件付き）
```

## プロジェクト構成

```
tool-portal/
├── public/
│   ├── index.html                # / → /portal/ リダイレクト
│   └── portal/
│       ├── index.html            # ポータル TOP
│       ├── portal.js / portal.css
│       ├── portal-title-logo.png # タイトル PNG ロゴ
│       ├── banner_*.png / bloglink.png / youtubelink.png
│       ├── spray/                # ピンポイント天気 UI
│       ├── rac/                  # 楽RAC農薬ローテ（クライアント完結）
│       ├── risk/                 # 病害リスク予報（Leaflet 地図）
│       └── disease-risk-ui.js    # 病害リスク表示・判定ロジック（TOP/risk 共有）
├── functions/portal/
│   ├── api/                      # Pages Functions（API）
│   │   ├── dashboard.ts
│   │   ├── weather.ts
│   │   ├── disease-risk.ts
│   │   ├── risk-map.ts
│   │   ├── growth-potential.ts
│   │   ├── gdd.ts
│   │   ├── chat.ts
│   │   └── geocode.ts
│   └── spray/api/forecast.ts
├── src/
│   ├── portal/fetch-dashboard.ts
│   ├── advisor/                  # AI質問箱（Gemini）
│   ├── weather/
│   ├── disease/
│   ├── growth-potential/
│   ├── gdd/
│   ├── geocode/
│   └── spray/
├── workers/turf-tools-router/    # turf-tools.jp/portal* 用 Worker
│   ├── src/index.ts
│   └── wrangler.toml
├── wrangler.toml                 # Pages 設定
├── .dev.vars.example
└── package.json
```

## 元アプリ・関連リポジトリ

| リポジトリ | 関係 |
|------------|------|
| [spray-forecast](https://github.com/hitoshi4148/spray-forecast) | `/portal/spray/` の元。リポジトリ自体は未変更 |
| [racrac](https://github.com/hitoshi4148/racrac) | `/portal/rac/` の元。Render 版からクライアント完結に移植 |
| [ai_forecast](https://github.com/hitoshi4148/ai_forecast) | `/portal/risk/` の元。Render 版から Cloudflare に移植 |
| [turf_advisor](https://github.com/hitoshi4148/turf_advisor) | AI質問箱を Cloudflare Functions に移植 |
| [agromap](https://github.com/hitoshi4148/agromap) | 散布日・播種日 Cookie 名を共有 |

ロジックは Python 版から TypeScript に移植済みです。芝しごとシリーズの外部アプリは Render 等で個別稼働し、ポータルからリンクします。

## ライセンス

MIT
