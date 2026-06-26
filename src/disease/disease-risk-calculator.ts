/**
 * 芝生病害リスク計算ライブラリ
 *
 * 気象データから各病害の発生リスク（0-100%）を計算する純粋関数群
 */

import { DailyWeatherRecord, HourlyWeatherRecord } from "./nasa-power";

export interface DiseaseRiskResult {
  dollarSpot: number | null;
  brownPatch: number | null;
  pythium: number | null;
  anthracnose: number | null;
  largePatch: number | null;
}

export interface DiseaseWeatherInput {
  daily: DailyWeatherRecord[];
  hourly: HourlyWeatherRecord[];
}

// ============================================================================
// 定数定義
// ============================================================================

/**
 * Dollar Spot のパラメータ
 */
const DOLLAR_SPOT = {
  TEMP_MIN: 15,
  TEMP_MAX: 30,
  TEMP_PEAK: 25,
  TEMP_DECAY_START: 30,
  HUMIDITY_MIN: 60,
  MOVING_AVERAGE_DAYS: 5
};

/**
 * Brown Patch のパラメータ
 */
const BROWN_PATCH = {
  TEMP_MIN: 20,
  HUMIDITY_MIN: 90,
  NIGHT_START_HOUR: 20,
  NIGHT_END_HOUR: 6
};

/**
 * Pythium のパラメータ
 */
const PYTHIUM = {
  TEMP_MIN: 25,
  HUMIDITY_MIN: 85,
  EVALUATION_DAYS: 7,
  EXPONENTIAL_FACTOR: 0.3
};

/**
 * Anthracnose のパラメータ
 */
const ANTHRACNOSE = {
  TEMP_MIN: 15,
  TEMP_MAX: 30,
  TEMP_PEAK: 25,
  HIGH_TEMP_THRESHOLD: 25,
  HIGH_TEMP_CONSECUTIVE_DAYS: 5,
  HUMIDITY_BONUS_START: 70
};

/**
 * Large Patch のパラメータ
 */
const LARGE_PATCH = {
  TEMP_MIN: 10,
  TEMP_MAX: 20,
  TEMP_PEAK: 15,
  TEMP_RESET_HIGH: 25,
  TEMP_RESET_LOW: 8,
  EVALUATION_DAYS_MIN: 8,
  EVALUATION_DAYS_MAX: 10
};

// ============================================================================
// ユーティリティ関数
// ============================================================================

/**
 * リスク値を0〜100%に正規化
 * @param {number} value - 正規化前の値
 * @param {number} min - 最小値
 * @param {number} max - 最大値
 * @returns {number} 0〜100のリスク値
 */
function normalizeRisk(value, min, max) {
  if (max === min) return 0;
  const normalized = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, normalized));
}

/**
 * 移動平均を計算
 * @param {number[]} values - 値の配列
 * @param {number} windowSize - ウィンドウサイズ
 * @returns {number|null} 移動平均値（データ不足の場合はnull）
 */
function calculateMovingAverage(values, windowSize) {
  if (values.length < windowSize) return null;
  
  const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (validValues.length < windowSize) return null;
  
  const window = validValues.slice(-windowSize);
  const sum = window.reduce((acc, val) => acc + val, 0);
  return sum / windowSize;
}

/**
 * ISO8601形式の文字列から日付を抽出（YYYY-MM-DD）
 * @param {string} datetime - ISO8601形式の文字列
 * @returns {string} YYYY-MM-DD形式の日付
 */
function extractDate(datetime) {
  return datetime.split('T')[0];
}

/**
 * ISO8601形式の文字列から時刻（時）を抽出
 * @param {string} datetime - ISO8601形式の文字列
 * @returns {number} 時（0-23）
 */
function extractHour(datetime) {
  const timePart = datetime.split('T')[1];
  if (!timePart) return 0;
  const hourPart = timePart.split(':')[0];
  return parseInt(hourPart, 10) || 0;
}

/**
 * 日付文字列を比較
 * @param {string} date1 - YYYY-MM-DD形式
 * @param {string} date2 - YYYY-MM-DD形式
 * @returns {number} date1 < date2 なら負、等しければ0、date1 > date2 なら正
 */
function compareDates(date1, date2) {
  return new Date(date1) - new Date(date2);
}

// ============================================================================
// Dollar Spot リスク計算
// ============================================================================

/**
 * Dollar Spot（Smith-Kerns系）のリスクを計算
 * 
 * @param {Array<Object>} dailyData - 日次気象データ配列
 * @returns {number|null} 0〜100のリスク値（データ不足の場合はnull）
 */
