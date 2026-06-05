#!/usr/bin/env node
/* 82-0-0 data ETL — pulls real NHL stats once and writes ../data.js
 *
 * Sources (all official, no auth):
 *   - api-web.nhle.com  /v1/club-stats-season/{code}        -> seasons a code played
 *                       /v1/club-stats/{code}/{season}/2    -> per-team-season skaters+goalies
 *                       /v1/player/{id}/landing             -> shootsCatches (shot hand) backfill
 *   - api.nhle.com/stats/rest/en/team                       -> code -> franchiseId / teamId
 *                                    /skater/realtime        -> hits, blocks, shootsCatches (modern)
 *
 * Output per franchise/decade: top ~30 skaters by points/game (min games), and
 * the 3-5 goalies with the most games. Stats untracked in old eras (shots
 * pre-1959, hits/blocks pre-2008, goalie save% pre-~1955) are imputed by tier so
 * those decades aren't unfairly favored or penalized. Imputed fields are flagged.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(__dirname, 'cache');
fs.mkdirSync(CACHE, { recursive: true });

const AWEB = 'https://api-web.nhle.com/v1';
const REST = 'https://api.nhle.com/stats/rest/en';
const MODERN_START = 20052006; // hits/blocks (real-time) tracked from here
const SHOTS_START_YEAR = 1959;  // shots tracked from 1959-60
const MIN_GP_FACTOR = 0.03;     // include any skater who played ~3% of an era's games
const TOP_SKATERS = Infinity;   // list every player with data — no cap
const TOP_GOALIES = 10;

// Custom era boundaries (start year inclusive → era label).
// Seasons whose start year falls before 1942 are excluded entirely.
const ERAS = ['Original Six', 'Expansion', '80s', '90s', '2000s', '2010s', '2020s'];
function eraOf(seasonId) {
  const yr = Math.floor(seasonId / 10000);
  if (yr < 1942) return null;          // pre-Original Six — excluded
  if (yr < 1967) return 'Original Six'; // 1942-43 through 1966-67
  if (yr < 1980) return 'Expansion';   // 1967-68 through 1979-80
  if (yr < 1992) return '80s';         // 1980-81 through 1991-92
  if (yr < 2000) return '90s';         // 1992-93 through 1999-2000
  if (yr < 2010) return '2000s';
  if (yr < 2020) return '2010s';
  return '2020s';
}

// ---- the 32 current franchises. extraCodes = relocations the NHL counts as a
// DIFFERENT franchiseId but that we fold in (Utah<-Coyotes lineage, Ottawa<-
// original Senators). Same-franchiseId relocations are discovered automatically.
const TEAMS = [
  ['ANA', 'Anaheim Ducks', ['Mighty Ducks of Anaheim (1993)', 'Anaheim Ducks (2006–present)']],
  ['BOS', 'Boston Bruins', ['Boston Bruins (1924–present)']],
  ['BUF', 'Buffalo Sabres', ['Buffalo Sabres (1970–present)']],
  ['CGY', 'Calgary Flames', ['Atlanta Flames (1972)', 'Calgary Flames (1980–present)']],
  ['CAR', 'Carolina Hurricanes', ['Hartford Whalers (1979)', 'Carolina Hurricanes (1997–present)']],
  ['CHI', 'Chicago Blackhawks', ['Chicago Black Hawks (1926)', 'Chicago Blackhawks (1986–present)']],
  ['COL', 'Colorado Avalanche', ['Quebec Nordiques (1979)', 'Colorado Avalanche (1995–present)']],
  ['CBJ', 'Columbus Blue Jackets', ['Columbus Blue Jackets (2000–present)']],
  ['DAL', 'Dallas Stars', ['Minnesota North Stars (1967)', 'Dallas Stars (1993–present)']],
  ['DET', 'Detroit Red Wings', ['Detroit Cougars/Falcons (1926)', 'Detroit Red Wings (1932–present)']],
  ['EDM', 'Edmonton Oilers', ['Edmonton Oilers (1979–present)']],
  ['FLA', 'Florida Panthers', ['Florida Panthers (1993–present)']],
  ['LAK', 'Los Angeles Kings', ['Los Angeles Kings (1967–present)']],
  ['MIN', 'Minnesota Wild', ['Minnesota Wild (2000–present)']],
  ['MTL', 'Montreal Canadiens', ['Montreal Canadiens (1917–present)']],
  ['NSH', 'Nashville Predators', ['Nashville Predators (1998–present)']],
  ['NJD', 'New Jersey Devils', ['Kansas City Scouts (1974)', 'Colorado Rockies (1976)', 'New Jersey Devils (1982–present)']],
  ['NYI', 'New York Islanders', ['New York Islanders (1972–present)']],
  ['NYR', 'New York Rangers', ['New York Rangers (1926–present)']],
  ['OTT', 'Ottawa Senators', ['Ottawa Senators original (1917–1934)', 'Ottawa Senators (1992–present)'], ['SEN']],
  ['PHI', 'Philadelphia Flyers', ['Philadelphia Flyers (1967–present)']],
  ['PIT', 'Pittsburgh Penguins', ['Pittsburgh Penguins (1967–present)']],
  ['SJS', 'San Jose Sharks', ['San Jose Sharks (1991–present)']],
  ['SEA', 'Seattle Kraken', ['Seattle Kraken (2021–present)']],
  ['STL', 'St. Louis Blues', ['St. Louis Blues (1967–present)']],
  ['TBL', 'Tampa Bay Lightning', ['Tampa Bay Lightning (1992–present)']],
  ['TOR', 'Toronto Maple Leafs', ['Toronto Arenas/St. Pats (1917)', 'Toronto Maple Leafs (1927–present)']],
  ['UTA', 'Utah Mammoth', ['Winnipeg Jets original (1979)', 'Phoenix/Arizona Coyotes (1996)', 'Utah (2024–present)'], ['ARI', 'PHX', 'WIN']],
  ['VAN', 'Vancouver Canucks', ['Vancouver Canucks (1970–present)']],
  ['VGK', 'Vegas Golden Knights', ['Vegas Golden Knights (2017–present)']],
  ['WSH', 'Washington Capitals', ['Washington Capitals (1974–present)']],
  ['WPG', 'Winnipeg Jets', ['Atlanta Thrashers (1999)', 'Winnipeg Jets (2011–present)']],
];

const startYear = (seasonId) => Math.floor(seasonId / 10000);

async function fetchJSON(url, cacheKey) {
  const cf = cacheKey ? path.join(CACHE, cacheKey + '.json') : null;
  if (cf && fs.existsSync(cf)) {
    try { return JSON.parse(fs.readFileSync(cf, 'utf8')); } catch {}
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'eightytwo-oh-oh-etl/1.0' } });
      if (res.status === 404) { const v = { __404: true }; if (cf) fs.writeFileSync(cf, JSON.stringify(v)); return v; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      if (cf) fs.writeFileSync(cf, JSON.stringify(j));
      return j;
    } catch (e) {
      if (attempt === 3) { console.warn('  ! failed', url, e.message); return null; }
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); }
  }));
  return out;
}

const fullName = (p) => `${p.firstName?.default ?? p.firstName ?? ''} ${p.lastName?.default ?? p.lastName ?? ''}`.trim();

async function main() {
  console.log('Loading team/franchise table…');
  const teamTable = (await fetchJSON(`${REST}/team`, 'rest_team')).data;
  const byTri = new Map(teamTable.map((t) => [t.triCode, t]));
  const codesByFranchise = new Map();
  for (const t of teamTable) {
    if (!codesByFranchise.has(t.franchiseId)) codesByFranchise.set(t.franchiseId, []);
    codesByFranchise.get(t.franchiseId).push(t.triCode);
  }

  // Resolve each current franchise to the full set of historical team codes.
  const franchises = TEAMS.map(([id, name, history, extra = []]) => {
    const fid = byTri.get(id)?.franchiseId;
    const codes = new Set(fid != null ? codesByFranchise.get(fid) : [id]);
    for (const c of extra) codes.add(c);
    return { id, name, history, codes: [...codes] };
  });

  // 1) Pull every team-season club-stats for every code (cached).
  console.log('Pulling club-stats for all franchise seasons…');
  const teamSeasons = []; // {fid franchise idx, code, season}
  for (let fi = 0; fi < franchises.length; fi++) {
    for (const code of franchises[fi].codes) {
      const seasons = await fetchJSON(`${AWEB}/club-stats-season/${code}`, `seasons_${code}`);
      if (!Array.isArray(seasons)) continue;
      for (const s of seasons) if ((s.gameTypes || []).includes(2)) teamSeasons.push({ fi, code, season: s.season });
    }
  }
  console.log(`  ${teamSeasons.length} team-seasons`);

  // accumulators keyed by `${fi}|${decade}|${playerId}`
  const skAcc = new Map();
  const gAcc = new Map();
  const accSk = (k, init) => (skAcc.has(k) ? skAcc.get(k) : (skAcc.set(k, init), init));
  const accG = (k, init) => (gAcc.has(k) ? gAcc.get(k) : (gAcc.set(k, init), init));

  // Global career position set: tracks EVERY position code a player has been
  // registered at across ALL franchises and ALL seasons in the NHL database.
  // This is the most complete position history the official API can give us.
  const careerPos = new Map(); // playerId → Set<positionCode>

  let done = 0;
  await pool(teamSeasons, 8, async ({ fi, code, season }) => {
    const data = await fetchJSON(`${AWEB}/club-stats/${code}/${season}/2`, `cs_${code}_${season}`);
    if (++done % 200 === 0) console.log(`  …${done}/${teamSeasons.length}`);
    if (!data || data.__404) return;
    const era = eraOf(season);
    if (!era) return;  // pre-1942 — excluded
    for (const p of data.skaters || []) {
      const k = `${fi}|${era}|${p.playerId}`;
      const a = accSk(k, { id: p.playerId, n: fullName(p), pos: p.positionCode, gp: 0, g: 0, a: 0, sh: 0, pim: 0, shotsEras: 0 });
      a.gp += p.gamesPlayed || 0; a.g += p.goals || 0; a.a += p.assists || 0;
      a.pim += p.penaltyMinutes || 0;
      a.pos = p.positionCode || a.pos; a.n = fullName(p) || a.n;
      if (typeof p.shots === 'number') { a.sh += p.shots; a.shotsEras += p.gamesPlayed || 0; }
      // Record this position code in the player's global career set.
      if (p.positionCode) {
        if (!careerPos.has(p.playerId)) careerPos.set(p.playerId, new Set());
        careerPos.get(p.playerId).add(p.positionCode);
      }
    }
    for (const p of data.goalies || []) {
      const k = `${fi}|${era}|${p.playerId}`;
      const a = accG(k, { id: p.playerId, n: fullName(p), gp: 0, saves: 0, sa: 0, ga: 0, toi: 0, gaaGP: 0, gaaSum: 0 });
      a.gp += p.gamesPlayed || 0; a.ga += p.goalsAgainst || 0; a.toi += p.timeOnIce || 0;
      if (typeof p.shotsAgainst === 'number') { a.sa += p.shotsAgainst; a.saves += p.saves || 0; }
      if (typeof p.goalsAgainstAverage === 'number') { a.gaaSum += p.goalsAgainstAverage * (p.gamesPlayed || 0); a.gaaGP += p.gamesPlayed || 0; }
      a.n = fullName(p) || a.n;
    }
  });

  // 2) Pull realtime hits/blocks + shot hand for modern team-seasons.
  console.log('Pulling realtime hits/blocks (modern eras)…');
  const realtimeKeys = []; // {teamId, season}
  const seenRT = new Set();
  for (const { code, season } of teamSeasons) {
    if (season < MODERN_START) continue;
    const teamId = byTri.get(code)?.id;
    if (teamId == null) continue;
    const key = teamId + '_' + season;
    if (seenRT.has(key)) continue; seenRT.add(key);
    realtimeKeys.push({ teamId, season });
  }
  const hb = new Map();       // playerId|season -> {hits, blocks, gp}
  const handOf = new Map();   // playerId -> 'L'|'R'
  await pool(realtimeKeys, 6, async ({ teamId, season }) => {
    const url = `${REST}/skater/realtime?isAggregate=false&isGame=false&limit=-1&cayenneExp=seasonId=${season}%20and%20gameTypeId=2%20and%20teamId=${teamId}`;
    const j = await fetchJSON(url, `rt_${teamId}_${season}`);
    for (const p of j?.data || []) {
      hb.set(`${p.playerId}|${season}`, { hits: p.hits || 0, blocks: p.blockedShots || 0, gp: p.gamesPlayed || 0 });
      if (p.shootsCatches) handOf.set(p.playerId, p.shootsCatches);
    }
  });
  // attach realtime hits/blocks back onto skater accumulators
  for (const { fi, code, season } of teamSeasons) {
    if (season < MODERN_START) continue;
    const era = eraOf(season);
    if (!era) continue;
    const data = JSON.parse(fs.readFileSync(path.join(CACHE, `cs_${code}_${season}.json`), 'utf8'));
    for (const p of data.skaters || []) {
      const rt = hb.get(`${p.playerId}|${season}`);
      if (!rt) continue;
      const a = skAcc.get(`${fi}|${era}|${p.playerId}`);
      if (!a) continue;
      a.hits = (a.hits || 0) + rt.hits;
      a.blocks = (a.blocks || 0) + rt.blocks;
      a.rtGP = (a.rtGP || 0) + rt.gp;
    }
  }

  // 3) Approx games per season (for min-GP threshold).
  const gamesPerSeason = (yr) => (yr < 1946 ? 50 : yr < 1967 ? 70 : yr < 1974 ? 78 : yr < 1992 ? 80 : 82);
  const eraSeasons = {};  // era label -> Set of season IDs in that era
  for (const { season } of teamSeasons) {
    const era = eraOf(season);
    if (!era) continue;
    (eraSeasons[era] ??= new Set()).add(season);
  }

  // 4) Imputation tables from modern data: hits/blocks per game by (pos, ppgTier).
  const ppgTier = (ppg) => (ppg >= 0.75 ? 'hi' : ppg >= 0.4 ? 'mid' : 'lo');
  const hbSamples = {}; // `${pos}|${tier}` -> {h:[], b:[]}
  for (const a of skAcc.values()) {
    if (!a.rtGP || a.rtGP < 20) continue;
    const ppg = (a.g + a.a) / a.gp;
    const key = `${a.pos}|${ppgTier(ppg)}`;
    (hbSamples[key] ??= { h: [], b: [] });
    hbSamples[key].h.push(a.hits / a.rtGP);
    hbSamples[key].b.push(a.blocks / a.rtGP);
  }
  const median = (arr) => { if (!arr.length) return null; const s = [...arr].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const hbTable = {};
  for (const k of Object.keys(hbSamples)) hbTable[k] = { h: median(hbSamples[k].h), b: median(hbSamples[k].b) };
  const hbFallback = { h: median(Object.values(hbSamples).flatMap((s) => s.h)) ?? 1.2, b: median(Object.values(hbSamples).flatMap((s) => s.b)) ?? 0.8 };
  const imputeHB = (pos, ppg) => hbTable[`${pos}|${ppgTier(ppg)}`] || hbTable[`${pos}|mid`] || hbFallback;

  // 5) Assemble final per-franchise/era lists.
  console.log('Assembling final lists…');
  const out = { eras: ERAS, teams: [] };
  const handNeeded = new Set();

  // group accumulators by franchise+era (key format: "fi|era|playerId")
  const groupSk = new Map(); const groupG = new Map();
  for (const [k, a] of skAcc) {
    const pipe1 = k.indexOf('|'), pipe2 = k.indexOf('|', pipe1 + 1);
    const groupKey = k.slice(0, pipe2);  // "fi|era"
    (groupSk.get(groupKey) ?? groupSk.set(groupKey, []).get(groupKey)).push(a);
  }
  for (const [k, a] of gAcc) {
    const pipe1 = k.indexOf('|'), pipe2 = k.indexOf('|', pipe1 + 1);
    const groupKey = k.slice(0, pipe2);
    (groupG.get(groupKey) ?? groupG.set(groupKey, []).get(groupKey)).push(a);
  }

  for (let fi = 0; fi < franchises.length; fi++) {
    const fr = franchises[fi];
    const eraData = {};
    for (const era of ERAS) {
      const sk = groupSk.get(fi + '|' + era) || [];
      const go = groupG.get(fi + '|' + era) || [];
      if (!sk.length && !go.length) continue;
      // min GP: 3% of the total games played in this era.
      const eraGameCount = [...(eraSeasons[era] || [])].reduce((s, ss) => s + gamesPerSeason(startYear(ss)), 0);
      const minGames = Math.max(15, Math.round(eraGameCount * MIN_GP_FACTOR));

      const skaters = sk
        .filter((a) => a.gp >= minGames)
        .map((a) => {
          const ppg = (a.g + a.a) / a.gp;
          const realShots = a.shotsEras >= a.gp * 0.5;
          const spg = realShots ? a.sh / a.shotsEras : +(((a.g / a.gp) / 0.11)).toFixed(2);
          const hasHB = a.rtGP && a.rtGP >= a.gp * 0.5;
          const imp = hasHB ? null : imputeHB(a.pos, ppg);
          if (!handOf.has(a.id)) handNeeded.add(a.id);
          // Collect all position codes this player has been registered at
          // across their entire NHL career (all franchises, all seasons).
          // Sorted so the primary pos comes first.
          const careerSet = careerPos.get(a.id) || new Set([a.pos]);
          const positions = [a.pos, ...[...careerSet].filter(c => c !== a.pos)];
          return {
            id: a.id, n: a.n, pos: a.pos, positions, gp: a.gp,
            gpg: +(a.g / a.gp).toFixed(3), apg: +(a.a / a.gp).toFixed(3), ppg: +ppg.toFixed(3),
            spg: +spg, pimpg: +(a.pim / a.gp).toFixed(2),
            hpg: +(hasHB ? a.hits / a.rtGP : imp.h).toFixed(2),
            bpg: +(hasHB ? a.blocks / a.rtGP : imp.b).toFixed(2),
            imp: { shots: !realShots, hb: !hasHB },
          };
        })
        .sort((x, y) => y.ppg - x.ppg)
        .slice(0, TOP_SKATERS === Infinity ? undefined : TOP_SKATERS);

      // drop fluke cameos (e.g. a skater who played 1 game in net) so a 1.000
      // save% can't be exploited; fall back to all if none clear the bar.
      const goPool = go.filter((a) => a.gp >= 8).length ? go.filter((a) => a.gp >= 8) : go;
      const goalies = goPool
        .map((a) => {
          const realSV = a.sa > 0 && a.saves > 0;
          const gaa = a.gaaGP ? a.gaaSum / a.gaaGP : (a.ga / Math.max(1, a.gp));
          // impute save% from GAA (era ~28 shots/game), capped so old-era
          // goalies don't become artificially elite.
          const svpct = realSV ? a.saves / a.sa : Math.min(0.925, Math.max(0.86, 1 - gaa / 28));
          return {
            id: a.id, n: a.n, gp: a.gp,
            svpct: +svpct.toFixed(4), gaa: +gaa.toFixed(2), gapg: +(a.ga / Math.max(1, a.gp)).toFixed(2),
            imp: { svpct: !realSV },
          };
        })
        .sort((x, y) => y.gp - x.gp)
        .slice(0, TOP_GOALIES);

      if (skaters.length || goalies.length) eraData[era] = { skaters, goalies };
    }
    out.teams.push({ id: fr.id, name: fr.name, history: fr.history, eras: eraData });
    console.log(`  ${fr.id}: ${Object.keys(eraData).length} eras`);
  }

  // 6) Backfill hand, height, weight for all players in the assembled data.
  // Build height/weight maps from already-cached player pages first (free).
  const htOf = new Map(), wtOf = new Map();
  const CACHE_DIR = CACHE;
  for (const f of fs.readdirSync(CACHE_DIR).filter(f => f.startsWith('player_'))) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, f), 'utf8'));
      const pid = parseInt(f.replace('player_','').replace('.json',''), 10);
      if (j.heightInInches) htOf.set(pid, j.heightInInches);
      if (j.weightInPounds) wtOf.set(pid, j.weightInPounds);
      if (j.shootsCatches) handOf.set(pid, j.shootsCatches);
    } catch {}
  }

  // Collect ALL unique player IDs in the assembled data that are missing ht/wt,
  // then fetch their landing pages (cached responses are instant).
  const allIds = new Set();
  for (const t of out.teams) for (const e of Object.keys(t.eras)) {
    for (const s of t.eras[e].skaters) allIds.add(s.id);
    for (const g of t.eras[e].goalies) allIds.add(g.id);
  }
  const needArr = [...allIds].filter(pid => !htOf.has(pid));
  console.log(`Fetching landing pages for ${needArr.length} players missing ht/wt…`);
  await pool(needArr, 12, async (pid) => {
    const j = await fetchJSON(`${AWEB}/player/${pid}/landing`, `player_${pid}`);
    if (!j) return;
    if (j.shootsCatches) handOf.set(pid, j.shootsCatches);
    if (j.heightInInches) htOf.set(pid, j.heightInInches);
    if (j.weightInPounds) wtOf.set(pid, j.weightInPounds);
  });

  // Stamp hand, height, weight onto every skater and goalie.
  for (const t of out.teams) for (const era of Object.keys(t.eras)) {
    for (const s of t.eras[era].skaters) {
      s.hand = handOf.get(s.id) || 'L';
      if (htOf.has(s.id)) s.ht = htOf.get(s.id);
      if (wtOf.has(s.id)) s.wt = wtOf.get(s.id);
    }
    for (const g of t.eras[era].goalies) {
      if (htOf.has(g.id)) g.ht = htOf.get(g.id);
      if (wtOf.has(g.id)) g.wt = wtOf.get(g.id);
    }
  }

  // 6b) Star player flags: top 80 skaters by career-best PPG + top 10 goalies
  // by career-best SV% (min 50 GP). At least 20 must be active in 2026 (2020s era).
  // The `star` field is used silently in the sim (team synergy bonus) and is
  // deliberately not shown to the user in the UI.
  {
    const skBest = new Map(), gBest = new Map();
    for (const t of out.teams) for (const e of Object.keys(t.eras)) {
      for (const s of t.eras[e].skaters)
        if (!skBest.has(s.id) || s.ppg > skBest.get(s.id)) skBest.set(s.id, s.ppg);
      for (const g of t.eras[e].goalies)
        if (g.gp >= 50 && (!gBest.has(g.id) || g.svpct > gBest.get(g.id))) gBest.set(g.id, g.svpct);
    }
    const topSk = [...skBest.entries()].sort((a,b) => b[1]-a[1]).slice(0,200).map(([id]) => id);
    const topG  = [...gBest.entries()].sort((a,b) => b[1]-a[1]).slice(0,30).map(([id]) => id);
    const starIds = new Set([...topSk, ...topG]);

    // Ensure at least 20 active (2020s era) players are starred.
    const active2026 = new Set(out.teams.flatMap(t => (t.eras['2020s']?.skaters || []).map(s => s.id)));
    const activeStarCount = [...starIds].filter(id => active2026.has(id)).length;
    if (activeStarCount < 20) {
      const extra = out.teams.flatMap(t => t.eras['2020s']?.skaters || [])
        .filter(s => !starIds.has(s.id)).sort((a,b) => b.ppg-a.ppg)
        .slice(0, 20 - activeStarCount);
      for (const s of extra) starIds.add(s.id);
    }
    // Stamp onto every player entry.
    for (const t of out.teams) for (const e of Object.keys(t.eras)) {
      for (const s of t.eras[e].skaters) if (starIds.has(s.id)) s.star = true;
      for (const g of t.eras[e].goalies) if (starIds.has(g.id)) g.star = true;
    }
    console.log(`  ${starIds.size} star player IDs (${activeStarCount < 20 ? 20 : activeStarCount} active 2026)`);
  }

  // 7) Write data.js (global, works on file:// and GitHub Pages).
  const banner = `/* 82-0-0 data — generated by etl/build-data.mjs from official NHL APIs.\n` +
    ` * Skaters ranked by points/game (min ${Math.round(MIN_GP_FACTOR * 100)}% of era games); goalies by games played.\n` +
    ` * imp flags mark stats imputed for eras the NHL didn't track (shots pre-1959,\n` +
    ` * hits/blocks pre-2005, goalie save% pre-~1955). Do not edit by hand.\n */\n`;
  const js = banner + `(function(g){g.NHL_DATA=${JSON.stringify(out)};})(typeof window!=='undefined'?window:globalThis);\n`;
  const outPath = path.join(__dirname, '..', 'data.js');
  fs.writeFileSync(outPath, js);
  const totalPlayers = out.teams.reduce((s, t) => s + Object.values(t.eras).reduce((a, e) => a + e.skaters.length + e.goalies.length, 0), 0);
  console.log(`\nWrote ${outPath} — ${out.teams.length} teams, ${totalPlayers} player-entries, ${(js.length / 1024).toFixed(0)} KB`);
}

main().catch((e) => { console.error(e); process.exit(1); });
