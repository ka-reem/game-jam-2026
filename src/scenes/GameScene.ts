import Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT, PLAYER_ZONE_Y, BULLET_SPEED,
  GATE_WIDTH, GATE_HEIGHT, GATE_GAP, SCROLL_SPEED
} from '../utils/Constants';
import { Player, WeaponType } from '../objects/Player';
import { BulletPool } from '../objects/BulletPool';
import { ZombiePool } from '../objects/ZombiePool';
import { Zombie } from '../objects/Zombie';
import { Gate, GateOption, makeGateOption } from '../objects/Gate';
import { ParticleManager } from '../objects/ParticleManager';
import { GameState } from '../data/GameState';
import { getLevelConfig, LevelConfig, WaveConfig, GatePairConfig } from '../data/LevelData';

type PhaseType = 'intro' | 'gate' | 'horde' | 'clearing' | 'complete';

export class GameScene extends Phaser.Scene {
  private player: Player;
  private bulletPool: BulletPool;
  private zombiePool: ZombiePool;
  private particleManager: ParticleManager;
  private gates: Gate[] = [];

  private phase: PhaseType = 'intro';
  private levelConfig: LevelConfig;
  private currentWaveIndex: number = 0;
  private zombiesSpawned: number = 0;
  private zombiesKilled: number = 0;
  private totalZombiesInLevel: number = 0;
  private spawnTimer: number = 0;
  private gateTimer: number = 0;
  private gateIndex: number = 0;

  private score: number = 0;
  private multiplierChain: number = 1;

  private fireTimer: Phaser.Time.TimerEvent;
  private laserGraphics: Phaser.GameObjects.Graphics;
  private bgGraphics: Phaser.GameObjects.Graphics;
  private introText: Phaser.GameObjects.Text;

  private pointer: Phaser.Input.Pointer;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Reset state
    this.score = 0;
    this.multiplierChain = 1;
    this.zombiesKilled = 0;
    this.zombiesSpawned = 0;
    this.currentWaveIndex = 0;
    this.gateIndex = 0;
    this.phase = 'intro';
    this.gates = [];

    this.levelConfig = getLevelConfig(GameState.currentLevel);
    this.totalZombiesInLevel = this.levelConfig.zombieWaves.reduce((s, w) => s + w.count, 0);

    // Background
    this.bgGraphics = this.add.graphics();
    this.drawBackground();

    // Game objects
    this.particleManager = new ParticleManager(this);
    this.bulletPool = new BulletPool(this);
    this.zombiePool = new ZombiePool(this);
    this.player = new Player(this);

    this.laserGraphics = this.add.graphics().setDepth(6);

