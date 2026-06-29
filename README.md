# tool-portal

芝管理ツールを集約するポータルサイト（Cloudflare Pages + Functions）。

## URL 構成

| パス | 内容 |
|------|------|
| `/portal/` | 芝しごとポータル TOP |
| `/portal/spray/` | ピンポイント天気で芝しごと |
| `/portal/api/dashboard` | ポータル TOP 用まとめ取得 API |
| `/portal/api/weather` | 天気予報 API（単体） |
| `/portal/api/disease-risk` | 病害リスク API（単体） |
| `/portal/api/growth-potential` | Growth Potential API（単体） |
| `/portal/api/gdd` | 積算温度（GDD）API（単体） |
| `/portal/api/chat` | 芝しごと・AI質問箱 API（Gemini） |
| `/portal/api/geocode` | 逆ジオコーディング API |
| `/portal/spray/api/forecast` | 散布予報 API |

## ポータル TOP 機能

`/portal/` では以下を表示します。

| 機能 | 説明 |
|------|------|
| 設定 | 施設名・緯度経度・芝種・AI回答モードなど（Cookie 保存） |
| AI質問箱 | タイトル下の入力欄から Gemini による芝管理 Q&A（Cloudflare Functions） |
| 天気予報 | 48h 横スクロールウィジェット。「もっと詳しく」から `/portal/spray/` へ |
| 病害リスク | 翌日・明後日 朝6:00 時点の5病害リスク（%） |
| 積算温度（GDD） | プリモマックス・グリーンフィールドの散布日から昨日までの GDD ゲージ、および設定芝種の発芽積算温度ゲージ |
| Growth Potential | 昨年の月平均気温から算出した GP 曲線（暖地型・寒地型・未指定） |

