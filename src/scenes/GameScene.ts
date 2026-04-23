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
import { BarrelPool } from '../objects/BarrelPool';
import { ParticleManager } from '../objects/ParticleManager';
import { GameState } from '../data/GameState';
import { getLevelConfig, LevelConfig, WaveConfig, GatePairConfig } from '../data/LevelData';

type PhaseType = 'intro' | 'gate' | 'horde' | 'clearing' | 'complete';

export class GameScene extends Phaser.Scene {
  private static readonly ROAD_TOP_Y = 70;
  private static readonly ROAD_TOP_WIDTH = GAME_WIDTH * 0.36;
  private static readonly ROAD_BOTTOM_WIDTH = GAME_WIDTH * 1.05;

  private player: Player;
  private bulletPool: BulletPool;
  private zombiePool: ZombiePool;
  private barrelPool: BarrelPool;
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
  private barrelTimer: number = 0;
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
    this.barrelTimer = 0;
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
    this.barrelPool = new BarrelPool(this);
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
    const topY = GameScene.ROAD_TOP_Y;
    const bottomY = GAME_HEIGHT;
    const topW = GameScene.ROAD_TOP_WIDTH;
    const bottomW = GameScene.ROAD_BOTTOM_WIDTH;
    const cx = GAME_WIDTH / 2;
    const leftTop = cx - topW / 2;
    const rightTop = cx + topW / 2;
    const leftBottom = cx - bottomW / 2;
    const rightBottom = cx + bottomW / 2;

    this.bgGraphics.fillStyle(0x0f1a2a, 0.45);
    this.bgGraphics.beginPath();
    this.bgGraphics.moveTo(leftTop, topY);
    this.bgGraphics.lineTo(rightTop, topY);
    this.bgGraphics.lineTo(rightBottom, bottomY);
    this.bgGraphics.lineTo(leftBottom, bottomY);
    this.bgGraphics.closePath();
    this.bgGraphics.fillPath();

    this.bgGraphics.lineStyle(3, 0x00d6d6, 0.35);
    this.bgGraphics.beginPath();
    this.bgGraphics.moveTo(leftTop, topY);
    this.bgGraphics.lineTo(leftBottom, bottomY);
    this.bgGraphics.strokePath();
    this.bgGraphics.beginPath();
    this.bgGraphics.moveTo(rightTop, topY);
    this.bgGraphics.lineTo(rightBottom, bottomY);
    this.bgGraphics.strokePath();

    const laneWTop = topW / 3;
    const laneWBottom = bottomW / 3;
    this.bgGraphics.lineStyle(1.5, 0xffffff, 0.18);
    for (let i = 1; i < 3; i++) {
      const xTop = leftTop + laneWTop * i;
      const xBottom = leftBottom + laneWBottom * i;
      this.bgGraphics.beginPath();
      this.bgGraphics.moveTo(xTop, topY);
      this.bgGraphics.lineTo(xBottom, bottomY);
      this.bgGraphics.strokePath();
    }

