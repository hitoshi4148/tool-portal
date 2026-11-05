export const WEATHER_FETCH_USER_ERROR =
  "気象データの取得に失敗しました。再読み込みしてください。";

export function toPublicWeatherError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /Invalid JSON|Unterminated|Unexpected end|Unexpected token|JSON at position|Incomplete response|Empty response|timed out|Fetch timed out|MET API error|NASA POWER API error|network/i.test(
      message
    )
  ) {
    return WEATHER_FETCH_USER_ERROR;
  }
  return message;
}
