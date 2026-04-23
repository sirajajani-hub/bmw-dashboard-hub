import { useEffect, useState, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore, useConfigStore } from '../store';
import { motion, useScroll, useTransform } from 'motion/react';
import { ArrowLeft, Search, Settings, ArrowRight } from 'lucide-react';
import Fuse from 'fuse.js';
import { BmwLogo } from '../components/BmwLogo';
import { CountryCode } from '../types';

type CardArtDirection = {
  backgroundColor: string;
  backgroundImage: string;
};

const countryFlags: Record<CountryCode, string> = {
  'USA': '🇺🇸',
  'CANADA': '🇨🇦',
  'LATAM': '🌎',
};

const DASHBOARD_CARD_ART: Record<string, CardArtDirection> = {
  'Cross-Tier: Media Performance Dashboard': {
    backgroundColor: '#4b2d73',
    backgroundImage:
      'radial-gradient(circle at 16% 20%, rgba(158, 92, 255, 0.96) 0%, rgba(158, 92, 255, 0.12) 30%), radial-gradient(circle at 84% 24%, rgba(255, 173, 97, 0.9) 0%, rgba(255, 173, 97, 0.08) 24%), linear-gradient(135deg, #6c3fc6 0%, #7f62c6 40%, #d5949b 72%, #eed28b 100%)',
  },
  'Business Monitoring Dashboard': {
    backgroundColor: '#103650',
    backgroundImage:
      'radial-gradient(circle at 18% 82%, rgba(46, 170, 255, 0.94) 0%, rgba(46, 170, 255, 0.1) 30%), radial-gradient(circle at 84% 18%, rgba(255, 212, 131, 0.92) 0%, rgba(255, 212, 131, 0.08) 24%), linear-gradient(135deg, #205e97 0%, #3f82b7 34%, #c49996 70%, #ddd39d 100%)',
  },
  'Creative Intelligence Dashboard': {
    backgroundColor: '#1c5b43',
    backgroundImage:
      'radial-gradient(circle at 18% 20%, rgba(58, 204, 138, 0.92) 0%, rgba(58, 204, 138, 0.1) 28%), radial-gradient(circle at 84% 78%, rgba(255, 167, 92, 0.9) 0%, rgba(255, 167, 92, 0.08) 24%), linear-gradient(135deg, #1f8a63 0%, #4b9b7f 36%, #c59b8f 68%, #dfd19f 100%)',
  },
  'Marketing Campaign ROI': {
    backgroundColor: '#8a371f',
    backgroundImage:
      'radial-gradient(circle at 14% 22%, rgba(255, 109, 68, 0.94) 0%, rgba(255, 109, 68, 0.1) 30%), radial-gradient(circle at 80% 72%, rgba(255, 211, 107, 0.9) 0%, rgba(255, 211, 107, 0.08) 26%), linear-gradient(135deg, #c84e2c 0%, #d77747 34%, #d79b75 66%, #e8d394 100%)',
  },
};

const DEFAULT_CARD_ART: CardArtDirection = {
  backgroundColor: '#233b74',
  backgroundImage:
    'radial-gradient(circle at 16% 22%, rgba(72, 133, 255, 0.92) 0%, rgba(72, 133, 255, 0.08) 30%), radial-gradient(circle at 84% 18%, rgba(245, 202, 105, 0.92) 0%, rgba(245, 202, 105, 0.08) 24%), linear-gradient(135deg, #1f4b87 0%, #546fa1 36%, #c99091 70%, #e0d5a0 100%)',
};

function dashboardArtStyle(title: string, imageKey: string | undefined): CSSProperties {
  const palette = (imageKey && DASHBOARD_CARD_ART[imageKey]) || DASHBOARD_CARD_ART[title] || DEFAULT_CARD_ART;

  return {
    backgroundColor: palette.backgroundColor,
    backgroundImage: palette.backgroundImage,
  };
}

