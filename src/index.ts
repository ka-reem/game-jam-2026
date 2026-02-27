import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './utils/Constants';
import { PreloadScene } from './scenes/PreloadScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { LevelCompleteScene } from './scenes/LevelCompleteScene';
import { ThreeBackground } from './utils/ThreeBackground';

// Boot the subtle 3D bird's-eye background before Phaser
new ThreeBackground();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,       // force Canvas so we can set alpha:true easily
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: 'rgba(0,0,0,0)',   // transparent — Three.js shows through
  transparent: true,
  parent: document.body,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [PreloadScene, GameScene, UIScene, LevelCompleteScene]
};

new Phaser.Game(config);
