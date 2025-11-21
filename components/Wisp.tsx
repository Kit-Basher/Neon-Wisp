import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Color, Group, Mesh, MathUtils } from 'three';
import { Trail } from '@react-three/drei';
import { BuildingData, StarData, MobileInputState } from '../types';
import { audioService } from '../services/audioService';

interface WispProps {
  onUpdatePosition: (pos: Vector3) => void;
  buildings: BuildingData[];
  stars: StarData[];
  collectedStars: Set<string>;
  onCollectStar: (id: string) => void;
  isLocked: boolean;
  score: number;
  baseColor: string;
  mobileInput?: React.MutableRefObject<MobileInputState>;
  isTitleScreen?: boolean;
}

type MovementState = 'AIR' | 'GROUND' | 'WALL' | 'GRAPPLING';

const Wisp: React.FC<WispProps> = ({ onUpdatePosition, buildings, stars, collectedStars, onCollectStar, isLocked, score, baseColor, mobileInput, isTitleScreen }) => {
  const groupRef = useRef<Group>(null);
  const ropeRef = useRef<Mesh>(null);
  const { camera } = useThree();

  // Set rotation order to prevent camera roll
  useEffect(() => {
    camera.rotation.order = 'YXZ';
  }, [camera]);

  const onUpdatePosRef = useRef(onUpdatePosition);
  useEffect(() => {
    onUpdatePosRef.current = onUpdatePosition;
  }, [onUpdatePosition]);

  // Cache collected stars to prevent double-triggering in the physics loop before React updates
  const collectedCache = useRef(new Set<string>());

  // Sync cache with props
  useEffect(() => {
    collectedStars.forEach(id => collectedCache.current.add(id));
  }, [collectedStars]);

  const MOVE_SPEED_BASE = 12.0;
  const dynamicSpeed = MOVE_SPEED_BASE * (1 + score * 0.02);
  const moveSpeedRef = useRef(dynamicSpeed);
  moveSpeedRef.current = dynamicSpeed;

  // PHYSICS TUNING: "Heavy/Dense" Feel
  const GRAVITY = 55.0;           
  const JUMP_FORCE = 30.0;        
  const WALL_JUMP_FORCE_UP = 34.0;
  const WALL_JUMP_FORCE_OUT = 45.0;
  const GLIDE_GRAVITY_SCALE = 0.2;
  const GRAPPLE_SPEED_MULT = 2.0; 
  const GRAPPLE_PULL_FORCE = 40.0; // Reduced base force slightly
  const PLAYER_RADIUS = 0.15;
  const COLLISION_BUFFER = 1.5;
  const STICKY_FORCE = 30.0;

  const keys = useRef<{ [key: string]: boolean }>({});
  const mouse = useRef<{ left: boolean }>({ left: false });
  const velocity = useRef(new Vector3(0, 0, 0));
  const state = useRef<MovementState>('AIR');
  const wallNormal = useRef(new Vector3(0, 0, 0));
  const canJump = useRef(true);
  const canGrapple = useRef(true);
  const grapplePoint = useRef<Vector3 | null>(null);
  const wallJumpCooldown = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    const handleMouseDown = (e: MouseEvent) => { if (e.button === 0) mouse.current.left = true; };
    const handleMouseUp = (e: MouseEvent) => { if (e.button === 0) mouse.current.left = false; };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const castGrappleRay = (origin: Vector3, dir: Vector3): Vector3 | null => {
    let minDist = 150;
    let hitPoint: Vector3 | null = null;

    for (const b of buildings) {
      const distToCenter = origin.distanceTo(new Vector3(...b.position));
      if (distToCenter > minDist + Math.max(b.scale[0], b.scale[2])) continue;

      const minX = b.position[0] - b.scale[0] / 2;
      const maxX = b.position[0] + b.scale[0] / 2;
      const minY = b.position[1] - b.scale[1] / 2;
      const maxY = b.position[1] + b.scale[1] / 2;
      const minZ = b.position[2] - b.scale[2] / 2;
      const maxZ = b.position[2] + b.scale[2] / 2;

      const t1 = (minX - origin.x) / dir.x;
      const t2 = (maxX - origin.x) / dir.x;
      const t3 = (minY - origin.y) / dir.y;
      const t4 = (maxY - origin.y) / dir.y;
      const t5 = (minZ - origin.z) / dir.z;
      const t6 = (maxZ - origin.z) / dir.z;

      const tmin = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6));
      const tmax = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6));

      if (tmax < 0) continue;
      if (tmin > tmax) continue;

      if (tmin < minDist && tmin > 0) {
        minDist = tmin;
        hitPoint = origin.clone().add(dir.clone().multiplyScalar(tmin));
      }
    }

    return hitPoint;
  };

  const checkCollision = (pos: Vector3): { type: 'none' | 'floor' | 'wall', y?: number, normal?: Vector3, snapPos?: Vector3 } => {
    if (pos.y < PLAYER_RADIUS) return { type: 'floor', y: PLAYER_RADIUS };

    for (const b of buildings) {
      if (Math.abs(pos.x - b.position[0]) > b.scale[0] / 2 + PLAYER_RADIUS + 3) continue;
      if (Math.abs(pos.z - b.position[2]) > b.scale[2] / 2 + PLAYER_RADIUS + 3) continue;
      if (pos.y > b.position[1] + b.scale[1] / 2 + 2) continue;
      if (pos.y < b.position[1] - b.scale[1] / 2) continue;

      const minX = b.position[0] - b.scale[0] / 2;
      const maxX = b.position[0] + b.scale[0] / 2;
      const minZ = b.position[2] - b.scale[2] / 2;
      const maxZ = b.position[2] + b.scale[2] / 2;
      const maxY = b.position[1] + b.scale[1] / 2;

      if (pos.x > minX - COLLISION_BUFFER && pos.x < maxX + COLLISION_BUFFER &&
        pos.z > minZ - COLLISION_BUFFER && pos.z < maxZ + COLLISION_BUFFER &&
        pos.y < maxY + COLLISION_BUFFER) {

        if (pos.y >= maxY - 1.0) {
          return { type: 'floor', y: maxY + PLAYER_RADIUS };
        }

        const distMinX = Math.abs(pos.x - minX);
        const distMaxX = Math.abs(pos.x - maxX);
        const distMinZ = Math.abs(pos.z - minZ);
        const distMaxZ = Math.abs(pos.z - maxZ);
        const min = Math.min(distMinX, distMaxX, distMinZ, distMaxZ);

        const normal = new Vector3();
        const snapPos = pos.clone();

        if (min === distMinX) {
          normal.set(-1, 0, 0);
          snapPos.x = minX - PLAYER_RADIUS;
        }
        else if (min === distMaxX) {
          normal.set(1, 0, 0);
          snapPos.x = maxX + PLAYER_RADIUS;
        }
        else if (min === distMinZ) {
          normal.set(0, 0, -1);
          snapPos.z = minZ - PLAYER_RADIUS;
        }
        else if (min === distMaxZ) {
          normal.set(0, 0, 1);
          snapPos.z = maxZ + PLAYER_RADIUS;
        }

        return { type: 'wall', normal, snapPos };
      }
    }
    return { type: 'none' };
  };

  useFrame((stateObj, delta) => {
    if (!groupRef.current) return;
    
    // --- TITLE SCREEN ORBIT CAMERA ---
    if (isTitleScreen) {
      const time = stateObj.clock.getElapsedTime();
      const radius = 8;
      const height = 4;
      const x = groupRef.current.position.x + Math.sin(time * 0.15) * radius;
      const z = groupRef.current.position.z + Math.cos(time * 0.15) * radius;
      
      // Simple floating animation for the wisp
      groupRef.current.position.y = 30 + Math.sin(time) * 0.5;
      
      camera.position.lerp(new Vector3(x, groupRef.current.position.y + height, z), 0.05);
      camera.lookAt(groupRef.current.position);
      return; // Skip physics processing
    }

    // Only pause physics if NOT locked.
    // App.tsx ensures isLocked is true on mobile when playing.
    if (!isLocked) return;

    const dt = Math.min(delta, 0.05);
    const moveSpeed = moveSpeedRef.current;

    if (wallJumpCooldown.current > 0) {
      wallJumpCooldown.current -= dt;
    }

    // --- INPUT POLLING ---
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gamepad = gamepads[0];

    const applyDeadzone = (val: number, threshold = 0.15) => {
      return Math.abs(val) > threshold ? val : 0;
    };

    let inputMoveX = 0;
    let inputMoveY = 0;
    let inputLookX = 0;
    let inputLookY = 0;
    let isJumpPressed = keys.current['Space'];
    let isGrapplePressed = mouse.current.left;

    // 1. Gamepad
    if (gamepad) {
      inputMoveX += applyDeadzone(gamepad.axes[0]);
      inputMoveY += applyDeadzone(gamepad.axes[1]);
      inputLookX += applyDeadzone(gamepad.axes[2]);
      inputLookY += applyDeadzone(gamepad.axes[3]);
      if (gamepad.buttons[0]?.pressed) isJumpPressed = true;
      if (gamepad.buttons[5]?.pressed || gamepad.buttons[7]?.pressed) isGrapplePressed = true;
    }

    // 2. Mobile Touch
    if (mobileInput) {
      inputMoveX += mobileInput.current.move.x;
      inputMoveY += mobileInput.current.move.y;
      
      // Camera Look (Delta)
      // Reduced sensitivity from 200 to 70
      inputLookX += mobileInput.current.look.x * 70; 
      inputLookY += mobileInput.current.look.y * 70;

      // Reset mobile look delta after reading
      mobileInput.current.look.x = 0;
      mobileInput.current.look.y = 0;

      if (mobileInput.current.jump) isJumpPressed = true;
      if (mobileInput.current.grapple) isGrapplePressed = true;
    }

    // 3. Apply Camera Rotation (Gamepad + Mobile)
    const lookSensitivity = 1.5; 
    if (Math.abs(inputLookX) > 0.01 || Math.abs(inputLookY) > 0.01) {
      camera.rotation.y -= inputLookX * lookSensitivity * dt;
      camera.rotation.x -= inputLookY * lookSensitivity * dt;
      camera.rotation.x = MathUtils.clamp(camera.rotation.x, -Math.PI / 2, Math.PI / 2);
    }

    // 4. Calculate Movement Vector
    const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    forward.y = 0; forward.normalize();
    right.y = 0; right.normalize();

    const inputDir = new Vector3(0, 0, 0);

    // Keyboard
    if (keys.current['KeyW']) inputDir.add(forward);
    if (keys.current['KeyS']) inputDir.sub(forward);
    if (keys.current['KeyA']) inputDir.sub(right);
    if (keys.current['KeyD']) inputDir.add(right);

    // Analog (Gamepad + Mobile)
    if (inputMoveY !== 0) inputDir.add(forward.clone().multiplyScalar(-inputMoveY));
    if (inputMoveX !== 0) inputDir.add(right.clone().multiplyScalar(inputMoveX));

    if (inputDir.lengthSq() > 0) inputDir.normalize();

    // --- Star Collision Logic ---
    const playerPos = groupRef.current.position;
    const detectionRadiusSq = 12 * 12;

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      if (collectedCache.current.has(s.id)) continue;

      const starPos = new Vector3(s.position[0], s.position[1], s.position[2]);
      if (playerPos.distanceToSquared(starPos) < detectionRadiusSq) {
        collectedCache.current.add(s.id);
        onCollectStar(s.id);
      }
    }

    // --- Grapple Logic ---
    if (isGrapplePressed) {
      if (canGrapple.current && !grapplePoint.current) {
        const rayDir = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const hit = castGrappleRay(groupRef.current.position, rayDir);
        if (hit) {
          grapplePoint.current = hit;
          state.current = 'GRAPPLING';
          audioService.playGrapple();
        }
      }
    } else {
      // Grapple Release Boost
      if (state.current === 'GRAPPLING') {
        state.current = 'AIR';
        // If releasing while moving fast, apply a slight slingshot boost
        const currentSpeed = velocity.current.length();
        if (currentSpeed > moveSpeed) {
            // Add a 15% boost to current velocity to simulate the "snap" release
            velocity.current.add(velocity.current.clone().normalize().multiplyScalar(currentSpeed * 0.15));
        }
      }
      grapplePoint.current = null;
      canGrapple.current = true;
    }

    // --- Physics State Machine ---
    let gravityMult = 1.0;
    const isGliding = state.current === 'AIR' && velocity.current.y < 0;

    if (state.current === 'WALL') {
      gravityMult = 0;
    } else if (state.current === 'GRAPPLING') {
      gravityMult = 0.5;
    } else if (isGliding) {
      gravityMult = GLIDE_GRAVITY_SCALE;
    }

    if (state.current !== 'WALL' && state.current !== 'GROUND') {
      velocity.current.y -= GRAVITY * gravityMult * dt;
    }

    // --- MOVEMENT PHYSICS ---
    if (state.current === 'GRAPPLING' && grapplePoint.current) {
      const toPoint = grapplePoint.current.clone().sub(groupRef.current.position);
      const dist = toPoint.length();
      const dir = toPoint.normalize();
      
      // ELASTICITY: Spring force (Hooke's Law approximation)
      // Pulls harder when far away (snappy), softer when close (floaty)
      // Reduced multiplier from 3.0 to 1.5 to prevent excessive speed gain
      const springForce = GRAPPLE_PULL_FORCE + (dist * 1.5);

      // Add pull force
      velocity.current.add(dir.multiplyScalar(springForce * dt));
      
      // Allow swing influence (air control during grapple)
      if (inputDir.lengthSq() > 0) {
        velocity.current.add(inputDir.multiplyScalar(moveSpeed * GRAPPLE_SPEED_MULT * dt));
      }
      
      // Speed Limiter on Rope
      const currentSpeed = velocity.current.length();
      const maxSafeSpeed = moveSpeed * 2.5;
      
      if (currentSpeed > maxSafeSpeed) {
         // Stronger damping if overspeeding to prevent infinite energy gain
         velocity.current.multiplyScalar(0.97); 
      } else {
         // Minimal damping normally (Pendulum effect)
         velocity.current.multiplyScalar(0.998);
      }

    } else if (state.current === 'WALL') {
      const vDotN = velocity.current.dot(wallNormal.current);
      if (vDotN < 0) velocity.current.sub(wallNormal.current.clone().multiplyScalar(vDotN));

      const inputDotN = inputDir.dot(wallNormal.current);
      const wallMoveDir = inputDir.clone().sub(wallNormal.current.clone().multiplyScalar(inputDotN));

      velocity.current.add(wallMoveDir.multiplyScalar(moveSpeed * 6 * dt));
      velocity.current.x *= 0.92;
      velocity.current.z *= 0.92;
      velocity.current.y *= 0.6;

      // Sticky force: Push into wall to maintain state contact
      velocity.current.sub(wallNormal.current.clone().multiplyScalar(STICKY_FORCE * dt));

      if (isJumpPressed && canJump.current) {
        velocity.current.y = WALL_JUMP_FORCE_UP;
        // Increased force away from wall
        velocity.current.add(wallNormal.current.clone().multiplyScalar(WALL_JUMP_FORCE_OUT));
        
        // Add forward momentum boost if holding direction during wall jump
        if (inputDir.lengthSq() > 0) {
            velocity.current.add(inputDir.multiplyScalar(5.0));
        }

        state.current = 'AIR';
        canJump.current = false;
        grapplePoint.current = null;
        wallJumpCooldown.current = 0.25; // Ignore wall collisions for 0.25s
        audioService.playJump();
      }

    } else {
      // --- GROUND & AIR MOVEMENT (Momentum Preserving) ---
      const isGround = state.current === 'GROUND';
      
      // Parameters - Heavier Feel
      // Lower acceleration (inertia), Higher friction on ground (weight), Lower friction in air (momentum)
      // INCREASED AIR ACCEL from 15.0 to 45.0 for better air control
      const accel = isGround ? 60.0 : 45.0; 
      
      // Friction/Drag Logic
      // Ground Friction increased to 14 (stops faster, feels heavy). Air friction lowered to 0.1.
      let friction = isGround ? 14.0 : 0.1; 
      
      const currentHVel = new Vector3(velocity.current.x, 0, velocity.current.z);
      const hSpeed = currentHVel.length();
      const limitSpeed = moveSpeed; 

      // DYNAMIC AIR FRICTION:
      // If moving faster than limitSpeed in AIR, reduce friction drastically to preserve that momentum.
      if (!isGround && hSpeed > limitSpeed) {
          // Reduce friction as speed increases above limit.
          const overspeedFactor = Math.min(1, (hSpeed - limitSpeed) / limitSpeed);
          friction = MathUtils.lerp(0.1, 0.001, overspeedFactor);
      }

      // 1. Apply Input Force (Source Engine Style)
      if (inputDir.lengthSq() > 0) {
          // Projection of velocity onto input direction
          const currentSpeedInDir = currentHVel.dot(inputDir);
          
          // Only accelerate if we haven't reached max run speed in this direction.
          // This allows "Air Strafing" mechanics.
          const availableSpeed = limitSpeed - currentSpeedInDir;
          
          if (availableSpeed > 0) {
              // Accelerate up to the limit
              const accelToApply = Math.min(availableSpeed, accel * dt);
              velocity.current.x += inputDir.x * accelToApply;
              velocity.current.z += inputDir.z * accelToApply;
          }
      }

      // 2. Apply Drag
      // Frame-rate independent exponential decay
      const dragFactor = Math.exp(-friction * dt);
      velocity.current.x *= dragFactor;
      velocity.current.z *= dragFactor;

      // 3. Jump
      if (isJumpPressed && state.current === 'GROUND' && canJump.current) {
        velocity.current.y = JUMP_FORCE;
        state.current = 'AIR';
        canJump.current = false;
        audioService.playJump();
      }
    }

    if (!isJumpPressed) canJump.current = true;

    const nextPos = groupRef.current.position.clone().add(velocity.current.clone().multiplyScalar(dt));
    const collision = checkCollision(nextPos);

    if (collision.type === 'floor') {
      if (velocity.current.y > 0) {
        groupRef.current.position.copy(nextPos);
        if (state.current === 'GROUND') state.current = 'AIR';
      } else {
        groupRef.current.position.set(nextPos.x, collision.y!, nextPos.z);
        velocity.current.y = 0;
        state.current = 'GROUND';
        if (grapplePoint.current) {
          grapplePoint.current = null;
          canGrapple.current = false;
        }
      }
    }
    else if (collision.type === 'wall') {
      // Only stick to wall if cooldown is finished
      if (wallJumpCooldown.current > 0) {
        groupRef.current.position.copy(nextPos);
      } else {
        // Hard Snap to wall surface to prevent "sinking" due to sticky force
        groupRef.current.position.copy(collision.snapPos!);
        state.current = 'WALL';
        wallNormal.current.copy(collision.normal!);

        if (grapplePoint.current) {
          grapplePoint.current = null;
          canGrapple.current = false;
        }

        // Cancel velocity into the wall
        const vDotN = velocity.current.dot(collision.normal!);
        if (vDotN < 0) velocity.current.sub(collision.normal!.clone().multiplyScalar(vDotN));
      }
    }
    else {
      groupRef.current.position.copy(nextPos);
      if (state.current === 'GROUND' || state.current === 'WALL') state.current = 'AIR';
    }

    // Camera Follow
    const offset = new Vector3(0, 2, 5);
    offset.applyQuaternion(camera.quaternion);
    const desiredCamPos = groupRef.current.position.clone().add(offset);
    camera.position.lerp(desiredCamPos, 0.12);

    onUpdatePosRef.current(groupRef.current.position);

    if (ropeRef.current) {
      if (grapplePoint.current) {
        ropeRef.current.visible = true;
        const start = groupRef.current.position;
        const end = grapplePoint.current;
        const dist = start.distanceTo(end);
        ropeRef.current.position.lerpVectors(start, end, 0.5);
        ropeRef.current.lookAt(end);
        ropeRef.current.rotateX(Math.PI / 2);
        
        // Visual Elasticity: Rope gets thinner as it stretches
        const thickness = Math.max(0.02, 0.12 - (dist * 0.001)); 
        ropeRef.current.scale.set(thickness, dist, thickness);
      } else {
        ropeRef.current.visible = false;
      }
    }
  });

  const color = baseColor;
  // Aggressive scaling for high-energy "Super Saiyan" feel at high scores
  const glowIntensity = 4 + score * 0.2;
  const lightIntensity = 5 + score * 0.25;

  // Dynamic Comet Tail properties
  const trailWidth = 1.2 + score * 0.05;
  const trailLength = 6 + score * 0.2;

  return (
    <group>
      <group ref={groupRef} position={[0, 30, 0]}>
        <mesh>
          <sphereGeometry args={[PLAYER_RADIUS, 16, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={glowIntensity}
            toneMapped={false}
          />
        </mesh>
        <pointLight distance={15} decay={2} intensity={lightIntensity} color={color} />
        <Trail
          width={trailWidth}
          length={trailLength}
          color={new Color(color)}
          attenuation={(t) => t * t * t} // Sharper taper for comet look
        >
          <mesh visible={false}><sphereGeometry args={[0.1]} /></mesh>
        </Trail>
      </group>

      <mesh ref={ropeRef} visible={false}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshBasicMaterial color="#00ff00" toneMapped={false} opacity={0.8} transparent />
      </mesh>
    </group>
  );
};

export default Wisp;