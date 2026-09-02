# tool-portal

芝管理ツールを集約するポータルサイト（Cloudflare Pages + Functions）。

**現在のバージョン: v1.6.3**

## 本番 URL

| URL | 内容 |
|-----|------|
| https://www.turf-tools.jp/portal/ | 芝しごとポータル TOP（本番） |
| https://www.turf-tools.jp/portal/spray/ | ピンポイント天気で芝しごと（本番） |
| https://www.turf-tools.jp/portal/rac/ | 楽RAC農薬ローテ（本番） |
| https://www.turf-tools.jp/portal/risk/ | 病害リスク予報（本番） |
| https://www.turf-tools.jp/portal/turfpool/ | 芝しごと・ターフプール（本番） |
| https://www.turf-tools.jp/aihelpdesk/ | 芝しごと・AI相談室（別 Worker・同一ホスト） |
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
| `/portal/diagnosis/` | 病害画像診断AI（ONNX Runtime Web・端末内推論） |
| `/portal/turfpool/` | 芝しごと・ターフプール（5地点撮影・3Dプールビュー・手動ビルド配置） |
| `/portal/api/risk-map` | 病害リスク一括取得 API（地図用） |
| `/portal/api/dashboard` | ポータル TOP 用まとめ取得 API |
| `/portal/api/weather` | 天気予報 API（単体・デバッグ用） |
| `/portal/api/disease-risk` | 病害リスク API（単体・デバッグ用） |
| `/portal/api/growth-potential` | Growth Potential API（単体・デバッグ用） |
| `/portal/api/cbi` | ベント炭素収支（CBI）・体力指数 API（単体・デバッグ用） |
| `/portal/api/google-config` | 芝しごとノート用 Google OAuth クライアント ID 取得 |
| `/portal/api/gdd` | 積算温度（GDD）API |
| `/portal/api/chat` | ローカル用。本番ブラウザは `/aihelpdesk/api/chat` を直接呼ぶ |
| `/portal/api/geocode` | 逆ジオコーディング API |
| `/portal/spray/api/forecast` | 散布予報 API |

## ポータル TOP 機能

`/portal/` では以下を表示します。

### レイアウト

```
[[施設名](地名)] [芝しごと PNG ロゴ]          [⚙ 設定]
[スポーツターフ管理を、もっとシンプルに。 ℹ]
[AI質問箱（入力欄・注意4カ条・右端に Gemma 4 26B）]  「AI相談室」→ /aihelpdesk/
[48h 天気予報ウィジェット]  「もっと詳しく」→ /portal/spray/
┌─────────────────┬─────────────────┐
│ 病害リスク予測   │ PGR適時・発芽予測 │
└─────────────────┴─────────────────┘
┌─────────────────┬─────────────────┐
│ ベント炭素収支   │ 芝しごとノート   │
│ ・体力指数       │ （Google連携）   │
└─────────────────┴─────────────────┘
┌─────────────────┬─────────────────┐
│ 成長能(Growth   │ 農薬検索         │
│  Potential)     │ → /portal/rac/  │
└─────────────────┴─────────────────┘
[芝しごとシリーズ（2列カードグリッド）]
[PR | ブログ | YouTube バナー（3列）]
[フッター: 気象クレジット / グロウアンドプログレス / v1.6.3]
```

