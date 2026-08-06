interface Env {
  GOOGLE_OAUTH_CLIENT_ID?: string;
}

function isInvalidClientId(clientId: string): boolean {
  if (!clientId.endsWith(".apps.googleusercontent.com")) return true;
  return /xxxx|your[_-]?client|example|placeholder/i.test(clientId);
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const clientId = context.env.GOOGLE_OAUTH_CLIENT_ID?.trim();

  if (!clientId) {
    return Response.json(
      {
        success: false,
        error:
          "Google 連携の設定がありません。GOOGLE_OAUTH_CLIENT_ID を .dev.vars（ローカル）または Cloudflare Pages の環境変数に設定し、開発サーバーを再起動してください。",
      },
      { status: 503 }
    );
  }

  if (isInvalidClientId(clientId)) {
    return Response.json(
      {
        success: false,
        error:
          "GOOGLE_OAUTH_CLIENT_ID がプレースホルダーのままです。Google Cloud Console で OAuth 2.0 クライアント ID（Web）を作成し、発行された ID（例: 123456789-abc.apps.googleusercontent.com）を .dev.vars に設定して npm run dev を再起動してください。",
      },
      { status: 503 }
    );
  }

  return Response.json({
    success: true,
    clientId,
  });
};
