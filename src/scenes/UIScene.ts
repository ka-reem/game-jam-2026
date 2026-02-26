import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, PLAYER_ZONE_Y } from '../utils/Constants';
import { GameState } from '../data/GameState';

export class UIScene extends Phaser.Scene {
  private scoreText: Phaser.GameObjects.Text;
  private levelText: Phaser.GameObjects.Text;
  private bulletText: Phaser.GameObjects.Text;
  private multiplierText: Phaser.GameObjects.Text;
  private multiplierTimer: number = 0;
  private weaponText: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    this.levelText = this.add.text(12, 12, 'LVL 1', {
      fontSize: '20px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3
    });

    this.scoreText = this.add.text(GAME_WIDTH - 12, 12, 'SCORE: 0', {
      fontSize: '18px', fontFamily: 'Arial', color: '#ffff00',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(1, 0);

    this.bulletText = this.add.text(GAME_WIDTH / 2, PLAYER_ZONE_Y - 50, '', {
      fontSize: '16px', fontFamily: 'Arial', color: '#00ffee',
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5);

    this.weaponText = this.add.text(GAME_WIDTH / 2, PLAYER_ZONE_Y - 30, '', {
      fontSize: '14px', fontFamily: 'Arial', color: '#ff9900',
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5);

    this.multiplierText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', {
      fontSize: '36px', fontFamily: 'Arial Black, Arial', color: '#ffff00',
      stroke: '#000000', strokeThickness: 5
    }).setOrigin(0.5).setAlpha(0).setDepth(20);

    this.scene.get('GameScene').events.on('updateScore', (score: number) => {
      this.scoreText.setText('SCORE: ' + score);
    });

    this.scene.get('GameScene').events.on('updateLevel', (level: number) => {
      this.levelText.setText('LVL ' + level);
    });

    this.scene.get('GameScene').events.on('updateBullets', (count: number, weapon: string) => {
      this.bulletText.setText('BULLETS: ' + count);
      this.weaponText.setText('[' + weapon.toUpperCase() + ']');
    });

    this.scene.get('GameScene').events.on('showMultiplier', (mult: number) => {
      this.multiplierText.setText('x' + mult + ' MULTIPLIER!');
      this.tweens.killTweensOf(this.multiplierText);
      this.multiplierText.setAlpha(1).setScale(1.5);
      this.tweens.add({
        targets: this.multiplierText,
        alpha: 0,
        scale: 1,
        duration: 1200,
        ease: 'Power2'
      });
    });

    this.scene.get('GameScene').events.on('showGateEffect', (label: string) => {
      this.multiplierText.setText(label);
      this.tweens.killTweensOf(this.multiplierText);
      this.multiplierText.setAlpha(1).setScale(1.2);
      this.tweens.add({
        targets: this.multiplierText,
        alpha: 0,
        scale: 1,
        duration: 900,
        ease: 'Power2'
      });
    });
  }

  update(): void {
    // UI updates handled via events
  }
}
