import React from 'react';

interface TitleScreenProps {
  onStart: () => void;
}

const TitleScreen: React.FC<TitleScreenProps> = ({ onStart }) => {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div className="text-center max-w-4xl w-full px-4 relative">
        
        {/* Decorative Lines */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50"></div>

        {/* Main Title */}
        <div className="mb-2 relative group cursor-default">
          <h1 className="text-6xl md:text-9xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-purple-500 drop-shadow-[0_0_25px_rgba(0,255,255,0.5)] transform transition-transform duration-700 group-hover:scale-105">
            NEON WISP
          </h1>
          {/* Glitch effect duplicate */}
          <h1 className="absolute top-0 left-0 w-full text-6xl md:text-9xl font-black italic tracking-tighter text-cyan-500 opacity-0 group-hover:opacity-30 animate-pulse translate-x-[2px]">
            NEON WISP
          </h1>
        </div>

        <p className="text-cyan-200 text-lg md:text-2xl tracking-[0.5em] font-light mb-12 drop-shadow-[0_0_10px_rgba(0,255,255,0.3)]">
          CITY OF WHISPERS
        </p>

        {/* Start Button */}
        <button
          onClick={onStart}
          className="group relative px-12 py-4 bg-black/60 border border-cyan-500/50 overflow-hidden transition-all duration-300 hover:border-cyan-400 hover:bg-cyan-900/20 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black"
        >
          <div className="absolute inset-0 w-0 bg-cyan-500/20 transition-all duration-[250ms] ease-out group-hover:w-full"></div>
          <span className="relative text-cyan-400 font-mono text-xl md:text-2xl font-bold tracking-widest group-hover:text-white transition-colors">
            INITIALIZE_LINK
          </span>
        </button>

        {/* Controls Hint */}
        <div className="mt-16 grid grid-cols-2 gap-8 text-xs md:text-sm font-mono text-gray-400 opacity-80">
          <div className="text-right border-r border-gray-700 pr-4">
            <p className="text-cyan-600 font-bold mb-1">KEYBOARD</p>
            <p>[WASD] MOVE</p>
            <p>[SPACE] JUMP</p>
            <p>[CLICK] GRAPPLE</p>
          </div>
          <div className="text-left pl-4">
            <p className="text-purple-600 font-bold mb-1">CONTROLLER</p>
            <p>[L-STICK] MOVE</p>
            <p>[A / X] JUMP</p>
            <p>[R1 / RB] GRAPPLE</p>
          </div>
        </div>

        <div className="absolute bottom-[-100px] left-0 w-full text-center">
            <p className="text-[10px] text-gray-600 tracking-widest font-mono">SYSTEM_VERSION: 2.4.0 // READY</p>
        </div>
      </div>
    </div>
  );
};

export default TitleScreen;