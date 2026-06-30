const GolfCourseCsv = (() => {
  function parseGolfCourseCsv(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    const out = [];
    let lastR1 = "";
    let lastR2 = "";

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(",");
      if (parts.length !== 5) continue;

      const [c0, c1, c2, c3, c4] = parts.map((p) => p.trim());
      if (c0) lastR1 = c0;
      if (c1) lastR2 = c1;

      const lat = parseFloat(c3);
      const lon = parseFloat(c4);
      if (Number.isNaN(lat) || Number.isNaN(lon)) continue;

      const region1 = lastR1;
      const region2 = lastR2;
      const name = c2;
      const rowKey = `${region1}\t${region2}\t${name}`;

      out.push({
        region1,
        region2,
        name,
        latitude: lat,
        longitude: lon,
        rowKey,
      });
    }

    return out;
  }

  function buildRegionTree(rows) {
    const tree = {};
    for (const row of rows) {
      if (!tree[row.region1]) tree[row.region1] = {};
      if (!tree[row.region1][row.region2]) tree[row.region1][row.region2] = [];
      tree[row.region1][row.region2].push(row);
    }
    return tree;
  }

  return { parseGolfCourseCsv, buildRegionTree };
})();
