import Phaser from 'phaser';
import { Bullet } from './Bullet';

export class BulletPool {
  private scene: Phaser.Scene;
  private pool: Bullet[] = [];
  private readonly MAX_BULLETS = 500;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    for (let i = 0; i < this.MAX_BULLETS; i++) {
      const b = new Bullet(scene, -100, -100);
      this.pool.push(b);
    }
  }

  get(): Bullet | null {
    for (const b of this.pool) {
      if (!b.active) return b;
    }
    return null;
  }

  getAll(): Bullet[] {
    return this.pool;
  }

  getActive(): Bullet[] {
    return this.pool.filter(b => b.active);
  }

  updateAll(): void {
    for (const b of this.pool) {
      if (b.active) b.update();
    }
  }
}
