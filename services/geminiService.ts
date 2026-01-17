// Removed GoogleGenAI import to maximize speed
import { CombinedResponse, BackgroundType, VerseSegment, DesignConfig } from '../types';

// Mapping user language selection to Quran API editions
const LANGUAGE_EDITIONS: Record<string, string> = {
  'English': 'en.sahih',
  'French': 'fr.hamidullah',
  'Spanish': 'es.cortes',
  'German': 'de.bubenheim',
  'Russian': 'ru.kuliev',
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

// Instant client-side design logic
function getDesignFromText(text: string): DesignConfig {
    const lowerText = (text || '').toLowerCase();
    
    const keywords = {
        [BackgroundType.JANNAT]: ['paradise', 'garden', 'river', 'heaven', 'reward', 'fruit', 'shade', 'eternity', 'jannah', 'bliss', 'springs', 'gold', 'silk', 'peace'],
        [BackgroundType.SKY]: ['sky', 'sun', 'moon', 'star', 'night', 'day', 'cloud', 'rain', 'thunder', 'universe', 'light', 'darkness', 'space', 'planet', 'orbit', 'rising', 'setting'],
        [BackgroundType.NATURE]: ['earth', 'mountain', 'sea', 'ocean', 'land', 'water', 'tree', 'plant', 'wind', 'creation', 'animal', 'bird', 'cattle', 'camel', 'desert', 'rock']
    };

    let scores = {
        [BackgroundType.JANNAT]: 0,
        [BackgroundType.SKY]: 0,
        [BackgroundType.NATURE]: 0
    };

    // Fast frequency count
    for (const [type, words] of Object.entries(keywords)) {
        for (const word of words) {
            if (lowerText.includes(word)) {
                scores[type as BackgroundType]++;
            }
        }
    }

    // Select best match
    const types = [BackgroundType.NATURE, BackgroundType.SKY, BackgroundType.JANNAT];
    let bestType = BackgroundType.NATURE;
    let maxScore = -1;

    // Check scores
    for (const t of types) {
         if (scores[t] > maxScore) {
             maxScore = scores[t];
             bestType = t;
         }
    }

    // If no keywords matched (score 0), pick a random one for variety
    if (maxScore === 0) {
        bestType = types[Math.floor(Math.random() * types.length)];
    }

    return {
        backgroundType: bestType,
        textColor: 'white', // White provides best contrast with current dark overlay style
        opacity: 0.5
    };
}

export const fetchVerseAndDesign = async (surahNumber: number, startAyah: number, endAyah?: number, language: string = 'English'): Promise<CombinedResponse> => {
  // 1. Fetch Verses from Quran API (This is the only network request now)
  const edition = LANGUAGE_EDITIONS[language] || 'en.sahih';
  
  const actualEndAyah = (endAyah && endAyah >= startAyah) ? endAyah : startAyah;
  const limit = actualEndAyah - startAyah + 1;
  const offset = startAyah - 1;

  const apiUrl = `https://api.alquran.cloud/v1/surah/${surahNumber}/editions/quran-uthmani,${edition}?offset=${offset}&limit=${limit}`;
  
  const response = await fetch(apiUrl);
  if (!response.ok) {
     const errorText = await response.text();
     throw new Error(`Quran API Error: ${response.status} - ${errorText}`);
  }
  
  const json = await response.json();
  
  if (!json || !json.data || !Array.isArray(json.data)) {
      throw new Error("Invalid response format from Quran API: data array missing");
  }

  // More robust finding logic
  // Arabic is usually quran-uthmani, or type: quran, language: ar
  const arabicEd = json.data.find((d: any) => 
    d.edition?.identifier === 'quran-uthmani' || 
    (d.edition?.language === 'ar' && d.edition?.type === 'quran')
  );
  
  // Translation is the other one, or type: translation
  const otherEd = json.data.find((d: any) => 
    d.edition?.identifier !== 'quran-uthmani' && d !== arabicEd
  );

  if (!arabicEd || !otherEd) {
      throw new Error("Invalid response format from Quran API: missing Arabic or Translation editions");
  }
  
  // Assign explicitly
  const arabicAyahs = arabicEd.ayahs;
  const transAyahs = otherEd.ayahs;
  const surahName = arabicEd.englishName;

  // 2. Smart Grouping Logic
  const segments: VerseSegment[] = [];
  const TARGET_CARD_CAPACITY = 450; 

  let currentChunkArabic: any[] = [];
  let currentChunkTrans: any[] = [];
  let currentLength = 0;

  for (let i = 0; i < arabicAyahs.length; i++) {
      const verse = arabicAyahs[i];
      const trans = transAyahs[i] || { text: '', numberInSurah: verse.numberInSurah }; // Fallback
      const verseLength = verse.text.length;

      if (currentLength + verseLength > TARGET_CARD_CAPACITY && currentChunkArabic.length > 0) {
          pushSegment(segments, currentChunkArabic, currentChunkTrans, surahName);
          currentChunkArabic = [];
          currentChunkTrans = [];
          currentLength = 0;
      }

      currentChunkArabic.push(verse);
      currentChunkTrans.push(trans);
      currentLength += verseLength;
  }

  if (currentChunkArabic.length > 0) {
      pushSegment(segments, currentChunkArabic, currentChunkTrans, surahName);
  }

  // 3. Instant Design (No API Latency)
  // Use translation of the first segment to determine context
  const contextText = segments[0]?.translation || "";
  const design = getDesignFromText(contextText);

  return { segments, design };
};

function pushSegment(segments: VerseSegment[], arabicChunk: any[], transChunk: any[], surahName: string) {
    const firstNum = arabicChunk[0].numberInSurah;
    const lastNum = arabicChunk[arabicChunk.length - 1].numberInSurah;

    const arabicText = arabicChunk.map((a: any) => 
        `${a.text} ۝${convertToArabicNumerals(a.numberInSurah)}`
    ).join(' ');

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