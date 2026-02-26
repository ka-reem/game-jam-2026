export type ZombieType = 'basic_zombie' | 'armored_zombie' | 'runner_zombie' | 'giant_zombie' | 'boss_zombie';

export interface WaveConfig {
  type: ZombieType;
  count: number;
  spacing: number;
  hp: number;
  speed: number;
  rows?: number;
}

export interface GateOptionConfig {
  type: 'multiply' | 'add' | 'reduce' | 'unlock' | 'power';
  value: number;
  label: string;
}

export interface GatePairConfig {
  left: GateOptionConfig;
  right: GateOptionConfig;
}

export interface LevelConfig {
  level: number;
  zombieWaves: WaveConfig[];
  gateSequence: GatePairConfig[];
  bossLevel: boolean;
}

const GATE_PRESETS: GatePairConfig[] = [
  { left: { type: 'multiply', value: 2, label: 'x2' }, right: { type: 'add', value: 5, label: '+5' } },
  { left: { type: 'add', value: 10, label: '+10' }, right: { type: 'multiply', value: 3, label: 'x3' } },
  { left: { type: 'unlock', value: 1, label: 'SHOTGUN' }, right: { type: 'multiply', value: 2, label: 'x2' } },
  { left: { type: 'multiply', value: 5, label: 'x5' }, right: { type: 'reduce', value: -5, label: '-5' } },
  { left: { type: 'power', value: 1, label: 'PIERCE' }, right: { type: 'add', value: 20, label: '+20' } },
  { left: { type: 'add', value: 15, label: '+15' }, right: { type: 'unlock', value: 2, label: 'CHAIN' } },
  { left: { type: 'multiply', value: 4, label: 'x4' }, right: { type: 'add', value: 30, label: '+30' } },
  { left: { type: 'reduce', value: -10, label: '-10' }, right: { type: 'multiply', value: 10, label: 'x10' } },
];

function makeLevel(lvl: number): LevelConfig {
  const bossLevel = lvl % 5 === 0;
  const scale = 1 + (lvl - 1) * 0.3;

  const waves: WaveConfig[] = [];
  const baseCount = Math.min(3 + lvl * 2, 20);

  if (bossLevel) {
    waves.push({ type: 'basic_zombie', count: baseCount, spacing: 80, hp: Math.round(3 * scale), speed: Math.round(60 + lvl * 5) });
    waves.push({ type: 'armored_zombie', count: Math.ceil(baseCount / 2), spacing: 100, hp: Math.round(8 * scale), speed: Math.round(50 + lvl * 4) });
    waves.push({ type: 'boss_zombie', count: 1, spacing: 200, hp: Math.round(50 * scale), speed: Math.round(40 + lvl * 3) });
  } else if (lvl <= 2) {
    waves.push({ type: 'basic_zombie', count: baseCount, spacing: 100, hp: 3, speed: 60 });
  } else if (lvl <= 4) {
    waves.push({ type: 'basic_zombie', count: baseCount, spacing: 80, hp: Math.round(3 * scale), speed: Math.round(60 + lvl * 3) });
    waves.push({ type: 'runner_zombie', count: Math.ceil(baseCount / 2), spacing: 60, hp: Math.round(2 * scale), speed: Math.round(100 + lvl * 5) });
  } else {
    waves.push({ type: 'basic_zombie', count: baseCount, spacing: 80, hp: Math.round(3 * scale), speed: Math.round(65 + lvl * 4) });
    waves.push({ type: 'armored_zombie', count: Math.ceil(baseCount / 3), spacing: 100, hp: Math.round(8 * scale), speed: Math.round(50 + lvl * 3) });
    if (lvl >= 7) {
      waves.push({ type: 'giant_zombie', count: Math.max(1, Math.floor(lvl / 3)), spacing: 150, hp: Math.round(20 * scale), speed: Math.round(40 + lvl * 2) });
    }
  }

  const gateCount = Math.min(2 + Math.floor(lvl / 2), 6);
  const gates: GatePairConfig[] = [];
  for (let i = 0; i < gateCount; i++) {
    gates.push(GATE_PRESETS[i % GATE_PRESETS.length]);
  }

  return { level: lvl, zombieWaves: waves, gateSequence: gates, bossLevel };
}

const LEVELS: LevelConfig[] = [];
for (let i = 1; i <= 50; i++) {
  LEVELS.push(makeLevel(i));
}

export function getLevelConfig(level: number): LevelConfig {
  const idx = Math.min(level - 1, LEVELS.length - 1);
  return LEVELS[idx];
}
