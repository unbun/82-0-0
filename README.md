# 82-0-0 🏒

An NHL twist on the viral [82-0](https://www.82-0.com/) basketball game.

Roll a random **franchise + decade**, draft a legend into a locked roster slot, and
build a 6-player all-time lineup — **3 forwards, 2 defensemen, 1 goalie**. Each pick
fills its slot for good; you can't swap it without starting over. You get **one
reroll per game** if you hate your options. Then a simulation crunches your roster
into a **W-L-T** record over 82 games. Can you go **82-0-0** — 82 wins, 0 losses,
0 ties (old-school NHL ties included)?

- **From the NHL's creation (1917) to now (2026).**
- **Relocated/renamed franchises are folded into today's 32 teams.** The Quebec
  Nordiques live under the Colorado Avalanche; the Hartford Whalers under the
  Carolina Hurricanes; the original Winnipeg Jets / Phoenix / Arizona Coyotes
  under the Utah Mammoth; the Atlanta Thrashers under the current Winnipeg Jets;
  the Minnesota North Stars under the Dallas Stars; and so on.
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

| File         | What it does                                                            |
|--------------|-------------------------------------------------------------------------|
| `index.html` | Markup + script includes                                                |
| `styles.css` | Styling                                                                 |
| `data.js`    | The dataset: 32 current franchises → decades → curated legends          |
| `sim.js`     | The season simulation engine (deterministic — same roster → same record)|
| `game.js`    | Game loop / UI                                                          |

`sim.js` and `data.js` are written as UMD-style globals, so they also run under
Node for testing:

```bash
node -e 'require("./data.js");require("./sim.js");
const D=NHL_DATA,S=NHL_SIM,f=n=>{for(const t of D.teams)for(const d in t.eras)for(const p of t.eras[d])if(p.n===n)return p};
console.log(S.simulateSeason(["Wayne Gretzky","Mario Lemieux","Gordie Howe","Bobby Orr","Nicklas Lidstrom","Patrick Roy"].map(f)));'
```

## How the simulation works

Skaters and goalies are rated on **different axes**: a skater's rating is
offense/skill (it drives the goals you *score*); a goalie's rating is goaltending
(it drives the goals you *allow*). Defensemen help on both ends; forwards chip in a
little on defense.

Your six picks collapse into two team ratings (0–99):

```
attack  = 0.75·avgForward + 0.25·avgDefense
defense = 0.62·goalie + 0.26·avgDefense + 0.12·avgForward
```

Those map to expected goals per game (anchored on the dataset's real rating band,
so good drafting actually separates the field):

```
xGF = -7.31 + attack  × 0.1304     // attack 76 → 2.6 GF,  99 → 5.6 GF
xGA = 14.51 - defense × 0.1475     // defense 76 → 3.3 GA, 96 → 0.3 GA
```

Then 82 games are simulated. Each game draws `goalsFor ~ Poisson(xGF)` and
`goalsAgainst ~ Poisson(xGA)`; more goals = win, fewer = loss, equal = tie.

Two design consequences worth knowing:

- **Results are deterministic.** The random draws are seeded from your exact
  roster, so the same lineup always returns the same record — built for bragging.
- **82-0-0 is hard on purpose.** It needs an elite, balanced lineup (a true #1
  goalie included) *and* a bit of variance luck. Most great teams land in the high
  70s to low 80s in wins.

## A note on the data

`data.js` is **hand-curated and intentionally debatable** — arguing about the
ratings and which legend belongs to which decade is half the fun. Players are
bucketed into the decade they're most associated with for a given franchise, and
ratings (75–99) are a subjective all-time tier, not a real metric. The original
(1917–1934) Ottawa Senators are folded into the modern Senators in the spirit of
"creation to now." Corrections and additions welcome via PR.

## Deploy

### GitHub Pages
1. Push this folder to a GitHub repo.
2. Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
3. Pick your branch (e.g. `main`) and `/ (root)`. Save.
4. Your site goes live at `https://<you>.github.io/<repo>/`.

(The included `.nojekyll` file tells Pages to serve the files as-is.)

### Vercel (free tier)
1. Import the repo at [vercel.com/new](https://vercel.com/new).
2. Framework preset: **Other**. Build command: none. Output dir: `./`.
3. Deploy. (Or run `npx vercel` from this folder.)

## License

MIT — see [LICENSE](LICENSE).
