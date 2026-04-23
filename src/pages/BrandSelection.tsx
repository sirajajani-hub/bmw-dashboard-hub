import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { BrandCode } from '../types';
import { motion } from 'motion/react';
import { BmwLogo } from '../components/BmwLogo';
import { MiniCircularDisplay } from '../components/MiniCircularDisplay';

const brands: { code: BrandCode; name: string; media: string; type: 'image' | 'video' | 'component' }[] = [
  { code: 'BMW', name: 'BMW', media: 'https://www.bmw.com/content/dam/bmw/marketBMWCOM/bmw_com/home/sky-04-media-hd-recut-v2b.mp4', type: 'video' },
  { code: 'MOTORRAD', name: 'Motorrad', media: 'https://www.bmw-motorrad.ca/content/dam/bmwmotorradnsc/common/multiimages/images/experience/stories/brand/new-colours-2026/nsc-story-colour-update-2026-multiimage-2560x1440.jpg.asset.1751558420212.jpg', type: 'image' },
  { code: 'MINI', name: 'MINI', media: 'https://mini.com/content/dam/MINI/marketCOM/common/assets/images/content/new-family/a-digital-quantum-leap/Efficient Green-1-1_LQ.mp4', type: 'video' },
];

export default function BrandSelection() {
  const navigate = useNavigate();
  const { setBrand } = useAppStore();

  const handleSelect = (code: BrandCode) => {
    setBrand(code);
    navigate('/dashboards');
  };

  return (
    <div className="min-h-screen bg-[#F4F4F4] text-[#1a1a1a] font-sans selection:bg-black selection:text-white">
      <header className="px-8 py-8 flex justify-between items-center bg-transparent relative z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <BmwLogo className="w-8 h-8" />
            <div className="text-xl font-bold tracking-tighter">BMW Group</div>
          </div>
        </div>
      </header>
      
      <main className="max-w-[1600px] mx-auto px-6 py-12 lg:py-20">
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mb-24"
        >
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold mb-8 tracking-tighter leading-[0.9]">
            <span className="text-gray-400">Select</span> Brand
          </h1>
          <p className="text-lg md:text-xl text-gray-500 max-w-xl leading-relaxed">
            View dasboards, tools, and advaced analytics solutions.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10">
          {brands.map((brand, idx) => (
            <motion.div
              key={brand.code}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => handleSelect(brand.code)}
              className="group cursor-pointer"
            >
              <div className="relative overflow-hidden rounded-lg aspect-[4/5] mb-6 bg-gray-200">
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors duration-500 z-10" />
                
                {brand.type === 'video' ? (
                  <video
                    src={brand.media}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-cover transition-transform duration-700 ease-[0.16,1,0.3,1] group-hover:scale-105 grayscale-[20%] group-hover:grayscale-0"
                  />
                ) : brand.type === 'component' ? (
                  <MiniCircularDisplay />
                ) : (
                  <img 
                    src={brand.media} 
                    alt={brand.name} 
                    className="w-full h-full object-cover transition-transform duration-700 ease-[0.16,1,0.3,1] group-hover:scale-105 grayscale-[20%] group-hover:grayscale-0"
                    referrerPolicy="no-referrer"
                  />
                )}
                
                <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="flex flex-col items-center gap-3 text-white text-base font-medium tracking-wide drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">
                    <span>Dashboards</span>
                    <span>Tools</span>
                    <span>Analytics Solutions</span>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-end border-b border-gray-300 pb-4 group-hover:border-black transition-colors duration-500">
                <div>
                  <span className="text-xs font-mono text-gray-500 mb-1 block">0{idx + 1}</span>
                  <h2 className="text-2xl font-bold tracking-tight">{brand.name}</h2>
                </div>
                <div className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center group-hover:bg-black group-hover:border-black group-hover:text-white transition-all duration-300">
                  <svg className="w-3 h-3 transform -rotate-45 group-hover:rotate-0 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
