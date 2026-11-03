// fontkit 2 ships no type definitions; this covers what fontkitAdapter.ts uses.
declare module 'fontkit' {
  interface Subset {
    encode(): Uint8Array;
  }
  interface Font {
    createSubset(): Subset;
  }
  export function create(data: Uint8Array): Font;
}
