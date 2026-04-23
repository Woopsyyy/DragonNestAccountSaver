/// <reference types="vite/client" />
declare module '*.glb';
declare module '*.png';

declare module 'meshline' {
  export const MeshLineGeometry: new (...args: never[]) => object;
  export const MeshLineMaterial: new (...args: never[]) => object;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      meshLineGeometry: Record<string, unknown>;
      meshLineMaterial: Record<string, unknown>;
    }
  }
}
export {};
