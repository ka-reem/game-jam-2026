import Phaser from 'phaser';

export class Barrel extends Phaser.Physics.Arcade.Sprite {
  hp: number = 6;
  maxHp: number = 6;
  speed: number = 90;
  private hpBar: Phaser.GameObjects.Graphics;
  private renderVisible: boolean = true;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'barrel');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.hpBar = scene.add.graphics();
    this.setActive(false);
    this.setVisible(false);
    this.hpBar.setVisible(false);
  }

  spawn(x: number, y: number, hp: number, speed: number): void {
    this.hp = hp;
    this.maxHp = hp;
    this.speed = speed;
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(this.renderVisible);
    this.hpBar.setVisible(this.renderVisible);

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
    this.updateHpBar();
    return this.hp <= 0;
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

  setRenderVisible(visible: boolean): void {
    this.renderVisible = visible;
    this.setVisible(visible && this.active);
    this.hpBar.setVisible(visible && this.active);
  }

  private updateHpBar(): void {
    this.hpBar.clear();
    const w = this.displayWidth;
    const bx = this.x - w / 2;
    const by = this.y - this.displayHeight / 2 - 6;
    this.hpBar.fillStyle(0x222222, 1);
    this.hpBar.fillRect(bx, by, w, 3);
    const pct = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    this.hpBar.fillStyle(0xffaa00, 1);
    this.hpBar.fillRect(bx, by, w * pct, 3);
  }

  update(): void {
    if (!this.active) return;
    if (this.y > 920) {
      this.deactivate();
      return;
    }
    this.updateHpBar();
  }
}