export function calculateDollarSpotRisk(dailyData: DailyWeatherRecord[]) {
  if (!dailyData || dailyData.length === 0) return null;
  
  // 有効なデータのみ抽出
  const validData = dailyData.filter(d => 
    d.temperature_avg !== null && 
    d.humidity_avg !== null &&
    !isNaN(d.temperature_avg) && 
    !isNaN(d.humidity_avg)
  );
  
  if (validData.length < DOLLAR_SPOT.MOVING_AVERAGE_DAYS) return null;
  
  // 直近5日間のデータを取得
  const recentData = validData.slice(-DOLLAR_SPOT.MOVING_AVERAGE_DAYS);
  
  // 5日移動平均を計算
  const tempValues = recentData.map(d => d.temperature_avg);
  const humidityValues = recentData.map(d => d.humidity_avg);
  
  const avgTemp = calculateMovingAverage(tempValues, DOLLAR_SPOT.MOVING_AVERAGE_DAYS);
  const avgHumidity = calculateMovingAverage(humidityValues, DOLLAR_SPOT.MOVING_AVERAGE_DAYS);
  
  if (avgTemp === null || avgHumidity === null) return null;
  
  // リスク計算
  let riskScore = 0;
  
  // 気温条件（15〜30℃でリスク上昇）
  if (avgTemp >= DOLLAR_SPOT.TEMP_MIN && avgTemp <= DOLLAR_SPOT.TEMP_MAX) {
    // 15〜30℃の範囲で線形にリスク上昇（ピークは25℃）
    const tempRisk = avgTemp <= DOLLAR_SPOT.TEMP_PEAK
      ? ((avgTemp - DOLLAR_SPOT.TEMP_MIN) / (DOLLAR_SPOT.TEMP_PEAK - DOLLAR_SPOT.TEMP_MIN)) * 50  // 15℃→0%, 25℃→50%
      : ((DOLLAR_SPOT.TEMP_MAX - avgTemp) / (DOLLAR_SPOT.TEMP_MAX - DOLLAR_SPOT.TEMP_PEAK)) * 50;   // 25℃→50%, 30℃→0%
    
    riskScore += tempRisk;
  }
  
  // 湿度条件（60%以上でリスク上昇）
  if (avgHumidity >= DOLLAR_SPOT.HUMIDITY_MIN) {
    const humidityRisk = ((avgHumidity - DOLLAR_SPOT.HUMIDITY_MIN) / (100 - DOLLAR_SPOT.HUMIDITY_MIN)) * 50; // 60%→0%, 100%→50%
    riskScore += humidityRisk;
  }
  
  // 気温30℃以上でリスクを減衰
  if (avgTemp > DOLLAR_SPOT.TEMP_DECAY_START) {
    const decayFactor = Math.max(0, 1 - (avgTemp - DOLLAR_SPOT.TEMP_DECAY_START) / 10); // 30℃→1.0, 40℃→0.0
    riskScore *= decayFactor;
  }
  
  // 0〜100%に正規化（最大値は100で頭打ち）
  return Math.min(100, Math.max(0, riskScore));
}

// ============================================================================
// Brown Patch リスク計算
// ============================================================================

/**
 * Brown Patchのリスクを計算
 * 
 * @param {Array<Object>} hourlyData - 時間単位気象データ配列
 * @returns {number|null} 0〜100のリスク値（データ不足の場合はnull）
 */
export function calculateBrownPatchRisk(hourlyData: HourlyWeatherRecord[]) {
  if (!hourlyData || hourlyData.length === 0) return null;
  
  // 有効なデータのみ抽出
  const validData = hourlyData.filter(d => 
    d.temperature !== null && 
    d.humidity !== null &&
    !isNaN(d.temperature) && 
    !isNaN(d.humidity) &&
    d.datetime
  );
  
  if (validData.length === 0) return null;
  
  // 夜間の条件該当時間数をカウント
  let nightTimeCount = 0;
  let totalNightHours = 0;
  
  for (const entry of validData) {
    const hour = extractHour(entry.datetime);
    
    // 夜間（20:00〜翌6:00）の判定
    const isNightTime = hour >= BROWN_PATCH.NIGHT_START_HOUR || hour < BROWN_PATCH.NIGHT_END_HOUR;
    
    if (isNightTime) {
      totalNightHours++;
      
      // 気温20℃以上かつ湿度90%以上の条件
      if (entry.temperature >= BROWN_PATCH.TEMP_MIN && entry.humidity >= BROWN_PATCH.HUMIDITY_MIN) {
        nightTimeCount++;
      }
    }
  }
  
  if (totalNightHours === 0) return null;
  
  // 該当時間の割合を計算
  const riskRatio = nightTimeCount / totalNightHours;
  
  // 0〜100%に正規化
  // 割合が高いほどリスク上昇（例：50%以上で高リスク）
  return normalizeRisk(riskRatio * 100, 0, 50);
}

