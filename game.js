/* 82-0-0 — game UI / loop */
(function () {
  const DATA = window.NHL_DATA;
  const SIM = window.NHL_SIM;

  // The real hockey six. Each skater fills its strict position; wings and
  // defense have a left/right side, and playing a skater on their off-side
  // costs a rating penalty (SIM.offsidePenalty). Each slot, once filled, is
  // locked — you can't swap it without restarting.
  //   cat: which players may fill it ('C' | 'W' | 'D' | 'G')
  //   side: 'L' | 'R' for wing/defense slots (undefined for C/G)
  const SLOTS = [
    { label: 'Center',        code: 'C',  cat: 'C' },
    { label: 'Left Wing',     code: 'LW', cat: 'W', side: 'L' },
    { label: 'Right Wing',    code: 'RW', cat: 'W', side: 'R' },
    { label: 'Left Defense',  code: 'LD', cat: 'D', side: 'L' },
    { label: 'Right Defense', code: 'RD', cat: 'D', side: 'R' },
    { label: 'Goalie',        code: 'G',  cat: 'G' },
  ];
  const REROLLS_PER_GAME = 1; // one mulligan per playthrough

  // Pre-build the list of valid (team, decade) rolls — buckets with players.
  const ROLLS = [];
  for (const team of DATA.teams) {
    for (const decade of Object.keys(team.eras)) {
      if (team.eras[decade] && team.eras[decade].length) ROLLS.push({ team, decade });
    }
  }

  // State
  let roster = new Array(SLOTS.length).fill(null);
  let drafted = new Set();
  let rerollsLeft = REROLLS_PER_GAME;
  let currentRoll = null;

  // Elements
  const $ = (id) => document.getElementById(id);
  const slotsEl = $('slots');
  const rosterCountEl = $('roster-count');
  const rollPanel = $('roll-panel');
  const pickPanel = $('pick-panel');
  const rollBtn = $('roll-btn');
  const rerollBtn = $('reroll-btn');
  const rollTeamEl = $('roll-team');
  const rollDecadeEl = $('roll-decade');
  const playersEl = $('players');
  const simBtn = $('sim-btn');
  const resultEl = $('result');

  const pkey = (p) => `${p.n}|${p.p}|${p.o}`;
  const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const posLabel = (p) => (p.p === 'C' ? 'C' : p.p === 'G' ? 'G' : `${p.p}${p.h ? ' ' + p.h : ''}`);

  // Candidate (still-open) slots a player could fill, best (lowest penalty) first.
  function candidateSlots(p) {
    return SLOTS
      .map((s, i) => ({ s, i }))
      .filter((x) => x.s.cat === p.p && !roster[x.i])
      .sort((a, b) => SIM.offsidePenalty(p.h, a.s.side) - SIM.offsidePenalty(p.h, b.s.side));
  }
  const isPickable = (p) => !drafted.has(pkey(p)) && candidateSlots(p).length > 0;
  const filledCount = () => roster.filter(Boolean).length;

  function renderSlots(justFilledIdx = -1) {
    slotsEl.innerHTML = '';
    SLOTS.forEach((slot, i) => {
      const div = document.createElement('div');
      div.className = 'slot';
      const p = roster[i];
      if (p) {
        div.classList.add('filled');
        if (i === justFilledIdx) div.classList.add('just-filled');
        const off = p.offside ? ` <span class="offtag">off-side −${SIM.OFFSIDE_PENALTY}</span>` : '';
        div.innerHTML =
          `<span class="slot-label">${slot.label} · <span class="pos ${p.p}">${posLabel(p)}</span></span>` +
          `<span class="slot-name">${p.n}${off}</span>` +
          `<span class="slot-meta">${p.team} · ${p.decade} · OVR ${p.base}${p.offside ? ` → ${p.o}` : ''}</span>`;
      } else {
        div.innerHTML = `<span class="slot-label">${slot.label}</span><span class="empty-tip">—</span>`;
      }
      slotsEl.appendChild(div);
    });
    rosterCountEl.textContent = `(${filledCount()}/${SLOTS.length})`;
  }

  // Pick a random bucket that has at least one pickable player. Dead buckets
  // (nothing matches an open slot) are skipped for free — they never appear and
  // don't burn your reroll.
  function pickValidRoll() {
    let roll, guard = 0;
    do {
      roll = rnd(ROLLS);
      guard++;
    } while (!roll.team.eras[roll.decade].some(isPickable) && guard < 500);
    return roll;
  }

  function renderReroll() {
    if (rerollsLeft > 0) {
      rerollBtn.disabled = false;
      rerollBtn.textContent = `🔄 Reroll team & players (${rerollsLeft} left)`;
    } else {
      rerollBtn.disabled = true;
      rerollBtn.textContent = '🔄 No rerolls left';
    }
  }

  function showRoll(roll) {
    currentRoll = roll;
    rollTeamEl.textContent = roll.team.name;
    rollDecadeEl.textContent = roll.decade;

    playersEl.innerHTML = '';
    const sorted = roll.team.eras[roll.decade].slice().sort((a, b) => b.o - a.o);
    for (const p of sorted) {
      const pickable = isPickable(p);
      const best = candidateSlots(p)[0];
      const wouldOffside = pickable && best && SIM.offsidePenalty(p.h, best.s.side) > 0;
      const btn = document.createElement('button');
      btn.className = 'player';
      btn.disabled = !pickable;
      const warn = wouldOffside ? ` <span class="offtag">off-side −${SIM.OFFSIDE_PENALTY}</span>` : '';
      btn.innerHTML =
        `<span class="pname">${p.n}${warn}</span>` +
        `<span class="pright"><span class="pos ${p.p}">${posLabel(p)}</span><span class="ovr">${p.o}</span></span>`;
      btn.addEventListener('click', () => draftPlayer(p));
      playersEl.appendChild(btn);
    }

    renderReroll();
    rollPanel.classList.add('hidden');
    pickPanel.classList.remove('hidden');
  }

  function newRoll() { showRoll(pickValidRoll()); }

  function reroll() {
    if (rerollsLeft <= 0) return;
    rerollsLeft--;
    showRoll(pickValidRoll());
  }

  function draftPlayer(p) {
    const best = candidateSlots(p)[0];
    if (!best) return;
    const penalty = SIM.offsidePenalty(p.h, best.s.side);
    roster[best.i] = {
      ...p,
      team: currentRoll.team.name,
      decade: currentRoll.decade,
      slot: best.s.code,
      side: best.s.side,
      base: p.o,
      o: p.o - penalty,   // effective rating the sim sees
      offside: penalty > 0,
    };
    drafted.add(pkey(p));
    renderSlots(best.i);
    pickPanel.classList.add('hidden');

    if (filledCount() >= SLOTS.length) {
      simBtn.classList.remove('hidden');
      simBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      rollBtn.textContent = `🎲 Roll pick ${filledCount() + 1} of ${SLOTS.length}`;
      rollPanel.classList.remove('hidden');
    }
  }

  function verdictFor(r) {
    if (r.w === 82 && r.l === 0 && r.t === 0) return { text: '🏆 PERFECT! 82-0-0. The greatest team in hockey history.', perfect: true };
    if (r.l === 0) return { text: `Unbeaten! But ${r.t} tie${r.t === 1 ? '' : 's'} kept you from immortality.`, perfect: false };
    if (r.points >= 150) return { text: 'A juggernaut — but not quite perfect.', perfect: false };
    if (r.points >= 120) return { text: 'A serious Cup contender.', perfect: false };
    if (r.points >= 95) return { text: 'A solid playoff team.', perfect: false };
    if (r.points >= 75) return { text: 'Bubble team — might sneak into the playoffs.', perfect: false };
    return { text: 'Rough season. Back to the drawing board.', perfect: false };
  }

  function simulate() {
    const r = SIM.simulateSeason(roster);
    const v = verdictFor(r);

    $('record').innerHTML = `${r.w}<span style="color:var(--muted)">-</span>${r.l}<span style="color:var(--muted)">-</span>${r.t}`;
    $('record').className = 'record' + (v.perfect ? ' perfect' : '');
    $('verdict').innerHTML = `${v.text} <span class="pts">(${r.points} pts)</span>`;

    $('result-roster').innerHTML = SLOTS.map((slot, i) => {
      const p = roster[i];
      const off = p.offside ? ' <span class="offtag">off-side</span>' : '';
      return `<span class="chip"><span class="pos ${p.p}">${slot.code}</span> ${p.n}${off}</span>`;
    }).join('');

    $('stat-line').innerHTML =
      `Attack <strong>${r.attack}</strong> · Defense <strong>${r.defense}</strong> — ` +
      `expected <strong>${r.xGF}</strong> goals for / <strong>${r.xGA}</strong> against per game`;

    simBtn.classList.add('hidden');
    resultEl.classList.remove('hidden');
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function shareText() {
    const r = SIM.simulateSeason(roster);
    const lines = SLOTS.map((slot, i) => {
      const p = roster[i];
      return `  ${slot.code.padEnd(2)} ${p.n} (${p.team} ${p.decade})${p.offside ? ' [off-side]' : ''}`;
    }).join('\n');
    return `82-0-0 🏒  My all-time NHL lineup went ${r.w}-${r.l}-${r.t} (${r.points} pts)\n${lines}\nBuild yours!`;
  }

  function toast(msg) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1600);
  }

  function reset() {
    roster = new Array(SLOTS.length).fill(null);
    drafted = new Set();
    rerollsLeft = REROLLS_PER_GAME;
    currentRoll = null;
    renderSlots();
    resultEl.classList.add('hidden');
    simBtn.classList.add('hidden');
    pickPanel.classList.add('hidden');
    rollBtn.textContent = '🎲 Roll first pick';
    rollPanel.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Wire up
  rollBtn.addEventListener('click', newRoll);
  rerollBtn.addEventListener('click', reroll);
  simBtn.addEventListener('click', simulate);
  $('again-btn').addEventListener('click', reset);
  $('share-btn').addEventListener('click', async () => {
    const text = shareText();
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      toast('Copied to clipboard!');
    } catch (e) {
      try { await navigator.clipboard.writeText(text); toast('Copied!'); } catch (_) {}
    }
  });

  renderSlots();
})();
