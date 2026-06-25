const JST = "Asia/Tokyo";

export interface JstDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  utcDate: Date;
}

function readPart(parts: Intl.DateTimeFormatPart[], type: string): number {
  const value = parts.find((part) => part.type === type)?.value;
  return parseInt(value ?? "0", 10);
}

export function toJst(isoUtc: string): JstDateTime {
  const utc = new Date(isoUtc.replace("Z", "+00:00"));
  return utcToJst(utc);
}

export function utcToJst(utc: Date): JstDateTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: JST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(utc);

  let hour = readPart(parts, "hour");
  if (hour === 24) {
    hour = 0;
  }

  return {
    year: readPart(parts, "year"),
    month: readPart(parts, "month"),
    day: readPart(parts, "day"),
    hour,
    minute: readPart(parts, "minute"),
    second: readPart(parts, "second"),
    utcDate: utc,
  };
}

export function jstDateKey(jst: JstDateTime): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${jst.year}-${pad(jst.month)}-${pad(jst.day)}`;
}

export function jstIsoString(jst: JstDateTime): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${jst.year}-${pad(jst.month)}-${pad(jst.day)}T${pad(jst.hour)}:${pad(jst.minute)}:${pad(jst.second)}+09:00`;
}

export function isSameJstDay(a: JstDateTime, b: JstDateTime): boolean {
  return jstDateKey(a) === jstDateKey(b);
}

export function isAfterJst(a: JstDateTime, b: JstDateTime): boolean {
  return a.utcDate.getTime() > b.utcDate.getTime();
}

export function isBeforeJst(a: JstDateTime, b: JstDateTime): boolean {
  return a.utcDate.getTime() < b.utcDate.getTime();
}

export function addHoursJst(jst: JstDateTime, hours: number): JstDateTime {
  const shifted = new Date(jst.utcDate.getTime() + hours * 60 * 60 * 1000);
  return utcToJst(shifted);
}
