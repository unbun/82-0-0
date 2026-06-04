/* 82-0-0 — game UI / loop */
(function () {
  const DATA = window.NHL_DATA;
  const SIM = window.NHL_SIM;

  // Fixed lineup: 3 forwards, 2 defensemen, 1 goalie. Each slot, once filled,
  // is locked — you can't swap it without restarting.
  const SLOTS = [
    { label: 'Forward', cat: 'F' },
    { label: 'Forward', cat: 'F' },
    { label: 'Forward', cat: 'F' },
    { label: 'Defense', cat: 'D' },
    { label: 'Defense', cat: 'D' },
    { label: 'Goalie',  cat: 'G' },
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

  const firstOpenSlot = (cat) => SLOTS.findIndex((s, i) => s.cat === cat && !roster[i]);
  const filledCount = () => roster.filter(Boolean).length;
  const canPlace = (p) => firstOpenSlot(p.p) !== -1;
  const isPickable = (p) => !drafted.has(pkey(p)) && canPlace(p);

  function renderSlots(justFilledIdx = -1) {
    slotsEl.innerHTML = '';
    SLOTS.forEach((slot, i) => {
      const div = document.createElement('div');
      div.className = 'slot';
      const p = roster[i];
      if (p) {
        div.classList.add('filled');
        if (i === justFilledIdx) div.classList.add('just-filled');
        div.innerHTML =
          `<span class="slot-label">${slot.label} · <span class="pos ${p.p}">${p.p}</span></span>` +
          `<span class="slot-name">${p.n}</span>` +
          `<span class="slot-meta">${p.team} · ${p.decade} · OVR ${p.o}</span>`;
      } else {
        div.innerHTML = `<span class="slot-label">${slot.label}</span><span class="empty-tip">—</span>`;
      }
      slotsEl.appendChild(div);
    });
    rosterCountEl.textContent = `(${filledCount()}/${SLOTS.length})`;
  }

  // Pick a random bucket that has at least one pickable player. Dead buckets
  // (nothing matches an open slot) are skipped for free — they don't burn your
  // reroll, they just never appear.
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
      const btn = document.createElement('button');
      btn.className = 'player';
      btn.disabled = !isPickable(p);
      btn.innerHTML =
        `<span class="pname">${p.n}</span>` +
        `<span class="pright"><span class="pos ${p.p}">${p.p}</span><span class="ovr">${p.o}</span></span>`;
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
    const slot = firstOpenSlot(p.p);
    if (slot === -1) return;
    roster[slot] = { ...p, team: currentRoll.team.name, decade: currentRoll.decade };
    drafted.add(pkey(p));
    renderSlots(slot);
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

    $('result-roster').innerHTML = roster
      .map((p) => `<span class="chip"><span class="pos ${p.p}">${p.p}</span> ${p.n}</span>`).join('');

    $('stat-line').innerHTML =
      `Attack <strong>${r.attack}</strong> · Defense <strong>${r.defense}</strong> — ` +
      `expected <strong>${r.xGF}</strong> goals for / <strong>${r.xGA}</strong> against per game`;

    simBtn.classList.add('hidden');
    resultEl.classList.remove('hidden');
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function shareText() {
    const r = SIM.simulateSeason(roster);
    const lines = roster.map((p) => `  ${p.p}  ${p.n} (${p.team} ${p.decade})`).join('\n');
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
