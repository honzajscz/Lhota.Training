'use strict';

/* Rozpoznávací a dekódovací engine Luštidla.
 * LENGINE.analyze(vstup) → seznam kandidátních čtení napříč všemi
 * podporovanými systémy, seřazený podle (použitelnost × jazykové skóre). */

const LENGINE = (() => {

  const latin = n => String.fromCharCode(64 + n);

  /* ---------- profil vstupu ---------- */

  function makeProfile(raw) {
    const trimmed = raw.trim();
    const tokens = trimmed.split(/[\s,;|]+/).filter(t => t.length);
    const chars = new Set(trimmed.replace(/[\s,;|]/g, ''));
    return { raw, trimmed, tokens, chars };
  }

  const isInt = t => /^[0-9]+$/.test(t);

  /* ---------- pomocníci ---------- */

  function cand(list, methodId, method, variant, out, applic, note) {
    if (out == null) return;
    const text = typeof out === 'string' ? out : out.join('');
    if (!text.replace(/[\s?]/g, '').length) return;
    list.push({ methodId, method, variant, out: text, applic, note });
  }

  /* dekóduje seznam tokenů přes mapovací funkci; '?' za neznámé,
   * vrací null při příliš mnoha chybách */
  function mapTokens(tokens, fn, maxErrRate = 0.34) {
    let err = 0;
    const out = tokens.map(t => {
      const r = fn(t);
      if (r == null) { err++; return '?'; }
      return r;
    });
    if (err / tokens.length > maxErrRate) return null;
    return { text: out.join(''), errRate: err / tokens.length };
  }

  function applicWithErrors(base, dec) {
    return base * (1 - 0.7 * dec.errRate);
  }

  /* ---------- jednotlivé dekodéry ---------- */

  /* Morseovka: . a - (i typografické varianty), / odděluje slova */
  function tryMorse(p, add) {
    if (!p.trimmed) return;
    if (!/^[.·•\-–—_/|,;\s]+$/.test(p.trimmed)) return;
    if (!/[.·•]/.test(p.trimmed) && !/[-–—_]/.test(p.trimmed)) return;
    const norm = p.trimmed
      .replace(/[·•]/g, '.')
      .replace(/[–—_]/g, '-');
    const words = norm.split(/\s*\/+\s*|\n{2,}/);
    for (const swap of [false, true]) {
      const outWords = [];
      let err = 0, tot = 0;
      for (const w of words) {
        const toks = w.split(/[\s,;|]+/).filter(t => t.length);
        const letters = toks.map(t => {
          tot++;
          const key = swap
            ? t.replace(/[.\-]/g, c => (c === '.' ? '-' : '.'))
            : t;
          const r = LDATA.MORSE[key];
          if (!r) { err++; return '?'; }
          return r;
        });
        outWords.push(letters.join(''));
      }
      if (!tot || err / tot > 0.34) continue;
      cand(add, 'morse', 'Morseovka', swap ? 'prohozené · a –' : null,
        outWords.join(' ').trim(),
        (swap ? 0.8 : 1.0) * (1 - 0.7 * err / tot),
        null);
    }
  }

  /* Dvojice libovolných symbolů: zkusí morseovku i Baconovu šifru */
  function tryTwoSymbol(p, add) {
    const sym = [...p.chars].filter(c => !'./-·•–—_'.includes(c));
    if (p.chars.size !== 2 || sym.length !== 2) return;
    if ([...p.chars].every(c => '01'.includes(c))) return;  // řeší binární dekodér
    const [a, b] = [...p.chars];
    const lens = p.tokens.map(t => t.length);
    /* morseovka z dvojice symbolů */
    if (lens.every(l => l <= 5) && p.tokens.length >= 2) {
      for (const [dot, dash] of [[a, b], [b, a]]) {
        const dec = mapTokens(p.tokens, t =>
          LDATA.MORSE[t.split('').map(c => (c === dot ? '.' : '-')).join('')]);
        if (dec) cand(add, 'morse2', 'Morseovka z dvou symbolů',
          `${dot} = tečka, ${dash} = čárka`, dec.text,
          applicWithErrors(0.75, dec), null);
      }
    }
    /* Baconova šifra: skupiny po 5, dva symboly = bity */
    const joined = p.tokens.join('');
    if (joined.length >= 10 && joined.length % 5 === 0) {
      const groups = joined.match(/.{5}/g);
      for (const [zero, one] of [[a, b], [b, a]]) {
        const dec = mapTokens(groups, g => {
          const v = parseInt(g.split('').map(c => (c === one ? '1' : '0')).join(''), 2);
          return v < 26 ? latin(v + 1) : null;
        });
        if (dec) cand(add, 'bacon', 'Baconova šifra',
          `${zero} = A/0, ${one} = B/1`, dec.text,
          applicWithErrors(0.7, dec), null);
      }
    }
  }

  /* Binární vstup (0/1) */
  function tryBinary(p, add) {
    if (![...p.chars].every(c => '01'.includes(c))) return;
    const joined = p.tokens.join('');
    if (joined.length < 4) return;

    let groups = null;
    if (p.tokens.length > 1 && p.tokens.every(t => t.length === p.tokens[0].length))
      groups = { toks: p.tokens, w: p.tokens[0].length, applic: 1 };

    const tryWidth = (toks, w, baseApplic) => {
      for (const inv of [false, true]) {
        const bits = t => inv
          ? t.split('').map(c => (c === '0' ? '1' : '0')).join('')
          : t;
        if (w === 5) {
          const dec = mapTokens(toks, t => {
            const v = parseInt(bits(t), 2);
            return v >= 1 && v <= 26 ? latin(v) : null;
          });
          if (dec) cand(add, 'bin5', 'Binárně (5 bitů, A = 1)',
            inv ? 'invertované bity' : null, dec.text,
            applicWithErrors(baseApplic * (inv ? 0.75 : 1), dec), null);
          const dec0 = mapTokens(toks, t => {
            const v = parseInt(bits(t), 2);
            return v <= 25 ? latin(v + 1) : null;
          });
          if (dec0) cand(add, 'bin5', 'Binárně (5 bitů, A = 0)',
            inv ? 'invertované bity' : null, dec0.text,
            applicWithErrors(baseApplic * (inv ? 0.65 : 0.85), dec0), null);
        } else {
          const dec = mapTokens(toks, t => {
            const v = parseInt(bits(t), 2);
            return v >= 32 && v < 127 ? String.fromCharCode(v) : null;
          });
          if (dec) cand(add, 'binA', `Binárně (${w} bitů, ASCII)`,
            inv ? 'invertované bity' : null, dec.text,
            applicWithErrors(baseApplic * (inv ? 0.75 : 1), dec), null);
        }
      }
    };

    if (groups) {
      if ([5, 7, 8].includes(groups.w)) tryWidth(groups.toks, groups.w, 1);
    } else {
      for (const w of [5, 8, 7])
        if (joined.length % w === 0)
          tryWidth(joined.match(new RegExp(`.{${w}}`, 'g')), w, w === 5 ? 0.9 : 0.85);
    }
  }

  /* Čísla oddělená mezerami */
  function tryNumbers(p, add) {
    if (p.tokens.length < 2 || !p.tokens.every(isInt)) return;
    const nums = p.tokens.map(t => parseInt(t, 10));
    const max = Math.max(...nums), min = Math.min(...nums);

    if (min >= 1 && max <= 26) {
      cand(add, 'a1z26', 'Čísla → písmena (A = 1)', null,
        nums.map(latin).join(''), 1, null);
      cand(add, 'a1z26', 'Čísla → písmena (Z = 1)', 'pozpátku',
        nums.map(n => latin(27 - n)).join(''), 0.7, null);
    }
    if (min >= 0 && max <= 25)
      cand(add, 'a1z26', 'Čísla → písmena (A = 0)', null,
        nums.map(n => latin(n + 1)).join(''), 0.85, null);
    if (min >= 1 && max <= 27 && max === 27)
      cand(add, 'a1z26cz', 'Čísla → písmena (česká abeceda s CH, A = 1)', null,
        nums.map(n => LDATA.CZ_ALPHABET[n - 1]).join(''), 0.9, null);
    if (max > 26) {
      const dec = mapTokens(p.tokens, t => {
        const v = parseInt(t, 10);
        return v >= 32 && v < 127 ? String.fromCharCode(v) : null;
      });
      if (dec) cand(add, 'ascii', 'ASCII kódy (desítkově)', null, dec.text,
        applicWithErrors(0.95, dec), null);
      cand(add, 'a1z26', 'Čísla → písmena (modulo 26)', null,
        nums.map(n => latin(((n - 1) % 26) + 1)).join(''), 0.55, null);
    }
  }

  /* Souvislý řetězec číslic → DP segmentace na 1–26 */
  function tryDigitString(p, add) {
    const digitToks = p.tokens.filter(t => isInt(t) && t.length >= 4);
    if (!digitToks.length) return;
    if (p.tokens.some(t => !isInt(t))) return;
    const whole = p.tokens.join('');
    if (whole.length < 4 || whole.length > 120) return;
    /* u vstupu rozsekaného na víc tokenů jsou oddělovače nejspíš významné */
    const applic = p.tokens.length === 1 ? 0.85 : 0.5;
    for (const lang of ['cs', 'en']) {
      const seg = LSCORE.segmentDigits(whole, lang);
      if (seg) {
        cand(add, 'digseg', 'Číslice → písmena (chytré rozdělení)',
          lang === 'cs' ? 'jako čeština' : 'jako angličtina', seg.out, applic,
          'rozděleno: ' + seg.cuts.join('·'));
      }
    }
  }

  /* Polybiův čtverec: dvojciferné tokeny z číslic 1–5 (příp. 1–6) */
  function tryPolybius(p, add) {
    if (p.tokens.length < 2) return;
    if (!p.tokens.every(t => /^[1-6][1-6]$/.test(t))) return;
    const has6 = p.tokens.some(t => t.includes('6'));

    if (!has6) {
      const alphabets = {
        'bez Q': 'ABCDEFGHIJKLMNOPRSTUVWXYZ',
        'I = J': 'ABCDEFGHIKLMNOPQRSTUVWXYZ'
      };
      for (const [aName, alpha] of Object.entries(alphabets)) {
        for (const order of ['řádek–sloupec', 'sloupec–řádek']) {
          const dec = mapTokens(p.tokens, t => {
            let r = +t[0] - 1, c = +t[1] - 1;
            if (order === 'sloupec–řádek') [r, c] = [c, r];
            return alpha[r * 5 + c];
          });
          if (dec) cand(add, 'polybius', 'Polybiův čtverec 5×5',
            `${aName}, ${order}`, dec.text,
            applicWithErrors(order === 'řádek–sloupec' ? 0.95 : 0.75, dec), null);
        }
      }
    } else {
      const alpha6 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const dec = mapTokens(p.tokens, t =>
        alpha6[(+t[0] - 1) * 6 + (+t[1] - 1)]);
      if (dec) cand(add, 'polybius', 'Polybiův čtverec 6×6',
        'A–Z + 0–9, řádek–sloupec', dec.text, applicWithErrors(0.9, dec), null);
    }
  }

  /* Semafor: dvojice směrů 1–8 (1 = dolů, po směru hodinových ručiček) */
  function trySemaphore(p, add) {
    if (p.tokens.length < 2) return;
    if (!p.tokens.every(t => /^[1-8][1-8]$/.test(t) && t[0] !== t[1])) return;
    for (const mirror of [false, true]) {
      const dec = mapTokens(p.tokens, t => {
        let a = +t[0] - 1, b = +t[1] - 1;
        if (mirror) { a = (8 - a) % 8; b = (8 - b) % 8; }
        const key = a < b ? `${a}${b}` : `${b}${a}`;
        return LDATA.SEMAPHORE[key];
      });
      if (dec) cand(add, 'semaphore', 'Semafor (dvojice směrů 1–8)',
        mirror ? 'zrcadlově' : null, dec.text,
        applicWithErrors(mirror ? 0.65 : 0.85, dec), null);
    }
  }

  /* Braille: tokeny z číslic 1–6 = čísla vyplněných teček */
  function tryBrailleDots(p, add) {
    if (p.tokens.length < 1) return;
    if (!p.tokens.every(t => /^[1-6]{1,6}$/.test(t) && new Set(t).size === t.length))
      return;
    for (const mirror of [false, true]) {
      const dec = mapTokens(p.tokens, t => {
        let dots = t.split('').map(Number);
        if (mirror) dots = dots.map(d => (d <= 3 ? d + 3 : d - 3));
        return LDATA.BRAILLE[dots.sort((x, y) => x - y).join('')];
      });
      if (dec) cand(add, 'braille', 'Braillovo písmo (čísla teček)',
        mirror ? 'zrcadlově (sloupce prohozeny)' : null, dec.text,
        applicWithErrors(mirror ? 0.6 : 0.9, dec), null);
    }
  }

  /* Braille zadaný přímo unicode znaky ⠓⠑⠇⠇⠕ */
  function tryBrailleUnicode(p, add) {
    const cps = [...p.trimmed].map(c => c.codePointAt(0));
    if (!cps.some(c => c >= 0x2800 && c <= 0x28FF)) return;
    const out = [...p.trimmed].map(ch => {
      const c = ch.codePointAt(0);
      if (c < 0x2800 || c > 0x28FF) return /\s/.test(ch) ? ' ' : '?';
      const bits = c - 0x2800;
      const dots = [];
      for (let d = 0; d < 6; d++) if (bits & (1 << d)) dots.push(d + 1);
      return LDATA.BRAILLE[dots.join('')] || '?';
    }).join('');
    cand(add, 'braille', 'Braillovo písmo (znaky)', null, out, 1, null);
  }

  /* Mobilní klávesnice – multitap: „2 22 222“ */
  function tryMultitap(p, add) {
    if (p.tokens.length < 2) return;
    if (!p.tokens.every(t => /^([2-9])\1*$/.test(t) || t === '0')) return;
    const dec = mapTokens(p.tokens, t => {
      if (t === '0') return ' ';
      const opts = LDATA.KEYPAD[t[0]];
      return t.length <= opts.length ? opts[t.length - 1] : null;
    });
    if (dec) cand(add, 'multitap', 'Mobilní klávesnice (opakované stisky)',
      null, dec.text, applicWithErrors(0.95, dec), null);
  }

  /* Mobilní klávesnice – T9: každá číslice jedno písmeno, jazykový odhad */
  function tryKeypadT9(p, add) {
    if (!p.tokens.length || !p.tokens.every(t => /^[2-9]+$/.test(t))) return;
    const digits = p.tokens.join(' ').split('');
    if (digits.filter(d => d !== ' ').length < 3) return;
    /* multitap už to nejspíš pokryl lépe */
    if (p.tokens.every(t => /^([2-9])\1*$/.test(t)) && p.tokens.length > 2) return;
    for (const lang of ['cs', 'en']) {
      const out = LSCORE.keypadViterbi(digits, lang);
      if (out) cand(add, 't9', 'Mobilní klávesnice (číslice = písmeno)',
        lang === 'cs' ? 'jako čeština' : 'jako angličtina', out, 0.6,
        'nejpravděpodobnější čtení, každá číslice zastupuje 3–4 písmena');
    }
  }

  /* Šestnáctkově → ASCII */
  function tryHex(p, add) {
    const joined = p.tokens.join('');
    if (!/^[0-9a-fA-F]+$/.test(joined) || joined.length % 2 || joined.length < 4)
      return;
    if (!/[a-fA-F]/.test(joined)) return;
    const bytes = joined.match(/../g);
    const dec = mapTokens(bytes, b => {
      const v = parseInt(b, 16);
      return v >= 32 && v < 127 ? String.fromCharCode(v) : null;
    });
    if (dec) cand(add, 'hex', 'Šestnáctkově (ASCII)', null, dec.text,
      applicWithErrors(0.9, dec), null);
  }

  /* Base64 */
  function tryBase64(p, add) {
    const s = p.tokens.join('');
    if (s.length < 4 || s.length % 4) return;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return;
    if (!/[a-z]/.test(s) || !/[A-Z0-9]/.test(s)) return;
    try {
      const bin = atob(s);
      let printable = 0;
      for (const c of bin)
        if (c.charCodeAt(0) >= 32 && c.charCodeAt(0) < 127) printable++;
      if (printable / bin.length < 0.8) return;
      cand(add, 'base64', 'Base64', null,
        bin.replace(/[^\x20-\x7e]/g, '?'), 0.8, null);
    } catch (e) { /* neplatný base64 */ }
  }

  /* Římské číslice */
  function tryRoman(p, add) {
    if (p.tokens.length < 1) return;
    if (!p.tokens.every(t => /^[IVXLCDM]+$/i.test(t))) return;
    const parse = t => {
      let sum = 0, prev = 0;
      for (const ch of t.toUpperCase().split('').reverse()) {
        const v = LDATA.ROMAN[ch];
        sum += v < prev ? -v : v;
        prev = Math.max(prev, v);
      }
      return sum;
    };
    const nums = p.tokens.map(parse);
    if (nums.every(n => n >= 1 && n <= 26) && p.tokens.length >= 2)
      cand(add, 'roman', 'Římské číslice → písmena (A = 1)',
        null, nums.map(latin).join(''), 1,
        'čísla: ' + nums.join(', '));
    else
      cand(add, 'roman', 'Římské číslice → čísla', null, nums.join(' '),
        0.5, null);
  }

  /* Posunutá abeceda (Caesar) + Atbash + převrácení */
  function tryLetterTransforms(p, add) {
    const folded = LSCORE.fold(p.trimmed);
    const letters = folded.replace(/[^A-Z]/g, '');
    if (letters.length < 3) return;
    if (letters.length / folded.replace(/\s/g, '').length < 0.7) return;

    const shift = (text, k) => text.replace(/[A-Z]/g, c =>
      String.fromCharCode(65 + (c.charCodeAt(0) - 65 + k) % 26));

    /* všechny posuny, nejlepší jako hlavní kandidát, zbytek do variant */
    const shifts = [];
    for (let k = 1; k < 26; k++) {
      const out = shift(folded, k);
      shifts.push({ k, out, ev: LSCORE.evaluate(out) });
    }
    shifts.sort((x, y) => y.ev.score - x.ev.score);
    const best = shifts[0];
    cand(add, 'caesar', 'Posunutá abeceda (Caesar)',
      `posun +${best.k} (${latin(((0 + best.k) % 26) + 1)} místo A)`, best.out,
      0.7, null);
    const c = add[add.length - 1];
    if (c && c.methodId === 'caesar')
      c.alternatives = shifts.slice(1, 25).map(s =>
        ({ label: `posun +${s.k}`, out: s.out }));

    const atbash = folded.replace(/[A-Z]/g, ch =>
      String.fromCharCode(90 - (ch.charCodeAt(0) - 65)));
    cand(add, 'atbash', 'Atbash (A↔Z)', null, atbash, 0.7, null);

    cand(add, 'reverse', 'Pozpátku', 'celý text',
      [...p.trimmed].reverse().join(''), 0.65, null);
    if (/\s/.test(p.trimmed))
      cand(add, 'reverse', 'Pozpátku', 'každé slovo zvlášť',
        p.trimmed.split(/(\s+)/).map(w =>
          /\s/.test(w) ? w : [...w].reverse().join('')).join(''), 0.6, null);
  }

  const STRUCTURAL = [tryMorse, tryTwoSymbol, tryBinary, tryNumbers,
    tryDigitString, tryPolybius, trySemaphore, tryBrailleDots,
    tryBrailleUnicode, tryMultitap, tryKeypadT9, tryHex, tryBase64, tryRoman];

  /* ---------- hlavní analýza ---------- */

  function collect(raw) {
    const p = makeProfile(raw);
    const list = [];
    if (!p.tokens.length) return list;
    for (const fn of STRUCTURAL) {
      try { fn(p, list); } catch (e) { /* dekodér selhal – přeskočit */ }
    }
    try { tryLetterTransforms(p, list); } catch (e) { /* dtto */ }
    return list;
  }

  /* Vypadá výstup stále jako kód (samé číslice apod.)? Pak zkusit další krok. */
  function looksStructural(text) {
    const t = text.trim();
    if (!t) return false;
    return /^[0-9\s,;|]+$/.test(t) || /^[01\s]+$/.test(t);
  }

  function analyze(raw, opts = {}) {
    const depth = opts.depth || 0;
    let list = collect(raw);

    /* ohodnotit */
    for (const c of list) {
      c.ev = LSCORE.evaluate(c.out);
      c.total = c.ev.score + Math.log(Math.max(c.applic, 0.01)) * 0.8;
    }

    /* řetězení: výstup vypadá pořád jako kód → druhý průchod */
    if (depth === 0) {
      const chained = [];
      const seeds = [...list].sort((a, b) => b.applic - a.applic).slice(0, 6);
      for (const c of seeds) {
        if (!looksStructural(c.out)) continue;
        const sub = analyze(c.out, { depth: 1 });
        for (const s of sub.slice(0, 3)) {
          if (s.methodId === c.methodId) continue;
          if (looksStructural(s.out)) continue;
          chained.push({
            methodId: c.methodId + '+' + s.methodId,
            method: c.method + ' → ' + s.method,
            variant: [c.variant, s.variant].filter(Boolean).join('; ') || null,
            out: s.out,
            applic: c.applic * s.applic * 0.9,
            note: 'mezikrok: ' + c.out,
            ev: s.ev,
            total: s.ev.score + Math.log(Math.max(c.applic * s.applic * 0.9, 0.01)) * 0.8,
            alternatives: s.alternatives
          });
        }
      }
      list = list.concat(chained);
    }

    /* deduplikace stejných výstupů – nechat nejlepší */
    const byOut = new Map();
    for (const c of list) {
      const key = c.out.replace(/\s+/g, ' ').trim();
      const ex = byOut.get(key);
      if (!ex || c.total > ex.total) byOut.set(key, c);
    }
    list = [...byOut.values()];

    list.sort((a, b) => b.total - a.total);

    if (depth === 0 && list.length) {
      const best = list[0].total;
      for (const c of list) c.pct = LSCORE.relative(c.total, best);
    }
    return list;
  }

  /* Vstup už možná je čitelný text – informace pro UI. */
  function plaintextCheck(raw) {
    const folded = LSCORE.fold(raw.trim());
    const letters = folded.replace(/[^A-Z]/g, '');
    if (letters.length < 4) return null;
    const ev = LSCORE.evaluate(raw);
    return ev.score > -2.75 ? ev : null;
  }

  return { analyze, plaintextCheck };
})();
