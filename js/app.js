'use strict';

/* UI Luštidla – živé vyhodnocování vstupu a vykreslení kandidátů. */

(() => {

  const $ = id => document.getElementById(id);
  const inp = $('inp');
  const results = $('results');
  const resultsHead = $('resultsHead');
  const empty = $('empty');
  const plainNote = $('plainNote');
  const moreBtn = $('more');
  const clearBtn = $('clear');

  const SHOWN = 7;
  let allCands = [];
  let expanded = false;

  const EXAMPLES = [
    ['morseovka', '.- .... --- .---'],
    ['čísla', '20 1 10 5 14 11 1'],
    ['binárka', '01001000 01100101 01101100 01101100 01101111'],
    ['polybios', '42 11 24 15 33 25 11'],
    ['semafor', '12 23 34 57'],
    ['braille', '1 125 135 245'],
    ['mobil', '2 44 444 55'],
    ['posun', 'BIPK'],
  ];

  const examplesBox = $('examples');
  for (const [name, value] of EXAMPLES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'example-chip';
    b.textContent = name;
    b.title = value;
    b.addEventListener('click', () => {
      inp.value = value;
      inp.focus();
      update();
    });
    examplesBox.append(b);
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function outSpan(text) {
    const div = document.createElement('div');
    div.className = 'out';
    for (const part of text.split(/(\?+)/)) {
      if (!part) continue;
      if (part[0] === '?') {
        const s = document.createElement('span');
        s.className = 'err';
        s.textContent = part;
        div.append(s);
      } else {
        div.append(document.createTextNode(part));
      }
    }
    return div;
  }

  function miniBtn(label, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mini-btn';
    b.textContent = label;
    b.addEventListener('click', () => onClick(b));
    return b;
  }

  function renderCard(c, isBest) {
    const li = document.createElement('li');
    li.className = 'result' + (isBest ? ' best' : '');

    const top = document.createElement('div');
    top.className = 'result-top';
    const method = document.createElement('span');
    method.className = 'method';
    method.textContent = c.method;
    top.append(method);
    if (c.variant) {
      const v = document.createElement('span');
      v.className = 'variant';
      v.textContent = c.variant;
      top.append(v);
    }
    const pct = document.createElement('span');
    pct.className = 'pct';
    pct.textContent = c.pct + ' %';
    top.append(pct);
    li.append(top);

    const meter = document.createElement('div');
    meter.className = 'meter';
    const fill = document.createElement('i');
    fill.style.width = Math.max(c.pct, 2) + '%';
    meter.append(fill);
    li.append(meter);

    li.append(outSpan(c.out));

    if (c.note) {
      const note = document.createElement('p');
      note.className = 'note';
      note.textContent = c.note;
      li.append(note);
    }

    const actions = document.createElement('div');
    actions.className = 'result-actions';
    actions.append(miniBtn('Kopírovat', b => {
      navigator.clipboard && navigator.clipboard.writeText(c.out).then(() => {
        b.textContent = 'Zkopírováno ✓';
        b.classList.add('done');
        setTimeout(() => {
          b.textContent = 'Kopírovat';
          b.classList.remove('done');
        }, 1500);
      });
    }));
    actions.append(miniBtn('Luštit dál →', () => {
      inp.value = c.out;
      inp.focus();
      update();
      window.scrollTo({ top: 0 });
    }));

    if (c.alternatives && c.alternatives.length) {
      const alts = document.createElement('div');
      alts.className = 'alts';
      for (const a of c.alternatives) {
        const row = document.createElement('div');
        row.className = 'alt-row';
        const lab = document.createElement('span');
        lab.className = 'alt-label';
        lab.textContent = a.label;
        const out = document.createElement('span');
        out.className = 'alt-out';
        out.textContent = a.out;
        row.append(lab, out);
        alts.append(row);
      }
      actions.append(miniBtn('Další varianty ▾', b => {
        const open = alts.classList.toggle('open');
        b.textContent = open ? 'Skrýt varianty ▴' : 'Další varianty ▾';
      }));
      li.append(actions, alts);
    } else {
      li.append(actions);
    }
    return li;
  }

  function render() {
    results.replaceChildren();
    const list = expanded ? allCands : allCands.slice(0, SHOWN);
    list.forEach((c, i) => results.append(renderCard(c, i === 0)));
    resultsHead.hidden = !allCands.length;
    moreBtn.hidden = expanded || allCands.length <= SHOWN;
    empty.hidden = !(inp.value.trim() && !allCands.length);
  }

  function update() {
    const raw = inp.value;
    clearBtn.hidden = !raw.length;
    expanded = false;

    if (!raw.trim()) {
      allCands = [];
      plainNote.hidden = true;
      render();
      return;
    }

    allCands = LENGINE.analyze(raw).filter(c => c.pct >= 1);

    const pt = LENGINE.plaintextCheck(raw);
    if (pt) {
      plainNote.textContent = pt.lang === 'cs'
        ? 'Tohle už vypadá jako čitelný český text – možná není co luštit.'
        : 'Tohle už vypadá jako čitelný anglický text – možná není co luštit.';
      plainNote.hidden = false;
    } else {
      plainNote.hidden = true;
    }
    render();
  }

  moreBtn.addEventListener('click', () => { expanded = true; render(); });
  clearBtn.addEventListener('click', () => {
    inp.value = '';
    inp.focus();
    update();
  });
  inp.addEventListener('input', debounce(update, 120));

  update();
})();
