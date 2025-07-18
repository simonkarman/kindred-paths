/**
 * Random is a class that represents a seeded random number generator. It uses 'sfc32' (Simple Fast Counter) to generate the random numbers and uses
 *  'cyrb128' to generate a seed from a string.
 *
 * Implementation source can be found here: https://stackoverflow.com/a/47593316/2115633
 */
export class Random {
  private constructor(
    private a: number,
    private b: number,
    private c: number,
    private d: number,
  ) {}

  static fromSeed(seed: string) {
    // cyrb128 implementation
    let h1 = 1779033703, h2 = 3144134277,
      h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < seed.length; i++) {
      k = seed.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    h1 ^= (h2 ^ h3 ^ h4), h2 ^= h1, h3 ^= h1, h4 ^= h1;
    return new Random(h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0);
  }

  static fromState(a: number, b: number, c: number, d: number) {
    return new Random(a >>> 0, b >>> 0, c >>> 0, d >>> 0);
  }

  public getState(): [number, number, number, number] {
    return [this.a, this.b, this.c, this.d];
  }

  public next(): number {
    // sfc32 implementation
    this.a >>>= 0; this.b >>>= 0; this.c >>>= 0; this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ this.b >>> 9;
    this.b = this.c + (this.c << 3) | 0;
    this.c = (this.c << 21 | this.c >>> 11);
    this.d = this.d + 1 | 0;
    t = t + this.d | 0;
    this.c = this.c + t | 0;
    return (t >>> 0) / 4294967296;
  }

  public bool(chance = 0.5): boolean {
    return this.next() < chance;
  }

  public rangeInt(minInclusive: number, maxExclusive?: number | undefined): number {
    if (maxExclusive === undefined) {
      maxExclusive = minInclusive;
      minInclusive = 0;
    }
    if (minInclusive > maxExclusive) {
      [minInclusive, maxExclusive] = [maxExclusive, minInclusive];
    }
    minInclusive = Math.floor(minInclusive);
    maxExclusive = Math.floor(maxExclusive);
    return Math.floor(this.next() * (maxExclusive - minInclusive)) + minInclusive;
  }

  public shuffleArrayInPlace(array: unknown[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
  }

  public asShuffledArray<T>(array: T[]): T[] {
    const newArray = [...array];
    this.shuffleArrayInPlace(newArray);
    return newArray;
  }

  public string(length: number, characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(this.rangeInt(characters.length));
    }
    return result;
  }
}
