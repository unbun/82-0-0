/* 82-0-0 — season simulation engine (driven by REAL per-game stats)
 *
 * Input: a lineup of 6 picks — 5 skaters (C, LW, RW, LD, RD) each carrying real
 * per-game rates (goals, assists, shots, blocks, …) and 1 goalie carrying a real
 * save percentage. Each pick may have an `offside` flag (a winger/D played on the
 * wrong side for their shot hand), which discounts their contribution.
 *
 * Output: a DETERMINISTIC W-L-T record over 82 games. The RNG is seeded from the
 * exact roster, so the same lineup always yields the same record (shareable).
 *
 * The model is the standard hockey approach: estimate expected goals-for and
 * goals-against per game, then simulate each game as independent Poisson draws.
 *   - Offense (xGF): skaters' scoring rates -> goals you SCORE.
 *   - Defense (xGA): goalie save% sets how many shots become goals; the defense
 *     pair suppresses how many shots you face. -> goals you ALLOW.
 * Calibrated (see tools/calibrate) so an all-time lineup can flirt with 82-0-0,
 * an average lineup lands mid-pack, and a weak one sinks.
 */
(function (g) {
  // ---- tunables (calibrated against the real stat distribution) -------------
  // The inputs are 100% real per-game stats; these constants only set the
  // mapping from those stats to expected goals. They're anchored so the very
  // best attainable roster can flirt with 82-0-0 (the hook), an average roster
  // lands mid-pack, and a weak one sinks — while staying strictly monotonic in
  // the real stats (better players always help).
  const OFFSIDE_FACTOR = 0.82;   // a skater on their off-side is ~18% less effective
  const ASSIST_WEIGHT  = 0.5;    // assists count half a goal toward "scoring involvement"
  // xGF = OFF_INT + OFF_SLOPE * (top-5 scoring involvement)
  const OFF_INT = -0.10, OFF_SLOPE = 1.0;
  // defMetric = (save% - SV_BASE) * SV_GAIN + (defense-pair quality)
  // xGA = GA_INT - GA_SLOPE * defMetric
  const SV_BASE = 0.86, SV_GAIN = 22, GA_INT = 4.73, GA_SLOPE = 1.196;
  const SV_MIN = 0.860, SV_MAX = 0.940; // clamp goalie save% to a sane band
  const XGF_MIN = 1.0, XGA_MIN = 0.30;

  const isGoalie = (p) => typeof p.svpct === 'number';

  // side is the slot's side ('L'/'R'); a skater is off-side when their shot hand
  // doesn't match (exported so the UI can compute placement penalties too).
  function offsidePenalty(hand, side) {
    if (!side || hand === 'B' || !hand) return false;
    return hand !== side;
  }

  // Defensive quality of a defenseman from box-score proxies: all-around value
  // (points/game) plus shot-blocking, both signs of a good two-way D.
  const dQuality = (p) => 0.55 * (p.ppg || 0) + 0.16 * (p.bpg || 0);

  function expectedGoals(lineup) {
    const skaters = lineup.filter((p) => !isGoalie(p));
    const goalie = lineup.find(isGoalie) || { svpct: 0.88 };
    const D = skaters.filter((p) => (p.slotSide ? p.slot === 'LD' || p.slot === 'RD' : p.pos === 'D'));

    // Offense: top-5 scoring involvement -> expected goals for.
    let sOff = 0;
    for (const p of skaters) {
      const rate = (p.gpg || 0) + ASSIST_WEIGHT * (p.apg || 0);
      sOff += p.offside ? rate * OFFSIDE_FACTOR : rate;
    }
    const xGF = Math.max(XGF_MIN, OFF_INT + OFF_SLOPE * sOff);

    // Defense: goalie save% plus the defense pair's two-way quality.
    let dDef = 0;
    for (const p of D) dDef += p.offside ? dQuality(p) * OFFSIDE_FACTOR : dQuality(p);
    const sv = Math.min(SV_MAX, Math.max(SV_MIN, goalie.svpct || 0.88));
    const defMetric = (sv - SV_BASE) * SV_GAIN + dDef;
    const xGA = Math.max(XGA_MIN, GA_INT - GA_SLOPE * defMetric);

    // 0-100 summary ratings for the result screen.
    const attack = Math.round(Math.max(0, Math.min(100, (sOff - 1.8) / (5.8 - 1.8) * 100)));
    const defense = Math.round(Math.max(0, Math.min(100, (4.2 - xGA) / (4.2 - 0.4) * 100)));

    return { xGF, xGA, attack, defense, sOff, dDef, sv };
  }

  // Deterministic 32-bit seed from the exact roster (ids + key rates).
  function seedFrom(lineup) {
    const s = lineup.map((p) => `${p.id}:${p.gpg ?? p.svpct}:${p.offside ? 1 : 0}`).join('|');
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function poisson(lambda, rng) {
    const L = Math.exp(-lambda);
    let k = 0, prod = 1;
    do { k++; prod *= rng(); } while (prod > L);
    return k - 1;
  }

  function simulateSeason(lineup) {
    const e = expectedGoals(lineup);
    const rng = mulberry32(seedFrom(lineup));
    let w = 0, l = 0, t = 0;
    for (let game = 0; game < 82; game++) {
      const gf = poisson(e.xGF, rng);
      const ga = poisson(e.xGA, rng);
      if (gf > ga) w++; else if (gf < ga) l++; else t++;
    }
    return {
      w, l, t, points: w * 2 + t,
      xGF: +e.xGF.toFixed(2), xGA: +e.xGA.toFixed(2),
      attack: e.attack, defense: e.defense,
    };
  }

  g.NHL_SIM = { simulateSeason, expectedGoals, seedFrom, offsidePenalty, OFFSIDE_FACTOR };
})(typeof window !== 'undefined' ? window : globalThis);
