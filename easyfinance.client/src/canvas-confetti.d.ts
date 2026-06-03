declare module 'canvas-confetti' {
  interface ConfettiOptions {
    shapes?: string[];
    scalar?: number;
    particleCount?: number;
    spread?: number;
    ticks?: number;
    startVelocity?: number;
    decay?: number;
    origin?: { x?: number; y?: number };
  }
  interface ShapeFromTextOptions {
    text: string;
    scalar?: number;
  }
  interface ConfettiFn {
    (options?: ConfettiOptions): void;
    shapeFromText(options: ShapeFromTextOptions): string;
  }
  const confetti: ConfettiFn;
  export default confetti;
}
