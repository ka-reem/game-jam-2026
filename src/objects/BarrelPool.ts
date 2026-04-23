import Phaser from 'phaser';
import { Barrel } from './Barrel';

export class BarrelPool {
  private pool: Barrel[] = [];
  private readonly MAX_BARRELS = 40;

  constructor(scene: Phaser.Scene) {
    for (let i = 0; i < this.MAX_BARRELS; i++) {
      this.pool.push(new Barrel(scene, -200, -200));
    }
  }

  spawn(x: number, y: number, hp: number, speed: number): Barrel | null {
    for (const b of this.pool) {
      if (!b.active) {
        b.spawn(x, y, hp, speed);
        return b;
      }
    }
    return null;
  }

  getActive(): Barrel[] {
    return this.pool.filter(b => b.active);
  }

  updateAll(): void {
    for (const b of this.pool) {
      if (b.active) b.update();
    }
  }
}
