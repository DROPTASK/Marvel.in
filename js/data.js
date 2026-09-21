/**
 * Curated MCU reference data.
 * The free APIs (TMDB/OMDb/TVmaze/Watchmode/Marvel) give ratings, cast, posters
 * and streaming links — but none of them know "in-universe chronological order"
 * or "which phase/saga a film belongs to". That editorial layer lives here.
 */

// ---- Sagas & Phases -------------------------------------------------------
window.MI_PHASES = [
  { id: "phase1", saga: "Infinity Saga", label: "Phase One", years: "2008–2012" },
  { id: "phase2", saga: "Infinity Saga", label: "Phase Two", years: "2013–2015" },
  { id: "phase3", saga: "Infinity Saga", label: "Phase Three", years: "2016–2019" },
  { id: "phase4", saga: "Multiverse Saga", label: "Phase Four", years: "2021–2022" },
  { id: "phase5", saga: "Multiverse Saga", label: "Phase Five", years: "2023–2025" },
  { id: "phase6", saga: "Multiverse Saga", label: "Phase Six", years: "2026–2027" }
];

// ---- Release-order roadmap (the "todo list" of the MCU) ------------------
// status: "released" | "upcoming"
// tmdbQuery is used to try to match this entry to a live TMDB record for
// poster/rating/synopsis; if the match fails the fallback fields are used.
window.MI_ROADMAP = [
  { title: "Iron Man", year: 2008, phase: "phase1", status: "released", tmdbQuery: "Iron Man 2008" },
  { title: "The Incredible Hulk", year: 2008, phase: "phase1", status: "released", tmdbQuery: "The Incredible Hulk 2008" },
  { title: "Iron Man 2", year: 2010, phase: "phase1", status: "released", tmdbQuery: "Iron Man 2" },
  { title: "Thor", year: 2011, phase: "phase1", status: "released", tmdbQuery: "Thor 2011" },
  { title: "Captain America: The First Avenger", year: 2011, phase: "phase1", status: "released", tmdbQuery: "Captain America The First Avenger" },
  { title: "The Avengers", year: 2012, phase: "phase1", status: "released", tmdbQuery: "The Avengers 2012" },
  { title: "Iron Man 3", year: 2013, phase: "phase2", status: "released", tmdbQuery: "Iron Man 3" },
  { title: "Thor: The Dark World", year: 2013, phase: "phase2", status: "released", tmdbQuery: "Thor The Dark World" },
  { title: "Captain America: The Winter Soldier", year: 2014, phase: "phase2", status: "released", tmdbQuery: "Captain America The Winter Soldier" },
  { title: "Guardians of the Galaxy", year: 2014, phase: "phase2", status: "released", tmdbQuery: "Guardians of the Galaxy 2014" },
  { title: "Avengers: Age of Ultron", year: 2015, phase: "phase2", status: "released", tmdbQuery: "Avengers Age of Ultron" },
  { title: "Ant-Man", year: 2015, phase: "phase2", status: "released", tmdbQuery: "Ant-Man 2015" },
  { title: "Captain America: Civil War", year: 2016, phase: "phase3", status: "released", tmdbQuery: "Captain America Civil War" },
  { title: "Doctor Strange", year: 2016, phase: "phase3", status: "released", tmdbQuery: "Doctor Strange 2016" },
  { title: "Guardians of the Galaxy Vol. 2", year: 2017, phase: "phase3", status: "released", tmdbQuery: "Guardians of the Galaxy Vol 2" },
  { title: "Spider-Man: Homecoming", year: 2017, phase: "phase3", status: "released", tmdbQuery: "Spider-Man Homecoming" },
  { title: "Thor: Ragnarok", year: 2017, phase: "phase3", status: "released", tmdbQuery: "Thor Ragnarok" },
  { title: "Black Panther", year: 2018, phase: "phase3", status: "released", tmdbQuery: "Black Panther 2018" },
  { title: "Avengers: Infinity War", year: 2018, phase: "phase3", status: "released", tmdbQuery: "Avengers Infinity War" },
  { title: "Ant-Man and the Wasp", year: 2018, phase: "phase3", status: "released", tmdbQuery: "Ant-Man and the Wasp" },
  { title: "Captain Marvel", year: 2019, phase: "phase3", status: "released", tmdbQuery: "Captain Marvel 2019" },
  { title: "Avengers: Endgame", year: 2019, phase: "phase3", status: "released", tmdbQuery: "Avengers Endgame" },
  { title: "Spider-Man: Far From Home", year: 2019, phase: "phase3", status: "released", tmdbQuery: "Spider-Man Far From Home" },
  { title: "Black Widow", year: 2021, phase: "phase4", status: "released", tmdbQuery: "Black Widow 2021" },
  { title: "Shang-Chi and the Legend of the Ten Rings", year: 2021, phase: "phase4", status: "released", tmdbQuery: "Shang-Chi" },
  { title: "Eternals", year: 2021, phase: "phase4", status: "released", tmdbQuery: "Eternals 2021" },
  { title: "Spider-Man: No Way Home", year: 2021, phase: "phase4", status: "released", tmdbQuery: "Spider-Man No Way Home" },
  { title: "Doctor Strange in the Multiverse of Madness", year: 2022, phase: "phase4", status: "released", tmdbQuery: "Doctor Strange Multiverse of Madness" },
  { title: "Thor: Love and Thunder", year: 2022, phase: "phase4", status: "released", tmdbQuery: "Thor Love and Thunder" },
  { title: "Black Panther: Wakanda Forever", year: 2022, phase: "phase4", status: "released", tmdbQuery: "Wakanda Forever" },
  { title: "Ant-Man and the Wasp: Quantumania", year: 2023, phase: "phase5", status: "released", tmdbQuery: "Quantumania" },
  { title: "Guardians of the Galaxy Vol. 3", year: 2023, phase: "phase5", status: "released", tmdbQuery: "Guardians of the Galaxy Vol 3" },
  { title: "The Marvels", year: 2023, phase: "phase5", status: "released", tmdbQuery: "The Marvels 2023" },
  { title: "Deadpool & Wolverine", year: 2024, phase: "phase5", status: "released", tmdbQuery: "Deadpool and Wolverine" },
  { title: "Captain America: Brave New World", year: 2025, phase: "phase5", status: "released", tmdbQuery: "Captain America Brave New World" },
  { title: "Thunderbolts*", year: 2025, phase: "phase5", status: "released", tmdbQuery: "Thunderbolts" },
  { title: "The Fantastic Four: First Steps", year: 2025, phase: "phase5", status: "released", tmdbQuery: "Fantastic Four First Steps" },
  { title: "Avengers: Doomsday", year: 2026, phase: "phase6", status: "upcoming", tmdbQuery: "Avengers Doomsday", spotlight: true,
    synopsisFallback: "The Multiverse Saga's centerpiece — Doctor Doom rises as the Avengers, the Fantastic Four, X-Men and variants from across the multiverse are forced onto one battlefield." },
  { title: "Avengers: Secret Wars", year: 2027, phase: "phase6", status: "upcoming", tmdbQuery: "Avengers Secret Wars",
    synopsisFallback: "The saga-closing event pulling together threads from Loki, What If...?, and the multiverse arc built since Endgame." }
];

