import React, { useRef, useState, useEffect } from 'react';
import { MobileInputState } from '../types';

interface MobileControlsProps {
  inputRef: React.MutableRefObject<MobileInputState>;
}

const MobileControls: React.FC<MobileControlsProps> = ({ inputRef }) => {
  const joystickContainerRef = useRef<HTMLDivElement>(null);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const startPos = useRef({ x: 0, y: 0 });
  const lastLookPos = useRef({ x: 0, y: 0 });

  // Joystick Logic
  const handleJoystickStart = (e: React.TouchEvent) => {
    e.preventDefault(); // Prevent scrolling
    const touch = e.changedTouches[0];
    startPos.current = { x: touch.clientX, y: touch.clientY };
    setIsActive(true);
    setJoystickPos({ x: 0, y: 0 });
  };

  const handleJoystickMove = (e: React.TouchEvent) => {
    if (!isActive) return;
    e.preventDefault();
    const touch = e.changedTouches[0];
    
    const maxDist = 50; // Max joystick radius
    let dx = touch.clientX - startPos.current.x;
    let dy = touch.clientY - startPos.current.y;
    
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Clamp to radius
    if (dist > maxDist) {
      const ratio = maxDist / dist;
      dx *= ratio;
      dy *= ratio;
    }

    setJoystickPos({ x: dx, y: dy });
    
    // Normalize output -1 to 1
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
  };

  // Look Logic (Right side of screen)
  const handleLookStart = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    lastLookPos.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleLookMove = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const dx = touch.clientX - lastLookPos.current.x;
    const dy = touch.clientY - lastLookPos.current.y;
    
    // Add delta to ref (Wisp component will consume and reset this)
    inputRef.current.look.x += dx * 0.005;
    inputRef.current.look.y += dy * 0.005;
    
    lastLookPos.current = { x: touch.clientX, y: touch.clientY };
  };

  // Action Buttons
  const setAction = (action: 'jump' | 'grapple', value: boolean) => {
    inputRef.current[action] = value;
  };

  return (
    <div className="absolute inset-0 z-40 pointer-events-none select-none touch-none">
      {/* Left Zone: Joystick */}
      <div 
        className="absolute bottom-10 left-10 w-40 h-40 pointer-events-auto"
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
      >
        {/* Base */}
        <div className="w-full h-full rounded-full bg-white/10 border-2 border-white/30 backdrop-blur-sm relative flex items-center justify-center">
           {/* Stick */}
           <div 
             className="w-16 h-16 rounded-full bg-cyan-400/50 border border-cyan-200 shadow-[0_0_15px_rgba(0,255,255,0.5)] transition-transform duration-75"
             style={{ transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)` }}
           />
        </div>
      </div>

      {/* Right Zone: Look Touchpad (Invisible) */}
      <div 
        className="absolute top-0 right-0 w-1/2 h-full pointer-events-auto"
        onTouchStart={handleLookStart}
        onTouchMove={handleLookMove}
      />

      {/* Action Buttons */}
      <div className="absolute bottom-12 right-8 flex gap-6 pointer-events-none">
         {/* Jump Button (A) */}
         <button
            className="pointer-events-auto w-20 h-20 rounded-full bg-purple-500/40 border-2 border-purple-300 backdrop-blur-sm active:bg-purple-500/80 active:scale-95 transition-all flex items-center justify-center"
            onTouchStart={(e) => { e.stopPropagation(); setAction('jump', true); }}
            onTouchEnd={(e) => { e.stopPropagation(); setAction('jump', false); }}
         >
            <span className="font-bold text-white">JUMP</span>
         </button>

         {/* Grapple Button (R1) */}
         <button
            className="pointer-events-auto w-24 h-24 rounded-full bg-cyan-500/40 border-2 border-cyan-300 backdrop-blur-sm active:bg-cyan-500/80 active:scale-95 transition-all flex items-center justify-center -mt-16"
            onTouchStart={(e) => { e.stopPropagation(); setAction('grapple', true); }}
            onTouchEnd={(e) => { e.stopPropagation(); setAction('grapple', false); }}
         >
            <span className="font-bold text-white">HOOK</span>
         </button>
      </div>
    </div>
  );
};

export default MobileControls;