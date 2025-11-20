import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PointerLockControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import * as THREE from 'three';
import * as Tone from 'tone';
import ProceduralCity from './ProceduralCity';
import Wisp from './Wisp';
import MusicSystem from './MusicSystem';
import MobileControls from './MobileControls';
import { audioService } from '../services/audioService';
import { BuildingData, StarData, SentinelData, MobileInputState } from '../types';

interface GameSceneProps {
  onWispPositionUpdate: (pos: THREE.Vector3) => void;
  onCollectStar: () => void;
  isLocked: boolean;
  setIsLocked: (locked: boolean) => void;
  score: number;
  isGameOver: boolean;
  onGameOver: () => void;
  onRestart: (color: string) => void;
  wispColor: string;
  onProximityUpdate: (dist: number) => void;
  mobileInput?: React.MutableRefObject<MobileInputState>;
  isMobile?: boolean;
  gameStarted: boolean;
}

interface ExplosionData {
  id: string;
  position: THREE.Vector3;
}

// Effect for a single explosion
const ExplosionEffect: React.FC<{ position: THREE.Vector3 }> = ({ position }) => {
  const groupRef = useRef<THREE.Group>(null);
  // Generate random velocities for debris
  const particles = useMemo(() => {
    return new Array(12).fill(0).map(() => ({
      velocity: new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize().multiplyScalar(15 + Math.random() * 20),
      rotation: new THREE.Vector3(Math.random(), Math.random(), Math.random())
    }));
  }, []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.05);

    // Animate particles
    groupRef.current.children.forEach((child, i) => {
      if (i < particles.length) { // Debris
        child.position.add(particles[i].velocity.clone().multiplyScalar(dt));
        child.rotation.x += particles[i].rotation.x * 10 * dt;
        child.rotation.y += particles[i].rotation.y * 10 * dt;
        child.scale.multiplyScalar(0.92); // Fade out scale
      } else { // Shockwave
        child.scale.multiplyScalar(1.1);
        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        if (mat.opacity > 0) mat.opacity -= 2 * dt;
      }
    });
  });

  return (
    <group ref={groupRef} position={position}>
      {particles.map((_, i) => (
        <mesh key={i}>
          <boxGeometry args={[0.6, 0.6, 0.6]} />
          <meshBasicMaterial color="#ffaa00" toneMapped={false} />
        </mesh>
      ))}
      {/* Shockwave sphere */}
      <mesh>
        <sphereGeometry args={[2, 16, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} toneMapped={false} />
      </mesh>
    </group>
  );
};

// Local Collectibles Component using InstancedMesh for performance
const CollectibleStars: React.FC<{ data: StarData[], collectedIds: Set<string> }> = ({ data, collectedIds }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    if (!meshRef.current || !glowRef.current) return;
    const time = clock.getElapsedTime();

    // Update all instances
    data.forEach((star, i) => {
      if (collectedIds.has(star.id)) {
        // Hide collected stars by scaling to 0
        dummy.position.set(0, -1000, 0);
        dummy.scale.set(0, 0, 0);
      } else {
        // Floating animation
        const yOffset = Math.sin(time * 2 + i * 0.5) * 0.5;
        dummy.position.set(star.position[0], star.position[1] + yOffset, star.position[2]);
        dummy.rotation.set(0, time * 0.5 + i, 0);
        dummy.scale.set(1, 1, 1);
      }
      dummy.updateMatrix();

      meshRef.current!.setMatrixAt(i, dummy.matrix);

      // Glow mesh (slightly larger)
      dummy.scale.set(1.5, 1.5, 1.5);
      dummy.updateMatrix();
      glowRef.current!.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    glowRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* Main Star Core */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, 2000]} count={data.length}>
        <octahedronGeometry args={[1.2, 0]} />
        <meshStandardMaterial
          color="#ffd700"
          emissive="#ffaa00"
          emissiveIntensity={2}
          toneMapped={false}
        />
      </instancedMesh>
      {/* Star Halo/Glow */}
      <instancedMesh ref={glowRef} args={[undefined, undefined, 2000]} count={data.length}>
        <sphereGeometry args={[1.8, 8, 8]} />
        <meshBasicMaterial
          color="#ffd700"
          transparent
          opacity={0.2}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  );
}

