import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { CountryCode } from '../types';
import { motion } from 'motion/react';
import { BmwLogo } from '../components/BmwLogo';

const countries: { code: CountryCode; name: string; image: string }[] = [
  { code: 'CANADA', name: 'Canada', image: 'https://picsum.photos/seed/canada/800/600' },
  { code: 'LATAM', name: 'Latin America', image: 'https://picsum.photos/seed/latam/800/600' },
  { code: 'USA', name: 'United States', image: 'https://picsum.photos/seed/usa/800/600' },
];

export default function CountrySelection() {
  const navigate = useNavigate();
  const setCountry = useAppStore((state) => state.setCountry);

  const handleSelect = (code: CountryCode) => {
    setCountry(code);
    navigate('/brand');
  };

  return (
    <div className="min-h-screen bg-[#F4F4F4] text-[#1a1a1a] font-sans selection:bg-black selection:text-white">
      <header className="px-8 py-8 flex justify-between items-center bg-transparent relative z-10">
        <div className="flex items-center gap-3">
          <BmwLogo className="w-10 h-10" />
          <div className="text-xl font-bold tracking-tighter">BMW Group</div>
        </div>
        <div className="text-xs font-bold uppercase tracking-widest border border-black/10 px-3 py-1 rounded-full bg-white/50 backdrop-blur-sm">
          Tableau Hub
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
            Select <br />
            <span className="text-gray-400">Region</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-500 max-w-xl leading-relaxed">
            Access localized dashboards and analytics for your specific market. 
            Curated data visualization for better decision making.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10">
          {countries.map((country, idx) => (
            <motion.div
              key={country.code}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => handleSelect(country.code)}
              className="group cursor-pointer"
            >
              <div className="relative overflow-hidden rounded-lg aspect-[4/5] mb-6 bg-gray-200">
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500 z-10" />
                <img 
                  src={country.image} 
                  alt={country.name} 
                  className="w-full h-full object-cover transition-transform duration-700 ease-[0.16,1,0.3,1] group-hover:scale-105 grayscale-[20%] group-hover:grayscale-0"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-6 left-6 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 transform translate-y-4 group-hover:translate-y-0">
                  <span className="bg-white text-black px-4 py-2 rounded-full text-sm font-bold tracking-wide">
                    Explore
                  </span>
                </div>
              </div>
              
              <div className="flex justify-between items-end border-b border-gray-300 pb-4 group-hover:border-black transition-colors duration-500">
                <div>
                  <span className="text-xs font-mono text-gray-500 mb-1 block">0{idx + 1}</span>
                  <h2 className="text-2xl font-bold tracking-tight">{country.name}</h2>
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
