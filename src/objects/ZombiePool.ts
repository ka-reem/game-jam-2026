import Phaser from 'phaser';
import { Zombie } from './Zombie';
import { ZombieType } from '../data/LevelData';

export class ZombiePool {
  private pool: Zombie[] = [];
  private readonly MAX_ZOMBIES = 100;

  constructor(scene: Phaser.Scene) {
    for (let i = 0; i < this.MAX_ZOMBIES; i++) {
      const z = new Zombie(scene, -200, -200);
      this.pool.push(z);
    }
  }

  spawn(x: number, y: number, type: ZombieType, hp: number, speed: number): Zombie | null {
    for (const z of this.pool) {
      if (!z.active) {
        z.spawn(x, y, type, hp, speed);
        return z;
      }
    }
    return null;
  }

  getAll(): Zombie[] {
    return this.pool;
  }

  getActive(): Zombie[] {
    return this.pool.filter(z => z.active);
  }

  updateAll(delta: number): void {
    for (const z of this.pool) {
      if (z.active) z.update(delta);
    }
  }
}
