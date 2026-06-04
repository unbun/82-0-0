/* 82-0-0 — season simulation engine
 *
 * METHODOLOGY: Poisson match simulation (Dixon & Coles 1997, adapted for hockey).
 * Each of 82 games is modeled as two independent Poisson draws:
 *   goals scored  ~ Poisson(xGF)    goals allowed ~ Poisson(xGA)
 * where xGF and xGA are derived from your lineup's real per-game stats.
 *
 * WHY POISSON: Goals are rare, independent events at a roughly constant rate per
 * game — exactly the conditions that define a Poisson process. It correctly
 * produces the realistic game-to-game variance (sometimes you blow someone out,
 * sometimes you lose a squeaker) while centering on your expected rate.
 *
 * OFFENSE MODEL (xGF)  — inspired by Hockey Reference's Goals Created and
 *   Corsi-based expected-goals literature:
 *   • rawScoring  = Σ skaters (GPG + 0.5·APG)  [scoring involvement]
 *   • playmakingFactor: real teams need BOTH snipers and playmakers. Assists
 *     outnumber goals ~1.8:1 in the NHL. A lineup where APG/GPG << 1.8 means
 *     isolated players who can't set each other up → efficiency penalty.
 *     A lineup where APG/GPG >> 1.8 means pure playmakers with nobody to finish.
 *   • shotFactor: SPG drives shot volume (Corsi For); more shots = more chances.
 *   • physBonus: HIT/G wins puck battles → possession → better scoring position.
 *   • penaltyCost: PIM/G creates short-handed situations → lost offensive time.
 *
 * DEFENSE MODEL (xGA)  — goalie SV% is primary; defense is additive:
 *   • svQuality: (sv% − league_floor) × scale → saves above replacement
 *   • dQuality: D-pair PPG (smart Ds maintain possession/suppress shots) +
 *               D-pair BLK/G (literally blocks shots before they reach the goalie)
 *   • fwdBlocks: forwards blocking shots (all five skaters contribute)
 *   • oppPP: high PIM/G gifts the opponent power-play chances → more xGA
 *
 * DETERMINISM: the Poisson RNG is seeded from a hash of your exact roster.
 * Same lineup → same record every time. Built for sharing and arguing.
 *
 * OFF-SIDE PENALTY: playing a skater on the wrong side for their shot hand reduces
 * their effectiveness. The discount scales with the player's quality — elite
 * players adapt more easily, so the penalty shrinks as PPG rises.
 */
