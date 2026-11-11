# 芝しごと（tool-portal）と果樹園（orchard）

| | 芝しごと | 果樹園しごと |
|---|----------|--------------|
| リポジトリ | **tool-portal**（本リポ） | [orchard](https://github.com/hitoshi4148/orchard) |
| Pages | `tool-portal-9y2` | `orchard-aa7` |
| `/portal/risk/` | 芝・地図（本番 turf-tools.jp） | りんご・なし（orchard ドメインのみ） |

## 本リポの責務

- `workers/turf-tools-router/` — **ここでだけ** 編集・デプロイ
- `npm run deploy:router` / `npm run test:router`

## 禁止

`turf-tools.jp/portal/risk/` を orchard Pages に向けない（`routing-policy.test.ts` で検証）。

## 果樹ドキュメント

orchard 側: `docs/orchard-vs-turf-portal.md`
