import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/Constants';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
}

export class ParticleManager {
  private scene: Phaser.Scene;
  private particles: Particle[] = [];
  private graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(10);
  }

  spawnExplosion(x: number, y: number, color: number = 0xff6600, count: number = 10): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 80 + Math.random() * 120;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 600 + Math.random() * 300,
        maxLife: 900,
        color,
        size: 3 + Math.random() * 3
      });
    }
  }

  spawnHitSpark(x: number, y: number): void {
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 80;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 200 + Math.random() * 150,
        maxLife: 350,
        color: 0xffff00,
        size: 2 + Math.random() * 2
      });
    }
  }

  update(delta: number): void {
    const dt = delta / 1000;
    this.graphics.clear();

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 150 * dt;

      const alpha = Math.max(0, p.life / p.maxLife);
      this.graphics.fillStyle(p.color, alpha);
      this.graphics.fillCircle(p.x, p.y, p.size * alpha);
    }
  }

  clear(): void {
    this.particles = [];
    this.graphics.clear();
  }
}
