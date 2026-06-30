const RacEngine = (() => {
  let pesticideList = [];
  let pesticideData = {};
  let rowsByRegNoMap = new Map();
  let ready = false;

  function normalize(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .normalize("NFKC")
      .replace(/[\s　]+/g, "")
      .toLowerCase();
  }

  function getComponentsFromRow(row) {
    const comps = new Set();
    if (row["有効成分"]) comps.add(String(row["有効成分"]).trim());
    Object.keys(row).forEach((k) => {
      if (k && k.startsWith("有効成分") && typeof row[k] === "string") {
        const v = row[k].trim();
        if (v && !v.includes("総使用回数") && !v.includes("を含む")) {
          comps.add(v);
        }
      }
    });
    return Array.from(comps).filter(Boolean);
  }

  function findRacByComponents(components) {
    const racList = [];
    const seen = new Set();
    const typeKeys = Object.keys(pesticideData);

    components.forEach((comp) => {
      const nc = normalize(comp);
      typeKeys.forEach((typeKey) => {
        const arr = pesticideData[typeKey] || [];
        arr.forEach((r) => {
          const ex = normalize(r.examples || "");
          if (!ex) return;
          if (nc.includes(ex) || ex.includes(nc)) {
            const keyId = `${r.rac_type}-${r.rac_code}`;
            if (!seen.has(keyId)) {
              seen.add(keyId);
              racList.push({
                key: keyId,
                rac_type: r.rac_type,
                rac_code: r.rac_code,
                group_name: r.group_name,
                made_of_action: r.made_of_action,
                examples: r.examples,
                remarks: r.remarks,
              });
            }
          }
        });
      });
    });

    return racList;
  }

  function getRacListFromRows(rows) {
    const allComponents = new Set();
    rows.forEach((r) => {
      getComponentsFromRow(r).forEach((c) => allComponents.add(c));
    });
    return findRacByComponents(Array.from(allComponents));
  }

  function getRowsByRegNo(regNo) {
    return rowsByRegNoMap.get(String(regNo)) || [];
  }

  function getNormalizedTargetsFromRows(rows) {
    const targets = new Set();
    rows.forEach((row) => {
      [row["適用対象"], row["適用病害虫名"], row["適用病害虫雑草名"]].forEach((v) => {
        const n = normalize(v || "");
        if (n) targets.add(n);
      });
    });
    return Array.from(targets);
  }

  function getCombinedTargetTextFromRows(rows) {
    return getNormalizedTargetsFromRows(rows).join("|");
  }

  function toSearchText(values) {
    return values.map((v) => normalize(v || "")).filter(Boolean).join("|");
  }

  function buildRowsByRegNoMap() {
    rowsByRegNoMap = new Map();
    pesticideList.forEach((row) => {
      const regNo = String(row["登録番号"]);
      if (!rowsByRegNoMap.has(regNo)) rowsByRegNoMap.set(regNo, []);
      rowsByRegNoMap.get(regNo).push(row);
    });
  }

  async function init(basePath = "data") {
    const [pesticidesRes, racRes] = await Promise.all([
      fetch(`${basePath}/pesticides_target.json`),
      fetch(`${basePath}/pesticide_rac_target.json`),
    ]);

    if (!pesticidesRes.ok || !racRes.ok) {
      throw new Error("農薬データの読み込みに失敗しました");
    }

    pesticideList = await pesticidesRes.json();
    pesticideData = await racRes.json();
    buildRowsByRegNoMap();
    ready = true;
  }

  function isReady() {
    return ready;
  }

  function search(pesticideKeyword, targetKeyword) {
    const nPesticideKeyword = normalize(pesticideKeyword);
    const nTargetKeyword = normalize(targetKeyword);
    if (!nPesticideKeyword && !nTargetKeyword) return [];

    const unique = [];
    const seen = new Set();

    pesticideList.forEach((e) => {
      const fieldValues = {
        適用対象: e["適用対象"] || "",
        適用病害虫名: e["適用病害虫名"] || "",
        適用病害虫雑草名: e["適用病害虫雑草名"] || "",
        作物名: e["作物名"] || "",
        用途: e["用途_x"] || e["用途_y"] || "",
        農薬名称: e["農薬の名称_x"] || e["農薬の名称_y"] || e["農薬の名称"] || "",
        メーカー名: e["正式名称"] || "",
      };

      const pesticideSearchText = toSearchText([
        fieldValues.農薬名称,
        fieldValues.メーカー名,
        fieldValues.用途,
        fieldValues.作物名,
      ]);
      const targetSearchText = toSearchText([
        fieldValues.適用対象,
        fieldValues.適用病害虫名,
        fieldValues.適用病害虫雑草名,
        fieldValues.作物名,
        fieldValues.用途,
        fieldValues.農薬名称,
      ]);

      const pesticideMatch = !nPesticideKeyword || pesticideSearchText.includes(nPesticideKeyword);
      const targetMatch = !nTargetKeyword || targetSearchText.includes(nTargetKeyword);

      if (!pesticideMatch || !targetMatch) return;

      const reg = String(e["登録番号"]);
      if (!seen.has(reg)) {
        seen.add(reg);
        const rows = getRowsByRegNo(reg);
        const racCodes = getRacListFromRows(rows).map((r) => `${r.rac_type}-${r.rac_code}`);
        unique.push({
          登録番号: reg,
          用途_x: e["用途_x"] || "－",
          農薬の名称_x: e["農薬の名称_x"] || e["農薬の名称"] || "－",
          正式名称: e["正式名称"] || "－",
          適用病害虫雑草名: e["適用病害虫雑草名"] || "－",
          racCodes,
        });
      }
    });

    return unique;
  }

  function getDetail(regNo) {
    const detailRows = getRowsByRegNo(regNo);
    if (detailRows.length === 0) return null;

    const racList = getRacListFromRows(detailRows);

    const detail = detailRows.map((row) => ({
      登録番号: row["登録番号"],
      用途_x: row["用途_x"] || "－",
      農薬の種類_x: row["農薬の種類_x"] || row["農薬の種類"] || "－",
      農薬の名称_x: row["農薬の名称_x"] || row["農薬の名称"] || "－",
      正式名称: row["正式名称"] || "－",
      作物名: row["作物名"] || "－",
      適用場所: row["適用場所"] || "－",
      適用病害虫雑草名: row["適用病害虫雑草名"] || "－",
      有効成分: row["有効成分"] || "－",
      濃度: row["濃度"] || "－",
      希釈倍数使用量: row["希釈倍数使用量"] || "－",
      散布液量: row["散布液量"] || "－",
      使用時期: row["使用時期"] || "－",
      総使用回数:
        row["有効成分①を含む農薬の総使用回数"] ||
        row["有効成分1を含む農薬の総使用回数"] ||
        row["総使用回数"] ||
        "－",
      使用方法: row["使用方法"] || "－",
    }));

    return { detail, racList };
  }

  function getRacCodesFromRows(rows) {
    return Array.from(new Set(getRacListFromRows(rows).map((r) => `${r.rac_type}-${r.rac_code}`)));
  }

  function findPesticidesIncludingSameGroup(regNo) {
    const sourceRows = getRowsByRegNo(regNo);
    if (sourceRows.length === 0) return [];

    const sourceRacCodes = getRacCodesFromRows(sourceRows);
    const sourceRacSet = new Set(sourceRacCodes);
    const out = [];

    for (const [candidateRegNo, candidateRows] of rowsByRegNoMap.entries()) {
      if (candidateRegNo === String(regNo)) continue;
      const candidateRacCodes = getRacCodesFromRows(candidateRows);
      const matchedRacCodes = candidateRacCodes.filter((code) => sourceRacSet.has(code));
      if (matchedRacCodes.length === 0) continue;

      const head = candidateRows[0];
      out.push({
        登録番号: candidateRegNo,
        農薬の名称_x: head["農薬の名称_x"] || head["農薬の名称"] || "－",
        正式名称: head["正式名称"] || "－",
        racCodes: candidateRacCodes,
        matchedRacCodes,
      });
    }

    return out;
  }

  function isTargetMatched(aTargetText, bTargetText) {
    if (!aTargetText || !bTargetText) return false;
    return aTargetText.includes(bTargetText) || bTargetText.includes(aTargetText);
  }

  function findRecommendedRotations(regNo) {
    const sourceRows = getRowsByRegNo(regNo);
    if (sourceRows.length === 0) return [];

    const sourceTargetText = getCombinedTargetTextFromRows(sourceRows);
    const sourceRacSet = new Set(getRacListFromRows(sourceRows).map((r) => `${r.rac_type}-${r.rac_code}`));
    if (!sourceTargetText) return [];

    const result = [];

    for (const [candidateRegNo, candidateRows] of rowsByRegNoMap.entries()) {
      if (candidateRegNo === String(regNo)) continue;
      if (candidateRows.length === 0) continue;

      const candidateTargetText = getCombinedTargetTextFromRows(candidateRows);
      if (!isTargetMatched(sourceTargetText, candidateTargetText)) continue;

      const candidateRacSet = new Set(
        getRacListFromRows(candidateRows).map((r) => `${r.rac_type}-${r.rac_code}`)
      );

      let hasOverlap = false;
      for (const racCode of candidateRacSet) {
        if (sourceRacSet.has(racCode)) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) continue;

      const head = candidateRows[0];
      result.push({
        登録番号: candidateRegNo,
        農薬の名称_x: head["農薬の名称_x"] || head["農薬の名称"] || "－",
        正式名称: head["正式名称"] || "－",
        適用病害虫雑草名: normalize(head["適用病害虫雑草名"] || ""),
        racCodes: Array.from(candidateRacSet),
      });
    }

    return result;
  }

  return {
    init,
    isReady,
    search,
    getDetail,
    findPesticidesIncludingSameGroup,
    findRecommendedRotations,
  };
})();
