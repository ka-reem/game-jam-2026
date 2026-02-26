import Phaser from 'phaser';
import { GAME_WIDTH, PLAYER_ZONE_Y, PLAYER_WIDTH, PLAYER_HEIGHT, BASE_FIRE_RATE, BULLET_SPEED } from '../utils/Constants';

export type WeaponType = 'single' | 'shotgun' | 'pierce' | 'laser' | 'bomb' | 'chain';

export interface BulletModifiers {
  multiplier: number;
  addBonus: number;
  fireRateMultiplier: number;
  doubleShot: boolean;
  critChance: number;
  bulletSize: number;
}

export class Player extends Phaser.GameObjects.Container {
  weaponType: WeaponType = 'single';
  modifiers: BulletModifiers = {
    multiplier: 1,
    addBonus: 0,
    fireRateMultiplier: 1,
    doubleShot: false,
    critChance: 0,
    bulletSize: 1
  };

  private sprite: Phaser.GameObjects.Rectangle;
  private gunSprite: Phaser.GameObjects.Rectangle;
  private targetX: number;
  private bombCounter: number = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, GAME_WIDTH / 2, PLAYER_ZONE_Y);

    // Body
    this.sprite = scene.add.rectangle(0, 0, PLAYER_WIDTH, PLAYER_HEIGHT, 0x00ffee);
    // Gun barrel
    this.gunSprite = scene.add.rectangle(0, -PLAYER_HEIGHT / 2 - 5, 6, 16, 0x008888);

    this.add([this.sprite, this.gunSprite]);
    scene.add.existing(this);
    this.setDepth(5);
    this.targetX = GAME_WIDTH / 2;
  }

  getBulletCount(): number {
    return this.modifiers.multiplier + this.modifiers.addBonus;
  }

  getFireRate(): number {
    return BASE_FIRE_RATE / this.modifiers.fireRateMultiplier;
  }

  getDamage(): number {
    let dmg = this.modifiers.multiplier;
    if (Math.random() < this.modifiers.critChance) dmg *= 2;
    return dmg;
  }

  isBombShot(): boolean {
    if (this.weaponType === 'bomb') {
      this.bombCounter++;
      if (this.bombCounter >= 10) {
        this.bombCounter = 0;
        return true;
      }
    }
    return false;
  }

  resetForLevel(): void {
    this.weaponType = 'single';
    this.modifiers = {
      multiplier: 1,
      addBonus: 0,
      fireRateMultiplier: 1,
      doubleShot: false,
      critChance: 0,
      bulletSize: 1
    };
    this.bombCounter = 0;
    this.setPosition(GAME_WIDTH / 2, PLAYER_ZONE_Y);
    this.targetX = GAME_WIDTH / 2;
  }

  updatePosition(pointerX: number, delta: number): void {
    const minX = PLAYER_WIDTH / 2;
    const maxX = GAME_WIDTH - PLAYER_WIDTH / 2;
    const clamped = Phaser.Math.Clamp(pointerX, minX, maxX);
    // Lerp for slight smoothing
    this.targetX = clamped;
    this.x = Phaser.Math.Linear(this.x, this.targetX, 0.25);
  }

  setWeapon(type: WeaponType): void {
    this.weaponType = type;
    // Tint change to indicate weapon
    const colors: Record<WeaponType, number> = {
      single: 0x00ffee,
      shotgun: 0xff8800,
      pierce: 0x88ffff,
      laser: 0xff00ff,
      bomb: 0xff3300,
      chain: 0x44ff44
    };
    this.sprite.setFillStyle(colors[type]);
  }
}
