export interface GerminationGddConfig {
  baseTemp: number;
  targetGdd: number;
}

export const GERMINATION_GDD_CONFIG: Record<string, GerminationGddConfig> = {
  "未指定(C4)": { baseTemp: 15, targetGdd: 100 },
  ノシバ: { baseTemp: 15, targetGdd: 100 },
  高麗芝: { baseTemp: 15, targetGdd: 100 },
  バミューダ: { baseTemp: 15, targetGdd: 60 },
  パスパラム: { baseTemp: 15, targetGdd: 60 },
  "未指定(C3)": { baseTemp: 10, targetGdd: 100 },
  ベントグラス: { baseTemp: 10, targetGdd: 50 },
  クリーピングベントグラス: { baseTemp: 10, targetGdd: 50 },
  ペレニアルライグラス: { baseTemp: 10, targetGdd: 45 },
  ケンタッキーブルーグラス: { baseTemp: 10, targetGdd: 100 },
  トールフェスク: { baseTemp: 10, targetGdd: 70 },
};

export function getGerminationGddConfig(grassName: string): GerminationGddConfig {
  return (
    GERMINATION_GDD_CONFIG[grassName] ?? {
      baseTemp: grassName.includes("C3") ? 10 : 15,
      targetGdd: 100,
    }
  );
}
