export class GameState {
  static currentLevel: number = 1;
  static highestLevel: number = 1;
  static totalStars: number = 0;
  static levelStars: Record<number, number> = {};
  static currentScore: number = 0;
  static multiplierChain: number = 1;
}