export default function DashboardSelection() {
  const navigate = useNavigate();
  const { brand, country, setCountry } = useAppStore();
  const { config } = useConfigStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const { scrollY } = useScroll();
  const carX = useTransform(scrollY, [0, 600], [0, 800]);

  // Default to USA if no country selected
  useEffect(() => {
    if (!country) {
      setCountry('USA');
    }
  }, [country, setCountry]);

  useEffect(() => {
    if (!brand) {
      navigate('/brand', { replace: true });
    }
  }, [brand, navigate]);

  const filteredDashboards = useMemo(() => {
    let result = config.dashboards.filter(
      (d) => d.country === country && d.brand === brand
    );

    if (selectedTag) {
      result = result.filter((d) => d.tags.includes(selectedTag));
    }

    if (searchQuery) {
      const fuse = new Fuse(result, {
        keys: ['title', 'description', 'tags'],
        threshold: 0.3,
      });
      result = fuse.search(searchQuery).map((res) => res.item);
    }

    // Sort: featured first, then sortOrder, then title
    return result.sort((a, b) => {
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      if (a.sortOrder !== undefined && b.sortOrder !== undefined) return a.sortOrder - b.sortOrder;
      return a.title.localeCompare(b.title);
    });
  }, [config.dashboards, country, brand, searchQuery, selectedTag]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    config.dashboards
      .filter((d) => d.country === country && d.brand === brand)
      .forEach((d) => d.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [config.dashboards, country, brand]);

  if (!brand) return null;

  return (
    <div className="min-h-screen bg-[#F4F4F4] text-[#1a1a1a] font-sans selection:bg-black selection:text-white overflow-x-hidden">
      <header className="px-8 py-8 flex justify-between items-center bg-transparent relative z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/brand')}
            className="w-10 h-10 rounded-full border border-black/10 flex items-center justify-center hover:bg-black hover:text-white transition-colors duration-300"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <BmwLogo className="w-8 h-8" />
            <div className="text-xl font-bold tracking-tighter">BMW Group</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-white rounded-full p-1 border border-gray-200 shadow-sm">
            {(['USA', 'CANADA', 'LATAM'] as CountryCode[]).map((c) => (
              <button
                key={c}
                onClick={() => setCountry(c)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-2 ${
                  country === c 
                    ? 'bg-black text-white shadow-md' 
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <span className="text-sm">{countryFlags[c]}</span>
                {c}
              </button>
            ))}
          </div>
          
          <button 
            onClick={() => navigate('/admin')}
            className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition-colors duration-300 shadow-sm"
            title="Admin Settings"
          >
            <Settings className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </header>
      
      <main className="max-w-[1600px] mx-auto px-6 py-12 lg:py-20 relative">
        <div className="mb-16 relative">
          {/* Animated Car */}
          <motion.img
            src="https://prod.cosy.bmw.cloud/bmwweb/cosySec?COSY-EU-100-7331L%25LayVd4WsiBO3qImvhE5kkxbZxmeJv2TjHT0MIR3aJTcA3YdqfRQTNF1cGa8w0%25lx2tq94Wsf6HWp1Q8O4%25V1%25XUckfNE2E7fgekuMQ3Reqhk7kVSMLoACtqwhJHFl7fmou%25KXgs1HSfWQvCz%25V1Pa2MsfNEbnjHq10s9ODw6E4riI1HuscZwBE%25mrxRtesjzZ857MrHTRUgChZmL5GvloROFgp2XH5IMv6jQ%25gv92YDafvOPjmqn12YaDyLOEjxDqTJIsHkIL3uBr%25A3JdSeZfq6uzVMRcGdSkNh5xWhVA0og8PQNF4HvUnd0Kc%252GU14WxfjpTCcP81D7shxbZOMVXuMwVQX9v6Ocr8vM9CGZIDuscCRp%25QmSnM9qNhay3dYCj7ZidzmvhTB1jxbZUId4A89RJBzcN3O%25lZyrMnOIXYuiGEIHmdjJWHkIVFHGO6AusvL99mlDWLfV91KVZ0pEuTQLI19mt3aJqZvjDlwXYucCwO9%25UtNDPlNcfZ7dWMBHNzzm"
            alt="BMW XM"
            style={{ x: carX }}
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="h-24 md:h-32 lg:h-40 object-contain absolute -top-16 md:-top-24 lg:-top-32 left-0 z-20 pointer-events-none"
            referrerPolicy="no-referrer"
          />
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold mb-12 tracking-tighter leading-[0.9] relative z-10 text-black">
            Dashboards
          </h1>
          
          <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-end justify-between border-b border-black/10 pb-8 relative z-10 bg-[#F4F4F4]/80 backdrop-blur-sm">
            <div className="relative w-full lg:w-[400px]">
              <Search className="absolute left-0 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Search by title, description or tag..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-4 py-2 bg-transparent border-b border-gray-300 focus:border-black outline-none text-lg placeholder:text-gray-300 transition-colors font-medium"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTag(null)}
                className={`px-5 py-2 rounded-full text-xs font-bold tracking-wide transition-all duration-300 border ${
                  selectedTag === null 
                    ? 'bg-black text-white border-black' 
                    : 'bg-white text-gray-500 border-gray-200 hover:border-black hover:text-black'
                }`}
              >
                All
              </button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-5 py-2 rounded-full text-xs font-bold tracking-wide transition-all duration-300 border ${
                    selectedTag === tag 
                      ? 'bg-black text-white border-black' 
                      : 'bg-white text-gray-500 border-gray-200 hover:border-black hover:text-black'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="group flex h-full flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-white to-gray-50 shadow-sm transition-all duration-500 hover:shadow-2xl"
          >
            <div className="relative h-56 overflow-hidden bg-[#1a1a1a]">
              <div
                className="h-full w-full transition-transform duration-700 group-hover:scale-105"
                style={{
                  backgroundColor: '#1e1e20',
                  backgroundImage:
                    'radial-gradient(circle at 18% 22%, rgba(110, 110, 120, 0.5) 0%, rgba(110, 110, 120, 0.05) 28%), radial-gradient(circle at 84% 76%, rgba(215, 215, 220, 0.24) 0%, rgba(215, 215, 220, 0.03) 22%), linear-gradient(135deg, #0f1012 0%, #23252a 38%, #3b3e44 70%, #6b7078 100%)',
                }}
              />
            </div>

            <div className="flex flex-1 flex-col px-8 pb-8 pt-8">
              <h2 className="mb-4 text-2xl font-bold leading-tight text-gray-900 transition-colors duration-300 group-hover:text-gray-600">
                Tier 2: Quarterly MACO Reports
              </h2>

              <p className="mb-8 text-sm leading-relaxed text-gray-500 line-clamp-2">
                Quarterly MACO-level reporting template for Tier 2 regions powered by AI
              </p>

              <div className="mt-auto">
                <div className="mb-5 h-px w-full bg-gray-100" />

                <div className="mb-5 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900">Category</span>
                  <span className="text-sm text-gray-500">Internal</span>
                </div>

                <div className="mb-5 h-px w-full bg-gray-100" />

                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-900">Platform</span>
                    <div className="mt-1 h-1 w-8 rounded-full bg-[#6b7280]"></div>
                  </div>

                  <button
                    onClick={() => navigate('/dashboards/shell')}
                    className="flex h-8 items-center justify-center gap-4 text-black transition-transform duration-300 group-hover:translate-x-1"
                  >
                    <span className="text-sm text-gray-500">Shell</span>
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          {filteredDashboards.map((dashboard, idx) => (
            <motion.div
              key={dashboard.id}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="group bg-gradient-to-br from-white to-gray-50 rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col h-full"
            >
              {/* Image Section */}
              <div className="relative h-56 bg-gray-200 overflow-hidden">
                <div
                  className="w-full h-full transition-transform duration-700 group-hover:scale-105"
                  style={dashboardArtStyle(dashboard.title, dashboard.imageKey)}
                />
              </div>

              {/* Content Section */}
              <div className="pt-8 pb-8 px-8 flex-1 flex flex-col">
                <h3 className="text-2xl font-bold mb-4 leading-tight text-gray-900 group-hover:text-gray-600 transition-colors duration-300">
                  {dashboard.title}
                </h3>
                
                <p className="text-gray-500 text-sm mb-8 line-clamp-2 leading-relaxed">
                  {dashboard.description}
                </p>

                <div className="mt-auto">
                  {/* Divider */}
                  <div className="h-px bg-gray-100 w-full mb-5" />

                  {/* Category Row */}
                  <div className="flex justify-between items-center mb-5">
                    <span className="text-sm font-bold text-gray-900">Category</span>
                    <span className="text-sm text-gray-500">
                      {dashboard.tags[0] || 'General'}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-gray-100 w-full mb-5" />

                  {/* Platform Row */}
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-900">Platform</span>
                      <div className="h-1 w-8 bg-[#0066B1] mt-1 rounded-full"></div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-500">Tableau</span>
                      <a 
                        href={dashboard.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 flex items-center justify-center text-black transition-transform duration-300 group-hover:translate-x-1"
                      >
                        <ArrowRight className="w-5 h-5" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {filteredDashboards.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
              <Search className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="mb-2 text-2xl font-bold tracking-tight">No dashboards found</h3>
            <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
