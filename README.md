# 82-0-0 🏒

An NHL twist on the viral [82-0](https://www.82-0.com/) basketball game.

Roll two things — a **franchise** and a **decade** — then draft from a scrollable
list of that team-decade's real players (skaters ranked by points/game, goalies by
games played), each shown with their actual per-game stats. Fill the real hockey
six — **C, LW, RW, LD, RD, G** — one locked slot at a time; you can't swap a slot
without starting over. You get **one reroll per roster**, of either the franchise
or the decade. Then a stats-based simulation crunches your lineup into a **W-L-T**
record over 82 games. Can you go **82-0-0** — 82 wins, 0 losses, 0 ties?

- **Every stat is real**, pulled once from the NHL's official API, from the
  league's creation (1917) to today.
- **Relocated/renamed franchises are folded into today's 32 teams.** The Quebec
  Nordiques live under the Colorado Avalanche; the Hartford Whalers under the
  Carolina Hurricanes; the original Winnipeg Jets / Phoenix / Arizona Coyotes
  under the Utah Mammoth; the Atlanta Thrashers under the current Winnipeg Jets;
  the Minnesota North Stars under the Dallas Stars; and the original (1917–1934)
  Ottawa Senators under the modern Senators.
- **Wrong-handed = penalized.** Wings and defense have a left/right side; playing a
  skater on their off-side (their shot hand doesn't match) discounts them ~18%.
- **No build step, no dependencies.** Pure HTML/CSS/JS — works on GitHub Pages or Vercel.

## Play locally

Because the page is plain static files, just open it — or serve it (recommended, so
everything behaves like production):

```bash
# any of these from the project folder:
python3 -m http.server 8000      # then open http://localhost:8000
# or
npx serve .
```

## Project layout

| File                  | What it does                                                              |
|-----------------------|--------------------------------------------------------------------------|
| `index.html`          | Markup + script includes                                                 |
| `styles.css`          | Styling                                                                  |
| `data.js`             | **Generated** dataset: 32 franchises → decades → real players + stats     |
| `sim.js`              | Stats-based season simulation (deterministic — same roster → same record) |
| `game.js`             | Game loop / UI                                                           |
| `etl/build-data.mjs`  | One-time pull from the NHL API that generates `data.js`                   |
| `etl/calibrate.mjs`   | Samples real lineups to sanity-check / tune the sim                       |

`data.js` is a committed build artifact, so the site needs no server or build
step. To regenerate it from scratch:

```bash
node etl/build-data.mjs      # pulls the NHL API (cached in etl/cache/), writes data.js
node etl/calibrate.mjs       # prints the sim spread for an elite vs. random lineups
```

## Where the data comes from

Everything is pulled **once** from the league's official, public APIs — no scraping,
no hand-entered ratings:

- `api-web.nhle.com/v1/club-stats/{team}/{season}/2` — per-team-season skater &
  goalie box scores, back to 1917–18.
- `api.nhle.com/stats/rest/en/team` — maps each historical team code to a stable
  `franchiseId`, which is how relocations get folded into today's clubs (plus two
  manual merges the NHL counts separately: Coyotes-lineage → Utah, original
  Senators → modern Ottawa).
- `api.nhle.com/stats/rest/en/skater/realtime` — hits, blocks, and shot handedness
  for the modern era.

For each franchise/decade we keep the **top ~30 skaters by points/game** (with a
minimum games-played threshold) and the **3–5 goalies with the most games**. Stats
the NHL didn't track in a given era are **imputed by tier** so old decades aren't
unfairly favored or penalized, and every imputed value is flagged with a `~`:

- shots/game before 1959–60 (estimated from goals and era shooting %),
- hits/blocks before 2005–06 (league medians by position and scoring tier),
- goalie save % before ~1955 (derived from goals-against average).

## How the simulation works

Every input is a real per-game stat. Your lineup maps to expected goals per game:

```
scoring = Σ over your 5 skaters of (goals/game + ½·assists/game)
xGF     = -0.10 + 1.0 · scoring                 # goals you score

defense = (goalie save% - .86)·22 + D-pair quality
xGA     = 4.73 - 1.20 · defense                 # goals you allow
```

A skater on their off-side (shot hand ≠ slot side) is discounted ~18%. Then 82
games are simulated, each drawing `goalsFor ~ Poisson(xGF)` and
`goalsAgainst ~ Poisson(xGA)` — more goals win, fewer lose, equal ties.

Two things worth knowing:

- **Deterministic.** The Poisson draws are seeded from your exact roster, so the
  same lineup *always* returns the same record — built for bragging.
- **82-0-0 is hard on purpose.** The mapping is anchored so the best attainable
  roster can reach it, but it needs elite scoring *and* a genuine high-save% goalie
  (the run-and-gun '80s Oilers, with Fuhr's real .882 save %, famously leak goals).

## License

MIT — see [LICENSE](LICENSE).