const GameLoop: React.FC<{
  isGameOver: boolean;
  isLocked: boolean;
  gameTimeRef: React.MutableRefObject<number>;
  score: number;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  setSentinels: React.Dispatch<React.SetStateAction<SentinelData[]>>;
  isMobile?: boolean;
  gameStarted: boolean;
}> = ({ isGameOver, isLocked, gameTimeRef, score, playerPosRef, setSentinels, isMobile, gameStarted }) => {
  const lastSpawnTime = useRef(0);

  useFrame((state, delta) => {
    if (isGameOver || !gameStarted) return;

    // Only advance game time if active
    // On mobile, "isLocked" might not be true, but the game is active if playing
    if (isLocked || isMobile) {
      gameTimeRef.current += delta;
    }

    const time = gameTimeRef.current;
    const now = state.clock.getElapsedTime();

    // Difficulty Formulas
    // Spawn Rate: Time-based (Starts 5s, drops to 1.0s slowly)
    const spawnDelay = Math.max(1.0, 5.0 - (time * 0.02));

    // Max Sentinels: Time-based (Slower growth: +1 every 25s)
    const maxSentinels = 3 + Math.floor(time / 25);

    // Sentinel Speed: HYBRID (Time + Score)
    // Player Speed scales with score (Base 12 + Score*0.24)
    // Sentinel Speed needs to match player potential
    const sentinelSpeed = 12.0 + (time * 0.05) + (score * 0.2);

    if (now - lastSpawnTime.current > spawnDelay) {
      setSentinels(current => {
        if (current.length >= maxSentinels) return current;

        lastSpawnTime.current = now;

        // Spawn logic
        const angle = Math.random() * Math.PI * 2;
        // Spawn further away to give reaction time (250-400 units)
        const distance = 250 + Math.random() * 150;

        const relativeHeight = (Math.random() - 0.5) * 100;
        const spawnY = Math.max(10, playerPosRef.current.y + relativeHeight);

        const spawnPos = playerPosRef.current.clone().add(new THREE.Vector3(
          Math.cos(angle) * distance,
          0,
          Math.sin(angle) * distance
        ));
        spawnPos.y = spawnY;

        const newSentinel: SentinelData = {
          id: `sentinel_${Date.now()}_${Math.random()}`,
          position: spawnPos,
          speed: sentinelSpeed
        };
        return [...current, newSentinel];
      });
    }
  });
  return null;
};

