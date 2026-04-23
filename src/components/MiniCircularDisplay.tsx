import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

export function MiniCircularDisplay() {
  const [speed, setSpeed] = useState(30);
  const [isEfficient, setIsEfficient] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setSpeed(prev => {
        const next = prev + 1;
        if (next > 60) return 30;
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setIsEfficient(speed < 45);
  }, [speed]);

  return (
    <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden relative">
      {/* Background Glow */}
      <div className={`absolute inset-0 opacity-30 blur-3xl transition-colors duration-500 ${isEfficient ? 'bg-green-900' : 'bg-red-900'}`} />

      {/* Main Circular Container */}
      <div className="relative w-[80%] aspect-square rounded-full border-4 border-gray-800 bg-black shadow-2xl flex items-center justify-center overflow-hidden">
        
        {/* Outer Ring / Progress Bar */}
        <svg className="absolute inset-0 w-full h-full rotate-[-90deg]" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#1f2937" strokeWidth="2" />
          <motion.circle 
            cx="50" 
            cy="50" 
            r="45" 
            fill="none" 
            stroke={isEfficient ? "#4ade80" : "#f87171"} 
            strokeWidth="4" 
            strokeDasharray="283"
            strokeDashoffset={283 - (speed / 60) * 283}
            strokeLinecap="round"
            className="transition-all duration-300"
          />
        </svg>

        {/* Inner Content */}
        <div className="text-center z-10 flex flex-col items-center gap-1">
          {/* Top Info */}
          <div className="text-[10px] text-gray-400 font-mono flex gap-2 mb-1">
            <span>D</span>
            <span>280km</span>
          </div>

          {/* Speed */}
          <div className="text-6xl font-bold text-white leading-none tracking-tighter">
            {speed}
          </div>

          {/* Mode Label */}
          <div className={`text-xs font-bold tracking-widest uppercase mt-2 transition-colors duration-300 ${isEfficient ? 'text-green-400' : 'text-red-400'}`}>
            {isEfficient ? 'EFFICIENT' : 'HIGH CONSUMPTION'}
          </div>

          {/* Center Icon (Bird/Panther simulation) */}
          <div className="my-2">
             {isEfficient ? (
               <svg className="w-8 h-8 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                 <path d="M21 12l-18 9v-18l18 9z" /> {/* Simplified bird shape */}
               </svg>
             ) : (
               <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                 <path d="M12 2l3 6 6 1-4.5 4.5 1 6-5.5-3-5.5 3 1-6-4.5-4.5 6-1 3-6z" /> {/* Simplified star/burst shape */}
               </svg>
             )}
          </div>

          {/* Bottom Info */}
          <div className="text-[10px] text-gray-400 font-mono mt-1">
            YOU GAINED
          </div>
          <div className={`text-sm font-bold font-mono ${isEfficient ? 'text-green-400' : 'text-red-400'}`}>
            {isEfficient ? '+ 10.8 km' : '- 2.4 km'}
          </div>
        </div>

        {/* Decorative Grid Background */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '10px 10px' }}>
        </div>
      </div>
    </div>
  );
}