| 機能 | 説明 |
|------|------|
| タイトル | `[施設名](地名)` + **芝しごと PNG ロゴ**（横並び・中央寄せ）。地名は逆ジオコーディング（Nominatim）で取得し Cookie に保存 |
| ブランドメッセージ | ロゴ下に「スポーツターフ管理を、もっとシンプルに。」。右の **ℹ** でサイト説明（PC: ホバー、スマホ: タップ）。その下に **🆕 新しい解説**（ブログ）・ **▶ 解説動画**（YouTube）リンク |
| タイトルアニメ | PNG ロゴにきらんと光る CSS アニメーション（`prefers-reduced-motion` 時は停止） |
| 設定 | 施設名・緯度経度・芝種・AI回答モードなど（Cookie `portalSettings` に保存） |
| AI質問箱 | タイトル下の入力欄から Gemma 4 による芝管理 Q&A（本番は同一オリジンの `/aihelpdesk/api/chat`、SSE で逐次表示）。入力欄上右に **AI相談室**（`/aihelpdesk/`）。**資料フォルダ**（相談室と同じ。OCR 結果は `OCR_*.md` としてフォルダ内に保存）。入力欄下左に注意、右端に **AIモデル: Gemma 4 26B** |
| 天気予報 | 48h 横スクロールウィジェット。「もっと詳しく」から `/portal/spray/` へ（予報データはキャッシュ利用） |
| 病害リスク予測 | 翌日・明後日 朝6:00 時点の5病害リスク（%）。各病害名横に「判定ロジック」モーダル。パネル内右上に **他地域を見る** → `/portal/risk/` |
| ベント炭素収支（CBI） | 1パネルに炭素収支予測（明日/明後日）と体力指数（過去7日）を統合。**炭素収支とは**（ブログ）リンク・導入文・各項目の **判定ロジック** モーダル。予測セルは色・星・CBI 数値のみのコンパクト表示（行ラベル **炭素収支(CBI)**） |
| 芝しごとノート | 右隣パネル。**Googleで連携** した利用者のみ、マイドライブに `{施設名}作業履歴` スプレッドシート（日付・エリア・メモ）を保存。エリア・メモはマイクで音声入力可（対応ブラウザは下記） |
| PGR適時・発芽予測 | 除草剤（トリネキサパックエチル / フルルプリミドール）の散布日から昨日までの GDD ゲージ、および設定芝種の発芽積算温度ゲージ。各 PGR 名横の **ℹ** でリバウンド説明（GDD 表）を表示 |
| 成長能(Growth Potential) | 昨年の月平均気温から算出した GP 曲線（暖地型・寒地型・未指定）。右隣に農薬検索パネル |
| 農薬検索 | 農薬名・病害虫名で検索し `/portal/rac/` へ遷移して結果一覧を自動表示（URL クエリ `pesticide` / `target`）。各入力欄にマイク（音声入力。対応ブラウザは下記） |
| 芝しごとシリーズ | 外部アプリへのリンクカード（2列）。各カード名横の **ℹ** で説明文を表示（PC: ホバー、スマホ: タップ） |
| 関連バナー | PR・ブログ・YouTube を 3 列 1 行（最大幅 720px）でフッター上に表示 |
| フッター | 気象データクレジット・グロウアンドプログレスリンク・**v1.6.3** |

### 音声入力（マイク）

入力欄横のマイクは Web Speech API（`SpeechRecognition` / `webkitSpeechRecognition`）を使います。**PC または Android の Chrome / Edge** で利用できます。iPhone の Safari など非対応ブラウザでは、マイクは残しつつ、ブロックごとに1行だけ案内を出します。Chrome / Edge ではこの行は出しません。**AI利用時の注意4カ条には含めません。**

文言: `音声入力は PC または Android の Chrome / Edge で使えます`

| 場所 | 案内の出し方 |
|------|----------------|
| ポータル TOP・AI質問箱 | 入力欄の直下に1行 |
| ポータル TOP・農薬検索 | 2入力欄まとめて1行（検索ボタンの下） |
| ポータル TOP・芝しごとノート | Google 連携後のフォーム直下に1行（エリア・メモまとめて） |
| 楽RAC（`/portal/rac/`） | 検索行の下に1行 |

実装は `public/portal/voice-input.js`。非対応時にマイクを押すと、入力欄下のステータスにも長い案内を出します。

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
| 発芽 GDD | 芝種ごとの基準温度・発芽積算 GDD（`src/gdd/germination-config.ts`） |

API: `/portal/api/gdd`（NASA POWER daily）。dashboard とは独立して散布日ごとに呼び出します。

### 芝しごと・AI質問箱