// ---- In-universe chronological timeline (curated story beats) ------------
window.MI_TIMELINE = [
  { year: "1943", title: "Captain America: The First Avenger", blurb: "Steve Rogers becomes the first Super-Soldier and crashes Red Skull's Hydra flagship into the Arctic, ending WWII's shadow war and putting himself on ice for 70 years." },
  { year: "2011 (Asgard)", title: "Thor", blurb: "Thor is exiled to Earth for his recklessness, learns humility from Jane Foster and SHIELD, and stops Loki's attempt to destroy Jotunheim to win their father's throne." },
  { year: "2011", title: "Captain Marvel", blurb: "Carol Danvers uncovers her Kree conditioning, reclaims her human memories, and helps the Skrulls find a new home — years before anyone else in this list wears a suit." },
  { year: "2008", title: "Iron Man", blurb: "Weapons manufacturer Tony Stark builds a suit of armor to escape captivity, then chooses to become Iron Man instead of selling more weapons." },
  { year: "2010", title: "Iron Man 2", blurb: "Stark battles palladium poisoning and Ivan Vanko while SHIELD quietly assembles the Avengers Initiative around him." },
  { year: "2008 (present)", title: "The Incredible Hulk", blurb: "Bruce Banner, hunted for the Hulk within him, faces the Abomination in Harlem — and General Ross's obsession with weaponizing the Hulk formula." },
  { year: "2012", title: "The Avengers", blurb: "Loki invades New York with the Chitauri; Earth's Mightiest Heroes assemble for the first time to close the portal." },
  { year: "2013", title: "Iron Man 3", blurb: "Stark confronts PTSD after New York while unraveling the Mandarin conspiracy and the Extremis program." },
  { year: "2013 (Asgard)", title: "Thor: The Dark World", blurb: "The Aether resurfaces, the Dark Elves attack the Nine Realms, and Thor loses his brother Loki (or does he?) stopping Malekith." },
  { year: "2014", title: "Captain America: The Winter Soldier", blurb: "Cap discovers Hydra has grown inside SHIELD itself, and learns the Winter Soldier is his old friend Bucky Barnes." },
  { year: "2014 (Cosmos)", title: "Guardians of the Galaxy", blurb: "Peter Quill and a ragtag crew stop Ronan the Accuser from using an Infinity Stone to annihilate Xandar." },
  { year: "2014", title: "Guardians of the Galaxy Vol. 2", blurb: "Quill meets his father Ego — a Celestial with plans to consume the galaxy — and the Guardians choose found family over blood." },
  { year: "2015", title: "Avengers: Age of Ultron", blurb: "Stark's peacekeeping AI turns genocidal; the Avengers create Vision and lose Sokovia in the fight to stop him." },
  { year: "2015", title: "Ant-Man", blurb: "Scott Lang becomes the new Ant-Man to stop Hank Pym's former protégé from weaponizing shrinking tech." },
  { year: "2016", title: "Captain America: Civil War", blurb: "The Sokovia Accords split the Avengers over accountability, and Zemo exposes that Bucky killed Tony's parents." },
  { year: "2016", title: "Black Widow", blurb: "Natasha Romanoff confronts her Red Room past and frees the other Widows while a fugitive from the Accords." },
  { year: "2016 (Sanctum)", title: "Doctor Strange", blurb: "Surgeon Stephen Strange loses his hands, gains the mystic arts, and bargains with Dormammu to save Earth from Kaecilius." },
  { year: "2017", title: "Spider-Man: Homecoming", blurb: "Peter Parker balances high school with stopping Adrian Toomes' black-market alien-tech weapons ring." },
  { year: "2017", title: "Thor: Ragnarok", blurb: "Thor loses his hammer and his home, teams with Hulk and Valkyrie, and lets Asgard burn to stop Hela." },
  { year: "2017", title: "Black Panther", blurb: "T'Challa becomes king of Wakanda and must decide whether to open its doors to the world after Killmonger's challenge." },
  { year: "2018", title: "Avengers: Infinity War", blurb: "Thanos gathers all six Infinity Stones and snaps half of all life in the universe out of existence." },
  { year: "2018", title: "Ant-Man and the Wasp", blurb: "Scott, Hope and Hank race to rescue Janet van Dyne from the Quantum Realm — just as the Blip hits." },
  { year: "2023", title: "Avengers: Endgame", blurb: "The surviving Avengers use time travel to undo the Snap, and Tony Stark sacrifices himself to defeat Thanos for good." },
  { year: "2024", title: "Spider-Man: Far From Home", blurb: "Peter grieves Tony Stark while Mysterio frames him for chaos across Europe, ending with his identity exposed." },
  { year: "2025", title: "Shang-Chi and the Legend of the Ten Rings", blurb: "Shang-Chi confronts his father Wenwu and the Ten Rings' true, ancient purpose." },
  { year: "Timeless", title: "Eternals", blurb: "Ten immortal Eternals reveal their true purpose on Earth and split over Arishem's plan for humanity." },
  { year: "2024–25", title: "Doctor Strange in the Multiverse of Madness", blurb: "Strange and America Chavez traverse the multiverse to escape a corrupted Scarlet Witch hunting Chavez's power." },
  { year: "2025", title: "Spider-Man: No Way Home", blurb: "A broken spell tears open the multiverse, bringing villains — and Spider-Men — from other universes to help Peter." },
  { year: "2025", title: "Thor: Love and Thunder", blurb: "Thor teams with Jane Foster (now Mighty Thor) to stop Gorr the God Butcher from wiping out all gods." },
  { year: "2025", title: "Black Panther: Wakanda Forever", blurb: "Wakanda mourns T'Challa and faces Namor's underwater kingdom of Talokan; Shuri becomes the new Black Panther." },
  { year: "2026", title: "Ant-Man and the Wasp: Quantumania", blurb: "The Langs are pulled into the Quantum Realm and face Kang the Conqueror for the first time." },
  { year: "2026", title: "Guardians of the Galaxy Vol. 3", blurb: "The Guardians fight to save Rocket from the High Evolutionary, and go their separate ways." },
  { year: "2026", title: "The Marvels", blurb: "Carol Danvers, Kamala Khan and Monica Rambeau have their powers entangled and must work as one." },
  { year: "2027 (parallel)", title: "Deadpool & Wolverine", blurb: "Wade Wilson recruits a Wolverine variant to save his universe from the TVA's Time Ripper — and cameo-packs the multiverse's void." },
  { year: "2028", title: "Captain America: Brave New World", blurb: "Sam Wilson, the new Captain America, uncovers a conspiracy tied to celestial Adamantium and an old enemy: Thaddeus Ross." },
  { year: "2028", title: "Thunderbolts*", blurb: "A team of morally grey operatives — the New Avengers in waiting — confront the Void, a manifestation of Bob's trauma." },
  { year: "2028", title: "The Fantastic Four: First Steps", blurb: "Earth's First Family faces Galactus and the Silver Surfer in a retro-futurist timeline, setting up their entry into the main MCU." },
  { year: "2029 — the present crisis", title: "Avengers: Doomsday", blurb: "Variants collide as Victor von Doom steps out of the multiverse's shadows. The Fantastic Four, the X-Men, and every surviving Avenger converge for the fight that reshapes the Multiverse Saga.", spotlight: true },
  { year: "2029 — the finale", title: "Avengers: Secret Wars", blurb: "Incursions between universes threaten total collapse; heroes from every timeline the MCU has touched face the only fight big enough to close the saga." }
];

