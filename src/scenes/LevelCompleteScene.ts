import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/Constants';
import { GameState } from '../data/GameState';

export class LevelCompleteScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LevelCompleteScene' });
  }

  init(data: { level: number; score: number; zombiesKilled: number; stars: number }): void {
    this.registry.set('lcData', data);
  }

  create(): void {
    const data = this.registry.get('lcData') || { level: 1, score: 0, zombiesKilled: 0, stars: 2 };
    const { level, score, zombiesKilled, stars } = data;

    // Background overlay
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75);

    // Panel
    const panel = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 320, 420, 0x1a1a2e, 0.95);
    panel.setStrokeStyle(3, 0x00ffee);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 170, `LEVEL ${level}`, {
      fontSize: '18px', fontFamily: 'Arial', color: '#aaaaaa'
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 140, 'COMPLETE!', {
      fontSize: '38px', fontFamily: 'Arial Black, Arial', color: '#00ffee',
      stroke: '#000000', strokeThickness: 5
    }).setOrigin(0.5);

    // Stars
    const starY = GAME_HEIGHT / 2 - 80;
    for (let i = 0; i < 3; i++) {
      const starX = GAME_WIDTH / 2 - 50 + i * 50;
      const color = i < stars ? '#ffd700' : '#444444';
      this.add.text(starX, starY, '★', {
        fontSize: '44px', color, stroke: '#000000', strokeThickness: 3
      }).setOrigin(0.5).setAlpha(0);

      this.tweens.add({
        targets: this.children.list[this.children.list.length - 1],
        alpha: 1,
        scaleX: { from: 0, to: 1 },
        scaleY: { from: 0, to: 1 },
        delay: 300 + i * 200,
        duration: 400,
        ease: 'Back.easeOut'
      });
    }

    // Score count-up
    const scoreLabel = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, 'SCORE', {
      fontSize: '16px', fontFamily: 'Arial', color: '#aaaaaa'
    }).setOrigin(0.5);

    const scoreDisplay = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50, '0', {
      fontSize: '48px', fontFamily: 'Arial Black, Arial', color: '#ffff00',
      stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5);

    let displayScore = 0;
    const countDuration = 1500;
    const startTime = this.time.now;
    this.time.addEvent({
      delay: 16,
      repeat: Math.ceil(countDuration / 16),
      callback: () => {
        const elapsed = this.time.now - startTime;
        const t = Math.min(elapsed / countDuration, 1);
        displayScore = Math.floor(Phaser.Math.Easing.Cubic.Out(t) * score);
        scoreDisplay.setText(displayScore.toString());
      }
    });

    // Zombies killed
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 110, `ZOMBIES: ${zombiesKilled}`, {
      fontSize: '20px', fontFamily: 'Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5);

    // Next Level button
    const btnY = GAME_HEIGHT / 2 + 165;
    const btn = this.add.rectangle(GAME_WIDTH / 2, btnY, 200, 52, 0x00cc44);
    btn.setStrokeStyle(2, 0xffffff);
    btn.setInteractive({ useHandCursor: true });

    const btnText = this.add.text(GAME_WIDTH / 2, btnY, 'NEXT LEVEL ▶', {
      fontSize: '20px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5);

    btn.on('pointerover', () => btn.setFillStyle(0x00ff66));
    btn.on('pointerout', () => btn.setFillStyle(0x00cc44));
    btn.on('pointerdown', () => {
      GameState.currentLevel = level + 1;
      if (GameState.currentLevel > GameState.highestLevel) {
        GameState.highestLevel = GameState.currentLevel;
      }
      this.scene.stop('LevelCompleteScene');
      this.scene.stop('UIScene');
      this.scene.start('GameScene');
      this.scene.launch('UIScene');
    });

    // Retry button
    const retryBtn = this.add.rectangle(GAME_WIDTH / 2, btnY + 60, 160, 40, 0x334466);
    retryBtn.setStrokeStyle(2, 0x8888aa);
    retryBtn.setInteractive({ useHandCursor: true });
    this.add.text(GAME_WIDTH / 2, btnY + 60, 'REPLAY', {
      fontSize: '16px', fontFamily: 'Arial', color: '#aaaaaa',
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5);

    retryBtn.on('pointerdown', () => {
      this.scene.stop('LevelCompleteScene');
      this.scene.stop('UIScene');
      this.scene.start('GameScene');
      this.scene.launch('UIScene');
    });
  }
}