[turf_advisor](https://github.com/hitoshi4148/turf_advisor) のチャット UI を移植したのがポータルトップの入力欄です。本番の回答は相談室 Worker（Gemma 4）で、同一オリジンの `/aihelpdesk/api/chat` を SSE で逐次表示します。Render の旧 AI質問箱は使いません。

- UI: タイトル下に注意4カ条（ℹ ボタンでホバー/フォーカス表示）・入力欄・マイク（音声入力）・「AIに質問」ボタン。初回送信でチャット欄が縦に展開。音声の対応ブラウザと非対応時の1行案内は「音声入力（マイク）」を参照
- 資料フォルダ: 相談室と同じ `sources.js`。Chrome / Edge でフォルダを指定。抽出／OCR 結果は同じフォルダの `OCR_<元ファイル名>.md` に保存し、再指定時は再利用
- 入力欄下: 左に「個人情報・顧客情報は入力しないでください」、同じ行の右端に「AIモデル: Gemma 4 26B」（幅が足りないときは次行の右寄せ）
- 入力欄上右: **AI相談室**（天気欄の「もっと詳しく」と同じピル型。`/aihelpdesk/` へ）
- 設定: ポータル設定（緯度経度・芝種等）＋ AI回答モード（デフォルト「慎重に回答」）をプロンプトに反映
- 履歴: ページを開いている間のみ（リロードで消える）
- API: 本番は同一オリジンの `POST /aihelpdesk/api/chat`（Gemma 4・SSE）。ローカルは `POST /portal/api/chat` が相談室へ中継（SSE 可）

#### 環境変数

| 変数 | 必須 | 説明 |
|------|------|------|
| `GOOGLE_OAUTH_CLIENT_ID` | 芝しごとノート利用時 | Google Cloud OAuth 2.0 Web クライアント ID |
| `HELPDESK_CHAT_URL` | ローカルのみ | Pages Function `/portal/api/chat` が中継する相談室 URL。未設定なら `https://www.turf-tools.jp/aihelpdesk/api/chat` |

**ローカル**: `.dev.vars.example` を `.dev.vars` にコピーしてキーを設定（`wrangler pages dev` が自動読み込み）

**本番**: Cloudflare Pages ダッシュボード → **tool-portal** → Settings → Environment variables → **Production**

### 病害リスク「判定ロジック」

各病害名の右に **判定ロジック** ボタンがあります。クリックするとモーダルで計算方法を表示します。

- 対象: ダラースポット / ブラウンパッチ / ピシウム / 炭疽病 / ラージパッチ
- 内容: [ai_forecast](https://github.com/hitoshi4148/ai_forecast) の「芝しごと・病害リスク予報」と同じ判定ロジック説明
- 閉じ方: ×ボタン、背景クリック、Esc キー

判定ロジックの文言は `public/portal/disease-risk-ui.js` の `DISEASE_LOGIC` に定義しています。

### ベント炭素収支予測・ベント体力指数（CBI）

病害リスク予測と同じコンパクトな2列パネルで、ベントグラス向けの炭素収支を表示します。タイトル横の **炭素収支とは** からブログ記事（Q10則・夜温と炭素収支の解説）を新しいタブで開けます。各パネルタイトル横の **判定ロジック** ボタンから、数式と今回の計算値をモーダルで確認できます（×ボタン・背景クリック・Esc で閉じる）。

#### ベント炭素収支予測

翌日・明後日の朝6:00時点の日次 CBI（Carbon Balance Index）を ★1〜5 で表示します。

| 項目 | 内容 |
|------|------|
| データ源 | MET Norway 96時間予報（気温・雲量） |
| 昼間（光合成） | 6:00–18:00 の気温から Growth Potential を合算し、日射または雲量で光補正 L を掛け合わせる |
| 夜間（呼吸） | 18:00–翌6:00 の気温から Q10 式で呼吸負荷指数 RLI を合算 |
| 基本式 | **CBI = P / RLI**（P = 光合成指数、RLI = 呼吸負荷指数） |
| 星評価 | CBI ≥ 2.0 → ★5（非常に良好）、≥ 1.5 → ★4、≥ 1.0 → ★3、≥ 0.7 → ★2、≥ 0.4 → ★1（危険） |
| 判定ロジック | 明日・明後日それぞれの P / L / RLI / CBI の実測値と星判定を表示 |

光合成指数 P の GP 式（ベントグラス: T<sub>opt</sub>=20℃, σ=10）:

```
GP(T) = exp(−0.5 × ((T − 20) / 10)²)
P = Σ GP(T) × L
```

光補正 L: 日射あり `L = clamp(0.5 + 0.5 × DLI / 20, 0.5, 1.0)`、雲量のみ `L = clamp(1 − 0.5 × 雲量, 0.5, 1.0)`

呼吸負荷 RLI: `RLI = Σ 2^((T − 15) / 10)`（夜間各時間の合計）

#### 表示仕様（v1.6.1〜）

セル内の日本語ラベル（「良好」「注意」など）は非表示とし、**色・星・数値**だけで直感的に読めるようにしています。段階名はスクリーンリーダー向けに `aria-label` に残し、詳細は **判定ロジック** モーダルで確認できます。

| 要素 | 表示内容 | サイズ・備考 |
|------|----------|--------------|
| 行ラベル（左列） | **炭素収支(CBI)** | セル内に「CBI」接頭辞を付けないため、ここで単位を明示 |
| 炭素収支セル | ★1〜5 + CBI 数値（小数2桁） | 72×58px。星 14px、数値 14px。列幅 72px |
| セル背景色 | 星段階に応じた5色 | 緑（良好）→ 黄 → 橙 → 赤（危険） |
| 体力指数セル | % のみ | 幅 72px、16px。日本語ラベルは非表示（色で段階を表現） |
| フッター文 | コメント + 加重平均 CBI | セル外のテキストで補足説明 |

星5個がセル幅に収まるよう `letter-spacing` を調整しています（`public/portal/portal.css` の `.cbi-cell-stars`）。

#### ベント体力指数

NASA POWER の過去7日間の実績気象から日次 CBI を算出し、直近ほど重みを大きくした加重平均を 0〜100% の体力指数に換算します。

| 項目 | 内容 |
|------|------|
| データ源 | NASA POWER hourly（気温・日射 `ALLSKY_SFC_SW_DWN`、過去8日分） |
| 日次 CBI | 炭素収支予測と同じ P / RLI 式（実績気象ベース） |
| 重み（新しい順） | 30%, 25%, 20%, 10%, 7%, 5%, 3% |
| 加重平均 | CBI<sub>加重</sub> = Σ(CBI<sub>i</sub> × w<sub>i</sub>) / Σw<sub>i</sub> |
| 体力指数 | clamp(20 + (CBI<sub>加重</sub> − 0.4) / (2.0 − 0.4) × 80, 0, 100) % |
| 判定ロジック | 過去7日の日次 CBI・重み・寄与の表と、加重平均 → % への換算過程を表示 |

体力指数ラベル: ≥80% 非常に元気、≥60% 良好、≥40% 注意、≥20% かなり弱っている、それ未満 危険

係数（Q10、Topt、DLI 基準、重み、閾値）は `src/cbi/cbi-config.ts` に集約しています。UI は `public/portal/cbi-ui.js`、単体 API は `GET /portal/api/cbi?lat=&lon=` です。

### 芝しごとノート（Google スプレッドシート）

CBI 行の右列に **芝しごとノート** パネルを表示します。メモ機能を使う場合のみ **Googleで連携** ボタンから OAuth 同意を求めます（使わない利用者にはアカウント選択は表示されません）。

| 項目 | 内容 |
|------|------|
| 保存先 | 利用者 Google ドライブ（マイドライブ） |
| ファイル名 | `{施設名}作業履歴`（設定の施設名から自動生成） |
| 列 | A: 日付 / B: エリア / C: メモ |
| UI | 直近履歴を約5行分表示、スクロールで過去分を参照。下部フォームから追記。エリア・メモはマイクで音声入力可（対応ブラウザと非対応時の1行案内は「音声入力（マイク）」を参照） |
| OAuth スコープ | `drive.file`（このアプリが作成したファイルのみ） |
| 設定 | Cloudflare 環境変数 `GOOGLE_OAUTH_CLIENT_ID` |

**Testing モード（100名未満・審査なし）**

Google Cloud Console で OAuth 同意画面を **Testing** のまま運用し、利用者の Google アカウントを **テストユーザー** に登録してください（最大100件）。本番審査なしで利用できます（初回連携時に「未確認アプリ」の警告が出る場合があります）。

**Google Cloud 設定手順（概要）**

1. プロジェクト作成 → **Google Drive API** / **Google Sheets API** を有効化
2. OAuth 同意画面（External・Testing）→ テストユーザーを追加
3. OAuth 2.0 クライアント ID（Web）を作成  
   - 許可 JS オリジン: `https://www.turf-tools.jp` / `http://127.0.0.1:8788`  
4. クライアント ID を `GOOGLE_OAUTH_CLIENT_ID` に設定（`.dev.vars` / Cloudflare Pages）

### 芝しごとシリーズ

外部アプリと同一サイトのアプリを 2 列カードグリッドで表示します。カードにマウスオーバー（またはキーボードフォーカス）すると説明文が重なって表示されます。

| アプリ | カテゴリ | 説明 |
|--------|----------|------|
| ターフプール | データ | 5か所のスマホ写真から緑の被覆率、芝緑度、芝活力度、色均一性、刈込品質を測定し、ピッチのプールビューを3D表示 |
| 楽RAC農薬ローテ | 管理 | 同一サイト `/portal/rac/` へリンク。RACコードでローテーション候補を提案（Render 不要） |
| 施肥設計ナビ | 管理 | 施設の管理方針、気象情報をもとにした成長能、土壌分析値などをもとに、月毎のNPK施肥量計算を支援（起動に30秒必要） |
| 病害リスク予報 | 予報 | 同一サイト `/portal/risk/` へリンク。地図上に翌日・明後日 朝6:00 の5病害リスク（最大4施設） |
| AI相談室 | AI | 同一サイト `/aihelpdesk/` へリンク。資料フォルダと音声入力。ポータルと同じ施設 Cookie |
| 病害画像診断AI | AI | 同一サイト `/portal/diagnosis/` へリンク。病斑写真から11クラスをブラウザ内 ONNX 推論（v1.1.1） |
| ピンポイント天気で芝しごと | 予報 | 同一サイト `/portal/spray/` へリンク。時間毎の芝管理作業アドバイス（v1.1.0） |
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

spray ページは `portalSettings` Cookie の緯度経度を優先して読み込みます。予報表は表示時に **現在時刻以降の最初の時間帯** が先頭に来るよう自動スクロールします（日付ヘッダーは sticky 固定）。

### 関連バナー（フッター上）

| バナー | リンク先 |
|--------|----------|
| PR（農薬・資材メーカー向け） | https://www.turf-tools.jp/services-4 |
| 芝管理技術ブログ | https://www.turf-tools.jp/blog |
| YouTube | https://www.youtube.com/channel/UCSRU0zk4Fj1ETWqMRlJDPJQ |

デスクトップ: 3 列 1 行（最大幅 720px・高さ 76px）。スマホ: 1 列縦積み（最大幅 280px）。

## 変更履歴

### ポータル TOP v1.6.3（2026-09）

- ブランドメッセージ下に **🆕 新しい解説**（ブログ）・ **▶ 解説動画**（YouTube）リンクを追加

### ポータル TOP v1.6.2（2026-09）

- CBI 数値の表示サイズを拡大（12px → 14px）
- 行ラベルを「炭素収支(CBI)」に変更（セル内の CBI 表記を廃止したため）
- README に CBI パネルの表示仕様（セルサイズ・ラベル方針）を追記

### ポータル TOP v1.6.1（2026-09）

- 炭素収支予測セル・体力指数セルから日本語ラベルを非表示化（色と星・数値のみ表示）
- セルサイズ・文字サイズを拡大（炭素収支 72×58px、星 14px、体力指数 % 16px）
- 星表示のはみ出しを修正（列幅 72px の上書き、`letter-spacing` 調整）

### ポータル TOP v1.6.0（2026-09）

- ベント炭素収支・体力指数パネルに **炭素収支とは** リンク（ブログ記事を新しいタブで開く）と導入文を追加

### ポータル TOP v1.5.9（2026-08）

- AI質問箱に資料フォルダを追加（相談室と同じキーワード RAG）。PDF の OCR／抽出結果はフォルダ内の `OCR_*.md` に保存し、次回はそれを使う

### ピンポイント天気で芝しごと（`/portal/spray/`） v1.1.1（2026-08）

- 予報判定の計算量を削減し、Cloudflare Worker のリソース超過（error 1102）による断続的な 503 / HTML 応答を抑制
- API 応答が JSON でない場合のエラーメッセージを明確化し、最大 2 回まで自動再試行

### ポータル TOP v1.5.8（2026-08）

- 上記ピンポイント天気 API 安定化を含む

### ポータル TOP v1.5.7（2026-08）

**Google AdSense**

- 全 Web アプリ HTML の `<head>` に AdSense サイト用コード（`ca-pub-4778292115354884`）を追加（ポータル TOP・病害画像診断AI・楽RAC・病害リスク予報・ピンポイント天気・ルートリダイレクト）

### ポータル TOP v1.5.6（2026-08）

- 音声入力が使えないブラウザだけ、ブロックごとに1行「音声入力は PC または Android の Chrome / Edge で使えます」を表示（AI質問箱・農薬検索・芝しごとノート。注意4カ条には含めない）

### 楽RAC農薬ローテ（`/portal/rac/`） v1.1.5（2026-09）

- リード文の下に **🆕 新しい解説**（ブログ）・ **▶ 解説動画**（YouTube）リンクを追加

### 楽RAC農薬ローテ（`/portal/rac/`） v1.1.4（2026-08）

- 検索行の下に、非対応ブラウザ向けの音声入力案内を1行追加（Chrome / Edge では非表示）

### ポータル TOP v1.5.5（2026-08）

- 芝しごとノートのエリア・メモ入力欄に音声入力（マイク）を追加

### ポータル TOP v1.5.4（2026-08）

- 農薬検索の2入力欄に、AI質問箱と同じ音声入力（マイク）を追加

### 楽RAC農薬ローテ（`/portal/rac/`） v1.1.3（2026-08）

- 農薬名・適用対象の各入力欄に音声入力（マイク）を追加

### サブページフッタ（2026-08）

- 散布・RAC・病害リスク・診断のフッタから旧 **AI質問箱** リンクを削除（**AI相談室** のみ残す）

### ポータル TOP v1.5.3（2026-08）

- AI質問箱の回答を相談室と同じ SSE で逐次表示する
- 注意文はそのまま（③を含む）

### ポータル TOP v1.5.2（2026-08）

- 芝しごとシリーズのカード名を **AI相談室** に短縮
- 質問入力欄の上右に、天気欄と同じピル型の **AI相談室** リンクを追加（`/aihelpdesk/`）
- 未使用の Gemini 呼び出しコードを削除。Pages 本番の `GEMINI_API_KEY` を削除（`GOOGLE_OAUTH_CLIENT_ID` は残す）
- 本番の AI質問箱は同一オリジンの `/aihelpdesk/api/chat` を直接呼ぶ（Service Binding / workers.dev 中継をやめる）

### ポータル TOP v1.5.1（2026-08）

- 芝しごとシリーズの AI カードを Render の旧質問箱から **芝しごと・AI相談室**（`/aihelpdesk/`）へ変更
- サブページフッタに AI相談室リンクを追加

### ポータル TOP v1.5.0（2026-08）

**芝しごと・AI質問箱**

- 回答生成を Gemini から相談室 Worker（Gemma 4 / `lawn-helpdesk`）へ切替
- 注意4カ条を相談室と揃えた（個人・顧客情報は入力しない／最終判断は現場／入力は回答生成のみ）
- 音声入力を追加（入力欄横のマイク。話して文字にしたあと送信）
- 入力欄下の注意と同じ行の右端に「AIモデル: Gemma 4 26B」を表示

### ポータル TOP v1.4.7（2026-08）

**芝しごと・AI質問箱**

- オーバーシード設定あり時、Gemini へ送るプロンプトの表記を **WOS** から **Winter Over Seed** に変更（LLM の誤解を防止）

### ポータル TOP v1.4.6（2026-08）

**ピンポイント天気で芝しごと（`/portal/spray/`） v1.1.0**

- 保存ボタンを **端末のCookieに保存** に変更
- バナー3つ（PR・ブログ・YouTube）を小さく **1行3列** で表示
- フッター（ロゴ上）に **芝しごとアプリ** へのリンク10件を追加
- フッターにバージョン表示（Version 1.1.0）を追加

### ポータル TOP v1.4.5（2026-08）

**病害画像診断AI（`/portal/diagnosis/`） v1.1.1**

- フッター（ロゴ上）に **芝しごとアプリ** へのリンク10件を追加（ポータル・ターフプール・楽RAC農薬ローテほか）

### ポータル TOP v1.4.4（2026-08）

**病害リスク予報（`/portal/risk/`） v2.2.1**

- フッター（ロゴ上）に **芝しごとアプリ** へのリンク10件を追加（ポータル・ターフプール・楽RAC農薬ローテほか）

### ポータル TOP v1.4.3（2026-08）

**楽RAC農薬ローテ（`/portal/rac/`） v1.1.2**

- フッターに **芝しごとアプリ** へのリンク（ポータル・ターフプール・施肥設計ナビほか9件）と **グロウアンドプログレス** ロゴリンクを追加
- **【ご利用にあたっての注意】** を枠線で囲み、文字サイズ・行間をコンパクトに調整

### ポータル TOP v1.4.2（2026-08）

**Cookie 利用の案内・設定 UI**

- タイトル下 **ℹ** の説明に、Cookie ブロック時は設定保存や気象データ取得が完了しない場合がある旨と、Cookie 許可の案内を追加
- 設定モーダルの保存ボタンを **端末のCookieに保存** に変更（保存完了メッセージも同表記に統一）

### ポータル TOP v1.4.1（2026-08）

**芝しごとノート**

- 履歴行をクリックすると下のフォームに読み込み、**更新**・**キャンセル**・**削除** が可能（Google スプレッドシートの該当行を直接更新・削除）
- 選択行をハイライト表示。キーボード（Enter / Space）でも行選択可能

### ポータル TOP v1.4.0（2026-08）

**芝しごとノート（Google スプレッドシート）**

- CBI 行右列に **芝しごとノート** パネルを追加。**Googleで連携** 後、利用者のマイドライブに `{施設名}作業履歴` スプレッドシート（日付・エリア・メモ）を保存
- OAuth スコープ `drive.file`（このアプリが作成したファイルのみ）。芝しごとポータルのサーバー側ではデータを保持しない
- タイトル横 **ℹ** と初期表示で試験運用・モニター参加案内を表示（Gmail 連絡、個人情報不要）
- API: `GET /portal/api/google-config`（OAuth クライアント ID）。環境変数 `GOOGLE_OAUTH_CLIENT_ID`

**ベント炭素収支（CBI）**

- **ベント炭素収支予測** と **ベント体力指数** を 1 パネルに統合（CBI 行左列）

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

- 農薬名・メーカー名 × 病害虫・雑草名（かつ）の検索欄と「検索」ボタン。各欄のマイクで音声入力（対応ブラウザと非対応時の1行案内は「音声入力（マイク）」を参照）
- バリデーション（2文字以上）後、`/portal/rac/?pesticide=…&target=…` へ遷移
- rac ページ側で URL パラメータを読み取り、データ読込後に自動検索

**UX**

- 緯度経度未設定時の4パネル表示を「右上の ⚙ 設定 から入力してください」に変更
- 未設定プレースホルダーの文字サイズを他の補助文言に合わせて調整

**楽RAC農薬ローテ v1.2.0（2026-07）**

- UI をポータル系列に統一（Bootstrap 削除、`portal.css` + 独自 `style.css`、薄グレー背景 `#f3f4f6`）
- 詳細画面で「同一グループを含む農薬」実行後、結果セクションまで自動スクロール
- ポータル TOP の農薬検索からの URL クエリ自動検索に対応

### ポータル TOP v1.1.1（2026-07）

**ブランディング**

- サイトタイトル PNG を「芝しごと」ロゴに差し替え（上下余白トリミング・黒背景を透過化）
- ロゴ下にブランドメッセージ「スポーツターフ管理を、もっとシンプルに。」を追加
- メッセージ横の **ℹ** ボタンでサイト説明を表示（PC: マウスオーバー、スマホ: タップ）。末尾に代表署名を表示

### ポータル TOP v1.1.2（2026-07）

**PGR適時・発芽予測**

- プリモマックス表記を **トリネキサパックエチル　200℃リバウンド** に変更。行末 **ℹ** でリバウンド現象と GDD 別の効果状態表を表示
- グリーンフィールド表記を **フルルプリミドール　300℃リバウンド** に変更。同様に **ℹ** でリバウンド説明を表示
- PGR 説明ポップオーバーの位置を調整（右カラムで画面右端が見切れないよう右寄せ）

**発芽積算温度**

- 芝種ラベルの「目標」を **発芽積算** に変更（例: `基準 10℃ / 発芽積算 50℃日`）

**農薬検索**

- 検索欄の「かつ(AND)」表記を **かつ** に統一（ポータル TOP・`/portal/rac/`）

**芝しごとシリーズ**

- カード全体ホバーでの説明表示をやめ、タイトル横 **ℹ** のポップオーバーに統一（他 UI と同パターン）
- カテゴリ名を変更: **データ** → **データ分析**、**その他** → **ゲーム**

**その他 UI**

- AI質問箱セクション下の区切り横線を削除

### ポータル TOP v1.3.2（2026-07）

**病害リスク予測**

- パネル内右上に **他地域を見る** リンクを追加（天気欄「もっと詳しく」と同デザイン）→ `/portal/risk/`

**ピンポイント天気で芝しごと（`/portal/spray/`）**

- 散布予報表の表示位置を、現在時刻以降の最初の時間帯が先頭に来るよう自動スクロール
- 予報表コンテナに縦スクロール（最大高さ 70vh）と sticky 日付ヘッダーを追加

### ポータル TOP v1.3.1（2026-07）

**AI質問箱**

- 回答表示時、長文でも先頭から読めるようスクロール位置を調整（チャット欄は回答の先頭を表示、入力欄フォーカス時のページスクロールを抑制）

### ポータル TOP v1.3.0（2026-07）

**ベント炭素収支（CBI）UI 改善**

- **ベント炭素収支予測**・**ベント体力指数**を病害リスク予測と同じコンパクト表形式に変更（明日/明後日 2列・色付きセル）
- 各パネルに **判定ロジック** ボタンを追加。モーダルで数式と今回の計算値（P / RLI / CBI、過去7日の加重内訳など）を表示
- UI: `public/portal/cbi-ui.js`（病害リスクと同じ `#disease-logic-modal` を共有）

### ポータル TOP v1.2.0（2026-07）

**ベント炭素収支（CBI）Version 1**

- **ベント炭素収支予測**: 明日・明後日各朝6:00時点の日次 CBI を ★1〜5 で表示（昼間 GP×日射補正 ÷ 夜間 Q10 呼吸負荷）
- **ベント体力指数**: 過去7日分の CBI を加重平均し、0〜100% で表示
- 気象: 予報は MET Norway（気温・雲量）、履歴は NASA POWER（気温・日射 `ALLSKY_SFC_SW_DWN`）
- 係数（Q10、Topt、DLI 基準、重み、閾値）は `src/cbi/cbi-config.ts` に集約（後からキャリブレーション可能）
- 単体 API: `GET /portal/api/cbi?lat=&lon=`

### ポータル TOP v1.1.5（2026-07）

**Google Analytics**

- ページタイトル（`document.title`）を常に「芝しごとポータル」に固定し、施設名・地名ごとに GA4 のページとスクリーンが分割されないように変更
- gtag `config` に `page_title: '芝しごとポータル'` を明示。画面上の施設名表示（ヘッダー prefix）は従来どおり

### ポータル TOP v1.1.4（2026-07）

**ダッシュボード API の安定性**

- キャッシュ失効時の同時リクエストを **single-flight** で1本に集約（同一 Worker 内の in-flight 共有 + Cache API ロック + 最大30秒ポーリング）
- ブックマーク起動時など、他ユーザーとタイミングが重なっても NASA/MET 取得の重複実行を抑制
- クライアント側のインフラエラー（502/503/524 や HTML 応答）リトライを **最大5回・指数バックオフ（2秒起点）** に延長。処理中アニメーション表示中は長めに待って再試行

### 病害画像診断AI v1.1.0 / ポータル v1.1.3（2026-07）

**新規: `/portal/diagnosis/`**

- Streamlit（Render）版を Cloudflare Pages 向けに移植。推論は **ONNX Runtime Web（WASM）** で端末内完結（画像はサーバー非送信）
- MobileNetV3-Small 単一モデル + 芝種・症状チェックによる確率補正（従来ロジック踏襲）
- 初回のみ `model.onnx`（約 6 MB）を Cache API で保存。推論中は経過秒数を表示
- Google Analytics **`G-FT1B3ZCT2B`**（診断ページ専用・現行 Render 版と同一 ID）
- `portalSettings` Cookie の **芝種（greenType）** から暖地型/寒地型の初期値を設定
- 診断結果から `/portal/rac/?target=...` へ農薬検索を連携
- PC 推奨。スマートフォンでは動作が遅い場合があります

**学習リポジトリ:** `turf-disease-app`（`export_onnx.py` → 成果物を本リポジトリへコピー）

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

AI質問箱をローカルで試す場合、`.dev.vars` の `HELPDESK_CHAT_URL`（未設定なら本番の `/aihelpdesk/api/chat`）へ Pages Function が中継します。ブラウザが `Accept: text/event-stream` なら Function は SSE をそのまま流します。

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
3. 芝しごとノートを使う場合だけ `GOOGLE_OAUTH_CLIENT_ID` を Pages の本番変数に入れる

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
| Workers AI Gemma 4 | 本番 `/aihelpdesk/api/chat`（同一オリジン）。ローカルは `/portal/api/chat` が中継 |

### データフロー（ポータル TOP）

```
ブラウザ
  └─ GET /portal/api/dashboard?lat=&lon=&warmGrass=&coolGrass=
       ├─ MET Norway ............... 1 回 → 天気 + 病害 forecast + sprayForecast + CBI 予測
       ├─ NASA POWER daily ......... 1 回 → GP + 病害 daily
       └─ NASA POWER hourly ........ 1 回 → 病害 hourly + CBI 履歴（過去8日）

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
│       ├── voice-input.js        # マイク音声入力（Web Speech API）と非対応時の1行案内
│       ├── cbi-ui.js             # ベント炭素収支・体力指数表示・判定ロジック
│       ├── work-memo-ui.js       # 芝しごとノート（Google Sheets / drive.file）
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
│   │   ├── cbi.ts
│   │   ├── google-config.ts
│   │   ├── gdd.ts
│   │   ├── chat.ts
│   │   └── geocode.ts
│   └── spray/api/forecast.ts
├── src/
│   ├── portal/fetch-dashboard.ts
│   ├── advisor/                  # AI質問箱（相談室 Worker へ中継）
│   ├── weather/
│   ├── disease/
│   ├── growth-potential/
│   ├── cbi/                      # ベント炭素収支（CBI）計算
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
| [turf_advisor](https://github.com/hitoshi4148/turf_advisor) | ポータル入力欄の移植元。本番では未使用 |
| [agromap](https://github.com/hitoshi4148/agromap) | 散布日・播種日 Cookie 名を共有 |

ロジックは Python 版から TypeScript に移植済みです。芝しごとシリーズの外部アプリは Render 等で個別稼働し、ポータルからリンクします。

## ライセンス

MIT
