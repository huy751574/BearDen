import type { EngineKind, GameRef } from './types';

// Every mini-game variant: engine + wording + what to spawn. Scenes pick one
// in sceneEnv.json ("game": {"type": ..., "variant": ...}), chosen by
// tools/analyze_scenes.py.

export interface Variant {
  title: string;
  hint: string;
  duration?: number;
  // shooter
  enemy?: string;
  enemyScale?: number;
  beamColor?: string;
  // catcher
  good?: string[];
  bad?: string[];
  fall?: number;
  drift?: number;
  // collector
  item?: string;
  count?: number;
  moving?: boolean;
  float?: number;
  // timing
  mode?: 'meter' | 'reaction';
  rounds?: number;
  button?: string;
  waitIcon?: string;
  goIcon?: string;
  hitText?: string;
  missText?: string;
  earlyText?: string;
  slowText?: string;
  // simon
  pads?: string[];
  // dodge
  hazard?: string;
  burst?: string;
  // stealth
  watcher?: string;
  anchor?: string;
}

type Catalog = Record<EngineKind, Record<string, Variant>>;

const beam = (title: string, enemy: string, scale: number, who: string, color = '#38e1ff'): Variant => ({
  title, enemy, enemyScale: scale, beamColor: color,
  hint: `${who} are coming! Click where to fire (or press Space). Don't let them reach you.`,
});
const catcher = (title: string, good: string[], bad: string[], hint: string, extra: Partial<Variant> = {}): Variant => ({ title, good, bad, hint, ...extra });
const find = (title: string, item: string, hint: string, extra: Partial<Variant> = {}): Variant => ({ title, item, hint, ...extra });
const meter = (title: string, button: string, hint: string, extra: Partial<Variant> = {}): Variant => ({ title, button, hint, mode: 'meter', ...extra });
const react = (title: string, button: string, waitIcon: string, goIcon: string, hint: string, extra: Partial<Variant> = {}): Variant => ({ title, button, waitIcon, goIcon, hint, mode: 'reaction', ...extra });
const simon = (title: string, pads: string[], hint: string, extra: Partial<Variant> = {}): Variant => ({ title, pads, hint, ...extra });
const dodge = (title: string, hazard: string, burst: string, hint: string): Variant => ({ title, hazard, burst, hint });