// ============================================================================
// Pythium リスク計算
// ============================================================================

/**
 * Pythiumのリスクを計算
 * 
 * @param {Array<Object>} dailyData - 日次気象データ配列
 * @returns {number|null} 0〜100のリスク値（データ不足の場合はnull）
 */
export function calculatePythiumRisk(dailyData: DailyWeatherRecord[]) {
  if (!dailyData || dailyData.length === 0) return null;
  
  // 有効なデータのみ抽出
  const validData = dailyData.filter(d => 
    d.temperature_avg !== null && 
    d.humidity_avg !== null &&
    !isNaN(d.temperature_avg) && 
    !isNaN(d.humidity_avg)
  );
  
  if (validData.length === 0) return null;
  
  // 直近7日間のデータを取得
  const recentData = validData.slice(-PYTHIUM.EVALUATION_DAYS);
  
  // 条件該当日数をカウント
  // 条件：気温25℃以上かつ湿度85%以上
  let conditionDays = 0;
  
  for (const day of recentData) {
    if (day.temperature_avg >= PYTHIUM.TEMP_MIN && day.humidity_avg >= PYTHIUM.HUMIDITY_MIN) {
      conditionDays++;
    }
  }
  
  // 積算値を指数化
  // 0日→0%, 7日→100%を指数関数的に増加
  if (conditionDays === 0) return 0;
  
  // 指数関数: risk = 100 * (1 - e^(-k * days))
  // kを調整して、7日で約100%になるように設定
  const riskScore = 100 * (1 - Math.exp(-PYTHIUM.EXPONENTIAL_FACTOR * conditionDays));
  
  return Math.min(100, Math.max(0, riskScore));
}

// ============================================================================
// Anthracnose リスク計算
// ============================================================================

/**
 * Anthracnose（炭疽病）のリスクを計算
 * 
 * @param {Array<Object>} dailyData - 日次気象データ配列
 * @returns {number|null} 0〜100のリスク値（データ不足の場合はnull）
 */
export function calculateAnthracnoseRisk(dailyData: DailyWeatherRecord[]) {
  if (!dailyData || dailyData.length === 0) return null;
  
  // 有効なデータのみ抽出
  const validData = dailyData.filter(d => 
    d.temperature_avg !== null &&
    !isNaN(d.temperature_avg)
  );
  
  if (validData.length === 0) return null;
  
  let riskScore = 0;
  
  // 1. 気温条件（15〜30℃でリスク上昇）
  const recentData = validData.slice(-10); // 直近10日間を評価
  
  let tempRiskSum = 0;
  let validTempDays = 0;
  
  for (const day of recentData) {
    if (day.temperature_avg >= ANTHRACNOSE.TEMP_MIN && day.temperature_avg <= ANTHRACNOSE.TEMP_MAX) {
      // 15〜30℃の範囲でリスクを計算（ピークは25℃）
      const dayTempRisk = day.temperature_avg <= ANTHRACNOSE.TEMP_PEAK
        ? ((day.temperature_avg - ANTHRACNOSE.TEMP_MIN) / (ANTHRACNOSE.TEMP_PEAK - ANTHRACNOSE.TEMP_MIN)) * 10  // 15℃→0, 25℃→10
        : ((ANTHRACNOSE.TEMP_MAX - day.temperature_avg) / (ANTHRACNOSE.TEMP_MAX - ANTHRACNOSE.TEMP_PEAK)) * 10;  // 25℃→10, 30℃→0
      
      tempRiskSum += dayTempRisk;
      validTempDays++;
    }
  }
  
  if (validTempDays > 0) {
    const avgTempRisk = tempRiskSum / validTempDays;
    riskScore += avgTempRisk * 5; // スケーリング
  }
  
  // 2. 急激な高温継続の評価（5日以上25℃超）
  let highTempConsecutiveDays = 0;
  let maxConsecutive = 0;
  
  for (const day of recentData) {
    if (day.temperature_avg > ANTHRACNOSE.HIGH_TEMP_THRESHOLD) {
      highTempConsecutiveDays++;
      maxConsecutive = Math.max(maxConsecutive, highTempConsecutiveDays);
    } else {
      highTempConsecutiveDays = 0;
    }
  }
  
  // 5日以上で高リスク
  if (maxConsecutive >= ANTHRACNOSE.HIGH_TEMP_CONSECUTIVE_DAYS) {
    const highTempRisk = Math.min(50, (maxConsecutive - ANTHRACNOSE.HIGH_TEMP_CONSECUTIVE_DAYS) * 10); // 5日→0%, 10日→50%
    riskScore += highTempRisk;
  }
  
  // 3. 湿度補助要素（湿度が高いとリスク微増）
  const humidityData = validData.filter(d => 
    d.humidity_avg !== null && !isNaN(d.humidity_avg)
  );
  
  if (humidityData.length > 0) {
    const avgHumidity = humidityData.reduce((sum, d) => sum + d.humidity_avg, 0) / humidityData.length;
    if (avgHumidity >= ANTHRACNOSE.HUMIDITY_BONUS_START) {
      const humidityBonus = ((avgHumidity - ANTHRACNOSE.HUMIDITY_BONUS_START) / (100 - ANTHRACNOSE.HUMIDITY_BONUS_START)) * 10; // 70%→0%, 100%→10%
      riskScore += humidityBonus;
    }
  }
  
  // 0〜100%に正規化
  return Math.min(100, Math.max(0, riskScore));
}