    // Input
    this.pointer = this.input.activePointer;
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { this.pointer = p; });

    // Auto-fire timer
    this.fireTimer = this.time.addEvent({
      delay: this.player.getFireRate(),
      loop: true,
      callback: this.fireWeapon,
      callbackScope: this
    });

    // Emit initial UI
    this.events.emit('updateLevel', GameState.currentLevel);
    this.events.emit('updateScore', 0);
    this.emitBulletUpdate();

    // Show level intro
    this.showLevelIntro();
  }

  private drawBackground(): void {
    this.bgGraphics.clear();
    // No background fill — Three.js provides the 3D ground layer.

    // Lane dividers (subtle overlay matching Three.js lane lines)
    this.bgGraphics.lineStyle(1, 0x00ffee, 0.12);
    const laneW = GAME_WIDTH / 3;
    for (let i = 1; i < 3; i++) {
      this.bgGraphics.beginPath();
      this.bgGraphics.moveTo(laneW * i, 0);
      this.bgGraphics.lineTo(laneW * i, GAME_HEIGHT);
      this.bgGraphics.strokePath();
    }

    // Player zone separator
    this.bgGraphics.lineStyle(2, 0x00ffee, 0.3);
    this.bgGraphics.beginPath();
    this.bgGraphics.moveTo(0, PLAYER_ZONE_Y - 30);
    this.bgGraphics.lineTo(GAME_WIDTH, PLAYER_ZONE_Y - 30);
    this.bgGraphics.strokePath();
  }

  private showLevelIntro(): void {
    this.introText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `LEVEL ${GameState.currentLevel}`, {
      fontSize: '52px', fontFamily: 'Arial Black, Arial', color: '#00ffee',
      stroke: '#000000', strokeThickness: 6
    }).setOrigin(0.5).setDepth(30).setAlpha(0);

    this.tweens.add({
      targets: this.introText,
      alpha: 1,
      duration: 400,
      yoyo: true,
      hold: 600,
      onComplete: () => {
        this.introText.destroy();
        this.startGatePhase();
      }
    });
  }

  private startGatePhase(): void {
    this.phase = 'gate';
    this.gateTimer = 0;
    this.gateIndex = 0;
  }

  private startHordePhase(): void {
    this.phase = 'horde';
    this.currentWaveIndex = 0;
    this.zombiesSpawned = 0;
    this.spawnTimer = 0;
  }

  private spawnGate(): void {
    if (this.gateIndex >= this.levelConfig.gateSequence.length) {
      // Done with gates, start horde
      this.startHordePhase();
      return;
    }

    const cfg: GatePairConfig = this.levelConfig.gateSequence[this.gateIndex++];
    const leftOpt = makeGateOption(cfg.left.type, cfg.left.value, cfg.left.label);
    const rightOpt = makeGateOption(cfg.right.type, cfg.right.value, cfg.right.label);

    const gate = new Gate(
      this,
      GAME_WIDTH / 2,
      -GATE_HEIGHT / 2,
      leftOpt,
      rightOpt,
      GATE_WIDTH,
      GATE_HEIGHT,
      GATE_GAP
    );
    this.gates.push(gate);
  }

  private fireWeapon(): void {
    if (this.phase === 'intro' || this.phase === 'complete') return;
    if (!this.player.active) return;

    const px = this.player.x;
    const py = this.player.y - 20;
    const dmg = this.player.getDamage();
    const size = this.player.modifiers.bulletSize;
    const weapon = this.player.weaponType;

    switch (weapon) {
      case 'single':
        this.spawnBullet(px, py, 0, -BULLET_SPEED, dmg, false, size);
        break;

      case 'shotgun':
        for (let i = -2; i <= 2; i++) {
          const angle = (i * 12) * (Math.PI / 180);
          const vx = Math.sin(angle) * BULLET_SPEED;
          const vy = -Math.cos(angle) * BULLET_SPEED;
          this.spawnBullet(px, py, vx, vy, dmg, false, size * 0.8);
        }
        break;

      case 'pierce':
        this.spawnBullet(px, py, 0, -BULLET_SPEED, dmg, true, size);
        break;

      case 'laser':
        // Laser handled in update via laserGraphics
        this.laserFire(px, py, dmg);
        break;

      case 'bomb': {
        const isBomb = this.player.isBombShot();
        this.spawnBullet(px, py, 0, -BULLET_SPEED, isBomb ? dmg * 5 : dmg, false, isBomb ? size * 2 : size);
        if (this.player.modifiers.doubleShot) {
          this.spawnBullet(px - 15, py, 0, -BULLET_SPEED, dmg, false, size);
          this.spawnBullet(px + 15, py, 0, -BULLET_SPEED, dmg, false, size);
        }
        break;
      }

      case 'chain':
        this.spawnBullet(px, py, 0, -BULLET_SPEED, dmg, true, size);
        if (this.player.modifiers.doubleShot) {
          this.spawnBullet(px - 12, py, 0, -BULLET_SPEED, dmg, true, size);
          this.spawnBullet(px + 12, py, 0, -BULLET_SPEED, dmg, true, size);
        }
        break;
    }

    if (this.player.modifiers.doubleShot && weapon === 'single') {
      this.spawnBullet(px - 14, py, 0, -BULLET_SPEED, dmg, false, size);
      this.spawnBullet(px + 14, py, 0, -BULLET_SPEED, dmg, false, size);
    }

    this.emitBulletUpdate();
  }

  private laserFire(px: number, py: number, dmg: number): void {
    this.laserGraphics.clear();
    this.laserGraphics.lineStyle(4, 0xff00ff, 0.9);
    this.laserGraphics.beginPath();
    this.laserGraphics.moveTo(px, py);
    this.laserGraphics.lineTo(px, 0);
    this.laserGraphics.strokePath();

    this.laserGraphics.lineStyle(2, 0xffffff, 0.6);
    this.laserGraphics.beginPath();
    this.laserGraphics.moveTo(px, py);
    this.laserGraphics.lineTo(px, 0);
    this.laserGraphics.strokePath();

    // Hit zombies in laser path
    const active = this.zombiePool.getActive();
    for (const z of active) {
      if (Math.abs(z.x - px) < 20) {
        const died = z.takeDamage(dmg * 0.3);
        if (died) this.onZombieDied(z);
        else this.particleManager.spawnHitSpark(z.x, z.y);
      }
    }

    // Fade out laser quickly
    this.time.delayedCall(80, () => this.laserGraphics.clear());
  }

  private spawnBullet(x: number, y: number, vx: number, vy: number, dmg: number, piercing: boolean, size: number): void {
    const b = this.bulletPool.get();
    if (b) b.init(x, y, dmg, piercing, size, vx, vy);
  }

  private checkBulletZombieCollisions(): void {
    const bullets = this.bulletPool.getActive();
    const zombies = this.zombiePool.getActive();

    for (const b of bullets) {
      if (!b.active) continue;
      for (const z of zombies) {
        if (!z.active) continue;
        const dx = b.x - z.x;
        const dy = b.y - z.y;
        const hw = z.displayWidth / 2 + 6;
        const hh = z.displayHeight / 2 + 6;
        if (Math.abs(dx) < hw && Math.abs(dy) < hh) {
          this.particleManager.spawnHitSpark(z.x, z.y);
          const died = z.takeDamage(b.damage);
          if (!b.piercing) b.deactivate();
          if (died) this.onZombieDied(z);
          break;
        }
      }
    }
  }

  private onZombieDied(z: Zombie): void {
    this.zombiesKilled++;
    const pts = 100 * this.multiplierChain;
    this.score += pts;
    this.events.emit('updateScore', this.score);

    const color = z.zombieType === 'boss_zombie' ? 0xff00ff :
                  z.zombieType === 'giant_zombie' ? 0xff0000 :
                  z.zombieType === 'armored_zombie' ? 0x888888 : 0x33cc33;
    this.particleManager.spawnExplosion(z.x, z.y, color, 12);

    // Show score popup
    const popup = this.add.text(z.x, z.y - 20, '+' + pts, {
      fontSize: '18px', fontFamily: 'Arial Black', color: '#ffff00',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(15);
    this.tweens.add({
      targets: popup,
      y: z.y - 70,
      alpha: 0,
      duration: 800,
      onComplete: () => popup.destroy()
    });

    z.deactivate();
  }

  private checkGateCollisions(): void {
    const px = this.player.x;
    const py = this.player.y;

    for (let i = this.gates.length - 1; i >= 0; i--) {
      const gate = this.gates[i];
      if (gate.passed) continue;

      const leftBounds = gate.getLeftBounds();
      const rightBounds = gate.getRightBounds();

      if (leftBounds.contains(px, py)) {
        gate.passed = true;
        gate.flashLeft();
        this.applyGateEffect(gate.leftOption);
        this.scheduleGateDestroy(gate, i);
      } else if (rightBounds.contains(px, py)) {
        gate.passed = true;
        gate.flashRight();
        this.applyGateEffect(gate.rightOption);
        this.scheduleGateDestroy(gate, i);
      }

      // Destroy gates that scrolled off screen
      if (gate.y > GAME_HEIGHT + GATE_HEIGHT) {
        gate.destroy();
        this.gates.splice(i, 1);
      }
    }
  }

  private scheduleGateDestroy(gate: Gate, idx: number): void {
    this.time.delayedCall(300, () => {
      const i = this.gates.indexOf(gate);
      if (i >= 0) {
        gate.destroy();
        this.gates.splice(i, 1);
      }
    });
  }

  private applyGateEffect(opt: GateOption): void {
    const p = this.player;
    switch (opt.type) {
      case 'multiply':
        p.modifiers.multiplier *= opt.value;
        this.multiplierChain *= opt.value;
        this.events.emit('showMultiplier', this.multiplierChain);
        break;
      case 'add':
        p.modifiers.addBonus += opt.value;
        this.events.emit('showGateEffect', '+' + opt.value + ' BULLETS!');
        break;
      case 'reduce':
        p.modifiers.addBonus = Math.max(0, p.modifiers.addBonus + opt.value);
        this.events.emit('showGateEffect', opt.value + ' BULLETS');
        break;
      case 'unlock':
        // opt.value: 1=shotgun, 2=chain, etc.
        const weapons: WeaponType[] = ['single', 'shotgun', 'pierce', 'laser', 'bomb', 'chain'];
        p.setWeapon(weapons[Math.min(opt.value, weapons.length - 1)]);
        this.events.emit('showGateEffect', 'WEAPON: ' + p.weaponType.toUpperCase() + '!');
        break;
      case 'power':
        if (opt.value === 1) {
          p.setWeapon('pierce');
          this.events.emit('showGateEffect', 'PIERCE UNLOCKED!');
        } else {
          p.modifiers.fireRateMultiplier *= 1.5;
          this.events.emit('showGateEffect', 'FIRE RATE UP!');
        }
        break;
    }
    this.emitBulletUpdate();
  }

  private emitBulletUpdate(): void {
    this.events.emit('updateBullets', this.player.getBulletCount(), this.player.weaponType);
  }

  private spawnWaveZombie(wave: WaveConfig): void {
    const lanes = [GAME_WIDTH / 6, GAME_WIDTH / 2, (GAME_WIDTH * 5) / 6];
    const laneIdx = Math.floor(Math.random() * lanes.length);
    const x = lanes[laneIdx] + (Math.random() - 0.5) * 40;
    const y = -50 - Math.random() * 40;
    this.zombiePool.spawn(x, y, wave.type, wave.hp, wave.speed);
  }

  private checkLevelClear(): void {
    if (this.phase !== 'horde' && this.phase !== 'clearing') return;

    const allWavesDone = this.currentWaveIndex >= this.levelConfig.zombieWaves.length &&
      this.zombiesSpawned >= this.getCurrentWaveTotal();

    const allDead = this.zombiePool.getActive().length === 0;

    if (allDead && (this.phase === 'clearing' || allWavesDone)) {
      this.phase = 'complete';
      this.levelComplete();
    }
  }

  private getCurrentWaveTotal(): number {
    return this.levelConfig.zombieWaves.reduce((s, w) => s + w.count, 0);
  }

  private levelComplete(): void {
    this.fireTimer.remove();

    // Clear remaining bullets
    for (const b of this.bulletPool.getActive()) b.deactivate();

    // Stars based on score
    const target = this.totalZombiesInLevel * 100 * 3;
    let stars = 1;
    if (this.score >= target * 0.9) stars = 3;
    else if (this.score >= target * 0.5) stars = 2;

    GameState.levelStars[GameState.currentLevel] = Math.max(GameState.levelStars[GameState.currentLevel] || 0, stars);
    GameState.totalStars = Object.values(GameState.levelStars).reduce((a, b) => a + b, 0);
    GameState.currentScore = this.score;

    this.time.delayedCall(500, () => {
      this.scene.pause('UIScene');
      this.scene.launch('LevelCompleteScene', {
        level: GameState.currentLevel,
        score: this.score,
        zombiesKilled: this.zombiesKilled,
        stars
      });
    });
  }

  update(time: number, delta: number): void {
    if (this.phase === 'intro') return;

    // Player tracking
    if (this.input.activePointer.isDown || this.input.activePointer.x !== 0) {
      this.player.updatePosition(this.input.activePointer.x, delta);
    }

    // Update pools
    this.bulletPool.updateAll();
    this.zombiePool.updateAll(delta);
    this.particleManager.update(delta);

    // Update gates
    for (const gate of this.gates) {
      gate.update(delta);
    }

    // Collisions
    this.checkBulletZombieCollisions();
    this.checkGateCollisions();

    if (this.phase === 'gate') {
      this.gateTimer += delta;
      if (this.gateTimer > 2500) {
        this.gateTimer = 0;
        this.spawnGate();
      }
    }

    if (this.phase === 'horde' || this.phase === 'clearing') {
      this.updateHordeSpawning(delta);
      this.checkLevelClear();

      // Check if any zombie reached the bottom (player zone)
      const active = this.zombiePool.getActive();
      for (const z of active) {
        if (z.y > PLAYER_ZONE_Y + 20) {
          z.deactivate();
          // Could add player damage here
        }
      }
    }
  }

  private updateHordeSpawning(delta: number): void {
    const waves = this.levelConfig.zombieWaves;
    if (this.currentWaveIndex >= waves.length) {
      this.phase = 'clearing';
      return;
    }

    const wave = waves[this.currentWaveIndex];
    this.spawnTimer += delta;

    if (this.spawnTimer >= wave.spacing) {
      this.spawnTimer = 0;
      this.spawnWaveZombie(wave);
      this.zombiesSpawned++;

      // Count how many of this wave have been spawned
      let spawnedThisWave = this.zombiesSpawned;
      for (let i = 0; i < this.currentWaveIndex; i++) {
        spawnedThisWave -= waves[i].count;
      }

      if (spawnedThisWave >= wave.count) {
        this.currentWaveIndex++;
        this.spawnTimer = -wave.spacing * 0.5; // brief pause between waves
      }
    }
  }
}