const SentinelManager: React.FC<{
  sentinels: SentinelData[];
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  onGameOver: () => void;
  isGameOver: boolean;
  handleSentinelsDestroyed: (ids: string[]) => void;
  handleExplosion: (pos: THREE.Vector3) => void;
  onProximityUpdate: (dist: number) => void;
  buildings: BuildingData[];
}> = ({ sentinels, playerPosRef, onGameOver, isGameOver, handleSentinelsDestroyed, handleExplosion, onProximityUpdate, buildings }) => {
  const sentinelMeshes = useRef<THREE.Group>(null);
  const destructionPending = useRef(false); // Prevent spamming state updates
  const lastProximityReport = useRef(0);

  useFrame((state, delta) => {
    if (isGameOver || !sentinelMeshes.current) return;

    const playerPos = playerPosRef.current;
    const dt = Math.min(delta, 0.05);
    const children = sentinelMeshes.current.children;
    const time = state.clock.getElapsedTime();

    let minDistance = 1000;

    // 1. Movement & Player Collision
    children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const data = sentinels[i];
      if (!data) return;

      const currentPos = mesh.position;
      const dist = currentPos.distanceTo(playerPos);
      if (dist < minDistance) minDistance = dist;

      // --- Slow down near player ---
      let effectiveSpeed = data.speed;
      if (dist < 60) {
        // Linear slowdown: at dist 0 -> 30% speed, at dist 60 -> 100% speed
        const slowdownFactor = 0.3 + (dist / 60) * 0.7;
        effectiveSpeed *= slowdownFactor;
      }

      const dir = playerPos.clone().sub(currentPos).normalize();
      const moveStep = dir.clone().multiplyScalar(effectiveSpeed * dt);
      const nextPos = currentPos.clone().add(moveStep);

      // --- Building Collision (Sliding) ---
      const sentinelRadius = 2.0;
      let collisionNormal: THREE.Vector3 | null = null;

      // Optimization: Only check buildings reasonably close to the sentinel
      for (const b of buildings) {
        // Broadphase check
        if (Math.abs(nextPos.x - b.position[0]) > b.scale[0] / 2 + sentinelRadius + 4) continue;
        if (Math.abs(nextPos.z - b.position[2]) > b.scale[2] / 2 + sentinelRadius + 4) continue;
        if (Math.abs(nextPos.y - b.position[1]) > b.scale[1] / 2 + sentinelRadius + 4) continue;

        // AABB Intersection
        const minX = b.position[0] - b.scale[0] / 2 - sentinelRadius;
        const maxX = b.position[0] + b.scale[0] / 2 + sentinelRadius;
        const minY = b.position[1] - b.scale[1] / 2 - sentinelRadius;
        const maxY = b.position[1] + b.scale[1] / 2 + sentinelRadius;
        const minZ = b.position[2] - b.scale[2] / 2 - sentinelRadius;
        const maxZ = b.position[2] + b.scale[2] / 2 + sentinelRadius;

        if (nextPos.x > minX && nextPos.x < maxX &&
          nextPos.y > minY && nextPos.y < maxY &&
          nextPos.z > minZ && nextPos.z < maxZ) {

          // Determine approximate collision normal
          const distMinX = Math.abs(nextPos.x - minX);
          const distMaxX = Math.abs(nextPos.x - maxX);
          const distMinZ = Math.abs(nextPos.z - minZ);
          const distMaxZ = Math.abs(nextPos.z - maxZ);
          const distMinY = Math.abs(nextPos.y - minY);
          const distMaxY = Math.abs(nextPos.y - maxY);

          const min = Math.min(distMinX, distMaxX, distMinZ, distMaxZ, distMinY, distMaxY);

          collisionNormal = new THREE.Vector3();
          if (min === distMinX) collisionNormal.set(-1, 0, 0);
          else if (min === distMaxX) collisionNormal.set(1, 0, 0);
          else if (min === distMinZ) collisionNormal.set(0, 0, -1);
          else if (min === distMaxZ) collisionNormal.set(0, 0, 1);
          else if (min === distMinY) collisionNormal.set(0, -1, 0);
          else if (min === distMaxY) collisionNormal.set(0, 1, 0);

          break; // Handle first collision
        }
      }

      if (collisionNormal) {
        // Slide along wall: Project velocity onto plane perpendicular to normal
        const vDotN = moveStep.dot(collisionNormal);
        moveStep.sub(collisionNormal.multiplyScalar(vDotN));

        // Bias upwards slightly to help them climb over buildings
        moveStep.y += dt * 10;
      }

      mesh.position.add(moveStep);

      // Rotate sentinel
      mesh.rotation.x += dt * 2;
      mesh.rotation.y += dt * 3;

      // --- Visual Warning (Pulse) ---
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat) {
        if (dist < 50) {
          const urgency = 1 - (dist / 50); // 0 to 1
          // Faster pulse as they get closer (10Hz to 30Hz)
          const pulseSpeed = 10 + urgency * 20;
          const pulse = (Math.sin(time * pulseSpeed) + 1) / 2; // 0 to 1

          // Increase brightness significantly when close (Base 3 up to ~13)
          mat.emissiveIntensity = 3 + (pulse * 10 * urgency);

          // Flash color towards white at peak of pulse for heat effect
          if (pulse > 0.7) {
            mat.emissive.setHex(0xffaaaa); // Whitish Red
          } else {
            mat.emissive.setHex(0xff0000); // Base Red
          }
        } else {
          mat.emissiveIntensity = 3;
          mat.emissive.setHex(0xff0000);
        }
      }

      // Kill Collision
      if (dist < 2.0) {
        onGameOver();
      }
    });

    // Update Sentinel Audio Intensity
    audioService.updateSentinelDrone(minDistance);

    // Throttle proximity updates to UI (10Hz)
    if (time - lastProximityReport.current > 0.1) {
      onProximityUpdate(minDistance);
      lastProximityReport.current = time;
    }

    // 2. Sentinel-Sentinel Collision (Destruction)
    if (!destructionPending.current) {
      const deadIds = new Set<string>();

      for (let i = 0; i < children.length; i++) {
        const s1 = children[i];
        const id1 = sentinels[i]?.id;
        if (!id1 || deadIds.has(id1)) continue;

        for (let j = i + 1; j < children.length; j++) {
          const s2 = children[j];
          const id2 = sentinels[j]?.id;
          if (!id2 || deadIds.has(id2)) continue;

          const dist = s1.position.distanceTo(s2.position);

          if (dist < 3.0) {
            deadIds.add(id1);
            deadIds.add(id2);
            // Trigger Explosion at midpoint
            const midPoint = s1.position.clone().add(s2.position).multiplyScalar(0.5);
            handleExplosion(midPoint);
          }
        }
      }

      if (deadIds.size > 0) {
        destructionPending.current = true;
        handleSentinelsDestroyed(Array.from(deadIds));
        // Reset flag after a short delay to allow React to process the update
        setTimeout(() => { destructionPending.current = false; }, 100);
      }
    }
  });

  return (
    <group ref={sentinelMeshes}>
      {sentinels.map((s) => (
        <mesh key={s.id} position={s.position}>
          <icosahedronGeometry args={[1.5, 0]} />
          <meshStandardMaterial
            color="#ff0033"
            emissive="#ff0000"
            emissiveIntensity={3}
            wireframe
          />
          <mesh>
            <icosahedronGeometry args={[0.8, 0]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </mesh>
      ))}
    </group>
  )
};

