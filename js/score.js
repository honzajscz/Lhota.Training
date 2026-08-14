'use strict';

/* Jazykové hodnocení – jádro automatiky Luštidla.
 * Každému kandidátnímu čtení přiřadí skóre podle toho, jak moc vypadá
 * jako čeština nebo angličtina (četnosti písmen, časté bigramy, slovníček). */

const LSCORE = (() => {

  const LANGS = ['cs', 'en'];
  const logFreq = {};
  const bigramSet = {};
  const wordSet = {};
  const wordsByLen = {};

  for (const lang of LANGS) {
    logFreq[lang] = {};
    let total = 0;
    for (const c in LDATA.FREQ[lang]) total += LDATA.FREQ[lang][c];
    for (const c in LDATA.FREQ[lang])
      logFreq[lang][c] = Math.log(LDATA.FREQ[lang][c] / total);
    bigramSet[lang] = new Set(LDATA.BIGRAMS[lang]);
    wordSet[lang] = new Set(LDATA.WORDS[lang]);
    wordsByLen[lang] = LDATA.WORDS[lang].filter(w => w.length >= 4);
  }

  const UNKNOWN_LOG = Math.log(0.0002);   // penalizace za neznámý znak („?“)
  const BIGRAM_BONUS = 0.55;

  function letterLog(lang, c) {
    return logFreq[lang][c] !== undefined ? logFreq[lang][c] : UNKNOWN_LOG;
  }

  function bigramLog(lang, a, b) {
    let s = letterLog(lang, b);
    if (bigramSet[lang].has(a + b)) s += BIGRAM_BONUS;
    return s;
  }

  /* Odstraní diakritiku a převede na velká písmena. */
  function fold(text) {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  }

  /* Skóre textu pro daný jazyk: průměrné log-skóre na písmeno
   * + bonusy za slova ze slovníčku. */
  function scoreLang(text, lang) {
    const folded = fold(text);
    const letters = folded.replace(/[^A-Z?]/g, '');
    if (!letters.length) return -Infinity;
    let s = 0;
    let prev = null;
    for (const c of letters) {
      if (c === '?') { s += UNKNOWN_LOG; prev = null; continue; }
      s += prev ? bigramLog(lang, prev, c) : letterLog(lang, c);
      prev = c;
    }
    let avg = s / letters.length;

    /* bonus za rozpoznaná slova */
    const words = folded.split(/[^A-Z]+/).filter(w => w.length >= 2);
    let hit = 0, hitLen = 0;
    for (const w of words)
      if (wordSet[lang].has(w)) { hit++; hitLen += w.length; }
    if (words.length)
      avg += 0.9 * (hitLen / Math.max(letters.length, 1));
    /* bonus i za slova „vnořená“ v souvislém textu bez mezer */
    if (words.length <= 1 && letters.length >= 5) {
      for (const w of wordsByLen[lang])
        if (letters.includes(w)) { avg += 0.35; break; }
    }
    return avg;
  }

  /* Vyhodnotí text v obou jazycích, vrátí lepší z nich. */
  function evaluate(text) {
    let best = { score: -Infinity, lang: null };
    for (const lang of LANGS) {
      const s = scoreLang(text, lang);
      if (s > best.score) best = { score: s, lang };
    }
    return best;
  }

  /* Poměrná jistota kandidáta vůči nejlepšímu (pro procentní ukazatel). */
  function relative(score, bestScore) {
    if (!isFinite(score)) return 0;
    const T = 0.55;
    return Math.max(2, Math.round(100 * Math.exp((score - bestScore) / T)));
  }

  /* Viterbi pro „jeden stisk = jedno písmeno“ na mobilní klávesnici:
   * každá číslice zastupuje 3–4 písmena, hledá se jazykově nejlepší čtení. */
  function keypadViterbi(digits, lang) {
    let states = new Map([[null, { s: 0, out: '' }]]);
    for (const d of digits) {
      if (d === ' ') {
        let bestPrev = null;
        for (const [, v] of states)
          if (!bestPrev || v.s > bestPrev.s) bestPrev = v;
        states = new Map([[null, { s: bestPrev.s, out: bestPrev.out + ' ' }]]);
        continue;
      }
      const opts = LDATA.KEYPAD[d];
      if (!opts) return null;
      const next = new Map();
      for (const c of opts) {
        let best = null;
        for (const [prev, v] of states) {
          const s = v.s + (prev ? bigramLog(lang, prev, c) : letterLog(lang, c));
          if (!best || s > best.s) best = { s, out: v.out + c };
        }
        next.set(c, best);
      }
      states = next;
    }
    let best = null;
    for (const [, v] of states)
      if (!best || v.s > best.s) best = v;
    return best ? best.out : null;
  }

  /* DP segmentace souvislého řetězce číslic na čísla 1–26 (A=1)
   * maximalizující jazykové skóre. Vrací nejlepší čtení + rozdělení. */
  function segmentDigits(str, lang) {
    const n = str.length;
    /* dp[i] = Map(prevLetter -> {s, out, cuts}) */
    const dp = [new Map([[null, { s: 0, out: '', cuts: [] }]])];
    for (let i = 1; i <= n; i++) {
      const cur = new Map();
      for (const take of [1, 2]) {
        if (i - take < 0) continue;
        const numStr = str.slice(i - take, i);
        if (take === 2 && numStr[0] === '0') continue;
        const num = parseInt(numStr, 10);
        if (num < 1 || num > 26) continue;
        const c = String.fromCharCode(64 + num);
        for (const [prev, v] of dp[i - take]) {
          const s = v.s + (prev ? bigramLog(lang, prev, c) : letterLog(lang, c));
          const ex = cur.get(c);
          if (!ex || s > ex.s)
            cur.set(c, { s, out: v.out + c, cuts: v.cuts.concat(numStr) });
        }
      }
      dp.push(cur);
    }
    let best = null;
    for (const [, v] of dp[n])
      if (!best || v.s > best.s) best = v;
    return best;   // null, pokud řetězec nelze rozdělit
  }

  return { fold, evaluate, scoreLang, relative, keypadViterbi, segmentDigits };
})();
