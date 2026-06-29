import type { PortalAdvisorSettings } from "./types";

export function generatePrefix(settings: PortalAdvisorSettings): string {
  const lat = settings.lat?.trim() ?? "";
  const lon = settings.lon?.trim() ?? "";
  const locationType = settings.locationType ?? "未指定";
  const greenType = settings.greenType ?? "未指定";
  const overseed = settings.overseed ?? "無";
  const warmGrass = settings.warmGrass ?? "未指定(C4)";
  const coolGrass = settings.coolGrass ?? "未指定(C3)";
  const facilityName = settings.facilityName?.trim() ?? "";

  let prefix = "あなたは芝管理の専門家です。以下の情報を踏まえて回答してください。\n\n";

  if (facilityName) {
    prefix += `施設名: ${facilityName}\n`;
  }

  if (lat && lon) {
    prefix += `場所: 北緯${lat}度、東経${lon}度\n`;
  } else if (lat) {
    prefix += `場所: 北緯${lat}度\n`;
  } else if (lon) {
    prefix += `場所: 東経${lon}度\n`;
  }

  if (locationType !== "未指定") {
    prefix += `場所タイプ: ${locationType}\n`;
  }

  if (greenType !== "未指定") {
    prefix += `グリーンタイプ: ${greenType}\n`;
  }

  if (overseed !== "無") {
    prefix += `オーバーシード: ${overseed}\n`;
  }

  if (warmGrass !== "未指定(C4)") {
    prefix += `暖地型芝種: ${warmGrass}\n`;
  }

  if (coolGrass !== "未指定(C3)") {
    prefix += `寒地型芝種: ${coolGrass}\n`;
  }

  prefix +=
    "\n上記の情報を考慮して、以下の質問に専門的かつ具体的に回答してください。\n\n";

  return prefix;
}

export function generateSuffix(settings: PortalAdvisorSettings): string {
  const responseMode = settings.responseMode ?? "慎重に回答";

  let suffix = "\n\n回答の際は、以下の点に注意してください：\n";
  suffix += "- 実用的で具体的なアドバイスを提供してください\n";
  suffix += "- 必要に応じて季節や地域の特性を考慮してください\n";
  suffix += "- 専門用語を使用する場合は簡潔に説明を加えてください\n";

  if (responseMode === "慎重に回答") {
    suffix += "\n特に慎重に検討し、複数の観点から回答してください。";
  }

  return suffix;
}

export function buildFullPrompt(
  message: string,
  settings: PortalAdvisorSettings
): string {
  return `${generatePrefix(settings)}\n\n${message}\n\n${generateSuffix(settings)}`;
}
