/* 82-0-0 — NHL all-time roster builder data
 *
 * Each team is a CURRENT (2025-26) franchise. Relocated/renamed franchises are
 * folded into the present-day club, so e.g. the Quebec Nordiques live under the
 * Colorado Avalanche and the original/Phoenix/Arizona Coyotes live under Utah.
 *
 * Player shape: { n: name, p: position, o: overall, h: shot hand }
 *   p (strict slotting position): 'C' center | 'W' winger | 'D' defense | 'G' goalie
 *   h (shot hand, used for wing/defense side): 'L' left | 'R' right | 'B' both
 *       - Convention: left shot is the natural LEFT side, right shot the natural
 *         RIGHT side. Playing a skater on their off-side costs a heavy penalty in
 *         the sim (see sim.js). 'B' players (e.g. Gordie Howe) play either side
 *         with no penalty. Centers and goalies don't carry a hand (side is N/A).
 *   o (overall): a curated, subjective all-time tier (peak with THAT franchise),
 *         roughly 96-99 inner-circle, 88-95 Hall of Fame, 82-88 star, 75-82 good.
 *
 * Positions and handedness are hand-curated from memory and WILL contain some
 * errors — they're exactly the sort of thing that's easy to crowd-correct, so
 * PRs are welcome. Players are bucketed into the decade they're most associated
 * with for that franchise; a few greats appear under more than one team/decade.
 * The original (1917-1934) Ottawa Senators are folded into the modern Senators.
 */
