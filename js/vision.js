'use strict';

/* Čtení šifer z obrázku: najde tmavé/světlé skvrny, rozpozná strukturu
 * (Braillova mřížka, morseovka z teček a čárek) a přepíše ji do textu,
 * který pak zpracuje běžný engine. Vše běží lokálně v prohlížeči. */

const LVISION = (() => {

  const MAX_DIM = 1000;

  function toCanvas(bitmap) {
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  }

  /* Otsuův práh nad histogramem jasu. */
  function otsu(gray) {
    const hist = new Array(256).fill(0);
    for (const g of gray) hist[g]++;
    const total = gray.length;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, best = 127, bestVar = -1;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB || wB === total) continue;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / (total - wB);
      const v = wB * (total - wB) * (mB - mF) * (mB - mF);
      if (v > bestVar) { bestVar = v; best = t; }
    }
    return best;
  }

  /* Souvislé oblasti popředí (4-okolí). */
  function findBlobs(fg, w, h) {
    const labels = new Int32Array(w * h);
    const blobs = [];
    const stack = [];
    for (let start = 0; start < w * h; start++) {
      if (!fg[start] || labels[start]) continue;
      const blob = { n: 0, sx: 0, sy: 0,
        minx: w, maxx: 0, miny: h, maxy: 0 };
      stack.push(start);
      labels[start] = 1;
      while (stack.length) {
        const i = stack.pop();
        const x = i % w, y = (i / w) | 0;
        blob.n++;
        blob.sx += x; blob.sy += y;
        if (x < blob.minx) blob.minx = x;
        if (x > blob.maxx) blob.maxx = x;
        if (y < blob.miny) blob.miny = y;
        if (y > blob.maxy) blob.maxy = y;
        if (x > 0 && fg[i - 1] && !labels[i - 1]) { labels[i - 1] = 1; stack.push(i - 1); }
        if (x < w - 1 && fg[i + 1] && !labels[i + 1]) { labels[i + 1] = 1; stack.push(i + 1); }
        if (y > 0 && fg[i - w] && !labels[i - w]) { labels[i - w] = 1; stack.push(i - w); }
        if (y < h - 1 && fg[i + w] && !labels[i + w]) { labels[i + w] = 1; stack.push(i + w); }
      }
      blob.cx = blob.sx / blob.n;
      blob.cy = blob.sy / blob.n;
      blob.w = blob.maxx - blob.minx + 1;
      blob.h = blob.maxy - blob.miny + 1;
      blobs.push(blob);
    }
    return blobs;
  }

  const median = arr => {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    return s[(s.length / 2) | 0];
  };

  /* Rozdělí seřazené prvky do skupin podle mezery. */
  function clusterBy(items, valueFn, gap) {
    const sorted = [...items].sort((a, b) => valueFn(a) - valueFn(b));
    const groups = [];
    let cur = [];
    for (const it of sorted) {
      if (cur.length && valueFn(it) - valueFn(cur[cur.length - 1]) > gap)
        { groups.push(cur); cur = []; }
      cur.push(it);
    }
    if (cur.length) groups.push(cur);
    return groups;
  }

  /* Braille: skupiny teček → mřížka 2×3 → čísla teček. */
  function readBrailleRow(row, pitch) {
    const cells = clusterBy(row, b => b.cx, pitch * 1.7);
    const tokens = [];
    for (const cell of cells) {
      const xmin = Math.min(...cell.map(b => b.cx));
      const ymin = Math.min(...cell.map(b => b.cy));
      const dots = new Set();
      for (const b of cell) {
        const col = Math.min(1, Math.max(0, Math.round((b.cx - xmin) / pitch)));
        const r = Math.min(2, Math.max(0, Math.round((b.cy - ymin) / pitch)));
        dots.add(col === 0 ? r + 1 : r + 4);
      }
      tokens.push([...dots].sort().join(''));
    }
    return tokens.join(' ');
  }

  /* Morseovka: kulaté skvrny = tečky, protáhlé = čárky. */
  function readMorseRow(row, unit) {
    const sorted = [...row].sort((a, b) => a.cx - b.cx);
    let out = '';
    for (let i = 0; i < sorted.length; i++) {
      const b = sorted[i];
      if (i > 0) {
        const gap = b.minx - sorted[i - 1].maxx;
        if (gap > 5 * unit) out += ' / ';
        else if (gap > 1.8 * unit) out += ' ';
      }
      out += b.w / b.h >= 1.8 ? '-' : '.';
    }
    return out;
  }

  /* Hlavní rozpoznání: bitmapa → { text, kind, count } nebo null. */
  function recognize(bitmap) {
    const img = toCanvas(bitmap);
    const { width: w, height: h, data } = img;
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      gray[i] = (data[4 * i] * 3 + data[4 * i + 1] * 6 + data[4 * i + 2]) / 10;
    }
    const t = otsu(gray);
    let above = 0;
    for (const g of gray) if (g > t) above++;
    /* popředí = menšinová třída (tečky zabírají málo plochy) */
    const fgIsLight = above < w * h - above;
    const fg = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++)
      fg[i] = (gray[i] > t) === fgIsLight ? 1 : 0;

    let blobs = findBlobs(fg, w, h);
    const maxDim = 0.3 * Math.max(w, h);
    blobs = blobs.filter(b => b.n >= 4 && b.n <= 0.05 * w * h
      && b.w <= maxDim && b.h <= maxDim);
    if (blobs.length < 2 || blobs.length > 400) return null;

    const d = median(blobs.map(b => Math.max(b.w, b.h)));
    const elongated = blobs.filter(b => b.w / b.h >= 1.8).length;
    const kind = elongated >= blobs.length * 0.2 ? 'morse' : 'braille';

    /* řádky podle svislé polohy */
    const rows = clusterBy(blobs, b => b.cy, kind === 'morse' ? d * 1.5 : d * 2.2);

    if (kind === 'morse') {
      const unit = median(blobs.filter(b => b.w / b.h < 1.8).map(b => b.w)) || d;
      const text = rows.map(r => readMorseRow(r, unit)).join(' / ');
      return { text, kind, count: blobs.length };
    }

    /* odhad rozteče mřížky: vzdálenost k nejbližší sousední tečce */
    const nn = [];
    for (const a of blobs) {
      let best = Infinity;
      for (const b of blobs) {
        if (a === b) continue;
        const dist = Math.hypot(a.cx - b.cx, a.cy - b.cy);
        if (dist < best) best = dist;
      }
      if (isFinite(best)) nn.push(best);
    }
    const pitch = Math.max(median(nn), d * 1.1);
    const text = rows.map(r => readBrailleRow(r, pitch)).join('\n');
    return { text, kind, count: blobs.length };
  }

  async function fromFile(fileOrBlob) {
    let bitmap;
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(fileOrBlob);
    } else {
      bitmap = await new Promise((res, rej) => {
        const url = URL.createObjectURL(fileOrBlob);
        const im = new Image();
        im.onload = () => { URL.revokeObjectURL(url); res(im); };
        im.onerror = rej;
        im.src = url;
      });
    }
    return recognize(bitmap);
  }

  return { fromFile, recognize };
})();
