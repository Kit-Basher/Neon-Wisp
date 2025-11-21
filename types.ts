import * as THREE from 'three';
import React from 'react';

// Augment JSX namespace to include React Three Fiber elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      instancedMesh: any;
      boxGeometry: any;
      meshStandardMaterial: any;
      meshBasicMaterial: any;
      planeGeometry: any;
      sphereGeometry: any;
      pointLight: any;
      cylinderGeometry: any;
      octahedronGeometry: any;
      icosahedronGeometry: any;
      ambientLight: any;
      hemisphereLight: any;
      directionalLight: any;
      fog: any;
      color: any;
    }
  }
}

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