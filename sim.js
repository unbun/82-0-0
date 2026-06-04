/* 82-0-0 — season simulation engine
 *
 * Input: a lineup of 6 players — 3 forwards (F), 2 defensemen (D), 1 goalie (G).
 * Output: a deterministic W-L-T record over 82 games (same roster -> same record,
 * so results are shareable and brag-able).
 *
 * Skaters and the goalie are rated on DIFFERENT axes:
 *   - A skater's rating is OFFENSE/skill -> it drives goals you SCORE.
 *   - A goalie's rating is GOALTENDING -> it drives goals you ALLOW.
 * Defensemen help a bit on both ends; forwards help a little on defense
 * (backchecking). See the math below.
 *
 * Positions: 'C' center, 'W' winger, 'D' defense, 'G' goalie. Forwards = C + W.
 * Wingers and defensemen also carry a shot hand ('L'/'R'/'B'); playing one on
 * their off-side costs OFFSIDE_PENALTY rating points (applied by the UI before a
 * player reaches the sim, via each pick's effective rating).
 */
(function (g) {
  const OFFSIDE_PENALTY = 14;

  // side is the slot's side: 'L' (LW/LD) or 'R' (RW/RD). A left shot is natural
  // on the left, a right shot on the right; 'B' (both) is never penalized.
  function offsidePenalty(hand, side) {
    if (!side || hand === 'B' || !hand) return 0;
    return hand === side ? 0 : OFFSIDE_PENALTY;
  }

  const avg = (arr, fallback) =>
    arr.length ? arr.reduce((s, p) => s + p.o, 0) / arr.length : fallback;

  function ratings(players) {
    const F = players.filter(p => p.p === 'C' || p.p === 'W');
    const D = players.filter(p => p.p === 'D');
    const G = players.filter(p => p.p === 'G');
    return {
      fwd: avg(F, 40),                              // avg forward (C+W) rating
      def: avg(D, 40),                              // avg defenseman rating
      goalie: G.length ? Math.max(...G.map(p => p.o)) : 40, // best goalie rating
    };
  }

  /* ---- the model ----------------------------------------------------------
   * ATTACK (0-99): how good you are at scoring. Forwards matter most.
   *     attack  = 0.75*avgForward + 0.25*avgDefense
   * DEFENSE (0-99): how good you are at preventing goals. Goalie matters most.
   *     defense = 0.62*goalie + 0.26*avgDefense + 0.12*avgForward
   *
   * Those 0-99 ratings map linearly to expected goals per game. The mapping is
   * anchored on the dataset's real band (every player here is a notable one, so
   * ~76 is the practical floor and ~99 the ceiling), so good drafting actually
   * separates the field:
   *     xGF = -7.31 + attack  * 0.1304   // attack 76 -> ~2.6 GF, 99 -> ~5.6 GF
   *     xGA = 14.51 - defense * 0.1475   // defense 76 -> ~3.3 GA, 96 -> ~0.3 GA
   *
   * Then each of 82 games samples goals-for ~ Poisson(xGF) and
   * goals-against ~ Poisson(xGA). gf>ga = win, gf<ga = loss, gf==ga = tie.
   * ------------------------------------------------------------------------- */
  function expectedGoals(players) {
    const r = ratings(players);
    const attack = 0.75 * r.fwd + 0.25 * r.def;
    const defense = 0.62 * r.goalie + 0.26 * r.def + 0.12 * r.fwd;
    const xGF = Math.max(0.70, -7.31 + attack * 0.1304);
    const xGA = Math.max(0.22, 14.51 - defense * 0.1475);
    return { xGF, xGA, attack, defense, ...r };
  }

  // Deterministic 32-bit hash of the roster -> RNG seed.
  function seedFrom(players) {
    const s = players.map(p => p.n + p.p + p.o).join('|');
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
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

  // Knuth's Poisson sampler using a supplied uniform RNG.
  function poisson(lambda, rng) {
    const L = Math.exp(-lambda);
    let k = 0, prod = 1;
    do { k++; prod *= rng(); } while (prod > L);
    return k - 1;
  }

  function simulateSeason(players) {
    const e = expectedGoals(players);
    const rng = mulberry32(seedFrom(players));
    let w = 0, l = 0, t = 0;
    for (let game = 0; game < 82; game++) {
      const gf = poisson(e.xGF, rng);
      const ga = poisson(e.xGA, rng);
      if (gf > ga) w++;
      else if (gf < ga) l++;
      else t++;
    }
    return {
      w, l, t,
      points: w * 2 + t,                 // old-school NHL points (2 for a win, 1 for a tie)
      xGF: +e.xGF.toFixed(2),
      xGA: +e.xGA.toFixed(2),
      attack: Math.round(e.attack),
      defense: Math.round(e.defense),
    };
  }

  g.NHL_SIM = { simulateSeason, expectedGoals, ratings, seedFrom, offsidePenalty, OFFSIDE_PENALTY };
})(typeof window !== 'undefined' ? window : globalThis);
