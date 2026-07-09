// Minimal ambient declarations for the Bun runtime APIs used by the server
// security modules. Normally provided by the `bun-types`/`@types/bun`
// package; declared by hand here because this project's package registry
// mirror could not resolve that package at the time these modules were
// written. Safe to delete once `bun-types` is added to devDependencies and
// `"bun"` is added to tsconfig's `types` array.

declare module "bun:sqlite" {
  export class Database {
    constructor(filename: string);
    exec(sql: string): void;
    query<T = unknown, P extends readonly unknown[] = unknown[]>(
      sql: string,
    ): {
      get: (...params: P) => T | null;
      all: (...params: P) => T[];
      run: (...params: P) => void;
    };
  }
}

declare const Bun: {
  password: {
    hash(
      password: string,
      options?: { algorithm?: "argon2id" | "argon2i" | "argon2d" | "bcrypt"; memoryCost?: number; timeCost?: number },
    ): Promise<string>;
    verify(password: string, hash: string): Promise<boolean>;
  };
  write(destination: string, data: Uint8Array | string): Promise<number>;
  file(path: string): Blob & { exists(): Promise<boolean> };
};