    this.bgGraphics.lineStyle(2, 0x00ffee, 0.3);
    this.bgGraphics.beginPath();
    this.bgGraphics.moveTo(leftBottom, PLAYER_ZONE_Y - 30);
    this.bgGraphics.lineTo(rightBottom, PLAYER_ZONE_Y - 30);
    this.bgGraphics.strokePath();
  }

  private getRoadBoundsAtY(y: number): { left: number; right: number; width: number } {
    const t = Phaser.Math.Clamp((y - GameScene.ROAD_TOP_Y) / (GAME_HEIGHT - GameScene.ROAD_TOP_Y), 0, 1);
    const width = Phaser.Math.Linear(GameScene.ROAD_TOP_WIDTH, GameScene.ROAD_BOTTOM_WIDTH, t);
    const left = GAME_WIDTH / 2 - width / 2;
    return { left, right: left + width, width };
  }

  private getLaneCenterAtY(laneIndex: number, y: number): number {
    const b = this.getRoadBoundsAtY(y);
    return b.left + b.width * ((laneIndex + 0.5) / 3);
  }

  private getDepthScale(y: number, min = 0.55, max = 1.2): number {
    const t = Phaser.Math.Clamp((y - GameScene.ROAD_TOP_Y) / (GAME_HEIGHT - GameScene.ROAD_TOP_Y), 0, 1);
    return Phaser.Math.Linear(min, max, t);
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
    const bulletSpeed = this.getBulletSpeed();
    const size = this.player.modifiers.bulletSize;
    const weapon = this.player.weaponType;

    switch (weapon) {
      case 'single':
        this.spawnBullet(px, py, 0, -bulletSpeed, dmg, false, size);
        break;

      case 'shotgun':
        for (let i = -2; i <= 2; i++) {
          const angle = (i * 12) * (Math.PI / 180);
          const vx = Math.sin(angle) * bulletSpeed;
          const vy = -Math.cos(angle) * bulletSpeed;
          this.spawnBullet(px, py, vx, vy, dmg, false, size * 0.8);
        }
        break;

      case 'pierce':
        this.spawnBullet(px, py, 0, -bulletSpeed, dmg, true, size);
        break;

      case 'laser':
        // Laser handled in update via laserGraphics
        this.laserFire(px, py, dmg);
        break;

      case 'bomb': {
        const isBomb = this.player.isBombShot();
        this.spawnBullet(px, py, 0, -bulletSpeed, isBomb ? dmg * 5 : dmg, false, isBomb ? size * 2 : size);
        if (this.player.modifiers.doubleShot) {
          this.spawnBullet(px - 15, py, 0, -bulletSpeed, dmg, false, size);
          this.spawnBullet(px + 15, py, 0, -bulletSpeed, dmg, false, size);
        }
        break;
      }

      case 'chain':
        this.spawnBullet(px, py, 0, -bulletSpeed, dmg, true, size);
        if (this.player.modifiers.doubleShot) {
          this.spawnBullet(px - 12, py, 0, -bulletSpeed, dmg, true, size);
          this.spawnBullet(px + 12, py, 0, -bulletSpeed, dmg, true, size);
        }
        break;
    }

    if (this.player.modifiers.doubleShot && weapon === 'single') {
      this.spawnBullet(px - 14, py, 0, -bulletSpeed, dmg, false, size);
      this.spawnBullet(px + 14, py, 0, -bulletSpeed, dmg, false, size);
    }

    this.emitBulletUpdate();
  }

  private getBulletSpeed(): number {
    const levelScale = Phaser.Math.Clamp(0.7 + (GameState.currentLevel - 1) * 0.08, 0.7, 1.35);
    return BULLET_SPEED * levelScale;
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
    const bullets = this.bulletPool.getActive();

    for (let i = this.gates.length - 1; i >= 0; i--) {
      const gate = this.gates[i];
      if (gate.passed) continue;

      const leftBounds = gate.getLeftBounds();
      const rightBounds = gate.getRightBounds();

      for (const b of bullets) {
        if (!b.active) continue;
        if (leftBounds.contains(b.x, b.y)) {
          b.deactivate();
          gate.hitLeft();
          continue;
        }
        if (rightBounds.contains(b.x, b.y)) {
          b.deactivate();
          gate.hitRight();
        }
      }

      if (leftBounds.contains(px, py)) {
        this.activateGateOption(gate, gate.leftOption, 'left', i);
      } else if (rightBounds.contains(px, py)) {
        this.activateGateOption(gate, gate.rightOption, 'right', i);
      }

      // Destroy gates that scrolled off screen
      if (gate.y > GAME_HEIGHT + GATE_HEIGHT) {
        gate.destroy();
        this.gates.splice(i, 1);
      }
    }
  }

  private activateGateOption(
    gate: Gate,
    option: GateOption,
    side: 'left' | 'right',
    idx: number
  ): void {
    if (gate.passed) return;
    gate.passed = true;
    if (side === 'left') gate.flashLeft();
    else gate.flashRight();
    this.applyGateEffect(option);
    this.scheduleGateDestroy(gate, idx);
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

  private spawnBarrel(): void {
    const lane = Phaser.Math.Between(0, 2);
    const y = -30;
    const x = this.getLaneCenterAtY(lane, y);
    const hp = Math.round(4 + GameState.currentLevel * 1.4);
    const speed = 75 + GameState.currentLevel * 3;
    const barrel = this.barrelPool.spawn(x, y, hp, speed);
    if (barrel) {
      barrel.setData('lane', lane);
      barrel.setScale(this.getDepthScale(y, 0.5, 1.05));
      barrel.setDepth(3);
    }
  }

  private checkBulletBarrelCollisions(): void {
    const bullets = this.bulletPool.getActive();
    const barrels = this.barrelPool.getActive();

    for (const b of bullets) {
      if (!b.active) continue;
      for (const barrel of barrels) {
        if (!barrel.active) continue;
        const dx = b.x - barrel.x;
        const dy = b.y - barrel.y;
        const hw = barrel.displayWidth / 2 + 6;
        const hh = barrel.displayHeight / 2 + 6;
        if (Math.abs(dx) < hw && Math.abs(dy) < hh) {
          if (!b.piercing) b.deactivate();
          const destroyed = barrel.takeDamage(b.damage);
          this.particleManager.spawnHitSpark(barrel.x, barrel.y);
          if (destroyed) {
            this.particleManager.spawnExplosion(barrel.x, barrel.y, 0xffaa00, 10);
            barrel.deactivate();
          }
          break;
        }
      }
    }
  }

  private emitBulletUpdate(): void {
    this.events.emit('updateBullets', this.player.getBulletCount(), this.player.weaponType);
  }

  private spawnWaveZombie(wave: WaveConfig): void {
    const laneIdx = Phaser.Math.Between(0, 2);
    const y = -50 - Math.random() * 40;
    const laneBounds = this.getRoadBoundsAtY(y);
    const jitter = (Math.random() - 0.5) * laneBounds.width * 0.08;
    const x = this.getLaneCenterAtY(laneIdx, y) + jitter;
    const zombie = this.zombiePool.spawn(x, y, wave.type, wave.hp, wave.speed);
    if (zombie) {
      zombie.setData('lane', laneIdx);
      zombie.setData('jitter', jitter);
      zombie.setScale(this.getDepthScale(y, 0.48, 1.2));
      zombie.setDepth(4);
    }
  }

  private applyPerspective(): void {
    const playerBounds = this.getRoadBoundsAtY(this.player.y);
    this.player.x = Phaser.Math.Clamp(this.player.x, playerBounds.left + 18, playerBounds.right - 18);
    this.player.setScale(this.getDepthScale(this.player.y, 0.85, 1.15));

    for (const z of this.zombiePool.getActive()) {
      const lane = z.getData('lane');
      if (typeof lane === 'number') {
        const jitter = z.getData('jitter') ?? 0;
        z.x = this.getLaneCenterAtY(lane, z.y) + jitter;
      }
      z.setScale(this.getDepthScale(z.y, 0.45, 1.25));
      z.setDepth(3 + Math.floor(this.getDepthScale(z.y, 0, 8)));
      z.setRenderVisible(true);
    }

    for (const barrel of this.barrelPool.getActive()) {
      const lane = barrel.getData('lane');
      if (typeof lane === 'number') {
        barrel.x = this.getLaneCenterAtY(lane, barrel.y);
      }
      barrel.setScale(this.getDepthScale(barrel.y, 0.45, 1.12));
      barrel.setDepth(3 + Math.floor(this.getDepthScale(barrel.y, 0, 8)));
      barrel.setRenderVisible(true);
    }

    for (const gate of this.gates) {
      gate.setScale(this.getDepthScale(gate.y, 0.6, 1.35));
      gate.setDepth(2 + Math.floor(this.getDepthScale(gate.y, 0, 8)));
    }
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
      const bounds = this.getRoadBoundsAtY(this.player.y);
      this.player.updatePosition(this.input.activePointer.x, delta, bounds.left + 18, bounds.right - 18);
    }

    // Update pools
    this.bulletPool.updateAll();
    this.zombiePool.updateAll(delta);
    this.barrelPool.updateAll();
    this.particleManager.update(delta);

    // Update gates
    for (const gate of this.gates) {
      gate.update(delta);
    }
    this.applyPerspective();

    // Collisions
    this.checkBulletZombieCollisions();
    this.checkBulletBarrelCollisions();
    this.checkGateCollisions();

    if (this.phase === 'gate') {
      this.gateTimer += delta;
      if (this.gateTimer > 2500) {
        this.gateTimer = 0;
        this.spawnGate();
      }
    }

    if (this.phase === 'horde' || this.phase === 'clearing') {
      this.barrelTimer += delta;
      if (this.barrelTimer > 2400) {
        this.barrelTimer = 0;
        this.spawnBarrel();
      }

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

      for (const barrel of this.barrelPool.getActive()) {
        if (barrel.y > PLAYER_ZONE_Y + 20) {
          barrel.deactivate();
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
