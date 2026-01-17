import React, { forwardRef, useMemo, useState, useEffect } from 'react';
import { CardConfig, BackgroundType } from '../types';
import { BACKGROUNDS, FOOTER_TEXT } from '../constants';
import clsx from 'clsx';

interface VerseCardProps {
  config: CardConfig;
  className?: string;
}

const VerseCard = forwardRef<HTMLDivElement, VerseCardProps>(({ config, className }, ref) => {
  const { 
    verse = { arabic: '...', translation: '', surah: '', ayah: '' }, 
    backgroundType = BackgroundType.NATURE, 
    showTranslation, 
    opacity = 0.5, 
    textColor = 'white' 
  } = config || {};

  const normalizedType = (backgroundType?.toString().toUpperCase() || 'NATURE') as BackgroundType;
  const validBgKey = Object.keys(BACKGROUNDS).includes(normalizedType) 
    ? normalizedType 
    : BackgroundType.NATURE;

  // Select Image
  const bgImage = useMemo(() => {
    const images = BACKGROUNDS[validBgKey];
    if (Array.isArray(images)) {
        // Simple consistent hash based on verse info to keep the same image for the same verse if re-rendered
        // but random enough for different verses
        const seed = verse.arabic.length + (typeof verse.ayah === 'number' ? verse.ayah : 0);
        return images[seed % images.length];
    }
    return images; 
  }, [config, validBgKey, verse]);
  
  // Image Error Handling State
  const [imgError, setImgError] = useState(false);

  // Reset error state when image changes
  useEffect(() => {
    setImgError(false);
  }, [bgImage]);

  const finalTextColor = textColor;

  // Dynamic Font Sizing
  const dynamicFontSize = useMemo(() => {
    if (!verse?.arabic) return 65;
    const length = verse.arabic.length;
    
    if (length < 60) return 90;
    if (length < 120) return 72;
    if (length < 200) return 60;
    if (length < 300) return 52;
    if (length < 500) return 44;
    if (length < 800) return 36;
    if (length < 1200) return 28;
    if (length < 1800) return 24;
    if (length < 2500) return 20;
    if (length < 3500) return 18;
    return 16;
  }, [verse?.arabic]);

  const translationFontSize = useMemo(() => {
    if (!verse?.translation) return 28;
    const length = verse.translation.length;
    
    if (verse.arabic.length > 2000) return 18; 
    if (verse.arabic.length > 1000) return 20;

    if (length < 50) return 40;
    if (length < 100) return 34;
    if (length < 200) return 30;
    if (length < 350) return 26;
    return 22;
  }, [verse?.translation, verse?.arabic]);

  const lineHeight = useMemo(() => {
    if (dynamicFontSize > 60) return 2.1;
    if (dynamicFontSize > 40) return 2.0;
    if (dynamicFontSize < 20) return 1.8; 
    return 1.9; 
  }, [dynamicFontSize]);

  // Fallback Gradients based on type
  const getFallbackGradient = () => {
    switch(normalizedType) {
        case BackgroundType.SKY: return 'bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900';
        case BackgroundType.JANNAT: return 'bg-gradient-to-br from-emerald-900 via-teal-900 to-emerald-950';
        case BackgroundType.NATURE: return 'bg-gradient-to-br from-stone-900 via-stone-800 to-zinc-900';
        default: return 'bg-zinc-900';
    }
  };

  return (
    <div
      ref={ref}
      className={clsx(
        "relative overflow-hidden shadow-2xl flex flex-col items-center select-none",
        "w-[1080px] h-[1080px] origin-top-left",
        getFallbackGradient(), // Apply gradient as base color
        className
      )}
    >
      {/* Background Image Layer */}
      {bgImage && !imgError && (
        <img 
          src={bgImage}
          alt="background"
          crossOrigin="anonymous"
          loading="eager"
          onError={() => setImgError(true)} // Critical: Switches to gradient on error
          className="absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-500"
          style={{ objectFit: 'cover' }}
        />
      )}

      {/* Overlay */}
      <div 
        className="absolute inset-0 z-0 bg-black transition-opacity duration-300 pointer-events-none"
        style={{ opacity: imgError ? 0.3 : opacity }} // Less opacity if showing gradient
      />

      {/* Borders */}
      <div className={clsx("absolute inset-8 border-2 z-10 rounded-xl pointer-events-none", finalTextColor === 'black' ? "border-black/20" : "border-gold-400/50")} />
      <div className={clsx("absolute inset-10 border z-10 rounded-lg pointer-events-none", finalTextColor === 'black' ? "border-black/10" : "border-gold-400/30")} />

      {/* Content */}
      <div className="relative z-20 flex flex-col h-full w-full p-20 gap-4 md:gap-6">
        
        {/* Arabic */}
        <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0">
            <p 
              className={clsx(
                "font-amiri font-bold drop-shadow-lg w-full",
                finalTextColor === 'white' ? 'text-white' : 'text-black'
              )}
              style={{ 
                  fontSize: `${dynamicFontSize}px`,
                  lineHeight: lineHeight,
                  textAlign: verse.arabic.length > 100 ? 'justify' : 'center',
                  textAlignLast: 'center',
                  direction: 'rtl'
              }}
              dir="rtl"
            >
              {verse.arabic}
            </p>
            
            <p className={clsx(
                "mt-2 text-2xl font-cairo opacity-90 font-semibold tracking-wider", 
                 finalTextColor === 'white' ? 'text-gold-400' : 'text-zinc-800'
              )}>
              ﴿ {verse.surah} : {verse.ayah} ﴾
            </p>
        </div>

        {/* Translation */}
        {showTranslation && verse.translation && (
          <div className={clsx("flex-none pt-4 border-t w-full", finalTextColor === 'white' ? "border-white/20" : "border-black/10")}>
            <p 
              className={clsx(
                "font-cairo font-medium text-center drop-shadow-md mx-auto",
                 finalTextColor === 'white' ? 'text-gray-100' : 'text-zinc-800'
              )}
              style={{ 
                fontSize: `${translationFontSize}px`, 
                lineHeight: 1.4,
                textWrap: 'balance',
                maxWidth: '95%'
              }}
              dir="ltr"
            >
              {verse.translation}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex-none h-auto w-full flex justify-between items-end text-sm opacity-80 pt-1">
          <div className={clsx(
             "font-cairo text-lg",
             finalTextColor === 'white' ? 'text-gray-300' : 'text-zinc-600'
          )}>
            تم بواسطة كريم آل عشماوي
          </div>
          <div className={clsx(
             "font-lateef text-3xl tracking-wide", 
             finalTextColor === 'white' ? 'text-gold-400' : 'text-black'
          )}>
            {FOOTER_TEXT}
          </div>
        </div>
      </div>
    </div>
  );
});

VerseCard.displayName = "VerseCard";

export default VerseCard;