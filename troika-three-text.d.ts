declare module "troika-three-text" {
  import * as THREE from "three";

  export class Text extends THREE.Mesh {
    text: string;
    font: string;
    fontSize: number;
    anchorX: string | number;
    anchorY: string | number;
    textAlign: string;
    whiteSpace: string;
    letterSpacing: number;
    color: THREE.ColorRepresentation;
    fillOpacity: number;
    outlineWidth: number | string;
    outlineColor: THREE.ColorRepresentation;
    outlineOpacity: number;
    outlineBlur: number | string;
    textRenderInfo?: {
      blockBounds?: [number, number, number, number];
    };
    sync(callback?: () => void): void;
    dispose(): void;
  }

  export function configureTextBuilder(config: {
    useWorker?: boolean;
  }): void;
}
