import React, { useRef, useState } from 'react';
import { MobileInputState } from '../types';

interface MobileControlsProps {
  inputRef: React.MutableRefObject<MobileInputState>;
}

const MobileControls: React.FC<MobileControlsProps> = ({ inputRef }) => {
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const [grappleActive, setGrappleActive] = useState(false);
  
  const startPos = useRef({ x: 0, y: 0 });
  const lastLookPos = useRef({ x: 0, y: 0 });
  
  // Tap Detection Refs
  const joystickTapStart = useRef({ time: 0, x: 0, y: 0 });
  const lookTapStart = useRef({ time: 0, x: 0, y: 0 });
  
  const TAP_TIME_THRESHOLD = 200; // ms
  const TAP_DIST_THRESHOLD = 10; // px

  // --- Joystick Logic (Left Side) ---
  const handleJoystickStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    
    // Movement Logic
    startPos.current = { x: touch.clientX, y: touch.clientY };
    setIsActive(true);
    setJoystickPos({ x: 0, y: 0 });
    
    // Tap Logic
    joystickTapStart.current = { time: Date.now(), x: touch.clientX, y: touch.clientY };
  };

  const handleJoystickMove = (e: React.TouchEvent) => {
    if (!isActive) return;
    e.preventDefault();
    const touch = e.changedTouches[0];
    
    const maxDist = 50;
    let dx = touch.clientX - startPos.current.x;
    let dy = touch.clientY - startPos.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > maxDist) {
      const ratio = maxDist / dist;
      dx *= ratio;
      dy *= ratio;
    }

    setJoystickPos({ x: dx, y: dy });
    
    inputRef.current.move = {
      x: dx / maxDist,
      y: dy / maxDist
    };
  };

  const handleJoystickEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsActive(false);
    setJoystickPos({ x: 0, y: 0 });
    inputRef.current.move = { x: 0, y: 0 };

    // Check for Jump Tap
    const touch = e.changedTouches[0];
    const timeDiff = Date.now() - joystickTapStart.current.time;
    const dx = touch.clientX - joystickTapStart.current.x;
    const dy = touch.clientY - joystickTapStart.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (timeDiff < TAP_TIME_THRESHOLD && dist < TAP_DIST_THRESHOLD) {
      // Trigger Jump (Pulse)
      inputRef.current.jump = true;
      setTimeout(() => { inputRef.current.jump = false; }, 100);
    }
  };

  // --- Look Logic (Right Side) ---
  const handleLookStart = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    lastLookPos.current = { x: touch.clientX, y: touch.clientY };
    
    // Tap Logic
    lookTapStart.current = { time: Date.now(), x: touch.clientX, y: touch.clientY };
  };

  const handleLookMove = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const dx = touch.clientX - lastLookPos.current.x;
    const dy = touch.clientY - lastLookPos.current.y;
    
    inputRef.current.look.x += dx * 0.005;
    inputRef.current.look.y += dy * 0.005;
    
    lastLookPos.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleLookEnd = (e: React.TouchEvent) => {
     // Check for Grapple Toggle Tap
     const touch = e.changedTouches[0];
     const timeDiff = Date.now() - lookTapStart.current.time;
     const dx = touch.clientX - lookTapStart.current.x;
     const dy = touch.clientY - lookTapStart.current.y;
     const dist = Math.sqrt(dx * dx + dy * dy);

     if (timeDiff < TAP_TIME_THRESHOLD && dist < TAP_DIST_THRESHOLD) {
        // Toggle Grapple
        const newState = !inputRef.current.grapple;
        inputRef.current.grapple = newState;
        setGrappleActive(newState);
     }
  };

  return (
    <div className="absolute inset-0 z-40 pointer-events-none select-none touch-none">
      
      {/* Instructions Overlay */}
      <div className="absolute top-20 left-0 w-full text-center pointer-events-none opacity-50 text-[10px] font-mono text-white">
        <span className="mx-2">TAP L-PAD: JUMP</span> | <span className="mx-2">TAP R-SIDE: TOGGLE HOOK</span>
      </div>

      {/* Grapple Status Indicator */}
      {grappleActive && (
         <div className="absolute top-1/2 right-10 transform -translate-y-1/2 pointer-events-none">
            <div className="bg-cyan-500/20 border border-cyan-400/50 px-4 py-2 rounded backdrop-blur-sm animate-pulse">
               <p className="text-cyan-400 font-bold tracking-widest text-xs">HOOK ENGAGED</p>
            </div>
         </div>
      )}

      {/* Left Zone: Joystick & Jump Tap */}
      <div 
        className="absolute bottom-0 left-0 w-1/2 h-2/3 pointer-events-auto"
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
      >
        <div className="absolute bottom-10 left-10 w-40 h-40 pointer-events-none">
            <div className={`w-full h-full rounded-full bg-white/5 border-2 border-white/10 backdrop-blur-sm relative flex items-center justify-center transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-30'}`}>
                <div 
                    className="w-16 h-16 rounded-full bg-cyan-400/50 border border-cyan-200 shadow-[0_0_15px_rgba(0,255,255,0.5)] transition-transform duration-75"
                    style={{ transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)` }}
                />
            </div>
        </div>
      </div>

      {/* Right Zone: Look & Grapple Tap */}
      <div 
        className="absolute bottom-0 right-0 w-1/2 h-2/3 pointer-events-auto"
        onTouchStart={handleLookStart}
        onTouchMove={handleLookMove}
        onTouchEnd={handleLookEnd}
      />
    </div>
  );
};

export default MobileControls;