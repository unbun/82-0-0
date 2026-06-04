/* Calibration harness: samples real lineups and reports sim output spread. */
import '../data.js';
import '../sim.js';
const D = globalThis.NHL_DATA, SIM = globalThis.NHL_SIM;

// flatten with team/decade context
const skaters = [], goalies = [];
for (const t of D.teams) for (const dec of Object.keys(t.eras)) {
  for (const s of t.eras[dec].skaters) skaters.push({ ...s, team: t.name, decade: dec });
  for (const g of t.eras[dec].goalies) goalies.push({ ...g, team: t.name, decade: dec });
}
const C = skaters.filter(s => s.pos === 'C');
const W = skaters.filter(s => s.pos === 'L' || s.pos === 'R');
const Dm = skaters.filter(s => s.pos === 'D');
const G = goalies.filter(g => g.gp >= 60);
const rnd = a => a[Math.floor(Math.random() * a.length)];
const dQ = p => 0.55 * (p.ppg || 0) + 0.16 * (p.bpg || 0);

function lineupFrom(c, lw, rw, ld, rd, g) {
  return [
    { ...c, slot: 'C' },
    { ...lw, slot: 'LW', slotSide: 'L', offside: SIM.offsidePenalty(lw.hand, 'L') },
    { ...rw, slot: 'RW', slotSide: 'R', offside: SIM.offsidePenalty(rw.hand, 'R') },
    { ...ld, slot: 'LD', slotSide: 'L', offside: SIM.offsidePenalty(ld.hand, 'L') },
    { ...rd, slot: 'RD', slotSide: 'R', offside: SIM.offsidePenalty(rd.hand, 'R') },
    { ...g, slot: 'G' },
  ];
}

// elite: best at each slot, handedness-correct to avoid penalty
const maxBy = (arr, f) => arr.reduce((m, x) => (f(x) > f(m) ? x : m));
const elite = lineupFrom(
  maxBy(C, s => s.ppg),
  maxBy(W.filter(s => s.hand === 'L'), s => s.ppg),
  maxBy(W.filter(s => s.hand === 'R'), s => s.ppg),
  maxBy(Dm.filter(s => s.hand === 'L'), dQ),
  maxBy(Dm.filter(s => s.hand === 'R'), dQ),
  maxBy(G, g => g.svpct),
);

function describe(label, lineup) {
  const e = SIM.expectedGoals(lineup);
  const r = SIM.simulateSeason(lineup);
  console.log(`${label.padEnd(16)} ${r.w}-${r.l}-${r.t}`.padEnd(34) +
    `pts ${String(r.points).padStart(3)}  ATK ${String(r.attack).padStart(3)} DEF ${String(r.defense).padStart(3)}  xGF ${r.xGF} xGA ${r.xGA}  (sOff ${e.sOff.toFixed(2)}, dDef ${e.dDef.toFixed(2)}, sv ${e.sv.toFixed(3)})`);
}

console.log('ELITE lineup:');
elite.forEach(p => console.log('  ', p.slot.padEnd(3), p.n, `(${p.team} ${p.decade})`, p.svpct ? `sv ${p.svpct}` : `ppg ${p.ppg}`, p.offside ? 'OFFSIDE' : ''));
describe('ELITE', elite);

console.log('\n2000 random lineups — points distribution:');
const hist = {}; let perfect = 0; const recs = [];
for (let i = 0; i < 2000; i++) {
  const lu = lineupFrom(rnd(C), rnd(W), rnd(W), rnd(Dm), rnd(Dm), rnd(G));
  const r = SIM.simulateSeason(lu);
  recs.push(r.points);
  const b = Math.floor(r.points / 20) * 20; hist[b] = (hist[b] || 0) + 1;
  if (r.w === 82 && r.l === 0 && r.t === 0) perfect++;
}
Object.keys(hist).sort((a, b) => a - b).forEach(k => console.log(`  ${k}-${+k + 19} pts: ${hist[k]}`));
recs.sort((a, b) => a - b);
console.log(`  min ${recs[0]}  median ${recs[1000]}  max ${recs[recs.length - 1]}  | perfect 82-0-0: ${perfect}/2000`);

console.log('\nDeterminism check (same elite lineup x3):',
  [0, 1, 2].map(() => { const r = SIM.simulateSeason(elite); return `${r.w}-${r.l}-${r.t}`; }).join('  '));
