import React, { useMemo, useRef, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { BuildingData } from '../types';

interface ProceduralCityProps {
  buildings: BuildingData[];
}

const ProceduralCity: React.FC<ProceduralCityProps> = ({ buildings }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const wireframeRef = useRef<THREE.InstancedMesh>(null);
  const windowMeshRef = useRef<THREE.InstancedMesh>(null);

  // 1. Setup Main Buildings and Wireframes
  useLayoutEffect(() => {
    if (!meshRef.current || !wireframeRef.current) return;
    const tempObject = new THREE.Object3D();
    
    buildings.forEach((data, i) => {
      tempObject.position.set(...data.position);
      tempObject.scale.set(...data.scale);
      tempObject.rotation.set(0, 0, 0);
      tempObject.updateMatrix();
      
      meshRef.current!.setMatrixAt(i, tempObject.matrix);
      
      // Wireframe is slightly larger to prevent z-fighting
      tempObject.scale.set(data.scale[0] * 1.002, data.scale[1] * 1.002, data.scale[2] * 1.002);
      tempObject.updateMatrix();
      wireframeRef.current!.setMatrixAt(i, tempObject.matrix);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    wireframeRef.current.instanceMatrix.needsUpdate = true;
  }, [buildings]);

  // 2. Generate Windows stuck to faces
  const windows = useMemo(() => {
    const tempWindows: { pos: [number, number, number], rot: [number, number, number], scale: [number, number, number], color: string }[] = [];
    const colors = ['#00ffff', '#ff00ff', '#ffff00', '#ffffff'];
    
    buildings.forEach((b) => {
        // Number of windows based on building size
        const numWindows = Math.floor(b.scale[1] / 6) * Math.floor(Math.random() * 4 + 1);
        
        for(let j=0; j<numWindows; j++) {
            const face = Math.floor(Math.random() * 4); // 0: Front (+z), 1: Back (-z), 2: Right (+x), 3: Left (-x)
            
            const winW = 1.5 + Math.random() * 2;
            const winH = 1.5 + Math.random() * 2;
            
            // Random position on the surface
            // Vertical position
            const yOffset = (Math.random() - 0.5) * (b.scale[1] - 4); 
            const y = b.position[1] + yOffset;

            let x = b.position[0];
            let z = b.position[2];
            let rotX = 0, rotY = 0, rotZ = 0;

            // Calculate face position
            if (face === 0) { // Front (+Z)
                z += b.scale[2] / 2 + 0.1; // Push out slightly
                x += (Math.random() - 0.5) * (b.scale[0] - 4);
                rotY = 0;
            } else if (face === 1) { // Back (-Z)
                z -= b.scale[2] / 2 + 0.1;
                x += (Math.random() - 0.5) * (b.scale[0] - 4);
                rotY = Math.PI;
            } else if (face === 2) { // Right (+X)
                x += b.scale[0] / 2 + 0.1;
                z += (Math.random() - 0.5) * (b.scale[2] - 4);
                rotY = Math.PI / 2;
            } else if (face === 3) { // Left (-X)
                x -= b.scale[0] / 2 + 0.1;
                z += (Math.random() - 0.5) * (b.scale[2] - 4);
                rotY = -Math.PI / 2;
            }

            tempWindows.push({
                pos: [x, y, z],
                rot: [rotX, rotY, rotZ],
                scale: [winW, winH, 0.2],
                color: colors[Math.floor(Math.random() * colors.length)]
            });
        }
    });
    return tempWindows;
  }, [buildings]);

   useLayoutEffect(() => {
    if (!windowMeshRef.current) return;
    const tempObject = new THREE.Object3D();
    
    windows.forEach((w, i) => {
      tempObject.position.set(...w.pos);
      tempObject.rotation.set(...w.rot);
      tempObject.scale.set(...w.scale); 
      tempObject.updateMatrix();
      windowMeshRef.current!.setMatrixAt(i, tempObject.matrix);
      windowMeshRef.current!.setColorAt(i, new THREE.Color(w.color));
    });
    windowMeshRef.current.instanceMatrix.needsUpdate = true;
  }, [windows]);


  return (
    <group>
      {/* Main Building Bodies */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, buildings.length]} receiveShadow castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial 
            color="#3a3a4a" 
            roughness={0.9} 
            metalness={0.1} 
        />
      </instancedMesh>

      {/* Building Outlines (Neon Edges) */}
      <instancedMesh ref={wireframeRef} args={[undefined, undefined, buildings.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial wireframe color="#446688" transparent opacity={0.3} />
      </instancedMesh>

      {/* Glowing Windows */}
      <instancedMesh ref={windowMeshRef} args={[undefined, undefined, windows.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[10000, 10000]} />
        <meshStandardMaterial color="#080808" metalness={0.2} roughness={0.8} />
      </mesh>
    </group>
  );
};

export default ProceduralCity;