const GameScene: React.FC<GameSceneProps> = ({
  onWispPositionUpdate,
  onCollectStar,
  isLocked,
  setIsLocked,
  score,
  isGameOver,
  onGameOver,
  onRestart,
  wispColor,
  onProximityUpdate,
  mobileInput,
  isMobile,
  gameStarted
}) => {
  const [collectedStars, setCollectedStars] = useState<Set<string>>(new Set());
  const [sentinels, setSentinels] = useState<SentinelData[]>([]);
  const [stars, setStars] = useState<StarData[]>([]);
  const [explosions, setExplosions] = useState<ExplosionData[]>([]);

  const playerPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 30, 0));
  const gameTimeRef = useRef(0); // Track active gameplay time in seconds

  // Memoize lock handlers
  const handleLock = useCallback(() => {
    if (!isGameOver && !isMobile && gameStarted) setIsLocked(true);
  }, [setIsLocked, isGameOver, isMobile, gameStarted]);

  const handleUnlock = useCallback(() => {
    if (!isMobile) setIsLocked(false);
  }, [setIsLocked, isMobile]);

  // Reset Game State
  useEffect(() => {
    if (!isGameOver && score === 0) {
      setCollectedStars(new Set());
      setSentinels([]);
      setExplosions([]);
      gameTimeRef.current = 0;
      // Stars will regenerate via the star spawn logic below
    }
  }, [isGameOver, score]);

  // Stop Drone on Game Over
  useEffect(() => {
    if (isGameOver) {
      audioService.stopSentinelDrone();
    }
  }, [isGameOver]);

  // Generate City Data
  const buildings = useMemo(() => {
    const count = 1500;
    const range = 4000;
    const temp: BuildingData[] = [];

    const isValidPosition = (x: number, z: number, w: number, d: number) => {
      for (const b of temp) {
        const dx = Math.abs(x - b.position[0]);
        const dz = Math.abs(z - b.position[2]);
        if (dx < (w + b.scale[0]) / 2 + 10 && dz < (d + b.scale[2]) / 2 + 10) {
          return false;
        }
      }
      return true;
    };

    for (let i = 0; i < count; i++) {
      let x, z, width, depth;
      let attempts = 0;

      do {
        x = (Math.random() - 0.5) * range;
        z = (Math.random() - 0.5) * range;
        if (Math.abs(x) < 50 && Math.abs(z) < 50) {
          x = 100;
        }
        width = 30 + Math.random() * 40;
        depth = 30 + Math.random() * 40;
        attempts++;
      } while (!isValidPosition(x, z, width, depth) && attempts < 10);

      if (attempts >= 10) continue;

      const height = 60 + Math.random() * 250;

      temp.push({
        position: [x, height / 2, z],
        scale: [width, height, depth],
        color: '#404050',
        id: `b_${i}`
      });
    }
    return temp;
  }, []);

  // Helper to generate a single star
  const generateStar = useCallback((idSuffix: string | number): StarData | null => {
    if (buildings.length === 0) return null;
    const randomB = buildings[Math.floor(Math.random() * buildings.length)];
    const x = randomB.position[0] + (Math.random() - 0.5) * randomB.scale[0] * 1.2;
    const z = randomB.position[2] + (Math.random() - 0.5) * randomB.scale[2] * 1.2;
    const y = randomB.position[1] * 2 + 1.5;

    return {
      id: `star_${idSuffix}`,
      position: [x, y, z],
      collected: false
    };
  }, [buildings]);

  // Initial Star Generation
  useEffect(() => {
    if (buildings.length > 0 && stars.length === 0) {
      const temp: StarData[] = [];
      for (let i = 0; i < 1000; i++) {
        const s = generateStar(i);
        if (s) temp.push(s);
      }
      setStars(temp);
    }
  }, [buildings, generateStar]);

  // Continuous Star Spawning (Replenish world)
  useEffect(() => {
    if (isGameOver) return;
    const interval = setInterval(() => {
      setStars(current => {
        if (current.length >= 1200) return current; // Cap stars
        const newStar = generateStar(Date.now());
        return newStar ? [...current, newStar] : current;
      });
    }, 200); // Spawn a star every 200ms if below cap
    return () => clearInterval(interval);
  }, [generateStar, isGameOver]);


  const handleSentinelsDestroyed = useCallback((idsToDestroy: string[]) => {
    setSentinels(prev => prev.filter(s => !idsToDestroy.includes(s.id)));
  }, []);

  const handleExplosion = useCallback((position: THREE.Vector3) => {
    const id = Date.now().toString() + Math.random();
    setExplosions(prev => [...prev, { id, position }]);
    audioService.playExplosion();

    // Cleanup explosion visual after 1 second
    setTimeout(() => {
      setExplosions(prev => prev.filter(e => e.id !== id));
    }, 1000);
  }, []);


  const handleStarCollected = useCallback((id: string) => {
    setCollectedStars(prev => {
      if (prev.has(id)) return prev;
      const newSet = new Set(prev);
      newSet.add(id);
      return newSet;
    });
    audioService.playCollect();
    onCollectStar();
  }, [onCollectStar]);

  const handleWispUpdateWithRef = useCallback((pos: THREE.Vector3) => {
    playerPosRef.current.copy(pos);
    onWispPositionUpdate(pos);
  }, [onWispPositionUpdate]);

  return (
    <div className="w-full h-full" onContextMenu={(e) => e.preventDefault()}>
      <MusicSystem score={score} isLocked={isLocked} isGameOver={isGameOver} />
      
      {/* Mobile Controls Overlay */}
      {isMobile && !isGameOver && gameStarted && mobileInput && (
        <MobileControls inputRef={mobileInput} />
      )}

      <Canvas shadows gl={{ antialias: false, powerPreference: "high-performance" }}>
        <color attach="background" args={['#020203']} />
        <Stars radius={20000} depth={100} count={15000} factor={6} saturation={0} fade speed={1} />
        <fog attach="fog" args={['#0a0a12', 50, 4000]} />

        <ambientLight intensity={3.0} color="#505070" />
        <hemisphereLight args={['#88ccff', '#445566', 2.5]} />

        <directionalLight
          position={[200, 300, 100]}
          intensity={0.5}
          color="#ccddee"
          castShadow
          shadow-mapSize={[2048, 2048]}
        />

        {/* Only use PointerLock on Desktop when Game Started */}
        {!isMobile && gameStarted && (
          <PointerLockControls
            onLock={handleLock}
            onUnlock={handleUnlock}
          />
        )}

        <GameLoop
          isGameOver={isGameOver}
          isLocked={isLocked}
          gameTimeRef={gameTimeRef}
          score={score}
          playerPosRef={playerPosRef}
          setSentinels={setSentinels}
          isMobile={isMobile}
          gameStarted={gameStarted}
        />

        <ProceduralCity buildings={buildings} />
        <CollectibleStars data={stars} collectedIds={collectedStars} />
        <SentinelManager
          sentinels={sentinels}
          playerPosRef={playerPosRef}
          onGameOver={onGameOver}
          isGameOver={isGameOver}
          handleSentinelsDestroyed={handleSentinelsDestroyed}
          handleExplosion={handleExplosion}
          onProximityUpdate={onProximityUpdate}
          buildings={buildings}
        />

        {explosions.map(e => (
          <ExplosionEffect key={e.id} position={e.position} />
        ))}

        {!isGameOver && (
          <Wisp
            onUpdatePosition={handleWispUpdateWithRef}
            buildings={buildings}
            stars={stars}
            collectedStars={collectedStars}
            onCollectStar={handleStarCollected}
            isLocked={isLocked}
            score={score}
            baseColor={wispColor}
            mobileInput={mobileInput}
            isTitleScreen={!gameStarted}
          />
        )}

        <EffectComposer enableNormalPass={false}>
          <Bloom luminanceThreshold={0.7} mipmapBlur intensity={1.2} radius={0.6} />
          <Vignette eskil={false} offset={0.1} darkness={0.5} />
          <Noise opacity={0.03} />
        </EffectComposer>
      </Canvas>
    </div>
  );
};

export default GameScene;