// ============================================================================
// Large Patch リスク計算
// ============================================================================

/**
 * Large Patchのリスクを計算
 * 
 * @param {Array<Object>} dailyData - 日次気象データ配列
 * @returns {number|null} 0〜100のリスク値（データ不足の場合はnull）
 */
export function calculateLargePatchRisk(dailyData: DailyWeatherRecord[]) {
  if (!dailyData || dailyData.length === 0) return null;
  
  // 有効なデータのみ抽出
  const validData = dailyData.filter(d => 
    d.temperature_avg !== null &&
    !isNaN(d.temperature_avg)
  );
  
  if (validData.length === 0) return null;
  
  // 直近10日間のデータを取得
  const recentData = validData.slice(-LARGE_PATCH.EVALUATION_DAYS_MAX);
  
  // リスク累積値
  let accumulatedRisk = 0;
  let resetFlag = false;
  
  // 過去から順に評価（古い順）
  for (let i = 0; i < recentData.length; i++) {
    const day = recentData[i];
    const temp = day.temperature_avg;
    
    // リセット条件：25℃超または8℃未満
    if (temp > LARGE_PATCH.TEMP_RESET_HIGH || temp < LARGE_PATCH.TEMP_RESET_LOW) {
      resetFlag = true;
      accumulatedRisk = 0; // リスクをリセット
      continue;
    }
    
    // リセット後、またはリセットなしの場合
    if (!resetFlag || i > 0) {
      // 10〜20℃でリスク上昇
      if (temp >= LARGE_PATCH.TEMP_MIN && temp <= LARGE_PATCH.TEMP_MAX) {
        // 10〜20℃の範囲でリスクを計算（ピークは15℃）
        const dayRisk = temp <= LARGE_PATCH.TEMP_PEAK
          ? ((temp - LARGE_PATCH.TEMP_MIN) / (LARGE_PATCH.TEMP_PEAK - LARGE_PATCH.TEMP_MIN)) * 10  // 10℃→0, 15℃→10
          : ((LARGE_PATCH.TEMP_MAX - temp) / (LARGE_PATCH.TEMP_MAX - LARGE_PATCH.TEMP_PEAK)) * 10;  // 15℃→10, 20℃→0
        
        accumulatedRisk += dayRisk;
      }
    }
  }
  
  // 直近8〜10日間の積算を評価
  // 最大リスクは10日間すべてが最適条件（15℃）の場合: 10 * 10 = 100
  // 実際の評価期間は8日間を基準とする
  const evaluationDays = Math.min(LARGE_PATCH.EVALUATION_DAYS_MIN, recentData.length);
  const maxPossibleRisk = evaluationDays * 10;
  
  // 0〜100%に正規化
  if (maxPossibleRisk === 0) return 0;
  
  const riskScore = (accumulatedRisk / maxPossibleRisk) * 100;
  
  return Math.min(100, Math.max(0, riskScore));
}

// ============================================================================
// ラッパー関数
// ============================================================================

/**
 * 全病害のリスクを一括計算
 * 
 * @param {Object} weatherData - 気象データ
 * @param {Array<Object>} weatherData.daily - 日次気象データ配列
 * @param {Array<Object>} weatherData.hourly - 時間単位気象データ配列
 * @returns {Object} 各病害のリスク値（0-100またはnull）
 */
export function calculateAllDiseaseRisks(weatherData: DiseaseWeatherInput): DiseaseRiskResult {
  const { daily, hourly } = weatherData;
  
  return {
    dollarSpot: calculateDollarSpotRisk(daily),
    brownPatch: calculateBrownPatchRisk(hourly),
    pythium: calculatePythiumRisk(daily),
    anthracnose: calculateAnthracnoseRisk(daily),
    largePatch: calculateLargePatchRisk(daily)
  };
}
