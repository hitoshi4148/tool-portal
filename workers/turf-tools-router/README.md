# turf-tools-router

`turf-tools.jp/portal*` → Cloudflare Pages プロキシ Worker。

| 上流 | 用途 |
|------|------|
| `tool-portal-9y2.pages.dev` | **芝しごと**（既定） |
| `orchard-aa7.pages.dev` | `GET /portal/api/orchard-risk` のみ（果樹 API） |

**`/portal/risk/` は常に芝**（地図）。果樹病害 UI は orchard ドメインを使用。

## 開発

```bash
npm run test:router
npm run deploy:router
```

ポリシー: `routing-policy.ts`（`routing-policy.test.ts` 必須）

詳細: [docs/turf-orchard-boundary.md](../../docs/turf-orchard-boundary.md)