export const CATALOG: Catalog = {
  shooter: {
    alligator: beam('Mini-Croc Invasion', 'alligator', 0.4, "Sobek's mini-crocs"),
    wolf: beam('Wolf Pack Assault', 'wolf', 0.42, "The Dire Wolf's pups"),
    jelly: beam('Jellyfish Swarm', 'jelly', 0.9, "The Maelstrom's jellyfish", '#7fe0ff'),
    snake: beam('Hydra Hatchlings', 'snake', 0.9, 'Baby hydra snakes', '#9fff7a'),
    drone: beam('Beam Calibration', 'drone', 0.8, 'Practice drones', '#ffd36e'),
    slime: beam('Dungeon Slimes', 'slime', 0.7, 'Dungeon slimes', '#ffd36e'),
    hyena: beam('Assassin Ambush', 'hyena', 0.7, 'Hyena assassins', '#ff9ec4'),
  },
  catcher: {
    honey: catcher('Honey Rain', ['honey'], ['bee'], 'Catch the honey pots, dodge the bees! Walk under what falls.'),
    ramen: catcher('Ramen Toppings', ['egg', 'naruto'], ['chili'], 'Catch the toppings for your bowl. Avoid the super-hot chilies!'),
    petals: catcher('Catch the Petals', ['petal', 'flower'], [], 'Petals drift down. Catch as many as you can!', { fall: 1.6, drift: 1 }),
    stars: catcher('Stardust Catch', ['star'], ['meteor'], 'Catch the falling stars, dodge the meteors!'),
    snow: catcher('Snowflake Catch', ['snowflake'], ['icicle'], 'Catch snowflakes, dodge the icicles!', { fall: 2 }),
    light: catcher('Catch the Light', ['light'], ['dark'], 'Gather warm light orbs, avoid the dark ones!'),
    lantern: catcher('Lantern Festival', ['lantern'], [], 'Catch the floating lanterns before they touch the ground.', { fall: 1.5, drift: 0.6 }),
    notes: catcher('Catch the Melody', ['note'], ['offnote'], 'Catch the music notes, avoid the sour notes!'),
    sheep: catcher('Count the Sheep', ['sheep'], [], 'Catch the sleepy sheep as they float down… one, two, three…', { fall: 1.8 }),
    rain: catcher('Rain Bucket', ['raindrop'], ['bolt'], 'Catch raindrops for the garden, dodge the lightning!', { fall: 3.5 }),
  },
  collector: {
    gems: find('Castle Treasure Hunt', 'gem', 'Find all the hidden gems before time runs out!'),
    relics: find('Lost Relics', 'relic', 'Golden relics are scattered around the ruins. Find them all!'),
    pearls: find('Pearl Dive', 'pearl', 'Collect every pearl from the seabed!', { float: 0.4 }),
    lotus: find('Lotus Gathering', 'lotus', 'Gather the lotus flowers.', { float: 0.2 }),
    shells: find('Beach Comber', 'shell', 'Pick up all the sea shells.', { float: 0.25 }),
    mushrooms: find('Mushroom Forage', 'mushroom', 'Forage every mushroom in the forest.', { float: 0.25 }),
    butterflies: find('Butterfly Net', 'butterfly', 'Chase down the fluttering butterflies!', { moving: true, count: 10 }),
    stardust: find('Moon Dust', 'stardust', 'Collect the glittering moon dust.'),
    feathers: find('Feather Chase', 'feather', 'Gather the drifting feathers.', { moving: true, count: 10 }),
    books: find('Lost Books', 'book', 'Put the lost books back: collect them all!', { float: 0.3 }),
    bones: find('Dig Site', 'bone', 'Dig up all the fossil bones!', { float: 0.25 }),
    spools: find('Red Thread Spools', 'spool', 'Gather the spools of red thread for the loom.'),
    flowers: find('Flower Bouquet', 'flower', 'Pick flowers for a bouquet.', { float: 0.3 }),
    ducks: find('Rubber Ducks', 'duck', 'Round up the rubber ducks!', { float: 0.25 }),
    pumpkins: find('Pumpkin Patch', 'pumpkin', 'Collect the spooky pumpkins.', { float: 0.25 }),
    coins: find('Market Coins', 'coin', 'Pick up the coins around town.'),
    apples: find('Apple Picking', 'apple', 'Pick up all the apples for the road.'),
    runes: find('Summoning Runes', 'rune', 'Gather the glowing runes to power the circle.'),
    firewood: find('Firewood', 'firewood', 'Collect firewood for the camp.', { float: 0.25 }),
    balloons: find('Sky Balloons', 'balloon', 'Grab all the balloons!', { float: 1.0 }),
    pages: find('Flying Pages', 'page', 'Your pages blew away! Catch them all.', { moving: true, count: 10 }),
    wheat: find('Harvest Time', 'wheat', 'Gather the wheat bundles.', { float: 0.35 }),
    paint: find('Paint Palette', 'paint', 'Collect the paint drops for your painting.'),
    fireflies: find('Firefly Glow', 'firefly', 'Catch the fireflies to light your way.', { moving: true, count: 10 }),
    leaves: find('Autumn Leaves', 'leaf', 'Collect the falling autumn leaves.', { float: 0.4 }),
    candles: find('Candle Vigil', 'candle', 'Light the way: gather every candle.', { float: 0.3 }),
    rings: find('Flight Rings', 'ring', 'Fly through every ring!', { float: 1.0 }),
  },
  timing: {
    fishing: react('Quick Catch', 'REEL!', '🎣', '🐟❗', 'Wait for the bite… press when ❗ appears. Not too early!', { hitText: 'Caught one!', slowText: 'It got away!' }),
    salmon: react('Salmon Swipe', 'SWIPE!', '🌊', '🐟❗', 'Watch the river… swipe the moment a salmon leaps!', { hitText: 'Got it!', slowText: 'Too slow!' }),
    parry: react('Parry the Strike', 'PARRY!', '🛡️', '⚔️', 'Your rival attacks! Parry the instant you see ⚔️.', { hitText: 'Parried!', slowText: 'Hit!' }),
    stretch: react('Morning Stretch', 'WAKE!', '😴', '⏰', 'Doze… and jump up the moment the alarm rings!', { hitText: 'Good morning!' }),
    beat: meter('Glowstick Rhythm', 'BEAT!', 'Wave on the beat: press when the marker is in the glowing zone!'),
    pour: meter('Perfect Pour', 'POUR', 'Pour the tea when the marker is in the zone. Not a drop spilled!'),
    firework: meter('Firework Finale', 'LAUNCH', 'Launch each firework at the perfect moment!'),
    roar: meter('Mighty Roar', 'ROAR!', 'Time your roar to echo across the mountains!'),
    vine: meter('Vine Swing', 'JUMP!', 'Let go of the vine at the right moment to reach the next one!'),
    breath: meter('Calm Breathing', 'BREATHE', 'Breathe in… press in the calm zone to find your centre.', { rounds: 6 }),
    flip: meter('Grill Flip', 'FLIP!', 'Flip the fish when it is perfectly grilled!'),
    tune: meter('Tune the Radio', 'TUNE', 'Stop the dial on the clear station!'),
    dance: meter('Dance-Off', 'STEP!', 'Hit each step on the beat!'),
  },
  simon: {
    orchestra: simon('Conduct the Orchestra', ['🎻', '🥁', '🎺', '🎹'], 'Watch which section plays, then conduct them in the same order.'),
    lyre: simon('Lyre Melody', ['🌸', '🍃', '🌙', '⭐'], 'Listen to the melody, then play it back.'),
    orders: simon('Tavern Orders', ['🍺', '🍗', '🥧', '🍎'], 'Remember the order, then serve it in the same sequence.'),
    recipe: simon('Cooking Recipe', ['🐟', '🥕', '🧂', '🍄'], 'Add the ingredients in the right order!'),
    cards: simon('Quest Cards', ['⚔️', '🛡️', '🏹', '🧪'], 'Memorise the quest cards, then pick them in order.'),
    dance: simon('Dance Moves', ['⬆️', '⬇️', '⬅️', '➡️'], 'Copy the dance moves in order!'),
    weave: simon('Weave the Pattern', ['🔴', '🩷', '🟡', '⚪'], 'Weave the threads in the pattern shown.'),
    tasks: simon('Busy Workday', ['📝', '📞', '💻', '☕'], 'Do the tasks in the order they pop up.'),
    piano: simon('Jazz Session', ['🎹', '🎷', '🥁', '🎺'], 'Follow the band: repeat the riff!'),
  },
  dodge: {
    boulders: dodge('Siege Boulders', 'boulder', '#9a948a', 'Boulders are flying over the wall! Get out of the red circles.'),
    swords: dodge('Rain of Swords', 'sword', '#c8ccd4', 'Swords fall from the sky. Keep moving!'),
    meteors: dodge('Meteor Shower', 'meteor', '#ff8a3c', 'Meteors incoming! Dodge the red circles.'),
    snaps: dodge('Swamp Snaps', 'boulder', '#4f7a3a', 'Something in the swamp snaps at you. Watch the red circles!'),
    lightning: dodge('Lightning Storm', 'bolt', '#fff176', 'Lightning strikes the deck! Stay out of the red circles.'),
    icicles: dodge('Icicle Fall', 'icicle', '#bfe3f2', 'Icicles are falling! Dodge them.'),
  },
  stealth: {
    deer: { title: 'The Stalk', watcher: 'deer', hint: 'Creep up on the deer. Freeze whenever it looks (👀)!', missText: 'It spotted you!', hitText: 'Gotcha!' },
    cub: { title: "Don't Wake the Cub", watcher: 'cub', anchor: 'bed', hint: 'Tiptoe to the cub to tuck it in. Freeze when it stirs (👀)!', missText: 'The cub stirred!', hitText: 'Tucked in 💤' },
    owl: { title: 'Night Sneak', watcher: 'owl', hint: 'Sneak past the owl in the dark. Freeze when it looks!', missText: 'Hoo! Spotted!', hitText: 'Sneaky!' },
  },
};

export function variantFor(ref: GameRef | undefined): { ref: GameRef; v: Variant } {
  const r = ref && CATALOG[ref.type]?.[ref.variant] ? ref : { type: 'collector' as const, variant: 'coins' };
  return { ref: r, v: CATALOG[r.type][r.variant] };
}
