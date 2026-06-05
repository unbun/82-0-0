/* 82-0-0 — game UI / loop */
(function () {
  const DATA = window.NHL_DATA;
  const SIM = window.NHL_SIM;
  const TEAMS = DATA.teams;

  // The real hockey six. Locked once filled.
  const SLOTS = [
    { label: 'Center',        code: 'C',  cat: 'C' },
    { label: 'Left Wing',     code: 'LW', cat: 'W', side: 'L' },
    { label: 'Right Wing',    code: 'RW', cat: 'W', side: 'R' },
    { label: 'Left Defense',  code: 'LD', cat: 'D', side: 'L' },
    { label: 'Right Defense', code: 'RD', cat: 'D', side: 'R' },
    { label: 'Goalie',        code: 'G',  cat: 'G' },
  ];

  const catOf = (p) => p.isGoalie ? 'G' : p.pos === 'C' ? 'C' : p.pos === 'D' ? 'D' : 'W';

  // Primary team color for each current franchise (used to tint filled lineup cards).
  const TEAM_COLORS = {
    ANA: '#FC4C02', BOS: '#FCB514', BUF: '#003087', CGY: '#C8102E',
    CAR: '#CC0000', CHI: '#CF0A2C', COL: '#6F263D', CBJ: '#002654',
    DAL: '#006847', DET: '#CE1126', EDM: '#FF4C00', FLA: '#C8102E',
    LAK: '#A2AAAD', MIN: '#154734', MTL: '#AF1E2D', NSH: '#FFB81C',
    NJD: '#CE1126', NYI: '#00539B', NYR: '#0038A8', OTT: '#C52032',
    PHI: '#F74902', PIT: '#FCB514', SJS: '#006D75', SEA: '#68A7B4',
    STL: '#002F87', TBL: '#002868', TOR: '#00205B', UTA: '#578E6E',
    VAN: '#00843D', VGK: '#B4975A', WSH: '#C8102E', WPG: '#004C97',
  };

  // State
  let roster = new Array(SLOTS.length).fill(null);
  let drafted = new Set();
  let teamRerollLeft = 3;    // three Team rerolls per run
  let decadeRerollLeft = 2;  // two Era rerolls per run
  let curTeam = null, curDecade = null;
  let pendingPlayer = null;   // player waiting for the user to pick a slot

  const $ = (id) => document.getElementById(id);
  const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ── pool helpers ─────────────────────────────────────────────────────────

  function poolFor(team, decade) {
    const era = team.eras[decade];
    if (!era) return [];
    return [
      ...era.skaters.map((p) => ({ ...p })),
      ...era.goalies.map((p) => ({ ...p, isGoalie: true })),
    ];
  }
  const erasFor = (t) => DATA.eras.filter((e) => t.eras[e]);

  // Returns the slot categories this player is eligible to fill.
  // Centers can play any forward slot (C, LW, RW) — centers shifting to wing is
  // hockey's most common positional move, and the data backs it up: if a player's
  // career positions include C, they can fill any forward slot.
  // Wings (L/R only) can play either wing but not center.
  // Defensemen fill LD or RD only.
  function catsOf(p) {
    if (p.isGoalie) return ['G'];
    if (p.pos === 'D') return ['D'];
    const positions = p.positions || [p.pos];
    const hasC = positions.includes('C');
    const hasW = positions.some(x => x === 'L' || x === 'R');
    if (hasC) return ['C', 'W'];   // centers can play any forward slot
    return ['W'];                   // pure wings stay at wing
  }

  // Position badges for the card's left column.
  // Max 2 badges so the split is always even and nothing gets cut off:
  //   Centers with wing eligibility → C (top) + W (bottom)
  //   Pure wings or pure centers   → single badge
  //   Defensemen                   → D  (not LD/RD — those are slot names, not player positions)
  //   Goalies                      → G
  function positionTags(p) {
    if (p.isGoalie) return `<span class="pos G">G</span>`;
    if (p.pos === 'D') return `<span class="pos D">D</span>`;
    const cats = catsOf(p);
    if (cats.includes('C') && cats.includes('W'))
      return `<span class="pos C">C</span><span class="pos W">W</span>`;
    if (cats.includes('C')) return `<span class="pos C">C</span>`;
    return `<span class="pos W">W</span>`;
  }

  const isJakeAllen = (p) => p.n === 'Jake Allen';

  // All slots a player CAN go into (respects position eligibility; open slots only).
  // Jake Allen in easter egg mode can fill ANY slot, occupied or not.
  function validSlotsFor(p) {
    if (easterActive && isJakeAllen(p))
      return SLOTS.map((s, i) => ({ s, i }));
    const cats = catsOf(p);
    return SLOTS.map((s, i) => ({ s, i })).filter((x) => cats.includes(x.s.cat) && !roster[x.i]);
  }
  const isPickable = (p) => {
    if (easterActive && isJakeAllen(p)) return true;  // always green in egg mode
    return !drafted.has(p.id) && validSlotsFor(p).length > 0;
  };
  const bucketHasPick = (team, decade) => poolFor(team, decade).some(isPickable);
  const filledCount = () => roster.filter(Boolean).length;


  // ── rolling ──────────────────────────────────────────────────────────────

  function rollFresh() {
    let team, era, guard = 0;
    do {
      team = rnd(TEAMS);
      era = rnd(erasFor(team));
      guard++;
    } while (!bucketHasPick(team, era) && guard < 800);
    curTeam = team; curDecade = era;
    showPick();
  }

  function rerollTeam() {
    if (teamRerollLeft <= 0) return;
    const opts = TEAMS.filter((t) => t !== curTeam && t.eras[curDecade] && bucketHasPick(t, curDecade));
    if (!opts.length) return;
    teamRerollLeft--;
    curTeam = rnd(opts);
    showPick();
  }

  function rerollDecade() {
    if (decadeRerollLeft <= 0) return;
    const opts = erasFor(curTeam).filter((e) => e !== curDecade && bucketHasPick(curTeam, e));
    if (!opts.length) return;
    decadeRerollLeft--;
    curDecade = rnd(opts);
    showPick();
  }

  // ── cross-position Rating ("R") — EA NHL-inspired, sort-only, not used in sim ──

  function ratingRaw(p) {
    if (typeof p.svpct === 'number') {
      // Goalies: sv% is everything; GP reliability factor so small samples don't dominate
      const rel = Math.min(1, (p.gp || 0) / 80);
      return (p.svpct - 0.860) * 1350 * rel;
    }
    if (p.pos === 'D') // Defense: production + defensive contribution
      return 22 * (p.ppg || 0) + 3 * (p.spg || 0) + 5 * (p.bpg || 0) + 2 * (p.hpg || 0);
    // Forwards: scoring dominant
    return 30 * (p.ppg || 0) + 4 * (p.spg || 0) + 2 * (p.bpg || 0) + 1.5 * (p.hpg || 0);
  }

  // Compute scale once at startup from full dataset (99.9th pct as ceiling).
  const _allRaws = DATA.teams.flatMap(t =>
    Object.values(t.eras).flatMap(e => [
      ...e.skaters.map(ratingRaw),
      ...e.goalies.map(g => ratingRaw({ svpct: g.svpct, gp: g.gp })),
    ])
  ).sort((a, b) => a - b);
  const RATING_MAX = _allRaws[Math.floor(_allRaws.length * 0.999)] || 90;

  function getRating(p) {
    return Math.max(50, Math.min(99, Math.round(50 + ratingRaw(p) / RATING_MAX * 49)));
  }

  // ── rendering: stat badges ───────────────────────────────────────────────

  function statBadges(p) {
    const R = getRating(p);
    if (p.isGoalie) {
      const sv = (p.svpct * 100).toFixed(1);
      const imp = p.imp || {};
      return `<span class="st">R <b>${R}</b></span>` +
             `<span class="st">SV% <b${imp.svpct ? ' class="imp"' : ''}>${sv}</b></span>` +
             `<span class="st">GAA <b>${p.gaa.toFixed(2)}</b></span>` +
             `<span class="st">GP <b>${p.gp}</b></span>`;
    }
    const im = p.imp || {};
    const ppg = (p.gpg + p.apg).toFixed(2);
    return `<span class="st">R <b>${R}</b></span>` +
           `<span class="st">PPG <b>${ppg}</b></span>` +
           `<span class="st">GPG <b>${p.gpg.toFixed(2)}</b></span>` +
           `<span class="st">APG <b>${p.apg.toFixed(2)}</b></span>` +
           `<span class="st">SPG <b${im.shots ? ' class="imp"' : ''}>${p.spg.toFixed(1)}</b></span>` +
           `<span class="st">SV% <b${im.svpct ? ' class="imp"' : ''}>${p.isGoalie ? (p.svpct*100).toFixed(1) : '—'}</b></span>`;
  }

  // ── single unified list ──────────────────────────────────────────────────

  // Sort options (R default; GAA sorts ascending, others descending)
  const SORTS = [['r','R'],['ppg','PPG'],['gpg','GPG'],['apg','APG'],['spg','SPG'],['svpct','SV%'],['gaa','GAA'],['gp','GP']];
  const ASC_SORTS = new Set(['gaa']); // these sort low-first

  let curSortKey = 'r';
  let curPosFilter = 'all'; // 'all' | 'f' | 'd' | 'g'
  let curAllPlayers = [];

  function sortValue(p, key) {
    if (key === 'r') return getRating(p);
    const v = p[key];
    if (v != null) return v;
    // Missing stat: push to end
    return ASC_SORTS.has(key) ? Infinity : -Infinity;
  }

  function renderPlayerList() {
    const listEl = $('players');
    listEl.innerHTML = '';

    // Filter by position
    const filtered = curAllPlayers.filter(p => {
      if (curPosFilter === 'f') return !p.isGoalie && p.pos !== 'D';
      if (curPosFilter === 'd') return !p.isGoalie && p.pos === 'D';
      if (curPosFilter === 'g') return !!p.isGoalie;
      return true;
    });

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      const av = sortValue(a, curSortKey), bv = sortValue(b, curSortKey);
      return ASC_SORTS.has(curSortKey) ? av - bv : bv - av;
    });

    // Position filter tabs + sort tabs
    const ctrl = document.createElement('div');
    ctrl.className = 'sort-ctrl';

    // Position filter
    for (const [val, lbl] of [['all','All'],['f','F'],['d','D'],['g','G']]) {
      const btn = document.createElement('button');
      btn.className = 'sort-tab pos-filter' + (curPosFilter === val ? ' active' : '');
      btn.textContent = lbl;
      btn.addEventListener('click', () => { curPosFilter = val; renderPlayerList(); });
      ctrl.appendChild(btn);
    }
    // Divider
    const sep = document.createElement('span');
    sep.className = 'sort-sep';
    ctrl.appendChild(sep);
    // Sort tabs
    for (const [sk, lbl] of SORTS) {
      const btn = document.createElement('button');
      btn.className = 'sort-tab' + (curSortKey === sk ? ' active' : '');
      btn.textContent = lbl;
      btn.addEventListener('click', () => { curSortKey = sk; renderPlayerList(); });
      ctrl.appendChild(btn);
    }
    listEl.appendChild(ctrl);

    for (const p of sorted) {
      const pickable = isPickable(p);
      const row = document.createElement('button');
      row.className = 'player';
      row.disabled = !pickable;
      const hand = (p.isGoalie || !p.hand) ? '' : `<span class="hand">${p.hand}</span>`;
      row.innerHTML =
        `<span class="pos-col">${positionTags(p)}</span>` +
        `<span class="pname-row"><span class="pname">${p.n}</span>${hand}</span>` +
        `<span class="stats">${statBadges(p)}</span>`;
      row.addEventListener('click', () => onPlayerClick(p));
      row.addEventListener('mouseenter', (e) => showTooltip(p, e.currentTarget));
      row.addEventListener('mouseleave', hideTooltip);
      listEl.appendChild(row);
    }
    requestAnimationFrame(() => fitNames(listEl));
  }

  function fitNames(containerEl) {
    for (const el of containerEl.querySelectorAll('.pname')) {
      el.style.fontSize = '';
      if (el.offsetWidth > 0 && el.scrollWidth > el.offsetWidth) {
        const base = parseFloat(getComputedStyle(el).fontSize);
        el.style.fontSize = Math.max(7.5, base * (el.offsetWidth / el.scrollWidth) * 0.96) + 'px';
      }
    }
  }

  // ── show current roll ────────────────────────────────────────────────────

  const PLAYER_LISTS = ['players'];

  function showPick() {
    pendingPlayer = null;
    $('slot-chooser').classList.add('hidden');
    $('players').classList.remove('hidden');

    $('roll-team').textContent = curTeam.name;
    $('roll-decade').textContent = curDecade;

    curAllPlayers = poolFor(curTeam, curDecade);

    renderPlayerList();

    $('reroll-team').disabled = teamRerollLeft <= 0;
    $('reroll-decade').disabled = decadeRerollLeft <= 0;
    $('reroll-team').title = teamRerollLeft > 0 ? `Team reroll (${teamRerollLeft} left)` : 'Team reroll used';
    $('reroll-decade').title = decadeRerollLeft > 0 ? `Era reroll (${decadeRerollLeft} left)` : 'Era reroll used';
    const parts = [];
    if (teamRerollLeft > 0) parts.push(`${teamRerollLeft} Team reroll${teamRerollLeft > 1 ? 's' : ''} left`);
    if (decadeRerollLeft > 0) parts.push(`${decadeRerollLeft} Era reroll${decadeRerollLeft > 1 ? 's' : ''} left`);
    $('reroll-note').textContent = parts.length ? parts.join(' · ') : 'No rerolls left';

    $('roll-panel').classList.add('hidden');
    $('pick-panel').classList.remove('hidden');
  }

  // ── slot chooser (shown after clicking a player) ─────────────────────────

  function onPlayerClick(p) {
    const valids = validSlotsFor(p);
    if (valids.length === 0) return;
    if (valids.length === 1) {
      // Only one slot — place immediately.
      placePlayer(p, valids[0]);
      return;
    }
    // Multiple valid slots — let the user choose.
    pendingPlayer = p;
    $('players').classList.add('hidden');
    const sc = $('slot-chooser');
    sc.classList.remove('hidden');

    // Show "(L)" or "(R)" for all skaters including centers — useful if a center
    // is placed on a wing slot. Left-shot → natural on the LEFT side.
    const sideHint = (!p.isGoalie && p.hand && p.hand !== 'B') ? ` (${p.hand})` : '';
    $('sc-name').textContent = p.n + sideHint;

    const btns = $('sc-buttons');
    btns.innerHTML = '';
    for (const { s, i } of valids) {
      const btn = document.createElement('button');
      const isNatural = !SIM.offsidePenalty(p.hand, s.side);
      btn.className = 'sc-btn' + (isNatural ? ' natural' : '');
      btn.innerHTML = `<strong>${s.label}</strong>` + (isNatural ? `<span class="nat-tag">natural</span>` : '');
      btn.addEventListener('click', () => placePlayer(p, { s, i }));
      btns.appendChild(btn);
    }
    const cancel = document.createElement('button');
    cancel.className = 'ghost';
    cancel.textContent = '← Back to list';
    cancel.addEventListener('click', () => {
      pendingPlayer = null;
      sc.classList.add('hidden');
      $('players').classList.remove('hidden');
    });
    btns.appendChild(cancel);
  }

  function placePlayer(p, slot) {
    const { s, i } = slot;
    if (roster[i]) drafted.delete(roster[i].id);  // evict occupant (jake mode)
    const offside = !!SIM.offsidePenalty(p.hand, s.side);
    roster[i] = { ...p, slot: s.code, slotSide: s.side, offside, teamName: curTeam.name, teamId: curTeam.id, decade: curDecade };
    drafted.add(p.id);
    // Rainbow: Jake Allen has a 1-in-34 chance on any draft (not just egg mode).
    if (isJakeAllen(p) && !rainbowMode && Math.random() < 1 / 34) activateRainbow();
    pendingPlayer = null;
    $('slot-chooser').classList.add('hidden');
    $('pick-panel').classList.add('hidden');
    renderSlots(i);

    if (filledCount() >= SLOTS.length) {
      $('sim-btn').classList.remove('hidden');
      $('sim-btn').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      $('roll-btn').textContent = `🎲 Roll pick ${filledCount() + 1} of ${SLOTS.length}`;
      $('roll-panel').classList.remove('hidden');
    }
  }

  // ── roster display ───────────────────────────────────────────────────────

  function renderSlots(justFilledIdx = -1) {
    const el = $('slots'); el.innerHTML = '';
    SLOTS.forEach((slot, i) => {
      const div = document.createElement('div');
      div.className = 'slot';
      const p = roster[i];
      if (p) {
        div.classList.add('filled');
        if (i === justFilledIdx) div.classList.add('just-filled');
        const color = TEAM_COLORS[p.teamId];
        if (color) div.style.setProperty('--team-color', color);
        const key = p.isGoalie
          ? `SV% ${(p.svpct * 100).toFixed(1)}`
          : `${(p.gpg + p.apg).toFixed(2)} PPG`;
        div.innerHTML =
          `<span class="slot-label">${slot.label}</span>` +
          `<span class="slot-name">${p.n}</span>` +
          `<span class="slot-meta">${p.teamName} · ${p.decade} · ${key}</span>`;
      } else {
        div.innerHTML = `<span class="slot-label">${slot.label}</span><span class="empty-tip">—</span>`;
      }
      el.appendChild(div);
    });
    $('roster-count').textContent = `(${filledCount()}/${SLOTS.length})`;
  }

  // ── simulation + result ──────────────────────────────────────────────────

  function verdictFor(r) {
    if (r.points >= 164) return { text: 'Perfect',      perfect: true };
    if (r.points >= 135) return { text: 'Dynasty',      perfect: false };
    if (r.points >= 115) return { text: 'Legendary',    perfect: false };
    if (r.points >= 100) return { text: 'Contender',    perfect: false };
    if (r.points >= 92)  return { text: 'In The Fight', perfect: false };
    if (r.points >= 80)  return { text: "No Man's Land",perfect: false };
    if (r.points >= 65)  return { text: 'Rebuilding',   perfect: false };
    return                      { text: 'Tanking',       perfect: false };
  }

  function simulate() {
    const r = SIM.simulateSeason(roster);
    const v = verdictFor(r);
    $('record').innerHTML = `${r.w}<span class="d">-</span>${r.l}<span class="d">-</span>${r.t}`;
    $('record').className = 'record' + (v.perfect ? ' perfect' : '');
    $('verdict').innerHTML = `${v.text} <span class="pts">(${r.points} pts)</span>`;
    $('result-roster').innerHTML = SLOTS.map((slot, i) => {
      const p = roster[i];
      return `<span class="chip"><span class="pos ${catOf(p)}">${slot.code}</span> ${p.n}</span>`;
    }).join('');
    $('stat-line').innerHTML =
      `Attack <strong>${r.attack}</strong> · Defense <strong>${r.defense}</strong> — ` +
      `expected <strong>${r.xGF}</strong> GF / <strong>${r.xGA}</strong> GA per game`;
    $('sim-btn').classList.add('hidden');
    $('result').classList.remove('hidden');
    $('result').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function shareText() {
    const r = SIM.simulateSeason(roster);
    const lines = SLOTS.map((slot, i) => {
      const p = roster[i];
      return `  ${slot.code.padEnd(2)} ${p.n} (${p.teamName} ${p.decade})`;
    }).join('\n');
    return `82-0-0 🏒  My all-time NHL lineup went ${r.w}-${r.l}-${r.t} (${r.points} pts)\n${lines}\nBuild yours!`;
  }

  function toast(msg) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1600);
  }

  function reset() {
    roster = new Array(SLOTS.length).fill(null);
    drafted = new Set();
    teamRerollLeft = 4;
    decadeRerollLeft = 2;
    curSortKey = 'r';
    curPosFilter = 'all';
    curAllPlayers = [];
    easterActive = false;
    rainbowMode = false; rainbowNextRoll = false;
    document.body.classList.remove('rainbow');
    curTeam = curDecade = pendingPlayer = null;
    $('slot-chooser').classList.add('hidden');
    PLAYER_LISTS.forEach((id) => { $(id).classList.remove('hidden'); $(id).innerHTML = ''; });
    renderSlots();
    $('result').classList.add('hidden');
    $('sim-btn').classList.add('hidden');
    $('pick-panel').classList.add('hidden');
    $('roll-btn').textContent = '🎲 Roll first pick';
    $('roll-panel').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── player card tooltip ───────────────────────────────────────────────────

  let ttEl = null;

  function fmtHt(inches) {
    if (!inches) return null;
    return `${Math.floor(inches / 12)}′${inches % 12}″`;
  }

  function showTooltip(p, anchor) {
    hideTooltip();
    const tt = document.createElement('div');
    tt.className = 'player-tt';

    // Positions
    const cats = catsOf(p);
    const posLabels = p.isGoalie ? ['G']
      : [...(cats.includes('C') ? ['C'] : []), ...(cats.includes('W') ? ['LW','RW'] : []), ...(cats.includes('D') ? ['LD','RD'] : [])];
    const posRow = posLabels.map(l => {
      const cls = l === 'G' ? 'G' : (l === 'C' ? 'C' : (l === 'LD' || l === 'RD' ? 'D' : 'W'));
      return `<span class="pos ${cls}">${l}</span>`;
    }).join('');

    // Physical
    const physParts = [];
    if (!p.isGoalie && p.hand) physParts.push(`<span class="tt-kv"><b>Shoots</b> ${p.hand === 'L' ? 'Left' : p.hand === 'R' ? 'Right' : 'Both'}</span>`);
    if (p.ht) physParts.push(`<span class="tt-kv"><b>Height</b> ${fmtHt(p.ht)}</span>`);
    if (p.wt) physParts.push(`<span class="tt-kv"><b>Weight</b> ${p.wt} lbs</span>`);

    // Sim stats
    let statsHtml = '';
    if (p.isGoalie) {
      const imp = p.imp || {};
      statsHtml =
        `<span class="tt-kv"><b>SV%</b> ${(p.svpct*100).toFixed(1)}${imp.svpct ? '<i> ~</i>' : ''}</span>` +
        `<span class="tt-kv"><b>GAA</b> ${p.gaa.toFixed(2)}</span>` +
        `<span class="tt-kv"><b>GP</b> ${p.gp}</span>`;
    } else {
      const im = p.imp || {};
      statsHtml =
        `<span class="tt-kv"><b>PPG</b> ${(p.gpg+p.apg).toFixed(2)}</span>` +
        `<span class="tt-kv"><b>GPG</b> ${p.gpg.toFixed(2)}</span>` +
        `<span class="tt-kv"><b>APG</b> ${p.apg.toFixed(2)}</span>` +
        `<span class="tt-kv"><b>SPG</b> ${p.spg.toFixed(1)}${im.shots ? '<i> ~</i>' : ''}</span>` +
        `<span class="tt-kv"><b>PIM/G</b> ${p.pimpg.toFixed(1)}</span>` +
        `<span class="tt-kv"><b>HIT/G</b> ${p.hpg.toFixed(1)}${im.hb ? '<i> ~</i>' : ''}</span>` +
        `<span class="tt-kv"><b>BLK/G</b> ${p.bpg.toFixed(1)}${im.hb ? '<i> ~</i>' : ''}</span>`;
    }

    tt.innerHTML =
      `<div class="tt-name">${p.n}</div>` +
      `<div class="tt-pos">${posRow}</div>` +
      (physParts.length ? `<div class="tt-phys">${physParts.join('')}</div>` : '') +
      `<div class="tt-stats">${statsHtml}</div>`;

    document.body.appendChild(tt);
    ttEl = tt;

    // Position: prefer right of anchor, flip left if near edge.
    const rect = anchor.getBoundingClientRect();
    const ttW = 210;
    let left = rect.right + 8;
    if (left + ttW > window.innerWidth - 8) left = rect.left - ttW - 8;
    let top = rect.top + window.scrollY;
    tt.style.left = Math.max(8, left) + 'px';
    tt.style.top = top + 'px';
  }

  function hideTooltip() {
    if (ttEl) { ttEl.remove(); ttEl = null; }
  }

  // ── rainbow mode state (declared here so placePlayer and reset can see it) ──
  let rainbowMode = false;
  let rainbowNextRoll = false;

  function activateRainbow() {
    rainbowMode = true;
    rainbowNextRoll = true;
    document.body.classList.add('rainbow');
    toast('🌈');
  }
  function deactivateRainbow() {
    rainbowMode = false;
    rainbowNextRoll = false;
    document.body.classList.remove('rainbow');
  }

  // ── wire up ──────────────────────────────────────────────────────────────
  $('roll-btn').addEventListener('click', () => {
    // Rainbow mode: force next roll to STL 90s (the Gretzky era in St. Louis).
    if (rainbowNextRoll) {
      rainbowNextRoll = false;
      const stl = TEAMS.find(t => t.id === 'STL');
      if (stl && stl.eras['90s']) { curTeam = stl; curDecade = '90s'; showPick(); return; }
    }
    rollFresh();
  });
  $('reroll-team').addEventListener('click', rerollTeam);
  $('reroll-decade').addEventListener('click', rerollDecade);
  $('sim-btn').addEventListener('click', simulate);
  $('again-btn').addEventListener('click', () => { deactivateRainbow(); reset(); });
  $('share-btn').addEventListener('click', async () => {
    const text = shareText();
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text); toast('Copied!');
    } catch (e) {
      try { await navigator.clipboard.writeText(text); toast('Copied!'); } catch (_) {}
    }
  });

  renderSlots();

  // ── easter egg ────────────────────────────────────────────────────────────
  // Click the trailing "0", then type "jake" anywhere. No visual feedback on
  // the click. On activation: infinite rerolls + Jake Allen can play any position.
  let easterArmed = false;
  let easterTyped = '';
  const EASTER_WORD = 'jake';
  let easterActive = false;

  $('easter-zero').addEventListener('click', () => {
    easterArmed = true;
    easterTyped = '';
    setTimeout(() => { easterArmed = false; easterTyped = ''; }, 8000);
  });

  document.addEventListener('keydown', (e) => {
    if (!easterArmed) return;
    easterTyped += e.key.toLowerCase();
    if (!EASTER_WORD.startsWith(easterTyped)) { easterTyped = ''; return; }
    if (easterTyped === EASTER_WORD) {
      easterArmed = false;
      easterActive = true;
      teamRerollLeft = Infinity;
      decadeRerollLeft = Infinity;
      if (!$('pick-panel').classList.contains('hidden')) showPick();
      toast('🏒 jake mode');
    }
  });

})();