(function (g) {

  // ── calibrated constants ──────────────────────────────────────────────────
  // Offense
  const IDEAL_APG_RATIO = 1.80;  // NHL norm: assists outnumber goals 1.8:1
  const SPG_TEAM_AVG = 13.0;     // 5 skaters × ~2.6 shots/game = league baseline
  const HPG_COEFF = 0.012;       // physical play bonus per HIT/G unit
  const PIM_OFF_COEFF = 0.024;   // each PIM/G unit costs offensive output
  const PLAYMAKING_MIN = 0.78;   // floor: even the worst all-sniper team isn't useless

  // Defense
  const SV_BASELINE = 0.860;     // league-floor save% (replacement-level goalie)
  const SV_SCALE = 21.0;         // (sv% − baseline) × scale = sv quality index
  const D_PPG_COEFF = 0.50;      // D-pair PPG contribution to defense quality
  const D_BPG_COEFF = 0.30;      // D-pair BLK/G contribution to defense quality
  const FWD_BPG_COEFF = 0.09;    // forward BLK/G (smaller but real)
  const PIM_OPP_COEFF = 0.056;   // each PIM/G unit adds xGA via opponent PP
  const GA_BASE = 4.95;          // xGA for a team with no defensive value
  const GA_SLOPE = 1.24;         // how steeply elite defense suppresses goals

  const SV_MIN = 0.860, SV_MAX = 0.940;
  const XGF_MIN = 0.80, XGA_MIN = 0.25;

  const isGoalie = (p) => typeof p.svpct === 'number';

  // Off-side penalty: small across the board, essentially invisible for elite D.
  // Max penalty: 5% for skaters, 0.5% for top-line defensemen (PPG ≥ 0.70).
  const OFFSIDE_MAX_SKATER = 0.05;
  const OFFSIDE_MAX_ELITE_D = 0.005;
  const D_ELITE_PPG = 0.70;
  const PPG_ELITE = 1.50;
  const ELITE_FORGIVE = 0.80;

  function offsidePenalty(hand, side) {
    if (!side || hand === 'B' || !hand) return false;
    return hand !== side;
  }

  function offsideDiscount(p) {
    const ppg = (p.gpg || 0) + (p.apg || 0);
    if (p.pos === 'D' && ppg >= D_ELITE_PPG) return 1 - OFFSIDE_MAX_ELITE_D;
    const eliteness = Math.min(1, ppg / PPG_ELITE);
    const discount = OFFSIDE_MAX_SKATER * (1 - eliteness * ELITE_FORGIVE);
    return 1 - discount;
  }

  function eff(p, stat) {
    const v = p[stat] || 0;
    if (!p.offside) return v;
    return v * offsideDiscount(p);
  }

  function expectedGoals(lineup) {
    const skaters = lineup.filter((p) => !isGoalie(p));
    const goalie  = lineup.find(isGoalie) || { svpct: 0.88 };
    const dPair   = skaters.filter((p) => p.pos === 'D');
    const fwds    = skaters.filter((p) => p.pos !== 'D');

    // ── Offense ──────────────────────────────────────────────────────────────
    let totalGPG = 0, totalAPG = 0, totalSPG = 0, totalHPG = 0, totalPIMG = 0;
    let rawScoring = 0;

    for (const p of skaters) {
      const gpg = eff(p, 'gpg');
      const apg = eff(p, 'apg');
      totalGPG  += gpg;
      totalAPG  += apg;
      totalSPG  += eff(p, 'spg');
      totalHPG  += eff(p, 'hpg');
      totalPIMG += p.pimpg || 0;     // PIM happens regardless of side
      rawScoring += gpg + 0.5 * apg; // scoring involvement (Goals Created style)
    }

    // Playmaking balance: the ratio of team APG to GPG vs. the NHL norm.
    // Too low → isolated snipers who can't set each other up.
    // Too high → playmakers with nobody to finish (soft cap, not as penalized).
    const assistRatio = totalAPG / Math.max(0.5, totalGPG);
    const playmakingFactor = Math.min(1.02,
      Math.max(PLAYMAKING_MIN, assistRatio / IDEAL_APG_RATIO));

    // Shot volume: more shots on net (Corsi For) = more scoring opportunities.
    const shotFactor = 0.88 + Math.min(0.17, (totalSPG / SPG_TEAM_AVG) * 0.17);

    // Physical play → puck battles won → possession → cleaner scoring chances.
    const physBonus = totalHPG * HPG_COEFF;

    // Penalty discipline: PIM creates short-handed situations.
    const penaltyCost = totalPIMG * PIM_OFF_COEFF;

    const xGF = Math.max(XGF_MIN,
      rawScoring * playmakingFactor * shotFactor + physBonus - penaltyCost);

    // ── Defense ──────────────────────────────────────────────────────────────
    const sv = Math.min(SV_MAX, Math.max(SV_MIN, goalie.svpct || 0.88));

    // Goalie quality above replacement.
    const svQuality = (sv - SV_BASELINE) * SV_SCALE;

    // D-pair quality: elite offensive D (Orr, Coffey, Makar) maintain possession
    // in the defensive zone and their BLK/G physically reduces shots on net.
    const dPPG = dPair.reduce((s, p) => s + eff(p, 'gpg') + eff(p, 'apg'), 0);
    const dBPG = dPair.reduce((s, p) => s + eff(p, 'bpg'), 0);
    const dQuality = D_PPG_COEFF * dPPG + D_BPG_COEFF * dBPG;

    // Forwards blocking shots — small but real contribution.
    const fwdBPG = fwds.reduce((s, p) => s + eff(p, 'bpg'), 0);
    const fwdBlock = fwdBPG * FWD_BPG_COEFF;

    // Opponent power play from our penalties.
    const oppPP = totalPIMG * PIM_OPP_COEFF;

    const defMetric = svQuality + dQuality + fwdBlock - oppPP;
    const xGA = Math.max(XGA_MIN, GA_BASE - GA_SLOPE * defMetric);

    // 0–100 summary ratings for the result card.
    const attack  = Math.round(Math.max(0, Math.min(100, (rawScoring - 1.8) / (5.6 - 1.8) * 100)));
    const defense = Math.round(Math.max(0, Math.min(100, (4.5 - xGA) / (4.5 - 0.3) * 100)));

    return {
      xGF, xGA, attack, defense,
      totalGPG, totalAPG, totalSPG,
      playmakingFactor, sv, defMetric,
    };
  }

  // ── RNG / simulation ──────────────────────────────────────────────────────

  function seedFrom(lineup) {
    const s = lineup.map((p) =>
      `${p.id}:${+(p.gpg ?? 0).toFixed(4)}:${+(p.apg ?? 0).toFixed(4)}:${+(p.svpct ?? 0).toFixed(4)}:${p.offside ? 1 : 0}`
    ).join('|');
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
    let k = 0, p = 1;
    do { k++; p *= rng(); } while (p > L);
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

  g.NHL_SIM = {
    simulateSeason, expectedGoals, seedFrom,
    offsidePenalty, offsideDiscount,
  };
})(typeof window !== 'undefined' ? window : globalThis);
