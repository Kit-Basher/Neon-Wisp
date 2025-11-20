import * as THREE from 'three';
import React from 'react';

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

// Fix for React Three Fiber JSX types
declare global {
  namespace JSX {
    interface IntrinsicElements {
      // Core
      primitive: any;
      group: any;
      mesh: any;
      instancedMesh: any;

      // Geometries
      boxGeometry: any;
      planeGeometry: any;
      sphereGeometry: any;
      cylinderGeometry: any;
      icosahedronGeometry: any;
      octahedronGeometry: any;
      torusGeometry: any;
      
      // Materials
      meshStandardMaterial: any;
      meshBasicMaterial: any;
      meshPhongMaterial: any;

      // Lights
      pointLight: any;
      ambientLight: any;
      hemisphereLight: any;
      directionalLight: any;
      spotLight: any;

      // Misc
      color: any;
      fog: any;
      fogExp2: any;
    }
  }
}