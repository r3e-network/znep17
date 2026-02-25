declare module "ffjavascript" {
  export function getCurveFromName(name: string): Promise<{
    G1: {
      fromObject(value: unknown): unknown;
      toRprCompressed(buffer: Uint8Array, offset: number, point: unknown): void;
    };
    G2: {
      fromObject(value: unknown): unknown;
      toRprCompressed(buffer: Uint8Array, offset: number, point: unknown): void;
    };
  }>;
}
