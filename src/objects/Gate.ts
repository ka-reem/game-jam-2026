import Phaser from 'phaser';

export type GateType = 'multiply' | 'add' | 'reduce' | 'unlock' | 'power';

export interface GateOption {
  type: GateType;
  value: number;
  label: string;
  color: number;
}

function gateColor(type: GateType): number {
  switch (type) {
    case 'multiply': return 0x00cc44;
    case 'add': return 0x2288ff;
    case 'reduce': return 0xff3333;
    case 'unlock': return 0xaa44ff;
    case 'power': return 0xff9900;
    default: return 0x888888;
  }
}

export class Gate extends Phaser.GameObjects.Container {
  leftOption: GateOption;
  rightOption: GateOption;
  speed: number = 100;
  passed: boolean = false;

  private leftBg: Phaser.GameObjects.Rectangle;
  private rightBg: Phaser.GameObjects.Rectangle;
  private leftText: Phaser.GameObjects.Text;
  private rightText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, left: GateOption, right: GateOption, gateWidth: number, gateHeight: number, gap: number) {
    super(scene, x, y);
    this.leftOption = left;
    this.rightOption = right;

    const hw = gateWidth / 2;
    const hh = gateHeight / 2;
    const halfGap = gap / 2;

    this.leftBg = scene.add.rectangle(-hw - halfGap, 0, gateWidth, gateHeight, left.color, 0.85);
    this.leftBg.setStrokeStyle(2, 0xffffff, 0.7);
    this.rightBg = scene.add.rectangle(hw + halfGap, 0, gateWidth, gateHeight, right.color, 0.85);
    this.rightBg.setStrokeStyle(2, 0xffffff, 0.7);

    this.leftText = scene.add.text(-hw - halfGap, 0, left.label, {
      fontSize: '22px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5);
    this.rightText = scene.add.text(hw + halfGap, 0, right.label, {
      fontSize: '22px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5);

    this.add([this.leftBg, this.rightBg, this.leftText, this.rightText]);
    scene.add.existing(this);
  }

  private formatLabel(opt: GateOption): string {
    switch (opt.type) {
      case 'multiply':
        return `x${opt.value}`;
      case 'add':
      case 'reduce':
        return `${opt.value >= 0 ? '+' : ''}${opt.value}`;
      default:
        return opt.label;
    }
  }

  private refreshLabels(): void {
    this.leftText.setText(this.formatLabel(this.leftOption));
    this.rightText.setText(this.formatLabel(this.rightOption));
  }

  private incrementOption(opt: GateOption): void {
    if (opt.type === 'multiply' || opt.type === 'add' || opt.type === 'reduce') {
      opt.value += 1;
      opt.label = this.formatLabel(opt);
    }
  }

  hitLeft(): void {
    this.incrementOption(this.leftOption);
    this.refreshLabels();
    this.flashLeft();
  }

  hitRight(): void {
    this.incrementOption(this.rightOption);
    this.refreshLabels();
    this.flashRight();
  }

  update(delta: number): void {
    this.y += this.speed * (delta / 1000);
  }

  flashLeft(): void {
    this.scene.tweens.add({ targets: this.leftBg, alpha: 0.3, yoyo: true, duration: 150 });
  }

  flashRight(): void {
    this.scene.tweens.add({ targets: this.rightBg, alpha: 0.3, yoyo: true, duration: 150 });
  }

  getLeftBounds(): Phaser.Geom.Rectangle {
    const lx = this.x + (this.leftBg.x - this.leftBg.width / 2);
    const ly = this.y - this.leftBg.height / 2;
    return new Phaser.Geom.Rectangle(lx, ly, this.leftBg.width, this.leftBg.height);
  }

  getRightBounds(): Phaser.Geom.Rectangle {
    const rx = this.x + (this.rightBg.x - this.rightBg.width / 2);
    const ry = this.y - this.rightBg.height / 2;
    return new Phaser.Geom.Rectangle(rx, ry, this.rightBg.width, this.rightBg.height);
  }

  destroy(fromScene?: boolean): void {
    super.destroy(fromScene);
  }
}

export function makeGateOption(type: GateType, value: number, label: string): GateOption {
  return { type, value, label, color: gateColor(type) };
}
