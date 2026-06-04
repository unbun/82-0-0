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

  // State
  let roster = new Array(SLOTS.length).fill(null);
  let drafted = new Set();
  let teamRerollLeft = 1;
  let decadeRerollLeft = 1;
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
  const decadesFor = (t) => DATA.decades.filter((d) => t.eras[d]);

  // All open slots a player CAN go into (respects position, not yet filled).
  function validSlotsFor(p) {
    const cat = catOf(p);
    return SLOTS.map((s, i) => ({ s, i })).filter((x) => x.s.cat === cat && !roster[x.i]);
  }
  const isPickable = (p) => !drafted.has(p.id) && validSlotsFor(p).length > 0;
  const bucketHasPick = (team, decade) => poolFor(team, decade).some(isPickable);
  const filledCount = () => roster.filter(Boolean).length;

  // Off-side discount for display: returns a string like "−4%" or "" if none.
  function offsideLabel(p, side) {
    if (!side || !p.hand || p.hand === 'B') return '';
    if (p.hand === side) return '';
    const disc = SIM.offsideDiscount(p);
    const pct = Math.round((1 - disc) * 100);
    return `−${pct}%`;
  }

  // ── rolling ──────────────────────────────────────────────────────────────

  function rollFresh() {
    let team, decade, guard = 0;
    do {
      team = rnd(TEAMS);
      const ds = decadesFor(team);
      decade = rnd(ds);
      guard++;
    } while (!bucketHasPick(team, decade) && guard < 800);
    curTeam = team; curDecade = decade;
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
    const opts = decadesFor(curTeam).filter((d) => d !== curDecade && bucketHasPick(curTeam, d));
    if (!opts.length) return;
    decadeRerollLeft--;
    curDecade = rnd(opts);
    showPick();
  }

  // ── rendering: stat badges ───────────────────────────────────────────────

  function statBadges(p) {
    if (p.isGoalie) {
      const sv = (p.svpct * 100).toFixed(1);
      const imp = p.imp || {};
      return `<span class="st">SV% <b${imp.svpct ? ' class="imp"' : ''}>${sv}</b></span>` +
             `<span class="st">GAA <b>${p.gaa.toFixed(2)}</b></span>` +
             `<span class="st">GP <b>${p.gp}</b></span>`;
    }
    const im = p.imp || {};
    const ppg = (p.gpg + p.apg).toFixed(2);
    return `<span class="st">PPG <b>${ppg}</b></span>` +
           `<span class="st">GPG <b>${p.gpg.toFixed(2)}</b></span>` +
           `<span class="st">APG <b>${p.apg.toFixed(2)}</b></span>` +
           `<span class="st">SPG <b${im.shots ? ' class="imp"' : ''}>${p.spg.toFixed(1)}</b></span>` +
           `<span class="st">PIM <b>${p.pimpg.toFixed(1)}</b></span>` +
           `<span class="st">HIT <b${im.hb ? ' class="imp"' : ''}>${p.hpg.toFixed(1)}</b></span>` +
           `<span class="st">BLK <b${im.hb ? ' class="imp"' : ''}>${p.bpg.toFixed(1)}</b></span>`;
  }

  // ── show current roll ────────────────────────────────────────────────────

  const PLAYER_LISTS = ['fwds', 'dmen', 'goalies'];

  function showPick() {
    pendingPlayer = null;
    $('slot-chooser').classList.add('hidden');
    PLAYER_LISTS.forEach((id) => $(id).classList.remove('hidden'));

    $('roll-team').textContent = curTeam.name;
    $('roll-decade').textContent = curDecade;

    const pool = poolFor(curTeam, curDecade);
    const fwds = pool.filter((p) => !p.isGoalie && (p.pos === 'C' || p.pos === 'L' || p.pos === 'R'));
    const dmen = pool.filter((p) => !p.isGoalie && p.pos === 'D');
    const goalies = pool.filter((p) => p.isGoalie);

    const fwdList = $('fwds');
    const dList = $('dmen');
    const gList = $('goalies');
    fwdList.innerHTML = ''; dList.innerHTML = ''; gList.innerHTML = '';

    const addGroup = (title, arr, list) => {
      if (!arr.length) return;
      const h = document.createElement('div'); h.className = 'plist-head'; h.textContent = title;
      list.appendChild(h);
      for (const p of arr) {
        const pickable = isPickable(p);
        const valids = validSlotsFor(p);

        // For display: show off-side warning for the natural first slot, but
        // let the user know if an on-side slot also exists.
        const bestSide = valids[0];
        const offLabel = bestSide ? offsideLabel(p, bestSide.s.side) : '';
        const allOnSide = valids.some((v) => !offsideLabel(p, v.s.side));

        const row = document.createElement('button');
        row.className = 'player' + (offLabel && !allOnSide ? ' off' : '');
        row.disabled = !pickable;

        const tag = p.isGoalie ? 'G' : (p.pos === 'C' ? 'C' : p.pos === 'D' ? 'D' : p.pos === 'L' ? 'LW' : 'RW');
        const hand = p.isGoalie ? '' : ` <span class="hand">${p.hand || '?'}</span>`;
        const offWarn = offLabel && !allOnSide
          ? `<span class="offtag">${offLabel} off-side</span>` : '';

        row.innerHTML =
          `<span class="pinfo"><span class="pos ${catOf(p)}">${tag}</span>${hand}` +
          `<span class="pname">${p.n}${offWarn ? ' ' + offWarn : ''}</span></span>` +
          `<span class="stats">${statBadges(p)}</span>`;

        row.addEventListener('click', () => onPlayerClick(p));
        list.appendChild(row);
      }
    };

    addGroup('Forwards — by PPG', fwds, fwdList);
    addGroup('Defense — by PPG', dmen, dList);
    addGroup('Goalies — by GP', goalies, gList);

    $('reroll-team').disabled = teamRerollLeft <= 0;
    $('reroll-decade').disabled = decadeRerollLeft <= 0;
    $('reroll-team').title = teamRerollLeft > 0 ? 'Team reroll (1 left)' : 'Team reroll used';
    $('reroll-decade').title = decadeRerollLeft > 0 ? 'Decade reroll (1 left)' : 'Decade reroll used';
    const parts = [];
    if (teamRerollLeft > 0) parts.push('Team reroll available');
    if (decadeRerollLeft > 0) parts.push('Decade reroll available');
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
    PLAYER_LISTS.forEach((id) => $(id).classList.add('hidden'));
    const sc = $('slot-chooser');
    sc.classList.remove('hidden');
    $('sc-name').textContent = p.n;

    const btns = $('sc-buttons');
    btns.innerHTML = '';
    for (const { s, i } of valids) {
      const offLabel = offsideLabel(p, s.side);
      const btn = document.createElement('button');
      btn.className = 'sc-btn' + (offLabel ? ' off' : '');
      const disc = offLabel ? ` <span class="offtag">${offLabel} off-side</span>` : '';
      btn.innerHTML = `<strong>${s.label}</strong>${disc}`;
      btn.addEventListener('click', () => placePlayer(p, { s, i }));
      btns.appendChild(btn);
    }
    const cancel = document.createElement('button');
    cancel.className = 'ghost';
    cancel.textContent = '← Back to list';
    cancel.addEventListener('click', () => {
      pendingPlayer = null;
      sc.classList.add('hidden');
      PLAYER_LISTS.forEach((id) => $(id).classList.remove('hidden'));
    });
    btns.appendChild(cancel);
  }

  function placePlayer(p, slot) {
    const { s, i } = slot;
    const offside = !!SIM.offsidePenalty(p.hand, s.side);
    roster[i] = { ...p, slot: s.code, slotSide: s.side, offside, teamName: curTeam.name, decade: curDecade };
    drafted.add(p.id);
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
        const disc = p.offside ? Math.round((1 - SIM.offsideDiscount(p)) * 100) : 0;
        const off = disc ? ` <span class="offtag">−${disc}% off-side</span>` : '';
        const key = p.isGoalie
          ? `SV% ${(p.svpct * 100).toFixed(1)}`
          : `${(p.gpg + p.apg).toFixed(2)} PPG`;
        div.innerHTML =
          `<span class="slot-label">${slot.label}</span>` +
          `<span class="slot-name">${p.n}${off}</span>` +
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
    if (r.w === 82 && r.l === 0 && r.t === 0) return { text: '🏆 PERFECT! 82-0-0. The greatest team ever assembled.', perfect: true };
    if (r.l === 0) return { text: `Unbeaten! But ${r.t} tie${r.t === 1 ? '' : 's'} kept you from immortality.`, perfect: false };
    if (r.points >= 150) return { text: 'A juggernaut — but not quite perfect.', perfect: false };
    if (r.points >= 115) return { text: 'A serious Cup contender.', perfect: false };
    if (r.points >= 85) return { text: 'A solid playoff team.', perfect: false };
    if (r.points >= 60) return { text: 'Bubble team — might sneak into the playoffs.', perfect: false };
    if (r.points >= 35) return { text: 'Rough season. This roster needs work.', perfect: false };
    return { text: 'Brutal. Back to the drawing board.', perfect: false };
  }

  function simulate() {
    const r = SIM.simulateSeason(roster);
    const v = verdictFor(r);
    $('record').innerHTML = `${r.w}<span class="d">-</span>${r.l}<span class="d">-</span>${r.t}`;
    $('record').className = 'record' + (v.perfect ? ' perfect' : '');
    $('verdict').innerHTML = `${v.text} <span class="pts">(${r.points} pts)</span>`;
    $('result-roster').innerHTML = SLOTS.map((slot, i) => {
      const p = roster[i];
      const disc = p.offside ? Math.round((1 - SIM.offsideDiscount(p)) * 100) : 0;
      const off = disc ? ` <span class="offtag">−${disc}%</span>` : '';
      return `<span class="chip"><span class="pos ${catOf(p)}">${slot.code}</span> ${p.n}${off}</span>`;
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
      const disc = p.offside ? Math.round((1 - SIM.offsideDiscount(p)) * 100) : 0;
      return `  ${slot.code.padEnd(2)} ${p.n} (${p.teamName} ${p.decade})${disc ? ` [−${disc}% off-side]` : ''}`;
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
    teamRerollLeft = 1;
    decadeRerollLeft = 1;
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

  // ── wire up ──────────────────────────────────────────────────────────────
  $('roll-btn').addEventListener('click', rollFresh);
  $('reroll-team').addEventListener('click', rerollTeam);
  $('reroll-decade').addEventListener('click', rerollDecade);
  $('sim-btn').addEventListener('click', simulate);
  $('again-btn').addEventListener('click', reset);
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

  // ── easter egg: click the trailing 0 → "unnas" appears → infinite rerolls ──
  let easterArmed = false;
  const easterZero = $('easter-zero');
  const easterName = $('easter-name');

  easterZero.addEventListener('click', () => {
    easterArmed = true;
    easterZero.classList.add('armed');
    easterName.classList.add('visible');
    // auto-disarm after 4 s if they don't click "unnas"
    setTimeout(() => {
      if (easterArmed) {
        easterArmed = false;
        easterZero.classList.remove('armed');
        easterName.classList.remove('visible');
      }
    }, 4000);
  });

  easterName.addEventListener('click', () => {
    if (!easterArmed) return;
    easterArmed = false;
    easterZero.classList.remove('armed');
    easterName.classList.remove('visible');
    teamRerollLeft = Infinity;
    decadeRerollLeft = Infinity;
    // refresh reroll button state if the pick panel is open
    if (!$('pick-panel').classList.contains('hidden')) showPick();
    toast('∞ rerolls — dev mode');
  });
})();