散布日は [agromap](https://github.com/hitoshi4148/agromap) と同じ Cookie 名（`agromap_primomax_date` / `agromap_greenfield_date`）で保存し、同一ドメイン上で共有できます。播種日は暖地型・寒地型それぞれ `agromap_warm_seeding_date` / `agromap_cool_seeding_date` に保存します。

発芽積算温度は設定の暖地型・寒地型芝種ごとに基準温度と目標 GDD（`src/gdd/germination-config.ts`）を使い、播種日から昨日までを NASA POWER 日次気温で計算します。ゲージ最大値は芝種ごとの目標値、超過時も緑の進捗表示のみです。

### 芝しごと・AI質問箱

[turf_advisor](https://github.com/hitoshi4148/turf_advisor) のチャット機能を Cloudflare Pages Functions に移植しています（Render のコールドスタートなし）。

- UI: タイトル下に注意4カ条・入力欄・送信ボタン。初回送信でチャット欄が縦に展開
- 設定: ポータル設定（緯度経度・芝種等）＋ AI回答モード（デフォルト「慎重に回答」）をプロンプトに反映
- 履歴: ページを開いている間のみ（リロードで消える）
- API: `POST /portal/api/chat` → Gemini（`GEMINI_API_KEY` 必須）

#### 環境変数

| 変数 | 必須 | 説明 |
|------|------|------|
| `GEMINI_API_KEY` | はい | [Google AI Studio](https://aistudio.google.com/) の API キー |
| `GEMINI_MODEL` | いいえ | デフォルト `gemini-2.5-flash` |

**ローカル**: `.dev.vars.example` を `.dev.vars` にコピーしてキーを設定（`wrangler pages dev` が自動読み込み）

**本番**: Cloudflare Pages ダッシュボード → Settings → Environment variables

### 病害リスク「判定ロジック」

各病害名の右に **判定ロジック** ボタンがあります。クリックするとモーダルで計算方法を表示します。

- 対象: ダラースポット / ブラウンパッチ / ピシウム / 炭疽病 / ラージパッチ
- 内容: [ai_forecast](https://github.com/hitoshi4148/ai_forecast) の「芝しごと・病害リスク予報」と同じ判定ロジック説明（条件・計算式）
- 閉じ方: ×ボタン、背景クリック、Esc キー

判定ロジックの文言は `public/portal/portal.js` の `DISEASE_LOGIC` に定義しています（`ai_forecast/components/DiseaseRiskExplanation.jsx` と同等）。

## ローカル開発

```powershell
npm install
npm run dev
```

ブラウザで以下を開いてください:

- http://localhost:8788/portal/
- http://localhost:8788/portal/spray/

## Cloudflare Pages へのデプロイ

### 1. GitHub に push

```powershell
git init
git add .
git commit -m "Initial tool-portal with spray-forecast port"
git remote add origin https://github.com/hitoshi4148/tool-portal.git
git push -u origin main
```

### 2. Cloudflare ダッシュボード

1. 右上 **+ Add** → **Pages** → **Connect to Git**
2. GitHub の `tool-portal` リポジトリを選択
3. ビルド設定:
   - **Framework preset**: None
   - **Build command**: （空欄）
   - **Build output directory**: `public`
4. **Deploy**

デプロイ後、Cloudflare ダッシュボードに表示される **あなた専用の URL** で確認します。

> **注意**: `tool-portal.pages.dev` は別のサイト（名前の衝突）です。  
> ダッシュボードの **Visit site** に表示された URL を使ってください。  
> 例: `https://turf-tools-portal.pages.dev/` や `https://tool-portal-xxxxx.pages.dev/`

確認 URL:

- `（あなたのURL）/portal/`
- `（あなたのURL）/portal/spray/`

### 3. 本番ドメイン接続（後日）

`*.pages.dev` で動作確認後、`turf-tools.jp` を Cloudflare に追加し DNS を移行します。

## 外部 API の利用方針

ポータル TOP は **1 回の `/portal/api/dashboard` 呼び出し** で天気・病害リスク・GP をまとめて取得します。  
Met Norway / NASA POWER への重複アクセスを避けるため、サーバー側でデータを共有しています。

### MET Norway（Locationforecast 2.0）

| 利用箇所 | 呼び出し回数（1リクエストあたり） | 用途 |
|----------|-----------------------------------|------|
| ポータル TOP（`/portal/api/dashboard`） | **1 回** | 48h 天気ウィジェット + 72h 病害リスク予測 |
| 散布予報（`/portal/spray/`） | 1 回 | 散布タイミング判定（別ページ・独立） |

**以前の問題**: 天気 API と病害リスク API を別々に呼んでいたため、ポータル TOP 表示のたびに MET Norway へ **2 回** アクセスしていました。  
**現状**: `fetchMet` は dashboard 内で **1 回だけ** 実行し、返却データから天気（48h）と病害用 forecast（72h）を切り出します。

単体 API（`/portal/api/weather`, `/portal/api/disease-risk`）は開発・デバッグ用に残していますが、フロントエンドからは dashboard のみを利用します。

### NASA POWER

| 利用箇所 | 呼び出し回数（dashboard 1 回あたり） | 期間 | 用途 |
|----------|----------------------------------------|------|------|
| Daily（統合） | **1 回** | 昨年 1/1 〜 昨日 | GP 用の昨年月平均気温 + 病害用の過去日次 |
| Hourly | **1 回** | 過去 7 日 〜 昨日 | 病害リスク計算用の時間別気温・湿度 |

**以前の問題**: 病害用 daily（7 日分）と GP 用 daily（昨年 1 年分）を **別リクエスト** で取得していました。  
**現状**: daily は **1 リクエスト**（昨年 1/1 〜 昨日）に統合し、サーバー側で期間を切り分けます。hourly は病害計算に必要なため従来どおり 1 回です。

GP と病害リスクで期間・粒度が異なるため NASA hourly の統合は行っていません（hourly API は日次とは別エンドポイント）。

### その他

| サービス | 利用箇所 | 備考 |
|----------|----------|------|
| Nominatim (OSM) | `/portal/api/geocode` | 設定保存時・現在地取得時のみ。気象 API とは独立 |

### データフロー（ポータル TOP）

```
ブラウザ
  └─ GET /portal/api/dashboard?lat=&lon=&warmGrass=&coolGrass=
       ├─ MET Norway ............... 1 回 → 天気 + 病害 forecast
       ├─ NASA POWER daily ......... 1 回 → GP + 病害 daily
       └─ NASA POWER hourly ........ 1 回 → 病害 hourly

積算温度（GDD）は dashboard とは別に `/portal/api/gdd` を散布日ごとに呼び出します（NASA POWER daily）。
```

## プロジェクト構成

```
tool-portal/
├── public/portal/              # ポータル TOP・散布予報 UI
├── functions/portal/api/       # Pages Functions（API）
│   ├── dashboard.ts            # まとめ取得（ポータル TOP 用）
│   ├── weather.ts
│   ├── disease-risk.ts
│   ├── growth-potential.ts
│   ├── gdd.ts
│   ├── chat.ts
│   └── geocode.ts
├── src/
│   ├── portal/fetch-dashboard.ts
│   ├── advisor/                  # AI質問箱（Gemini）
│   ├── weather/                  # 天気ウィジェット
│   ├── disease/                  # 病害リスク
│   ├── growth-potential/         # GP
│   ├── gdd/                      # 積算温度
│   ├── geocode/
│   └── spray/                    # 散布判定ロジック
└── wrangler.toml
```

## 元アプリとの関係

- 元の [spray-forecast](https://github.com/hitoshi4148/spray-forecast) は変更していません
- 病害リスク計算・判定ロジック説明は [ai_forecast](https://github.com/hitoshi4148/ai_forecast) から移植済み
- ロジックは Python 版から TypeScript に移植済み

## ライセンス

MIT
