import React, { useState, useCallback } from 'react';
import { Vector3 } from 'three';
import GameScene from './components/GameScene';
import HUD from './components/HUD';

const App: React.FC = () => {
  const [score, setScore] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [wispColor, setWispColor] = useState('#00ffff');
  const [sentinelProximity, setSentinelProximity] = useState(1000);
  
  const handleCollectStar = useCallback(() => {
    setScore(prev => prev + 1);
  }, []);

  const handleGameOver = useCallback(() => {
    setIsGameOver(true);
    setIsLocked(false); // Unlock cursor so they can click retry
  }, []);

  const handleRestart = useCallback((color: string) => {
    setWispColor(color);
    setScore(0);
    setSentinelProximity(1000);
    setIsGameOver(false);
    setIsLocked(false); // Don't auto-lock; let user click "Resume" to satisfy browser security
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
        />
      </div>

      <HUD 
        score={score} 
        isLocked={isLocked} 
        isGameOver={isGameOver} 
        onRestart={handleRestart} 
        sentinelProximity={sentinelProximity}
      />
    </div>
  );
};

export default App;