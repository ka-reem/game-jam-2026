import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, PLAYER_WIDTH, PLAYER_HEIGHT, ZOMBIE_WIDTH, ZOMBIE_HEIGHT, GATE_WIDTH, GATE_HEIGHT } from '../utils/Constants';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  create(): void {
    this.generateTextures();

    // Title screen — semi-transparent overlay so Three.js background shows through
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0d0d1a, 0.55);
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, 'ZOMBIE\nLANE SHOOTER', {
      fontSize: '42px', fontFamily: 'Arial Black, Arial', color: '#00ffee',
      stroke: '#000000', strokeThickness: 5, align: 'center'
    }).setOrigin(0.5);

    const sub = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60, 'TAP TO PLAY', {
      fontSize: '24px', fontFamily: 'Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5);

    this.tweens.add({ targets: sub, alpha: 0, yoyo: true, repeat: -1, duration: 700 });

    this.input.once('pointerdown', () => {
      this.scene.start('GameScene');
    });
  }

  private generateTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 });

    // Bullet - yellow circle
    g.clear();
    g.fillStyle(0xffff00, 1);
    g.fillCircle(6, 6, 6);
    g.generateTexture('bullet', 12, 12);

    // Basic zombie - green rectangle with face
    g.clear();
    g.fillStyle(0x33cc33, 1);
    g.fillRect(0, 0, ZOMBIE_WIDTH, ZOMBIE_HEIGHT);
    g.fillStyle(0x000000, 1);
    g.fillRect(6, 12, 8, 6);
    g.fillRect(22, 12, 8, 6);
    g.fillStyle(0xff0000, 1);
    g.fillRect(8, 28, 20, 4);
    g.generateTexture('basic_zombie', ZOMBIE_WIDTH, ZOMBIE_HEIGHT);

    // Armored zombie - grey with X marks
    g.clear();
    g.fillStyle(0x888888, 1);
    g.fillRect(0, 0, ZOMBIE_WIDTH, ZOMBIE_HEIGHT);
    g.fillStyle(0x555555, 1);
    g.fillRect(2, 2, ZOMBIE_WIDTH - 4, 10);
    g.fillRect(2, 36, ZOMBIE_WIDTH - 4, 10);
    g.fillStyle(0xffffff, 0.5);
    g.fillRect(4, 14, 12, 3);
    g.fillRect(20, 14, 12, 3);
    g.generateTexture('armored_zombie', ZOMBIE_WIDTH, ZOMBIE_HEIGHT);

    // Runner zombie - orange, taller/thinner
    g.clear();
    g.fillStyle(0xff8800, 1);
    g.fillRect(0, 0, 26, ZOMBIE_HEIGHT + 8);
    g.fillStyle(0x000000, 1);
    g.fillRect(5, 10, 6, 5);
    g.fillRect(15, 10, 6, 5);
    g.generateTexture('runner_zombie', 26, ZOMBIE_HEIGHT + 8);

    // Giant zombie - dark red, large
    g.clear();
    g.fillStyle(0x880000, 1);
    g.fillRect(0, 0, ZOMBIE_WIDTH + 20, ZOMBIE_HEIGHT + 20);
    g.fillStyle(0xff0000, 1);
    g.fillRect(8, 12, 10, 8);
    g.fillRect(30, 12, 10, 8);
    g.fillStyle(0x000000, 1);
    g.fillRect(10, 32, 26, 5);
    g.generateTexture('giant_zombie', ZOMBIE_WIDTH + 20, ZOMBIE_HEIGHT + 20);

    // Boss zombie - purple, large
    g.clear();
    g.fillStyle(0x7700aa, 1);
    g.fillRect(0, 0, ZOMBIE_WIDTH + 30, ZOMBIE_HEIGHT + 30);
    g.fillStyle(0xff00ff, 1);
    g.fillRect(0, 0, ZOMBIE_WIDTH + 30, 10);
    g.fillRect(0, ZOMBIE_HEIGHT + 20, ZOMBIE_WIDTH + 30, 10);
    g.fillStyle(0xffffff, 1);
    g.fillRect(8, 14, 12, 10);
    g.fillRect(30, 14, 12, 10);
    g.fillStyle(0xff0000, 0.8);
    g.fillCircle(10 + 6, 14 + 5, 4);
    g.fillCircle(30 + 6, 14 + 5, 4);
    g.generateTexture('boss_zombie', ZOMBIE_WIDTH + 30, ZOMBIE_HEIGHT + 30);

    // Particle
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('particle', 8, 8);

    // Barrel obstacle
    g.clear();
    g.fillStyle(0x8a4f24, 1);
    g.fillRoundedRect(2, 0, 28, 36, 6);
    g.fillStyle(0x3a2a1e, 1);
    g.fillRect(2, 4, 28, 5);
    g.fillRect(2, 16, 28, 5);
    g.fillRect(2, 28, 28, 5);
    g.fillStyle(0xffaa00, 0.9);
    g.fillCircle(16, 18, 4);
    g.generateTexture('barrel', 32, 36);

    g.destroy();
  }
}
