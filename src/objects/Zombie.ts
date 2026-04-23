import Phaser from 'phaser';
import { ZombieType } from '../data/LevelData';

export class Zombie extends Phaser.Physics.Arcade.Sprite {
  hp: number = 3;
  maxHp: number = 3;
  speed: number = 60;
  zombieType: ZombieType = 'basic_zombie';
  private hpBar: Phaser.GameObjects.Graphics;
  private flashTimer: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'basic_zombie');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.hpBar = scene.add.graphics();
    this.setActive(false);
    this.setVisible(false);
    this.hpBar.setVisible(false);
  }

  spawn(x: number, y: number, type: ZombieType, hp: number, speed: number): void {
    this.zombieType = type;
    this.hp = hp;
    this.maxHp = hp;
    this.speed = speed;
    this.setTexture(type);
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.hpBar.setVisible(true);
    this.clearTint();
    this.flashTimer = 0;

    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.reset(x, y);
      body.setVelocity(0, speed);
      body.setEnable(true);
    }
    this.updateHpBar();
  }

  takeDamage(dmg: number): boolean {
    this.hp -= dmg;
    this.setTint(0xffffff);
    this.flashTimer = 100;
    this.updateHpBar();
    if (this.hp <= 0) {
      return true;
    }
    return false;
  }

  deactivate(): void {
    this.setActive(false);
    this.setVisible(false);
    this.hpBar.setVisible(false);
    this.hpBar.clear();
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setVelocity(0, 0);
      body.setEnable(false);
    }
  }

  private updateHpBar(): void {
    this.hpBar.clear();
    const w = this.displayWidth;
    const bx = this.x - w / 2;
    const by = this.y - this.displayHeight / 2 - 8;
    this.hpBar.fillStyle(0x333333, 1);
    this.hpBar.fillRect(bx, by, w, 4);
    const pct = Math.max(0, this.hp / this.maxHp);
    const color = pct > 0.5 ? 0x00ff00 : pct > 0.25 ? 0xffff00 : 0xff0000;
    this.hpBar.fillStyle(color, 1);
    this.hpBar.fillRect(bx, by, w * pct, 4);
  }

  update(delta: number): void {
    if (!this.active) return;
    if (this.flashTimer > 0) {
      this.flashTimer -= delta;
      if (this.flashTimer <= 0) {
        this.clearTint();
      }
    }
    this.updateHpBar();
  }
}
