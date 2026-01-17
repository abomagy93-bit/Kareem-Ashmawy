import React, { useState, useRef, useMemo, useEffect } from 'react';
// Removed top-level html-to-image import for performance
import { 
  Download, 
  Loader2,
  BookOpen,
  Wand2,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Palette,
  Globe,
  Languages,
  Radio,
  Play,
  Pause,
  Users
} from 'lucide-react';
import { CardConfig, VerseSegment, BackgroundType } from './types';
import { SURAHS, LANGUAGES as TRANS_LANGUAGES, UI_TRANSLATIONS } from './constants';
import { fetchVerseAndDesign } from './services/geminiService';
import VerseCard from './components/VerseCard';

export default function App() {
  const [cards, setCards] = useState<CardConfig[]>([]);

  // Refs for the actual card DOM elements (high-res 1080px)
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  // Refs for the wrapper containers (responsive)
  const containerRefs = useRef<Array<HTMLDivElement | null>>([]);
  
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  
  // Radio State
  const [isRadioPlaying, setIsRadioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [selectedSurah, setSelectedSurah] = useState(1);
  const [startAyah, setStartAyah] = useState(1);
  const [endAyah, setEndAyah] = useState(1);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [isRangeMode, setIsRangeMode] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // UI Language State
  const [uiLang, setUiLang] = useState<'ar' | 'en'>('ar');
  const t = UI_TRANSLATIONS[uiLang];

  // New State for Verse Previews
  const [previewVerses, setPreviewVerses] = useState<any[]>([]);
  const [loadingVerses, setLoadingVerses] = useState(false);

  // Visitor Counter State
  const [visitorCount, setVisitorCount] = useState<number>(0);

  // Base settings are fixed for simplicity in this version
  const baseSettings = {
    fontSize: 55,
    showTranslation: true,
    opacity: 0.6
  };

  const currentSurahObj = useMemo(() => 
    SURAHS.find(s => s.number === selectedSurah) || SURAHS[0], 
  [selectedSurah]);

  const maxVerseCount = currentSurahObj.verseCount || 100;

  // Update Document Direction based on UI Language
  useEffect(() => {
    document.documentElement.dir = uiLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = uiLang;
  }, [uiLang]);

  // Fix Google Fonts CORS for html-to-image
  // OPTIMIZATION: Deferred this heavy task to run after the initial render
  useEffect(() => {
    const timer = setTimeout(() => {
        const inlineGoogleFonts = async () => {
        const links = Array.from(document.querySelectorAll('link[href*="fonts.googleapis.com"]')) as HTMLLinkElement[];
        for (const link of links) {
            try {
            const response = await fetch(link.href);
            const css = await response.text();
            const style = document.createElement('style');
            style.innerHTML = css;
            document.head.appendChild(style);
            link.remove();
            } catch (e) {
            console.warn('Could not inline Google Fonts', e);
            }
        }
        };
        inlineGoogleFonts();
    }, 2000); // Wait 2 seconds before running heavy network/DOM tasks

    return () => clearTimeout(timer);
  }, []);

  // Fetch Visitor Count
  useEffect(() => {
    const fetchCount = async () => {
      try {
        // Using counterapi.dev - free public counter
        const NAMESPACE = 'quran-card-design-karim-app-v1';
        const KEY = 'visits';
        const res = await fetch(`https://api.counterapi.dev/v1/${NAMESPACE}/${KEY}/up`);
        const data = await res.json();
        if (data && data.count) {
            setVisitorCount(data.count);
        }
      } catch (error) {
        console.warn("Counter API failed", error);
      }
    };
    // Small delay to prioritize UI paint
    const t = setTimeout(fetchCount, 500);
    return () => clearTimeout(t);
  }, []);

  // Responsive Scaling Logic
  useEffect(() => {
    const updateScales = () => {
      cards.forEach((_, index) => {
        const container = containerRefs.current[index];
        const card = cardRefs.current[index];

        if (!container || !card) return;

        const containerWidth = container.offsetWidth;
        if (containerWidth > 0) {
          const scale = containerWidth / 1080;
          card.style.transform = `scale(${scale})`;
        }
      });
    };

    updateScales();

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(updateScales);
    });

    containerRefs.current.forEach(container => {
      if (container) resizeObserver.observe(container);
    });

    return () => resizeObserver.disconnect();
  }, [cards]);

  // Fetch Verse Previews when Surah changes
  useEffect(() => {
    const fetchVersesPreview = async () => {
      setLoadingVerses(true);
      setPreviewVerses([]); // Clear old previews
      try {
        // Using api.alquran.cloud for simple text preview (Standard Arabic)
        const response = await fetch(`https://api.alquran.cloud/v1/surah/${selectedSurah}`);
        const data = await response.json();
        if (data && data.data && data.data.ayahs) {
          setPreviewVerses(data.data.ayahs);
        }
      } catch (error) {
        console.error("Failed to fetch verse previews", error);
        // Fallback handled by UI (will just show numbers if array is empty)
      } finally {
        setLoadingVerses(false);
      }
    };

    fetchVersesPreview();
  }, [selectedSurah]);


  const toggleRadio = () => {
    try {
        if (!audioRef.current) {
          audioRef.current = new Audio('https://stream.radiojar.com/8s5u5tpdtwzuv');
          audioRef.current.preload = "auto";
        }
        
        if (isRadioPlaying) {
          audioRef.current.pause();
        } else {
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
              playPromise.then(() => {
                  if ('mediaSession' in navigator) {
                      navigator.mediaSession.metadata = new MediaMetadata({
                          title: 'إذاعة القرآن الكريم',
                          artist: 'بث مباشر',
                          album: 'Cairo',
                          artwork: [
                              { src: 'https://images.unsplash.com/photo-1537181534458-75f6fa0bc2e7?w=512&q=80', sizes: '512x512', type: 'image/jpeg' }
                          ]
                      });
                      
                      navigator.mediaSession.setActionHandler('play', () => {
                          audioRef.current?.play();
                          setIsRadioPlaying(true);
                      });
                      navigator.mediaSession.setActionHandler('pause', () => {
                          audioRef.current?.pause();
                          setIsRadioPlaying(false);
                      });
                      navigator.mediaSession.setActionHandler('stop', () => {
                           audioRef.current?.pause();
                           setIsRadioPlaying(false);
                      });
                  }
              }).catch(e => {
                  console.error("Audio playback error:", e);
                  alert("لا يمكن تشغيل الإذاعة حالياً، يرجى التحقق من الاتصال.");
                  setIsRadioPlaying(false);
              });
          }
        }
        setIsRadioPlaying(!isRadioPlaying);
    } catch (e) {
        console.error("Audio error", e);
    }
  };

  const handleFetchVerse = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isRangeMode && endAyah < startAyah) {
        alert(t.rangeError);
        return;
    }

    setLoading(true);
    // Note: We do NOT clear cards here to prevent UI jumping. We use the loading overlay.
    
    // On mobile, collapse sidebar after search
    if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
    }
    
    try {
      const finalEndAyah = isRangeMode ? endAyah : undefined;
      
      const { segments, design } = await fetchVerseAndDesign(selectedSurah, startAyah, finalEndAyah, selectedLanguage);
      
      const newCards: CardConfig[] = segments.map(segment => ({
        verse: segment,
        backgroundType: design.backgroundType,
        textColor: design.textColor,
        opacity: design.opacity,
        fontSize: baseSettings.fontSize,
        showTranslation: baseSettings.showTranslation,
      }));

      setCards(newCards);
      
      // Reset refs
      cardRefs.current = newCards.map(() => null);
      containerRefs.current = newCards.map(() => null);

    } catch (err: any) {
      console.error("Fetch Error:", err);
      const msg = err.message || t.errorTitle;
      alert(`${t.errorTitle}: ${msg}\n${t.errorRetry}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (index: number, verse: VerseSegment) => {
    const ref = cardRefs.current[index];
    if (!ref) return;

    setDownloadingId(index);

    try {
      // Critical: Wait for fonts to be ready
      await document.fonts.ready;
      // Extra buffer for image decoding
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const commonOptions = {
          pixelRatio: 1.5, // Slight upscale for sharpness
          width: 1080,
          height: 1080,
          skipAutoScale: true, // Fix for mobile rendering
          style: {
             transform: 'none', 
             transformOrigin: 'top left'
          }
      };

      let dataUrl;
      try {
          // Dynamic Import to boost startup speed
          // This library is heavy and not needed until download click
          const { toPng } = await import('html-to-image');

          // First attempt with cache busting (safest for fresh external images)
          dataUrl = await toPng(ref, { 
              ...commonOptions,
              cacheBust: true, 
          });
      } catch (firstErr) {
          console.warn("First download attempt failed, retrying without cache bust...", firstErr);
          // Retry without cache busting (in case of CORS headers mismatch on cached items)
          await new Promise(resolve => setTimeout(resolve, 500));
          const { toPng } = await import('html-to-image'); // Re-import safe
          dataUrl = await toPng(ref, { 
              ...commonOptions,
              cacheBust: false,
          });
      }

      if (dataUrl) {
          const link = document.createElement('a');
          link.download = `quran-card-${verse.surah}-${verse.ayah}.png`;
          link.href = dataUrl;
          link.click();
      } else {
          throw new Error("Failed to generate image data");
      }

    } catch (err) {
      console.error("Download failed", err);
      alert(t.downloadError);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSurahChange = (newSurah: number) => {
    setSelectedSurah(newSurah);
    setStartAyah(1);
    setEndAyah(1);
  };

  const handleStartAyahChange = (val: number) => {
      setStartAyah(val);
      if (!isRangeMode || val > endAyah) {
          setEndAyah(val);
      }
  };

  const renderAyahOptions = (count: number, startFrom: number = 1) => {
    if (!loadingVerses && previewVerses.length > 0) {
       return previewVerses.map((ayahObj, idx) => {
          const ayahNum = idx + 1;
          if (ayahNum < startFrom) return null;
          
          const text = ayahObj.text.length > 40 ? ayahObj.text.substring(0, 40) + '...' : ayahObj.text;
          return (
            <option key={ayahNum} value={ayahNum}>
               {ayahNum}. {text}
            </option>
          );
       });
    }

    return Array.from({length: count}, (_, i) => i + startFrom).map((num) => (
      <option key={num} value={num}>
        {loadingVerses ? `${t.loading} ${num}` : `${t.ayahPrefix} ${num}`}
      </option>
    ));
  };

  return (
    <div className="min-h-screen bg-black text-gray-100 font-cairo flex flex-col">
      
      {/* Top Credits & Radio Bar */}
      <div className="bg-zinc-950 border-b border-zinc-800 py-2 px-4 lg:px-6 flex flex-col md:flex-row justify-between items-center gap-3 text-[10px] lg:text-xs font-medium text-zinc-500 select-none relative z-50">
         <div className="flex flex-wrap justify-center md:justify-start items-center gap-3 md:gap-4 order-2 md:order-1 w-full md:w-auto">
             <button 
                onClick={toggleRadio}
                className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all ${isRadioPlaying ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800 animate-pulse' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'}`}
             >
                <Radio className="w-3 h-3" />
                <span>{isRadioPlaying ? t.radioOn : t.radioOff}</span>
                {isRadioPlaying ? <Pause className="w-3 h-3 ml-1" /> : <Play className="w-3 h-3 ml-1" />}
             </button>
             
             <div className="flex items-center gap-2">
                <a href="https://Karimashmawy.blogspot.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-gold-500/90 hover:text-gold-400 px-3 py-1 rounded-full border border-zinc-800 transition-all hover:border-gold-500/20">
                  <Globe className="w-3 h-3" />
                  <span>{t.blogLink}</span>
                </a>
                <a href="https://Quran-elkareem.netlify.app" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-gold-500/90 hover:text-gold-400 px-3 py-1 rounded-full border border-zinc-800 transition-all hover:border-gold-500/20">
                  <BookOpen className="w-3 h-3" />
                  <span>{t.quranLink}</span>
                </a>
             </div>

             {/* Language Toggle */}
             <button 
                onClick={() => setUiLang(prev => prev === 'ar' ? 'en' : 'ar')}
                className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white px-3 py-1 rounded-full border border-zinc-800 transition-all"
             >
                <Languages className="w-3 h-3" />
                <span>{uiLang === 'ar' ? 'English' : 'العربية'}</span>
             </button>
         </div>

         <div className="flex items-center gap-3 order-1 md:order-2">
            <span>{t.madeBy}</span>
            <div className="hidden md:block w-px h-3 bg-zinc-800"></div>
            <span className="text-gold-600/60 whitespace-nowrap">{t.charity}</span>
         </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1">
        <aside className={`flex-shrink-0 bg-zinc-900 border-b lg:border-b-0 lg:border-l border-zinc-800 transition-all duration-300 ease-in-out z-30 shadow-2xl w-full lg:w-96 ${isSidebarOpen ? 'max-h-none' : 'max-h-16 lg:max-h-none'} flex flex-col relative`}>
            <div className="sticky top-0 z-40 bg-zinc-900 flex items-center justify-between p-4 lg:p-6 border-b border-zinc-800 cursor-pointer lg:cursor-default" onClick={() => window.innerWidth < 1024 && setIsSidebarOpen(!isSidebarOpen)}>
                <div>
                    <h1 className="text-xl lg:text-2xl font-bold text-gold-400 drop-shadow-sm">{t.appTitle}</h1>
                    <p className="text-zinc-500 text-xs mt-1 hidden lg:block">{t.controlsTitle}</p>
                </div>
                <div className="lg:hidden text-gold-400">
                  {isSidebarOpen ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                </div>
            </div>

            <div className={`p-6 space-y-6 ${isSidebarOpen ? 'block' : 'hidden lg:block'}`}>
                <div className="text-center pb-2 hidden lg:block">
                    <p className="text-zinc-400 text-sm">{t.controlsDesc}</p>
                </div>

                <div className="space-y-4 bg-zinc-800/50 p-4 rounded-xl border border-gold-500/20">
                    <div className="flex items-center gap-2 text-gold-400 font-bold border-b border-zinc-700 pb-2 mb-2">
                      <BookOpen className="w-5 h-5" />
                      <span>{t.selectionHeader}</span>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                          <label className="block text-xs font-semibold text-zinc-400 mb-1">{t.surah}</label>
                          <select 
                             value={selectedSurah} 
                             onChange={(e) => handleSurahChange(Number(e.target.value))} 
                             className="w-full p-2 border border-zinc-600 rounded-lg text-right bg-zinc-950 text-white focus:ring-1 focus:ring-gold-500 outline-none" 
                             dir={uiLang === 'ar' ? 'rtl' : 'ltr'}
                          >
                          {SURAHS.map((s) => (
                              <option key={s.number} value={s.number}>
                              {s.number}. {uiLang === 'ar' ? s.arabicName : s.name} ({uiLang === 'ar' ? s.name : s.arabicName})
                              </option>
                          ))}
                          </select>
                      </div>

                      <div className="space-y-2">
                          <div className="flex items-center justify-between">
                              <label className="block text-xs font-semibold text-zinc-400">{t.verses}</label>
                              <button onClick={() => setIsRangeMode(!isRangeMode)} className="text-[10px] text-gold-500 underline hover:text-gold-300">
                                {isRangeMode ? t.oneVerse : t.multiVerses}
                              </button>
                          </div>
                          
                          <div className="flex flex-col gap-2">
                              <div className="flex-1 w-full">
                                  <div className={`text-[10px] text-zinc-500 mb-1 ${uiLang === 'ar' ? 'text-right' : 'text-left'}`}>{t.from}</div>
                                  <select 
                                      value={startAyah} 
                                      onChange={(e) => handleStartAyahChange(Number(e.target.value))} 
                                      className="w-full p-2 border border-zinc-600 rounded-lg text-right bg-zinc-950 text-white focus:ring-1 focus:ring-gold-500 outline-none appearance-none font-amiri text-sm"
                                      dir={uiLang === 'ar' ? 'rtl' : 'ltr'}
                                  >
                                      {renderAyahOptions(maxVerseCount, 1)}
                                  </select>
                              </div>
                              
                              {isRangeMode && (
                                  <div className="flex-1 w-full animate-in fade-in slide-in-from-top-1 duration-200">
                                      <div className={`text-[10px] text-zinc-500 mb-1 ${uiLang === 'ar' ? 'text-right' : 'text-left'}`}>{t.to}</div>
                                      <select 
                                          value={endAyah} 
                                          onChange={(e) => setEndAyah(Number(e.target.value))} 
                                          className="w-full p-2 border border-zinc-600 rounded-lg text-right bg-zinc-950 text-white focus:ring-1 focus:ring-gold-500 outline-none appearance-none font-amiri text-sm"
                                          dir={uiLang === 'ar' ? 'rtl' : 'ltr'}
                                      >
                                         {renderAyahOptions(maxVerseCount - startAyah + 1, startAyah)}
                                      </select>
                                  </div>
                              )}
                          </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-1 flex items-center gap-1">
                          <Languages className="w-3 h-3" />
                          {t.transLang}
                        </label>
                        <select 
                           value={selectedLanguage} 
                           onChange={(e) => setSelectedLanguage(e.target.value)} 
                           className="w-full p-2 border border-zinc-600 rounded-lg text-right bg-zinc-950 text-white focus:ring-1 focus:ring-gold-500 outline-none" 
                           dir={uiLang === 'ar' ? 'rtl' : 'ltr'}
                        >
                          {TRANS_LANGUAGES.map((lang) => (
                            <option key={lang.code} value={lang.code}>{lang.name}</option>
                          ))}
                        </select>
                      </div>

                      <button onClick={handleFetchVerse} disabled={loading} className="w-full bg-gold-500 hover:bg-gold-400 text-black font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-gold-500/20 disabled:opacity-50 mt-4">
                          {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Wand2 className="w-5 h-5" />}
                          <span>{t.generate}</span>
                      </button>
                    </div>
                </div>
            </div>
        </aside>

        <main className="flex-1 bg-zinc-950 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black pointer-events-none"></div>
            <div className="absolute inset-0 opacity-20 pointer-events-none fixed" style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)', backgroundSize: '30px 30px'}}></div>
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-gold-500/5 blur-[120px] rounded-full pointer-events-none"></div>
            
            <div className="relative z-10 p-4 lg:p-12 min-h-full flex flex-col items-center">
                
                {cards.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center min-h-[50vh] text-zinc-500 mt-10 lg:mt-0">
                        <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-zinc-800 shadow-2xl shadow-gold-900/5 ring-1 ring-gold-500/10">
                            <Palette className="w-10 h-10 text-gold-500/50" />
                        </div>
                        <h2 className="text-2xl font-bold text-zinc-300 mb-2 font-amiri">{t.startTitle}</h2>
                        <p className="text-sm text-zinc-500 max-w-md text-center leading-relaxed">
                            {t.startDesc}
                        </p>
                    </div>
                )}

                {/* Loading Overlay when generating NEW cards while OLD ones exist */}
                {loading && cards.length > 0 && (
                     <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
                        <Loader2 className="w-16 h-16 text-gold-500 animate-spin mb-4 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
                        <p className="text-white font-bold text-lg animate-pulse">{t.designing}</p>
                     </div>
                )}

                {loading && cards.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-4 min-h-[50vh]">
                        <Loader2 className="w-12 h-12 text-gold-500 animate-spin mb-4" />
                        <p className="text-gold-400 animate-pulse text-sm lg:text-base font-medium">{t.fetching}</p>
                    </div>
                )}

                <div className="space-y-12 lg:space-y-16 w-full max-w-[800px] pb-20 mt-4">
                    {cards.map((cardConfig, index) => (
                        <div key={index} className="flex flex-col items-center w-full">
                            
                            <div 
                                ref={(el) => { containerRefs.current[index] = el; }}
                                className="relative w-full aspect-square shadow-2xl shadow-gold-900/10 rounded-sm overflow-hidden bg-zinc-900 border border-zinc-800"
                            >
                                <div 
                                    className="absolute top-0 left-0 w-[1080px] h-[1080px] origin-top-left"
                                    ref={(el) => { cardRefs.current[index] = el; }} 
                                >
                                    <VerseCard config={cardConfig} />
                                </div>
                            </div>

                            <div className="mt-6 w-full flex justify-center">
                                <button 
                                    onClick={() => handleDownload(index, cardConfig.verse)}
                                    disabled={downloadingId === index}
                                    className="px-10 py-3 bg-gold-500 hover:bg-gold-400 text-black border border-gold-400 rounded-full font-bold transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 min-w-[200px]"
                                >
                                    {downloadingId === index ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Download className="w-5 h-5" />
                                    )}
                                    <span>{downloadingId === index ? t.downloading : t.download}</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {visitorCount > 0 && (
                    <div className="mt-auto pt-10 pb-4 text-center opacity-60 hover:opacity-100 transition-opacity">
                        <p className="text-zinc-500 text-sm font-amiri flex items-center justify-center gap-2">
                             <Users className="w-4 h-4" />
                             {t.visitor} <span className="text-gold-500 font-bold mx-1 text-base">{visitorCount.toLocaleString(uiLang === 'ar' ? 'ar-EG' : 'en-US')}</span>
                        </p>
                    </div>
                )}
            </div>
        </main>
      </div>
    </div>
  );
}