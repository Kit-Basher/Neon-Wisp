import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Vector3 } from 'three';
import * as Tone from 'tone';
import GameScene from './components/GameScene';
import HUD from './components/HUD';
import TitleScreen from './components/TitleScreen';
import { MobileInputState } from './types';
import { audioService } from './services/audioService';

const App: React.FC = () => {
  const [gameStarted, setGameStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [wispColor, setWispColor] = useState('#00ffff');
  const [sentinelProximity, setSentinelProximity] = useState(1000);
  const [isMobile, setIsMobile] = useState(false);

  // Ref for mobile input to avoid re-renders
  const mobileInput = useRef<MobileInputState>({
    move: { x: 0, y: 0 },
    look: { x: 0, y: 0 },
    jump: false,
    grapple: false
  });

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Simple regex check for mobile devices or touch capability
      if (/android|ipad|iphone|ipod/i.test(userAgent) || (isTouchDevice && window.innerWidth < 1024)) {
        setIsMobile(true);
      }
    };
    checkMobile();
  }, []);
  
  const handleStartGame = useCallback(() => {
    Tone.start();
    audioService.init();
    setGameStarted(true);
    // On mobile, we don't lock pointers, but we consider the game "active"
    if (!isMobile) {
        setIsLocked(true);
    }
  }, [isMobile]);

  const handleCollectStar = useCallback(() => {
    setScore(prev => prev + 1);
  }, []);

  const handleGameOver = useCallback(() => {
    setIsGameOver(true);
    setIsLocked(false); 
  }, []);

  const handleRestart = useCallback((color: string) => {
    setWispColor(color);
    setScore(0);
    setSentinelProximity(1000);
    setIsGameOver(false);
    setIsLocked(false);
    // Don't reset gameStarted, we stay in game mode
  }, []);

  const handleWispPositionUpdate = useCallback((pos: Vector3) => {
    // Position tracking if needed
  }, []);

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden font-sans selection:bg-cyan-500 selection:text-black">
      <div className="absolute inset-0 z-0">
        <GameScene 
            onWispPositionUpdate={handleWispPositionUpdate} 
            onCollectStar={handleCollectStar}
            isLocked={isLocked}
            setIsLocked={setIsLocked}
            score={score}
            isGameOver={isGameOver}
            onGameOver={handleGameOver}
            onRestart={handleRestart}
            wispColor={wispColor}
            onProximityUpdate={setSentinelProximity}
            mobileInput={mobileInput}
            isMobile={isMobile}
            gameStarted={gameStarted}
        />
      </div>

      {!gameStarted && (
        <TitleScreen onStart={handleStartGame} />
      )}

      {gameStarted && (
        <HUD 
            score={score} 
            isLocked={isLocked} 
            isGameOver={isGameOver} 
            onRestart={handleRestart} 
            sentinelProximity={sentinelProximity}
        />
      )}
    </div>
  );
};

export default App;