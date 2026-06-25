# tool-portal

芝管理ツールを集約するポータルサイト（Cloudflare Pages + Functions）。

## URL 構成

| パス | 内容 |
|------|------|
| `/portal/` | ポータル TOP |
| `/portal/spray/` | ピンポイント天気で芝しごと |
| `/portal/spray/api/forecast` | 散布予報 API |

## ローカル開発

```powershell
npm install
npm run dev
```

ブラウザで以下を開く:

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

デプロイ後、`https://tool-portal.pages.dev/portal/` で確認できます。

### 3. 本番ドメイン接続（後日）

`*.pages.dev` で動作確認後、`turf-tools.jp` を Cloudflare に追加し DNS を移行します。

## プロジェクト構成

```
tool-portal/
├── public/portal/           # 静的ファイル
├── functions/               # Pages Functions（API）
├── src/spray/               # 散布判定ロジック（TypeScript）
└── wrangler.toml
```

## 元アプリとの関係

- 元の [spray-forecast](https://github.com/hitoshi4148/spray-forecast) は変更していません
- ロジックは Python 版から TypeScript に移植済み

## ライセンス

MIT
