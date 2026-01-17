// Removed top-level import to speed up initial app load
// import { GoogleGenAI, Type, Schema } from "@google/genai";
import { CombinedResponse, BackgroundType, VerseSegment, DesignConfig } from '../types';

const MODEL_NAME = 'gemini-3-flash-preview';

// Mapping user language selection to Quran API editions
// Fixed German and Greek, and added new global languages
const LANGUAGE_EDITIONS: Record<string, string> = {
  'English': 'en.sahih',
  'French': 'fr.hamidullah',
  'Spanish': 'es.cortes',
  'German': 'de.bubenheim', // Changed from abullais for better reliability
  'Russian': 'ru.kuliev',
  'Greek': 'el.vlachos', 
  'Indonesian': 'id.indonesian',
  'Turkish': 'tr.diyanet',
  'Urdu': 'ur.jalandhry',
  'Italian': 'it.piccardo',
  'Dutch': 'nl.keyzer',
  'Chinese': 'zh.jian',
};

// Helper to convert standard numbers to Arabic-Indic numerals
function convertToArabicNumerals(n: number): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return n.toString().replace(/\d/g, (d) => arabicDigits[parseInt(d)]);
}

export const fetchVerseAndDesign = async (surahNumber: number, startAyah: number, endAyah?: number, language: string = 'English'): Promise<CombinedResponse> => {
  // 1. Fetch Verses from Quran API
  const edition = LANGUAGE_EDITIONS[language] || 'en.sahih';
  
  // Validate range
  const actualEndAyah = (endAyah && endAyah >= startAyah) ? endAyah : startAyah;
  const limit = actualEndAyah - startAyah + 1;
  const offset = startAyah - 1;

  // Fetch both Arabic (Uthmani) and Translation
  const apiUrl = `https://api.alquran.cloud/v1/surah/${surahNumber}/editions/quran-uthmani,${edition}?offset=${offset}&limit=${limit}`;
  
  const response = await fetch(apiUrl);
  if (!response.ok) {
     const errorText = await response.text();
     throw new Error(`Quran API Error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  
  const arabicEd = data.data.find((d: any) => d.edition.type === 'quran');
  const transEd = data.data.find((d: any) => d.edition.type === 'translation');
  
  if (!arabicEd || !transEd) {
      throw new Error("Invalid response format from Quran API");
  }

  const arabicAyahs = arabicEd.ayahs;
  const transAyahs = transEd.ayahs;
  const surahName = arabicEd.englishName;

  // 2. Smart Grouping Logic (Content Density Balancing)
  // Instead of a fixed number, we fill the card until it reaches a "visual limit"
  const segments: VerseSegment[] = [];
  
  // Optimal Arabic character count per card to keep font large (~450 chars is a good balance)
  // If a single verse is larger than this, it takes the whole card alone.
  const TARGET_CARD_CAPACITY = 450; 

  let currentChunkArabic: any[] = [];
  let currentChunkTrans: any[] = [];
  let currentLength = 0;

  for (let i = 0; i < arabicAyahs.length; i++) {
      const verse = arabicAyahs[i];
      const trans = transAyahs[i];
      const verseLength = verse.text.length;

      // Decision: Should we start a new card?
      // Yes, if adding this verse exceeds capacity AND we already have verses in the buffer.
      if (currentLength + verseLength > TARGET_CARD_CAPACITY && currentChunkArabic.length > 0) {
          // Push current buffer to segments
          pushSegment(segments, currentChunkArabic, currentChunkTrans, surahName);
          
          // Reset buffer
          currentChunkArabic = [];
          currentChunkTrans = [];
          currentLength = 0;
      }

      // Add verse to current buffer
      currentChunkArabic.push(verse);
      currentChunkTrans.push(trans);
      currentLength += verseLength;
  }

  // Push any remaining verses in the buffer
  if (currentChunkArabic.length > 0) {
      pushSegment(segments, currentChunkArabic, currentChunkTrans, surahName);
  }

  // 3. AI Design (Using Translation for Context)
  const contextText = segments[0]?.translation.substring(0, 500) || "";
  
  let design: DesignConfig = {
      backgroundType: BackgroundType.NATURE,
      textColor: 'white',
      opacity: 0.5
  };

  try {
      // Dynamic import to allow faster initial page load
      const { GoogleGenAI, Type } = await import("@google/genai");

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
        Context: Quranic verses translation: "${contextText}".
        Task: Choose a background theme based on meaning.
        
        Options:
        - JANNAT: Words like Paradise, Garden, Rivers, Heaven, Reward, Fruit, Shade.
        - SKY: Words like Sky, Sun, Moon, Stars, Night, Day, Clouds, Rain, Thunder, Universe.
        - NATURE: Words like Earth, Mountain, Sea, Animals, Plants, Travel, Creation.
        
        Default to NATURE if unsure.
        
        Return JSON: { "backgroundType": "SKY" | "NATURE" | "JANNAT", "textColor": "white" | "black", "opacity": 0.6 }
      `;

      const aiResponse = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
              responseMimeType: "application/json",
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      backgroundType: { type: Type.STRING, enum: ["SKY", "NATURE", "JANNAT"] },
                      textColor: { type: Type.STRING, enum: ["white", "black"] },
                      opacity: { type: Type.NUMBER }
                  }
              }
          }
      });
      
      const result = JSON.parse(aiResponse.text || "{}");
      
      if (result.backgroundType) design.backgroundType = result.backgroundType as BackgroundType;
      if (result.textColor) design.textColor = result.textColor as 'white' | 'black';
      if (result.opacity) design.opacity = result.opacity;

  } catch (e) {
      console.warn("AI Design step failed, using default design.", e);
  }

  return { segments, design };
};

// Helper to format and push a segment
function pushSegment(segments: VerseSegment[], arabicChunk: any[], transChunk: any[], surahName: string) {
    const firstNum = arabicChunk[0].numberInSurah;
    const lastNum = arabicChunk[arabicChunk.length - 1].numberInSurah;

    // Join Arabic with markers
    const arabicText = arabicChunk.map((a: any) => 
        `${a.text} ۝${convertToArabicNumerals(a.numberInSurah)}`
    ).join(' ');

    // Join Translation with numbers
    const transText = transChunk.map((t: any) => 
        `${t.text} (${t.numberInSurah})`
    ).join(' ');

    segments.push({
        arabic: arabicText,
        translation: transText,
        surah: surahName,
        ayah: firstNum === lastNum ? `${firstNum}` : `${firstNum}-${lastNum}`
    });
}