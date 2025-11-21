import * as THREE from 'three';

export interface BuildingData {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  id: string;
}

export interface StarData {
  id: string;
  position: [number, number, number];
  collected: boolean;
}

export interface SentinelData {
  id: string;
  position: THREE.Vector3;
  speed: number;
}

export enum WispColor {
  Cyan = '#00ffff',
  Purple = '#bf00ff',
  Gold = '#ffd700'
}

export interface MobileInputState {
  move: { x: number; y: number };
  look: { x: number; y: number };
  jump: boolean;
  grapple: boolean;
}