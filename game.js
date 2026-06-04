/* 82-0-0 — game UI / loop */
(function () {
  const DATA = window.NHL_DATA;
  const SIM = window.NHL_SIM;
  const TEAMS = DATA.teams;

  // The real hockey six. cat = which players may fill it; side = L/R for
  // wing/defense slots (used for the shot-hand off-side penalty). Each slot,
  // once filled, is LOCKED — no swapping without restarting.
  const SLOTS = [
    { label: 'Center',        code: 'C',  cat: 'C' },
    { label: 'Left Wing',     code: 'LW', cat: 'W', side: 'L' },
    { label: 'Right Wing',    code: 'RW', cat: 'W', side: 'R' },
    { label: 'Left Defense',  code: 'LD', cat: 'D', side: 'L' },
    { label: 'Right Defense', code: 'RD', cat: 'D', side: 'R' },
    { label: 'Goalie',        code: 'G',  cat: 'G' },
  ];
  // Two independent one-time rerolls per run — one Team reroll (swaps the
  // franchise, keeps the decade) and one Decade reroll (swaps the decade, keeps
  // the franchise). Each burns independently; using one doesn't affect the other.

  const POS_LABEL = { C: 'C', L: 'LW', R: 'RW', D: 'D' };
  const catOf = (p) => (p.isGoalie ? 'G' : p.pos === 'C' ? 'C' : p.pos === 'D' ? 'D' : 'W');

  // State
  let roster = new Array(SLOTS.length).fill(null);
  let drafted = new Set();           // player ids already taken
  let teamRerollLeft = 1;            // one Team reroll per run
  let decadeRerollLeft = 1;          // one Decade reroll per run
  let curTeam = null, curDecade = null;

  const $ = (id) => document.getElementById(id);
  const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ---- pool access ---------------------------------------------------------
  // Players (skaters + goalies) for a team+decade, normalized.
  function poolFor(team, decade) {
    const era = team.eras[decade];
    if (!era) return [];
    const sk = era.skaters.map((p) => ({ ...p }));
    const go = era.goalies.map((p) => ({ ...p, isGoalie: true }));
    return [...sk, ...go];
  }
  const decadesFor = (team) => DATA.decades.filter((d) => team.eras[d]);

  const firstOpenSlotIdx = (cat) => SLOTS.findIndex((s, i) => s.cat === cat && !roster[i]);
  const filledCount = () => roster.filter(Boolean).length;

  function candidateSlots(p) {
    const cat = catOf(p);
    return SLOTS
      .map((s, i) => ({ s, i }))
      .filter((x) => x.s.cat === cat && !roster[x.i])
      .sort((a, b) => (SIM.offsidePenalty(p.hand, a.s.side) - SIM.offsidePenalty(p.hand, b.s.side)));
  }
  const isPickable = (p) => !drafted.has(p.id) && candidateSlots(p).length > 0;
  const bucketHasPick = (team, decade) => poolFor(team, decade).some(isPickable);

  // ---- rolling -------------------------------------------------------------
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

  // ---- rendering -----------------------------------------------------------
  function statBadges(p) {
    if (p.isGoalie) {
      const sv = (p.svpct * 100).toFixed(1);
      return `<span class="st">SV% <b>${sv}</b>${p.imp.svpct ? '<i title="imputed for this era">~</i>' : ''}</span>` +
             `<span class="st">GAA <b>${p.gaa.toFixed(2)}</b></span>` +
             `<span class="st">GP <b>${p.gp}</b></span>`;
    }
    const im = p.imp || {};
    return `<span class="st">G/g <b>${p.gpg.toFixed(2)}</b></span>` +
           `<span class="st">A/g <b>${p.apg.toFixed(2)}</b></span>` +
           `<span class="st">Sh/g <b>${p.spg.toFixed(1)}</b>${im.shots ? '<i title="imputed">~</i>' : ''}</span>` +
           `<span class="st">PIM/g <b>${p.pimpg.toFixed(1)}</b></span>` +
           `<span class="st">Hit/g <b>${p.hpg.toFixed(1)}</b>${im.hb ? '<i title="imputed">~</i>' : ''}</span>` +
           `<span class="st">Blk/g <b>${p.bpg.toFixed(1)}</b>${im.hb ? '<i title="imputed">~</i>' : ''}</span>`;
  }

  function showPick() {
    $('roll-team').textContent = curTeam.name;
    $('roll-decade').textContent = curDecade;

    const pool = poolFor(curTeam, curDecade);
    const skaters = pool.filter((p) => !p.isGoalie);     // already sorted by ppg
    const goalies = pool.filter((p) => p.isGoalie);      // already sorted by gp
    const list = $('players');
    list.innerHTML = '';

    const addGroup = (title, arr) => {
      if (!arr.length) return;
      const h = document.createElement('div'); h.className = 'plist-head'; h.textContent = title;
      list.appendChild(h);
      for (const p of arr) {
        const pickable = isPickable(p);
        const best = candidateSlots(p)[0];
        const wouldOffside = pickable && best && SIM.offsidePenalty(p.hand, best.s.side);
        const row = document.createElement('button');
        row.className = 'player' + (wouldOffside ? ' off' : '');
        row.disabled = !pickable;
        const tag = p.isGoalie ? 'G' : POS_LABEL[p.pos];
        const hand = p.isGoalie ? '' : ` <span class="hand">${p.hand}</span>`;
        const off = wouldOffside ? `<span class="offtag">off-side −${Math.round((1 - SIM.OFFSIDE_FACTOR) * 100)}%</span>` : '';
        row.innerHTML =
          `<span class="pinfo"><span class="pos ${catOf(p)}">${tag}</span>${hand}` +
          `<span class="pname">${p.n}${off}</span></span>` +
          `<span class="stats">${statBadges(p)}</span>`;
        row.addEventListener('click', () => draftPlayer(p));
        list.appendChild(row);
      }
    };
    addGroup(`Skaters — by points/game`, skaters);
    addGroup(`Goalies — by games played`, goalies);

    // reroll buttons — each token is independent
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

  function renderSlots(justFilledIdx = -1) {
    const el = $('slots'); el.innerHTML = '';
    SLOTS.forEach((slot, i) => {
      const div = document.createElement('div');
      div.className = 'slot';
      const p = roster[i];
      if (p) {
        div.classList.add('filled');
        if (i === justFilledIdx) div.classList.add('just-filled');
        const off = p.offside ? ` <span class="offtag">off-side</span>` : '';
        const key = p.isGoalie ? `SV% ${(p.svpct * 100).toFixed(1)}` : `${(p.gpg + p.apg).toFixed(2)} P/g`;
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

  function draftPlayer(p) {
    const best = candidateSlots(p)[0];
    if (!best) return;
    const offside = !!SIM.offsidePenalty(p.hand, best.s.side);
    roster[best.i] = { ...p, slot: best.s.code, slotSide: best.s.side, offside, teamName: curTeam.name, decade: curDecade };
    drafted.add(p.id);
    renderSlots(best.i);
    $('pick-panel').classList.add('hidden');

    if (filledCount() >= SLOTS.length) {
      $('sim-btn').classList.remove('hidden');
      $('sim-btn').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      $('roll-btn').textContent = `🎲 Roll pick ${filledCount() + 1} of ${SLOTS.length}`;
      $('roll-panel').classList.remove('hidden');
    }
  }

  // ---- result --------------------------------------------------------------
  function verdictFor(r) {
    if (r.w === 82 && r.l === 0 && r.t === 0) return { text: '🏆 PERFECT! 82-0-0. The greatest team ever assembled.', perfect: true };
    if (r.l === 0) return { text: `Unbeaten! But ${r.t} tie${r.t === 1 ? '' : 's'} kept you from immortality.`, perfect: false };
    if (r.points >= 150) return { text: 'A juggernaut — but not quite perfect.', perfect: false };
    if (r.points >= 115) return { text: 'A serious Cup contender.', perfect: false };
    if (r.points >= 95) return { text: 'A solid playoff team.', perfect: false };
    if (r.points >= 75) return { text: 'Bubble team — might sneak into the playoffs.', perfect: false };
    return { text: 'Rough season. Back to the drawing board.', perfect: false };
  }

  function simulate() {
    const r = SIM.simulateSeason(roster);
    const v = verdictFor(r);
    $('record').innerHTML = `${r.w}<span class="d">-</span>${r.l}<span class="d">-</span>${r.t}`;
    $('record').className = 'record' + (v.perfect ? ' perfect' : '');
    $('verdict').innerHTML = `${v.text} <span class="pts">(${r.points} pts)</span>`;
    $('result-roster').innerHTML = SLOTS.map((slot, i) => {
      const p = roster[i];
      const off = p.offside ? ' <span class="offtag">off-side</span>' : '';
      return `<span class="chip"><span class="pos ${catOf(p)}">${slot.code}</span> ${p.n}${off}</span>`;
    }).join('');
    $('stat-line').innerHTML =
      `Attack <strong>${r.attack}</strong> · Defense <strong>${r.defense}</strong> — ` +
      `expected <strong>${r.xGF}</strong> goals for / <strong>${r.xGA}</strong> against per game`;
    $('sim-btn').classList.add('hidden');
    $('result').classList.remove('hidden');
    $('result').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function shareText() {
    const r = SIM.simulateSeason(roster);
    const lines = SLOTS.map((slot, i) => {
      const p = roster[i];
      return `  ${slot.code.padEnd(2)} ${p.n} (${p.teamName} ${p.decade})${p.offside ? ' [off-side]' : ''}`;
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
    curTeam = curDecade = null;
    renderSlots();
    $('result').classList.add('hidden');
    $('sim-btn').classList.add('hidden');
    $('pick-panel').classList.add('hidden');
    $('roll-btn').textContent = '🎲 Roll first pick';
    $('roll-panel').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---- wire up -------------------------------------------------------------
  $('roll-btn').addEventListener('click', rollFresh);
  $('reroll-team').addEventListener('click', rerollTeam);
  $('reroll-decade').addEventListener('click', rerollDecade);
  $('sim-btn').addEventListener('click', simulate);
  $('again-btn').addEventListener('click', reset);
  $('share-btn').addEventListener('click', async () => {
    const text = shareText();
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text); toast('Copied to clipboard!');
    } catch (e) {
      try { await navigator.clipboard.writeText(text); toast('Copied!'); } catch (_) {}
    }
  });

  renderSlots();
})();
