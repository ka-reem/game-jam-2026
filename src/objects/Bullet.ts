import Phaser from 'phaser';

export class Bullet extends Phaser.Physics.Arcade.Sprite {
  damage: number = 1;
  piercing: boolean = false;
  bulletSize: number = 1;
  velocityX: number = 0;
  velocityY: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'bullet');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setActive(false);
    this.setVisible(false);
  }

  init(x: number, y: number, damage: number, piercing: boolean, size: number, vx: number = 0, vy: number = -600): void {
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.damage = damage;
    this.piercing = piercing;
    this.bulletSize = size;
    this.velocityX = vx;
    this.velocityY = vy;
    this.setScale(size);
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.reset(x, y);
      body.setVelocity(vx, vy);
      body.setEnable(true);
    }
  }

  deactivate(): void {
    this.setActive(false);
    this.setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setVelocity(0, 0);
      body.setEnable(false);
    }
  }

  update(): void {
    if (this.active && (this.y < -20 || this.y > 900 || this.x < -20 || this.x > 420)) {
      this.deactivate();
    }
  }
}