// ---- A small curated cast → character map (supplements TMDB credits) -----
// TMDB already returns actor + character per movie via /credits, but for the
// "advanced character info" screen we want a stable person to browse *across*
// their whole MCU history, comic-accurate aliases, and powers.
window.MI_CHARACTERS = [
  { name: "Tony Stark / Iron Man", actor: "Robert Downey Jr.", aliases: ["Iron Man", "Anthony Stark"], powers: "Genius-level intellect, powered exo-suits, repulsor & unibeam weaponry, arc-reactor energy control.", firstAppearance: "Iron Man (2008)", affiliation: "Avengers" },
  { name: "Steve Rogers / Captain America", actor: "Chris Evans", aliases: ["Captain America", "The First Avenger", "Nomad"], powers: "Super-Soldier serum strength, speed & durability; vibranium shield mastery; peak tactical leadership.", firstAppearance: "Captain America: The First Avenger (2011)", affiliation: "Avengers" },
  { name: "Natasha Romanoff / Black Widow", actor: "Scarlett Johansson", aliases: ["Black Widow"], powers: "Red Room-trained master spy, expert martial artist, marksman, and interrogator.", firstAppearance: "Iron Man 2 (2010)", affiliation: "Avengers / S.H.I.E.L.D." },
  { name: "Thor Odinson", actor: "Chris Hemsworth", aliases: ["God of Thunder"], powers: "Asgardian physiology, weather/lightning manipulation, Mjolnir & Stormbreaker mastery.", firstAppearance: "Thor (2011)", affiliation: "Avengers / Asgard" },
  { name: "Bruce Banner / Hulk", actor: "Mark Ruffalo", aliases: ["Hulk", "Smart Hulk"], powers: "Gamma-fueled transformation into a near-invulnerable rage-powered giant; genius physicist.", firstAppearance: "The Avengers (2012)", affiliation: "Avengers" },
  { name: "Clint Barton / Hawkeye", actor: "Jeremy Renner", aliases: ["Hawkeye", "Ronin"], powers: "World-class marksman with trick arrows; peak-human combatant.", firstAppearance: "Thor (2011, cameo)", affiliation: "Avengers" },
  { name: "Peter Parker / Spider-Man", actor: "Tom Holland", aliases: ["Spider-Man"], powers: "Spider-bite-derived strength, agility, wall-crawling, and precognitive 'spider-sense'.", firstAppearance: "Captain America: Civil War (2016)", affiliation: "Avengers" },
  { name: "T'Challa / Black Panther", actor: "Chadwick Boseman", aliases: ["Black Panther", "King of Wakanda"], powers: "Vibranium suit, Heart-Shaped Herb-enhanced strength & senses, master strategist.", firstAppearance: "Captain America: Civil War (2016)", affiliation: "Wakanda / Avengers" },
  { name: "Stephen Strange / Doctor Strange", actor: "Benedict Cumberbatch", aliases: ["Doctor Strange", "Sorcerer Supreme"], powers: "Mastery of the mystic arts, time manipulation via the Eye of Agamotto, astral projection.", firstAppearance: "Doctor Strange (2016)", affiliation: "Masters of the Mystic Arts" },
  { name: "Carol Danvers / Captain Marvel", actor: "Brie Larson", aliases: ["Captain Marvel", "Vers"], powers: "Photon-energy absorption & projection, flight, superhuman strength — one of the MCU's most powerful heroes.", firstAppearance: "Captain Marvel (2019)", affiliation: "Avengers / Kree (former)" },
  { name: "Wanda Maximoff / Scarlet Witch", actor: "Elizabeth Olsen", aliases: ["Scarlet Witch"], powers: "Chaos magic: reality alteration, telekinesis, telepathy; wields the Darkhold's forbidden knowledge.", firstAppearance: "Captain America: The Winter Soldier (2014, credits)", affiliation: "Avengers" },
  { name: "Sam Wilson / Falcon → Captain America", actor: "Anthony Mackie", aliases: ["Falcon", "Captain America (present)"], powers: "EXO-7 Falcon wingsuit, aerial combat mastery; inherits the vibranium shield.", firstAppearance: "Captain America: The Winter Soldier (2014)", affiliation: "Avengers" },
  { name: "Bucky Barnes / Winter Soldier", actor: "Sebastian Stan", aliases: ["Winter Soldier", "White Wolf"], powers: "Super-soldier serum remnants, vibranium arm, elite Hydra-trained assassin skillset.", firstAppearance: "Captain America: The First Avenger (2011)", affiliation: "Avengers" },
  { name: "Loki Laufeyson", actor: "Tom Hiddleston", aliases: ["God of Mischief", "He Who Remains variant"], powers: "Illusion casting, shapeshifting, sorcery; Frost Giant physiology beneath an Asgardian guise.", firstAppearance: "Thor (2011)", affiliation: "Variant / TVA (later)" },
  { name: "Nick Fury", actor: "Samuel L. Jackson", aliases: ["Director Fury"], powers: "No powers — peerless strategist, intelligence veteran, architect of the Avengers Initiative.", firstAppearance: "Iron Man (2008, post-credits)", affiliation: "S.H.I.E.L.D." },
  { name: "Peter Quill / Star-Lord", actor: "Chris Pratt", aliases: ["Star-Lord"], powers: "Half-Celestial physiology, elemental gun mastery, jet-boot flight.", firstAppearance: "Guardians of the Galaxy (2014)", affiliation: "Guardians of the Galaxy" },
  { name: "Gamora", actor: "Zoe Saldaña", aliases: ["Deadliest Woman in the Galaxy"], powers: "Cybernetically enhanced Zehoberei physiology; elite assassin trained by Thanos.", firstAppearance: "Guardians of the Galaxy (2014)", affiliation: "Guardians of the Galaxy" },
  { name: "Shuri", actor: "Letitia Wright", aliases: ["Princess of Wakanda", "Black Panther (later)"], powers: "Genius-level Wakandan technologist and inventor; later gains Heart-Shaped Herb powers.", firstAppearance: "Captain America: Civil War (2016)", affiliation: "Wakanda" },
  { name: "Shang-Chi", actor: "Simu Liu", aliases: ["Master of Kung Fu", "Shang"], powers: "Peerless martial artist trained by his father Wenwu; wields the Ten Rings.", firstAppearance: "Shang-Chi and the Legend of the Ten Rings (2021)", affiliation: "Ten Rings (former) / Avengers-adjacent" },
  { name: "Kamala Khan / Ms. Marvel", actor: "Iman Vellani", aliases: ["Ms. Marvel"], powers: "Cosmic bangle-derived hard-light constructs and embiggening; Captain Marvel super-fan.", firstAppearance: "Ms. Marvel (2022, TV)", affiliation: "The Marvels" },
  { name: "Victor von Doom", actor: "Robert Downey Jr.", aliases: ["Doctor Doom"], powers: "Sorcery and Latverian science fused into one of the multiverse's most dangerous minds; master of both magic and technology.", firstAppearance: "Avengers: Doomsday (2026)", affiliation: "Latveria" }
];