(function (g) {
  const T = (id, name, history, eras) => ({ id, name, history, eras });
  const C = (n, o) => ({ n, p: 'C', o });
  const W = (n, o, h) => ({ n, p: 'W', o, h });
  const D = (n, o, h) => ({ n, p: 'D', o, h });
  const G = (n, o) => ({ n, p: 'G', o });

  g.NHL_DATA = {
    decades: ['1910s','1920s','1930s','1940s','1950s','1960s','1970s','1980s','1990s','2000s','2010s','2020s'],
    teams: [
      T('MTL', 'Montreal Canadiens', ['Montreal Canadiens (1917–present)'], {
        '1910s': [C('Newsy Lalonde',90), G('Georges Vezina',91), W('Didier Pitre',83,'R')],
        '1920s': [C('Howie Morenz',95), W('Aurèle Joliat',89,'L'), G('Georges Vezina',91), D('Sylvio Mantha',82,'R')],
        '1930s': [C('Howie Morenz',94), W('Aurèle Joliat',88,'L'), W('Toe Blake',86,'L'), G('George Hainsworth',87)],
        '1940s': [W('Maurice Richard',96,'L'), C('Elmer Lach',88), W('Toe Blake',85,'L'), G('Bill Durnan',89), D('Butch Bouchard',85,'R')],
        '1950s': [W('Maurice Richard',95,'L'), C('Jean Beliveau',95), W('Bernie Geoffrion',89,'R'), D('Doug Harvey',94,'L'), G('Jacques Plante',93), W('Dickie Moore',87,'L'), C('Henri Richard',87)],
        '1960s': [C('Jean Beliveau',94), C('Henri Richard',88), G('Jacques Plante',92), D('Jacques Laperriere',86,'L'), W('Yvan Cournoyer',87,'L'), G('Gump Worsley',85)],
        '1970s': [W('Guy Lafleur',96,'R'), G('Ken Dryden',93), D('Larry Robinson',92,'L'), D('Serge Savard',87,'L'), D('Guy Lapointe',87,'L'), W('Steve Shutt',87,'L'), C('Jacques Lemaire',86), W('Yvan Cournoyer',86,'L')],
        '1980s': [W('Guy Lafleur',90,'R'), D('Larry Robinson',90,'L'), W('Bob Gainey',84,'L'), G('Patrick Roy',92), D('Chris Chelios',89,'R'), W('Mats Naslund',84,'L')],
        '1990s': [G('Patrick Roy',96), C('Vincent Damphousse',85), C('Kirk Muller',83), C('Saku Koivu',83)],
        '2000s': [C('Saku Koivu',84), D('Andrei Markov',86,'L'), W('Alex Kovalev',86,'R'), G('Jose Theodore',85)],
        '2010s': [G('Carey Price',93), D('P.K. Subban',90,'R'), W('Max Pacioretty',85,'L'), D('Shea Weber',88,'R'), W('Brendan Gallagher',83,'R')],
        '2020s': [W('Cole Caufield',86,'R'), C('Nick Suzuki',86), G('Carey Price',88), D('Lane Hutson',84,'L')],
      }),
      T('TOR', 'Toronto Maple Leafs', ['Toronto Arenas (1917)','Toronto St. Patricks (1919)','Toronto Maple Leafs (1927–present)'], {
        '1910s': [C('Reg Noble',82), D('Harry Cameron',80,'R')],
        '1920s': [W('Babe Dye',86,'R'), D('Hap Day',82,'L')],
        '1930s': [W('Charlie Conacher',90,'R'), C('Joe Primeau',86), W('Busher Jackson',87,'L'), D('King Clancy',88,'L'), D('Red Horner',80,'R')],
        '1940s': [C('Syl Apps',90), G('Turk Broda',88), C('Ted Kennedy',88)],
        '1950s': [C('Ted Kennedy',87), C('Tod Sloan',82), G('Harry Lumley',85)],
        '1960s': [W('Frank Mahovlich',92,'L'), C('Dave Keon',90), G('Johnny Bower',89), D('Tim Horton',89,'R'), D('Red Kelly',88,'L'), W('George Armstrong',85,'R'), D('Allan Stanley',83,'L')],
        '1970s': [C('Darryl Sittler',91), W('Lanny McDonald',88,'R'), D('Borje Salming',90,'L'), C('Dave Keon',86)],
        '1980s': [W('Rick Vaive',84,'R'), D('Borje Salming',87,'L'), W('Wendel Clark',85,'L')],
        '1990s': [C('Doug Gilmour',91), C('Mats Sundin',91), W('Wendel Clark',84,'L'), G('Felix Potvin',84), W('Dave Andreychuk',85,'L')],
        '2000s': [C('Mats Sundin',90), D('Tomas Kaberle',84,'L'), G('Curtis Joseph',87), D('Bryan McCabe',82,'L')],
        '2010s': [C('Auston Matthews',92), W('Mitch Marner',89,'R'), W('Phil Kessel',86,'R'), D('Morgan Rielly',85,'L'), G('Frederik Andersen',85), W('William Nylander',87,'R')],
        '2020s': [C('Auston Matthews',95), W('Mitch Marner',90,'R'), W('William Nylander',89,'R'), D('Morgan Rielly',85,'L'), C('John Tavares',86)],
      }),
      T('BOS', 'Boston Bruins', ['Boston Bruins (1924–present)'], {
        '1920s': [D('Eddie Shore',93,'L'), G('Tiny Thompson',86), D('Dit Clapper',86,'R')],
        '1930s': [D('Eddie Shore',94,'L'), G('Tiny Thompson',87), D('Dit Clapper',87,'R'), C('Cooney Weiland',83)],
        '1940s': [C('Milt Schmidt',89), C('Bill Cowley',86), G('Frank Brimsek',88), W('Bobby Bauer',82,'R'), W('Woody Dumart',81,'L')],
        '1950s': [C('Milt Schmidt',86), C('Fleming Mackell',80)],
        '1960s': [D('Bobby Orr',97,'L'), C('Phil Esposito',93), W('Johnny Bucyk',88,'L'), G('Gerry Cheevers',86), W('Ken Hodge',84,'R')],
        '1970s': [D('Bobby Orr',99,'L'), C('Phil Esposito',94), W('Johnny Bucyk',87,'L'), D('Brad Park',89,'L'), G('Gerry Cheevers',86), W('Wayne Cashman',82,'L')],
        '1980s': [D('Ray Bourque',95,'L'), W('Rick Middleton',86,'R'), W('Cam Neely',89,'R'), G('Pete Peeters',83)],
        '1990s': [D('Ray Bourque',95,'L'), W('Cam Neely',88,'R'), C('Adam Oates',89), G('Andy Moog',84)],
        '2000s': [C('Joe Thornton',88), D('Zdeno Chara',91,'L'), C('Patrice Bergeron',88), G('Tim Thomas',88), C('Marc Savard',84)],
        '2010s': [C('Patrice Bergeron',92), D('Zdeno Chara',90,'L'), W('Brad Marchand',88,'L'), W('David Pastrnak',89,'R'), G('Tuukka Rask',88), C('David Krejci',85)],
        '2020s': [W('David Pastrnak',93,'R'), W('Brad Marchand',87,'L'), D('Charlie McAvoy',88,'R'), G('Jeremy Swayman',86)],
      }),
      T('NYR', 'New York Rangers', ['New York Rangers (1926–present)'], {
        '1920s': [W('Bill Cook',88,'R'), C('Frank Boucher',87), W('Bun Cook',82,'L'), D('Ching Johnson',83,'R')],
        '1930s': [W('Bill Cook',88,'R'), C('Frank Boucher',87), D('Ching Johnson',83,'R'), G('Dave Kerr',83)],
        '1940s': [W('Bryan Hextall',85,'R'), W('Lynn Patrick',82,'L'), G('Chuck Rayner',83)],
        '1950s': [W('Andy Bathgate',88,'R'), G('Gump Worsley',85), D('Harry Howell',84,'L')],
        '1960s': [W('Rod Gilbert',88,'R'), C('Jean Ratelle',88), D('Harry Howell',85,'L'), D('Brad Park',88,'L'), G('Ed Giacomin',87), W('Vic Hadfield',83,'L')],
        '1970s': [W('Rod Gilbert',87,'R'), C('Jean Ratelle',87), D('Brad Park',89,'L'), G('Ed Giacomin',86)],
        '1980s': [G('John Vanbiesbrouck',85), D('Reijo Ruotsalainen',80,'R'), W('Don Maloney',80,'L')],
        '1990s': [C('Mark Messier',93), D('Brian Leetch',92,'L'), G('Mike Richter',88), W('Adam Graves',85,'L'), D('Sergei Zubov',85,'R'), C('Wayne Gretzky',94)],
        '2000s': [W('Jaromir Jagr',92,'L'), G('Henrik Lundqvist',90), D('Brian Leetch',86,'L')],
        '2010s': [G('Henrik Lundqvist',92), D('Ryan McDonagh',85,'L'), W('Rick Nash',85,'L'), W('Chris Kreider',84,'L'), W('Mats Zuccarello',82,'R')],
        '2020s': [W('Artemi Panarin',92,'L'), G('Igor Shesterkin',92), D('Adam Fox',90,'R'), C('Mika Zibanejad',87), W('Chris Kreider',85,'L')],
      }),
      T('CHI', 'Chicago Blackhawks', ['Chicago Black Hawks (1926)','Chicago Blackhawks (1986–present)'], {
        '1920s': [C('Dick Irvin',82)],
        '1930s': [G('Charlie Gardiner',87), W('Paul Thompson',80,'L'), C('Doc Romnes',78)],
        '1940s': [C('Max Bentley',88), W('Doug Bentley',86,'L'), W('Bill Mosienko',84,'R')],
        '1950s': [W('Bill Mosienko',82,'R')],
        '1960s': [W('Bobby Hull',95,'L'), C('Stan Mikita',93), G('Glenn Hall',91), D('Pierre Pilote',87,'L'), W('Ken Wharram',82,'R')],
        '1970s': [W('Bobby Hull',92,'L'), C('Stan Mikita',90), G('Tony Esposito',90), C('Pit Martin',80)],
        '1980s': [C('Denis Savard',90), D('Doug Wilson',87,'L'), W('Steve Larmer',85,'R'), W('Al Secord',80,'L')],
        '1990s': [D('Chris Chelios',91,'R'), C('Jeremy Roenick',88), G('Ed Belfour',89), W('Steve Larmer',84,'R'), W('Tony Amonte',84,'R')],
        '2000s': [W('Patrick Kane',88,'L'), C('Jonathan Toews',88), D('Duncan Keith',88,'L'), W('Patrick Sharp',84,'R')],
        '2010s': [W('Patrick Kane',94,'L'), C('Jonathan Toews',90), D('Duncan Keith',90,'L'), W('Marian Hossa',88,'L'), D('Brent Seabrook',84,'R'), G('Corey Crawford',86)],
        '2020s': [C('Connor Bedard',89), D('Seth Jones',83,'R')],
      }),
      T('DET', 'Detroit Red Wings', ['Detroit Cougars (1926)','Detroit Falcons (1930)','Detroit Red Wings (1932–present)'], {
        '1920s': [W('Larry Aurie',80,'R')],
        '1930s': [W('Larry Aurie',82,'R'), D('Ebbie Goodfellow',84,'R'), G('Normie Smith',80)],
        '1940s': [C('Sid Abel',86), W('Sid Howe',80,'L'), D('Black Jack Stewart',82,'R')],
        '1950s': [W('Gordie Howe',97,'B'), W('Ted Lindsay',90,'L'), G('Terry Sawchuk',92), D('Red Kelly',88,'L'), C('Alex Delvecchio',87), D('Marcel Pronovost',83,'L')],
        '1960s': [W('Gordie Howe',95,'B'), C('Alex Delvecchio',86), C('Norm Ullman',86), G('Roger Crozier',82)],
        '1970s': [C('Marcel Dionne',88), W('Mickey Redmond',82,'R')],
        '1980s': [C('Steve Yzerman',90), W('John Ogrodnick',82,'L')],
        '1990s': [C('Steve Yzerman',94), C('Sergei Fedorov',92), D('Nicklas Lidstrom',93,'L'), W('Brendan Shanahan',88,'L'), G('Chris Osgood',84), D('Vladimir Konstantinov',85,'R'), C('Igor Larionov',85)],
        '2000s': [D('Nicklas Lidstrom',95,'L'), C('Pavel Datsyuk',92), W('Henrik Zetterberg',89,'L'), C('Steve Yzerman',88), G('Dominik Hasek',90), W('Brendan Shanahan',86,'L'), D('Chris Chelios',84,'R')],
        '2010s': [C('Pavel Datsyuk',90), W('Henrik Zetterberg',88,'L'), D('Niklas Kronwall',82,'L')],
        '2020s': [C('Dylan Larkin',86), D('Moritz Seider',85,'R'), W('Lucas Raymond',85,'L')],
      }),
      T('BUF', 'Buffalo Sabres', ['Buffalo Sabres (1970–present)'], {
        '1970s': [C('Gilbert Perreault',91), W('Rick Martin',86,'L'), W('Rene Robert',82,'R'), D('Tim Horton',82,'R'), W('Danny Gare',81,'R')],
        '1980s': [C('Gilbert Perreault',87), G('Tom Barrasso',85), W('Dave Andreychuk',84,'L'), D('Phil Housley',86,'L'), W('Mike Foligno',80,'R')],
        '1990s': [G('Dominik Hasek',95), C('Pat LaFontaine',90), W('Alexander Mogilny',89,'L'), C('Dale Hawerchuk',86), C('Michael Peca',82)],
        '2000s': [C('Daniel Briere',85), C('Chris Drury',84), G('Ryan Miller',87), W('Thomas Vanek',84,'R')],
        '2010s': [C('Jack Eichel',86), C('Ryan O\'Reilly',84), D('Rasmus Ristolainen',78,'R')],
        '2020s': [D('Rasmus Dahlin',88,'L'), C('Tage Thompson',86), W('Alex Tuch',83,'R')],
      }),
      T('CGY', 'Calgary Flames', ['Atlanta Flames (1972)','Calgary Flames (1980–present)'], {
        '1970s': [C('Tom Lysiak',82), W('Eric Vail',80,'L'), G('Dan Bouchard',80)],
        '1980s': [W('Lanny McDonald',86,'R'), D('Al MacInnis',90,'R'), W('Joe Mullen',86,'R'), G('Mike Vernon',85), C('Doug Gilmour',86), W('Hakan Loob',84,'R'), C('Joe Nieuwendyk',86), D('Gary Suter',84,'L')],
        '1990s': [W('Theoren Fleury',89,'R'), D('Al MacInnis',88,'R'), C('Joe Nieuwendyk',85), W('Gary Roberts',83,'L')],
        '2000s': [W('Jarome Iginla',91,'R'), G('Miikka Kiprusoff',88), D('Robyn Regehr',80,'L')],
        '2010s': [W('Johnny Gaudreau',88,'L'), C('Sean Monahan',83), D('Mark Giordano',85,'L'), C('Mikael Backlund',80)],
        '2020s': [C('Nazem Kadri',84), W('Jonathan Huberdeau',84,'L'), D('Rasmus Andersson',82,'R')],
      }),
      T('CAR', 'Carolina Hurricanes', ['Hartford Whalers (1979)','Carolina Hurricanes (1997–present)'], {
        '1970s': [W('Gordie Howe',80,'B'), C('Dave Keon',78)],
        '1980s': [C('Ron Francis',88), W('Kevin Dineen',82,'R'), G('Mike Liut',84), D('Ulf Samuelsson',80,'L')],
        '1990s': [W('Geoff Sanderson',82,'L'), D('Chris Pronger',84,'L'), G('Sean Burke',82), C('Keith Primeau',83)],
        '2000s': [C('Eric Staal',88), C('Rod Brind\'Amour',86), C('Ron Francis',85), G('Cam Ward',85), W('Justin Williams',82,'R')],
        '2010s': [W('Jeff Skinner',83,'L'), C('Jordan Staal',82), C('Sebastian Aho',85)],
        '2020s': [C('Sebastian Aho',87), W('Andrei Svechnikov',84,'L'), G('Frederik Andersen',85), D('Jaccob Slavin',85,'L')],
      }),
      T('COL', 'Colorado Avalanche', ['Quebec Nordiques (1979)','Colorado Avalanche (1995–present)'], {
        '1980s': [C('Peter Stastny',91), W('Anton Stastny',82,'L'), W('Michel Goulet',88,'L'), C('Dale Hunter',82)],
        '1990s': [C('Joe Sakic',94), C('Peter Forsberg',92), G('Patrick Roy',95), D('Adam Foote',84,'R'), W('Claude Lemieux',83,'R'), W('Valeri Kamensky',83,'L')],
        '2000s': [C('Joe Sakic',92), C('Peter Forsberg',91), G('Patrick Roy',93), D('Rob Blake',88,'R'), W('Milan Hejduk',84,'R'), D('Adam Foote',83,'R')],
        '2010s': [C('Nathan MacKinnon',88), W('Gabriel Landeskog',85,'L'), C('Matt Duchene',83), D('Erik Johnson',80,'R'), G('Semyon Varlamov',84)],
        '2020s': [C('Nathan MacKinnon',96), D('Cale Makar',94,'R'), W('Mikko Rantanen',90,'R'), W('Gabriel Landeskog',85,'L'), D('Devon Toews',86,'L')],
      }),
      T('CBJ', 'Columbus Blue Jackets', ['Columbus Blue Jackets (2000–present)'], {
        '2000s': [W('Rick Nash',87,'L'), D('Rostislav Klesla',76,'L'), G('Pascal Leclaire',78)],
        '2010s': [G('Sergei Bobrovsky',88), C('Ryan Johansen',82), D('Seth Jones',84,'R'), W('Cam Atkinson',82,'R'), W('Artemi Panarin',88,'L'), D('Zach Werenski',84,'L')],
        '2020s': [D('Zach Werenski',88,'L'), W('Johnny Gaudreau',85,'L'), C('Boone Jenner',80), C('Adam Fantilli',83)],
      }),
      T('DAL', 'Dallas Stars', ['Minnesota North Stars (1967)','Dallas Stars (1993–present)'], {
        '1960s': [W('Bill Goldsworthy',80,'R'), G('Cesare Maniago',78)],
        '1970s': [W('Bill Goldsworthy',82,'R'), C('Dennis Hextall',78)],
        '1980s': [W('Dino Ciccarelli',86,'R'), C('Neal Broten',85), C('Bobby Smith',84), W('Brian Bellows',83,'L')],
        '1990s': [C('Mike Modano',90), W('Brett Hull',90,'R'), G('Ed Belfour',90), C('Joe Nieuwendyk',86), D('Sergei Zubov',87,'R'), D('Derian Hatcher',82,'L'), W('Jere Lehtinen',82,'R')],
        '2000s': [C('Mike Modano',88), G('Marty Turco',85), D('Sergei Zubov',85,'R'), W('Brenden Morrow',82,'L')],
        '2010s': [W('Jamie Benn',87,'L'), C('Tyler Seguin',86), D('John Klingberg',83,'R'), G('Ben Bishop',84)],
        '2020s': [W('Jason Robertson',87,'L'), D('Miro Heiskanen',88,'L'), C('Roope Hintz',84), G('Jake Oettinger',86)],
      }),
      T('EDM', 'Edmonton Oilers', ['Edmonton Oilers (1979–present)'], {
        '1980s': [C('Wayne Gretzky',99), C('Mark Messier',92), W('Jari Kurri',90,'R'), D('Paul Coffey',93,'L'), G('Grant Fuhr',89), W('Glenn Anderson',85,'R'), D('Kevin Lowe',82,'L'), W('Esa Tikkanen',80,'L')],
        '1990s': [C('Mark Messier',88), G('Bill Ranford',84), C('Doug Weight',85), G('Curtis Joseph',86), W('Ryan Smyth',82,'L')],
        '2000s': [W('Ryan Smyth',84,'L'), W('Ales Hemsky',82,'R'), C('Shawn Horcoff',78)],
        '2010s': [C('Connor McDavid',95), C('Leon Draisaitl',90), W('Taylor Hall',84,'L'), W('Jordan Eberle',82,'R'), C('Ryan Nugent-Hopkins',83)],
        '2020s': [C('Connor McDavid',99), C('Leon Draisaitl',95), C('Ryan Nugent-Hopkins',84), D('Evan Bouchard',86,'R'), G('Stuart Skinner',82)],
      }),
      T('FLA', 'Florida Panthers', ['Florida Panthers (1993–present)'], {
        '1990s': [W('Pavel Bure',90,'R'), G('John Vanbiesbrouck',86), W('Scott Mellanby',80,'R'), D('Robert Svehla',78,'R')],
        '2000s': [C('Olli Jokinen',83), G('Roberto Luongo',89), D('Jay Bouwmeester',82,'L'), W('Pavel Bure',88,'R')],
        '2010s': [C('Aleksander Barkov',87), W('Jonathan Huberdeau',85,'L'), D('Aaron Ekblad',84,'R'), G('Roberto Luongo',86)],
        '2020s': [C('Aleksander Barkov',92), W('Matthew Tkachuk',90,'L'), G('Sergei Bobrovsky',88), C('Sam Reinhart',86), D('Aaron Ekblad',85,'R'), C('Sam Bennett',84)],
      }),
      T('LAK', 'Los Angeles Kings', ['Los Angeles Kings (1967–present)'], {
        '1960s': [W('Real Lemieux',75,'L'), G('Terry Sawchuk',80)],
        '1970s': [C('Marcel Dionne',92), G('Rogie Vachon',86), C('Butch Goring',82), W('Bob Berry',78,'L')],
        '1980s': [C('Marcel Dionne',90), C('Bernie Nicholls',86), W('Dave Taylor',84,'R'), W('Luc Robitaille',88,'L')],
        '1990s': [C('Wayne Gretzky',96), W('Luc Robitaille',88,'L'), D('Rob Blake',88,'R'), W('Jari Kurri',84,'R'), W('Tony Granato',80,'R')],
        '2000s': [W('Luc Robitaille',84,'L'), D('Lubomir Visnovsky',82,'L'), C('Anze Kopitar',85), W('Dustin Brown',82,'R')],
        '2010s': [C('Anze Kopitar',90), D('Drew Doughty',90,'R'), G('Jonathan Quick',88), W('Dustin Brown',83,'R'), C('Jeff Carter',84), W('Marian Gaborik',84,'R')],
        '2020s': [C('Anze Kopitar',87), D('Drew Doughty',84,'R'), C('Adrian Kempe',84), C('Quinton Byfield',82)],
      }),
      T('MIN', 'Minnesota Wild', ['Minnesota Wild (2000–present)'], {
        '2000s': [W('Marian Gaborik',88,'R'), C('Brian Rolston',82), G('Niklas Backstrom',84), C('Mikko Koivu',82)],
        '2010s': [W('Zach Parise',85,'L'), D('Ryan Suter',85,'L'), C('Mikko Koivu',83), G('Devan Dubnyk',83), C('Mikael Granlund',80)],
        '2020s': [W('Kirill Kaprizov',91,'L'), C('Joel Eriksson Ek',84), D('Jared Spurgeon',83,'R'), W('Matt Boldy',84,'L')],
      }),
      T('NSH', 'Nashville Predators', ['Nashville Predators (1998–present)'], {
        '2000s': [W('Paul Kariya',85,'L'), D('Kimmo Timonen',83,'L'), G('Tomas Vokoun',84), C('Jason Arnott',83), C('David Legwand',80)],
        '2010s': [D('Shea Weber',90,'R'), G('Pekka Rinne',89), D('Roman Josi',88,'L'), W('Filip Forsberg',86,'L'), D('Ryan Suter',85,'L')],
        '2020s': [D('Roman Josi',90,'L'), W('Filip Forsberg',87,'L'), G('Juuse Saros',88), C('Ryan O\'Reilly',82)],
      }),
      T('NJD', 'New Jersey Devils', ['Kansas City Scouts (1974)','Colorado Rockies (1976)','New Jersey Devils (1982–present)'], {
        '1970s': [W('Wilf Paiement',80,'R'), W('Simon Nolet',76,'R')],
        '1980s': [C('Kirk Muller',84), W('Pat Verbeek',82,'R'), W('John MacLean',82,'R'), D('Ken Daneyko',78,'L')],
        '1990s': [G('Martin Brodeur',93), D('Scott Stevens',90,'L'), D('Scott Niedermayer',88,'L'), W('Claude Lemieux',83,'R'), C('Bobby Holik',82), W('John MacLean',82,'R')],
        '2000s': [G('Martin Brodeur',95), W('Patrik Elias',88,'L'), D('Scott Stevens',88,'L'), D('Scott Niedermayer',87,'L'), W('Zach Parise',85,'L'), D('Brian Rafalski',84,'R')],
        '2010s': [W('Ilya Kovalchuk',88,'R'), W('Patrik Elias',84,'L'), G('Cory Schneider',84), W('Taylor Hall',86,'L')],
        '2020s': [C('Jack Hughes',90), C('Nico Hischier',87), W('Jesper Bratt',85,'L'), D('Dougie Hamilton',85,'R')],
      }),
      T('NYI', 'New York Islanders', ['New York Islanders (1972–present)'], {
        '1970s': [D('Denis Potvin',92,'L'), C('Bryan Trottier',90), W('Mike Bossy',92,'R'), W('Clark Gillies',84,'L'), G('Billy Smith',86), W('Bob Nystrom',80,'R')],
        '1980s': [W('Mike Bossy',92,'R'), C('Bryan Trottier',90), D('Denis Potvin',91,'L'), G('Billy Smith',86), W('Clark Gillies',82,'L'), W('John Tonelli',82,'L')],
        '1990s': [C('Pierre Turgeon',87), C('Pat LaFontaine',88), W('Ziggy Palffy',84,'R')],
        '2000s': [C('Alexei Yashin',83), G('Rick DiPietro',78), D('Mark Streit',82,'L')],
        '2010s': [C('John Tavares',90), W('Josh Bailey',80,'L'), W('Kyle Okposo',80,'R'), W('Anders Lee',82,'L')],
        '2020s': [C('Mathew Barzal',86), C('Bo Horvat',84), G('Ilya Sorokin',90), D('Noah Dobson',85,'R')],
      }),
      T('OTT', 'Ottawa Senators', ['Ottawa Senators (original, 1917–1934)','Ottawa Senators (modern, 1992–present)'], {
        '1910s': [C('Frank Nighbor',86), W('Cy Denneny',82,'L')],
        '1920s': [C('Frank Nighbor',88), D('King Clancy',86,'L'), W('Cy Denneny',84,'L'), G('Alec Connell',84)],
        '1930s': [W('Frank Finnigan',78,'R'), C('Syd Howe',80)],
        '1990s': [C('Alexei Yashin',85), W('Daniel Alfredsson',86,'R'), C('Radek Bonk',78)],
        '2000s': [W('Daniel Alfredsson',90,'R'), C('Jason Spezza',86), W('Dany Heatley',86,'L'), D('Wade Redden',83,'L'), D('Zdeno Chara',86,'L'), W('Marian Hossa',86,'L')],
        '2010s': [D('Erik Karlsson',92,'R'), W('Mark Stone',84,'R'), C('Kyle Turris',80), G('Craig Anderson',82), W('Mike Hoffman',80,'L')],
        '2020s': [W('Brady Tkachuk',86,'L'), C('Tim Stutzle',85), D('Jake Sanderson',84,'L'), W('Drake Batherson',81,'R')],
      }),
      T('PHI', 'Philadelphia Flyers', ['Philadelphia Flyers (1967–present)'], {
        '1960s': [G('Bernie Parent',84), D('Ed Van Impe',78,'L')],
        '1970s': [C('Bobby Clarke',91), G('Bernie Parent',90), W('Bill Barber',88,'L'), W('Reggie Leach',84,'R'), C('Rick MacLeish',82)],
        '1980s': [W('Tim Kerr',85,'R'), D('Mark Howe',88,'L'), G('Pelle Lindbergh',84), W('Brian Propp',83,'L'), G('Ron Hextall',85), C('Dave Poulin',80)],
        '1990s': [C('Eric Lindros',92), W('John LeClair',87,'L'), W('Mark Recchi',86,'L'), C('Rod Brind\'Amour',84), D('Eric Desjardins',84,'R')],
        '2000s': [W('Simon Gagne',84,'L'), C('Jeremy Roenick',84), D('Kimmo Timonen',83,'L'), C('Mike Richards',83), C('Jeff Carter',83)],
        '2010s': [C('Claude Giroux',89), W('Jakub Voracek',84,'R'), C('Sean Couturier',83), W('Wayne Simmonds',82,'R')],
        '2020s': [W('Travis Konecny',85,'R'), C('Sean Couturier',82), D('Travis Sanheim',82,'L')],
      }),
      T('PIT', 'Pittsburgh Penguins', ['Pittsburgh Penguins (1967–present)'], {
        '1970s': [C('Syl Apps Jr.',82), W('Jean Pronovost',82,'R'), G('Les Binkley',76)],
        '1980s': [C('Mario Lemieux',98), D('Paul Coffey',90,'L'), W('Rob Brown',78,'R')],
        '1990s': [C('Mario Lemieux',99), W('Jaromir Jagr',95,'L'), C('Ron Francis',88), G('Tom Barrasso',85), W('Kevin Stevens',84,'L'), D('Larry Murphy',84,'R'), W('Joe Mullen',84,'R')],
        '2000s': [C('Sidney Crosby',95), C('Evgeni Malkin',92), G('Marc-Andre Fleury',87), D('Sergei Gonchar',85,'L'), W('Jaromir Jagr',90,'L')],
        '2010s': [C('Sidney Crosby',96), C('Evgeni Malkin',92), D('Kris Letang',88,'R'), W('Phil Kessel',85,'R'), G('Marc-Andre Fleury',86)],
        '2020s': [C('Sidney Crosby',92), C('Evgeni Malkin',86), D('Kris Letang',84,'R'), W('Jake Guentzel',86,'L')],
      }),
      T('SJS', 'San Jose Sharks', ['San Jose Sharks (1991–present)'], {
        '1990s': [W('Owen Nolan',85,'R'), W('Jeff Friesen',80,'L'), G('Mike Vernon',82)],
        '2000s': [C('Joe Thornton',90), C('Patrick Marleau',87), G('Evgeni Nabokov',86), W('Jonathan Cheechoo',82,'R')],
        '2010s': [C('Joe Thornton',88), C('Patrick Marleau',85), D('Brent Burns',88,'R'), C('Logan Couture',84), C('Joe Pavelski',85), D('Marc-Edouard Vlasic',82,'L'), D('Erik Karlsson',86,'R')],
        '2020s': [D('Erik Karlsson',84,'R'), C('Logan Couture',80), W('William Eklund',80,'L'), C('Macklin Celebrini',84)],
      }),
      T('SEA', 'Seattle Kraken', ['Seattle Kraken (2021–present)'], {
        '2020s': [C('Jared McCann',83), C('Matty Beniers',82), D('Vince Dunn',83,'L'), G('Philipp Grubauer',80), W('Jordan Eberle',81,'R'), W('Jaden Schwartz',81,'L')],
      }),
      T('STL', 'St. Louis Blues', ['St. Louis Blues (1967–present)'], {
        '1960s': [G('Glenn Hall',88), G('Jacques Plante',86), C('Red Berenson',82), D('Al Arbour',78,'L')],
        '1970s': [C('Garry Unger',82), D('Barclay Plager',78,'L')],
        '1980s': [C('Bernie Federko',87), W('Brian Sutter',82,'L'), C('Doug Gilmour',84), D('Rob Ramage',80,'R')],
        '1990s': [W('Brett Hull',92,'R'), W('Brendan Shanahan',86,'L'), D('Al MacInnis',88,'R'), D('Chris Pronger',88,'L'), G('Curtis Joseph',86), C('Pierre Turgeon',85), G('Grant Fuhr',84)],
        '2000s': [D('Chris Pronger',88,'L'), W('Keith Tkachuk',85,'L'), W('Pavol Demitra',83,'L'), C('Doug Weight',82)],
        '2010s': [C('David Backes',83), D('Alex Pietrangelo',87,'R'), W('Vladimir Tarasenko',87,'L'), G('Jordan Binnington',83), C('Ryan O\'Reilly',85)],
        '2020s': [C('Robert Thomas',85), W('Jordan Kyrou',84,'R'), D('Colton Parayko',83,'R')],
      }),
      T('TBL', 'Tampa Bay Lightning', ['Tampa Bay Lightning (1992–present)'], {
        '1990s': [C('Brian Bradley',80), D('Roman Hamrlik',80,'L'), G('Daren Puppa',80)],
        '2000s': [C('Vincent Lecavalier',88), W('Martin St. Louis',90,'R'), C('Brad Richards',86), G('Nikolai Khabibulin',85), D('Dan Boyle',84,'R')],
        '2010s': [C('Steven Stamkos',90), W('Nikita Kucherov',90,'L'), D('Victor Hedman',90,'L'), G('Andrei Vasilevskiy',90), C('Tyler Johnson',82), W('Ondrej Palat',82,'L')],
        '2020s': [W('Nikita Kucherov',95,'L'), D('Victor Hedman',89,'L'), G('Andrei Vasilevskiy',91), C('Steven Stamkos',86), C('Brayden Point',88), W('Brandon Hagel',84,'L')],
      }),
      T('UTA', 'Utah Mammoth', ['Winnipeg Jets (original, 1979)','Phoenix Coyotes (1996)','Arizona Coyotes (2014)','Utah Hockey Club (2024)','Utah Mammoth (2025–present)'], {
        '1980s': [C('Dale Hawerchuk',90), C('Thomas Steen',80), D('Randy Carlyle',80,'L')],
        '1990s': [W('Teemu Selanne',92,'R'), W('Keith Tkachuk',86,'L'), C('Alexei Zhamnov',82), G('Nikolai Khabibulin',82)],
        '2000s': [W('Shane Doan',84,'R'), C('Jeremy Roenick',84), C('Daniel Briere',82), G('Ilya Bryzgalov',84)],
        '2010s': [W('Shane Doan',82,'R'), D('Oliver Ekman-Larsson',84,'L'), G('Mike Smith',82), D('Keith Yandle',80,'L')],
        '2020s': [W('Clayton Keller',86,'R'), W('Dylan Guenther',82,'R'), D('Sean Durzi',80,'R'), C('Logan Cooley',82)],
      }),
      T('VAN', 'Vancouver Canucks', ['Vancouver Canucks (1970–present)'], {
        '1970s': [C('Andre Boudrias',80), W('Don Lever',78,'L'), W('Dennis Ververgaert',76,'R')],
        '1980s': [W('Stan Smyl',82,'R'), W('Tony Tanti',80,'R'), G('Richard Brodeur',80)],
        '1990s': [W('Pavel Bure',92,'R'), C('Trevor Linden',86), G('Kirk McLean',84), W('Geoff Courtnall',80,'L')],
        '2000s': [W('Markus Naslund',88,'L'), W('Daniel Sedin',86,'L'), C('Henrik Sedin',86), G('Roberto Luongo',88), D('Ed Jovanovski',82,'L')],
        '2010s': [C('Henrik Sedin',88), W('Daniel Sedin',88,'L'), G('Roberto Luongo',86), C('Ryan Kesler',84), D('Alex Edler',80,'L')],
        '2020s': [C('Elias Pettersson',87), D('Quinn Hughes',90,'L'), C('J.T. Miller',85), W('Brock Boeser',84,'R'), G('Thatcher Demko',86)],
      }),
      T('VGK', 'Vegas Golden Knights', ['Vegas Golden Knights (2017–present)'], {
        '2010s': [G('Marc-Andre Fleury',88), C('William Karlsson',84), W('Jonathan Marchessault',84,'R'), W('Reilly Smith',82,'R'), D('Nate Schmidt',80,'R')],
        '2020s': [C('Jack Eichel',88), W('Mark Stone',86,'R'), W('Jonathan Marchessault',84,'R'), D('Shea Theodore',85,'L'), D('Alex Pietrangelo',86,'R'), C('William Karlsson',83), G('Adin Hill',83)],
      }),
      T('WSH', 'Washington Capitals', ['Washington Capitals (1974–present)'], {
        '1970s': [D('Yvon Labre',74,'R')],
        '1980s': [W('Mike Gartner',87,'R'), D('Rod Langway',86,'L'), D('Scott Stevens',85,'L'), C('Dale Hunter',82), C('Bengt Gustafsson',80)],
        '1990s': [W('Peter Bondra',87,'R'), C('Adam Oates',85), G('Olaf Kolzig',85), C('Dale Hunter',80), D('Sergei Gonchar',83,'L'), C('Joe Juneau',80)],
        '2000s': [W('Alex Ovechkin',95,'R'), W('Alexander Semin',84,'L'), C('Nicklas Backstrom',86), D('Mike Green',84,'R'), G('Olaf Kolzig',82)],
        '2010s': [W('Alex Ovechkin',95,'R'), C('Nicklas Backstrom',87), G('Braden Holtby',87), D('John Carlson',86,'R'), W('T.J. Oshie',83,'R'), C('Evgeny Kuznetsov',84)],
        '2020s': [W('Alex Ovechkin',90,'R'), D('John Carlson',84,'R'), W('Tom Wilson',82,'R'), C('Dylan Strome',82)],
      }),
      T('WPG', 'Winnipeg Jets', ['Atlanta Thrashers (1999)','Winnipeg Jets (2011–present)'], {
        '2000s': [W('Ilya Kovalchuk',90,'R'), W('Marian Hossa',86,'L'), W('Dany Heatley',85,'L'), D('Tobias Enstrom',80,'L'), C('Patrik Stefan',72)],
        '2010s': [W('Blake Wheeler',86,'R'), D('Dustin Byfuglien',86,'R'), W('Patrik Laine',86,'R'), C('Mark Scheifele',85), G('Connor Hellebuyck',88), C('Bryan Little',80)],
        '2020s': [G('Connor Hellebuyck',93), C('Mark Scheifele',87), W('Kyle Connor',88,'L'), D('Josh Morrissey',86,'L'), W('Nikolaj Ehlers',84,'L')],
      }),
      T('ANA', 'Anaheim Ducks', ['Mighty Ducks of Anaheim (1993)','Anaheim Ducks (2006–present)'], {
        '1990s': [W('Paul Kariya',90,'L'), W('Teemu Selanne',90,'R'), G('Guy Hebert',82), C('Steve Rucchin',78)],
        '2000s': [W('Teemu Selanne',88,'R'), D('Scott Niedermayer',90,'L'), D('Chris Pronger',90,'L'), G('Jean-Sebastien Giguere',86), C('Ryan Getzlaf',86), W('Corey Perry',86,'R'), C('Andy McDonald',80)],
        '2010s': [C('Ryan Getzlaf',88), W('Corey Perry',87,'R'), D('Cam Fowler',82,'L'), G('John Gibson',86), W('Bobby Ryan',82,'R')],
        '2020s': [W('Troy Terry',83,'R'), C('Trevor Zegras',83), C('Mason McTavish',82), C('Leo Carlsson',82)],
      }),
    ],
  };
})(typeof window !== 'undefined' ? window : globalThis);
