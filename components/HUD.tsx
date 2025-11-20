import React from 'react';

interface HUDProps {
  score: number;
  isLocked: boolean;
  isGameOver: boolean;
  onRestart: (color: string) => void;
  sentinelProximity: number;
}

const HUD: React.FC<HUDProps> = ({ score, isLocked, isGameOver, onRestart, sentinelProximity }) => {
  const colors = [
    { name: 'CYAN', value: '#00ffff', ring: 'ring-cyan-400' },
    { name: 'MAGENTA', value: '#ff00ff', ring: 'ring-fuchsia-400' },
    { name: 'GOLD', value: '#ffd700', ring: 'ring-yellow-400' },
    { name: 'LIME', value: '#32ff32', ring: 'ring-green-400' },
    { name: 'CRIMSON', value: '#ff3232', ring: 'ring-red-500' },
    { name: 'WHITE', value: '#ffffff', ring: 'ring-white' },
  ];

  // Calculate warning opacity (starts at 150 units, max at 20)
  const warningOpacity = Math.max(0, Math.min(1, 1 - ((sentinelProximity - 20) / 130)));

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-10">
      
      {/* Proximity Warning Overlay */}
      {!isGameOver && (
          <div 
            className="absolute inset-0 pointer-events-none transition-opacity duration-200 z-0"
            style={{ 
                background: 'radial-gradient(circle, transparent 60%, rgba(255, 0, 0, 0.5) 100%)',
                opacity: warningOpacity 
            }}
          />
      )}

      {/* Crosshair */}
      {isLocked && !isGameOver && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20">
            <div className="w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_10px_#00ffff]"></div>
            <div className="absolute top-1/2 left-1/2 w-8 h-8 border border-cyan-500/30 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
        </div>
      )}

      {/* Critical Warning Text */}
      {!isGameOver && warningOpacity > 0.6 && (
         <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 z-20">
            <p className="text-red-500 font-bold tracking-widest animate-pulse text-xl drop-shadow-[0_0_10px_rgba(255,0,0,0.8)]">
                WARNING: SENTINEL PROXIMITY
            </p>
         </div>
      )}

      {/* Game Over / Color Selector Screen */}
      {isGameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-50 pointer-events-auto">
           <div className="text-center p-10 max-w-2xl w-full">
              <h2 className="text-5xl font-bold text-white mb-2 tracking-[0.2em] drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">SIGNAL LOST</h2>
              <p className="text-gray-400 font-mono mb-8 text-sm tracking-widest">WISP CONTAINMENT BREACHED</p>
              
              <div className="mb-10 border-y border-gray-800 py-6 bg-white/5">
                <p className="text-gray-500 text-xs tracking-widest mb-1">DATA UPLOADED</p>
                <p className="text-6xl text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 font-bold font-mono">{score}</p>
                <p className="text-gray-500 text-xs tracking-widest mt-1">STARS</p>
              </div>

              <p className="text-cyan-400 text-sm tracking-[0.3em] animate-pulse mb-6">SELECT FREQUENCY TO REBOOT</p>

              <div className="flex flex-wrap justify-center gap-6">
                {colors.map((c) => (
                    <button
                        key={c.name}
                        onClick={() => onRestart(c.value)}
                        className={`group relative w-16 h-16 rounded-full transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-opacity-50 ${c.ring}`}
                    >
                        <div 
                            className="absolute inset-0 rounded-full opacity-80 blur-md transition-opacity duration-300 group-hover:opacity-100"
                            style={{ backgroundColor: c.value }}
                        ></div>
                        <div 
                            className="absolute inset-1 rounded-full border-2 border-black/20"
                            style={{ backgroundColor: c.value }}
                        ></div>
                    </button>
                ))}
              </div>
           </div>
        </div>
      )}

      {/* Pause Screen Overlay */}
      {!isLocked && !isGameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 pointer-events-none">
           <div className="text-center">
              <h2 className="text-5xl font-bold text-white mb-2 tracking-widest drop-shadow-[0_0_15px_rgba(0,255,255,0.8)]">PAUSED</h2>
              <p className="text-cyan-400 tracking-[0.3em] animate-pulse font-mono">CLICK TO RESUME</p>
           </div>
        </div>
      )}

      {/* Header */}
      {!isGameOver && (
        <div className={`flex justify-between items-start transition-opacity duration-300 z-10 ${!isLocked ? 'opacity-50' : 'opacity-100'}`}>
            <div>
            <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 drop-shadow-[0_0_15px_rgba(0,255,255,0.5)]">
                NEON WISP
            </h1>
            <p className="text-cyan-200 text-opacity-70 text-xs md:text-sm mt-2 tracking-[0.2em]">
                CITY OF WHISPERS
            </p>
            </div>
            <div className="text-right font-mono">
            <div className="bg-black/40 backdrop-blur-md border border-yellow-500/50 p-3 md:p-4 rounded-lg mb-2 shadow-[0_0_15px_rgba(255,215,0,0.2)]">
                <p className="text-yellow-400 text-2xl md:text-3xl font-bold tracking-widest">{score.toString().padStart(3, '0')}</p>
                <p className="text-yellow-100/60 text-[10px] mt-1">STARS COLLECTED</p>
            </div>
            {score > 4 && (
                 <div className={`backdrop-blur-md border p-2 rounded-lg animate-pulse ${warningOpacity > 0.5 ? 'bg-red-900/80 border-red-500' : 'bg-red-900/20 border-red-500/30'}`}>
                    <p className="text-red-400 text-xs font-bold tracking-widest text-center">SENTINELS ACTIVE</p>
                 </div>
            )}
            </div>
        </div>
      )}

      {/* Controls Footer */}
      {!isGameOver && (
        <div className={`flex justify-between items-end w-full transition-opacity duration-300 z-10 ${!isLocked ? 'opacity-50' : 'opacity-100'}`}>
            <div className="text-cyan-100/60 text-xs md:text-sm font-mono space-y-1 bg-black/40 p-3 md:p-4 rounded-lg backdrop-blur-sm border border-cyan-900/30">
            <p><span className="text-cyan-400 font-bold">[WASD]</span> MOVE / WALL RUN</p>
            <p><span className="text-cyan-400 font-bold">[SPACE]</span> JUMP / AUTO-GLIDE</p>
            <p><span className="text-cyan-400 font-bold">[L-CLICK]</span> GRAPPLE HOOK</p>
            </div>

            <div className="text-right">
                <div className="bg-cyan-900/30 border border-cyan-500/50 p-3 md:p-4 rounded-lg backdrop-blur-md">
                    <p className="text-cyan-300 font-bold mb-1 text-sm">OBJECTIVE</p>
                    <p className="text-xs text-cyan-100">COLLECT STARS</p>
                    <p className="text-xs text-red-300 mt-1">AVOID RED SENTINELS</p>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default HUD;