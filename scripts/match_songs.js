const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// Ollama Configuration
const OLLAMA_HOST = '172.18.80.113';
const OLLAMA_PORT = 11434;
const OLLAMA_MODEL = 'qwen3:14b';

// Game Category Filters (configured as requested in TODO.md)
const MAIMAI_CATEGORIES = ['maimai', 'niconico＆ボーカロイド', '東方Project'];
const CHUNI_CATEGORIES = ['niconico', 'ゲキマイ', '東方Project'];

// Directories
const SONG_DATA_DIR = path.join(__dirname, '../song_data');
const PUBLIC_IMG_DIR = path.join(__dirname, '../public/img/covers');

// Make sure output directories exist
fs.mkdirSync(path.join(__dirname, '../src/data'), { recursive: true });
fs.mkdirSync(PUBLIC_IMG_DIR, { recursive: true });

// Helper: Parse CSV
function parseCSV(csvText) {
  const result = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(cell);
      result.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell || row.length > 0) {
    row.push(cell);
    result.push(row);
  }
  return result;
}

// Clean YouTube Title
function cleanTitle(title) {
  if (!title) return '';
  let cleaned = title;
  // Remove content in brackets [ ... ] and parentheses ( ... )
  cleaned = cleaned.replace(/\[.*?\]/g, '');
  cleaned = cleaned.replace(/\(.*?\)/g, '');
  cleaned = cleaned.replace(/（.*?）/g, '');
  // Remove common music terms/suffixes
  cleaned = cleaned.replace(/(Piano ver|Piano version|ver\.Rock|Ver\.Rock|short ver|Another|TV size|by Kanaria|by Kenshi Yonezu)/gi, '');
  // Clean whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

// Normalize for string matching
function normalizeForMatch(str) {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/[^a-z0-9\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf\u0e00-\u0e7f]/g, '') // Keep alphanumeric, jp characters, thai characters
    .replace(/\s+/g, '');
}

// Check if string contains Japanese characters
function hasJapanese(str) {
  return /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf]/.test(str);
}

// Helper: Check if Game Title and YouTube Title match safely
function isSafeMatch(gameTitle, ytTitle) {
  const g = normalizeForMatch(gameTitle);
  const y = normalizeForMatch(ytTitle);
  if (!g || !y) return false;

  // 1. Exact Match
  if (g === y) return true;

  // 2. Safe Prefix/Substring Matches
  // Case A: Game starts with YT (e.g. game: "badapplefeatnomico" starts with yt: "badapple")
  if (g.startsWith(y) && y.length >= 5) return true;

  // Case B: YT starts with Game (e.g. yt: "keitairenwa..." starts with game: "keitairenwa" or "携帯恋話keitairenwa" starts with "携帯恋話")
  if (y.startsWith(g) && (g.length >= 5 || hasJapanese(gameTitle))) return true;

  // Case C: YT contains Game and Game has Japanese characters (e.g. yt: "携帯恋話โกรธกันนะ..." contains game: "携帯恋話")
  if (y.includes(g) && hasJapanese(gameTitle) && g.length >= 2) return true;

  return false;
}

// Generate trigrams for fuzzy text overlap
function getTrigrams(str) {
  const trigrams = [];
  for (let i = 0; i < str.length - 2; i++) {
    trigrams.push(str.slice(i, i + 3));
  }
  return trigrams;
}

// Query Ollama API
function queryOllama(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.1
      }
    });

    const options = {
      hostname: OLLAMA_HOST,
      port: OLLAMA_PORT,
      path: '/api/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed.response);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(data);
    req.end();
  });
}

// Candidate scoring to find best matches from database
function getTopCandidates(cleanedYT, ytDescription, allGameSongs) {
  const list = [];
  const normalizedYT = normalizeForMatch(cleanedYT);
  const descLower = ytDescription.toLowerCase();
  
  for (const song of allGameSongs) {
    const normGame = normalizeForMatch(song.title);
    
    let score = 0;
    
    // 1. Safe Match Boost
    if (isSafeMatch(song.title, cleanedYT)) {
      score += 150;
    }
    
    // 2. Artist match in description or title
    // Split the artist string (e.g. "まふまふ / 初音ミク" or "DECO*27 feat.初音ミク") to match individual names
    if (song.artist && song.artist.length > 2) {
      const individualArtists = song.artist.toLowerCase()
        .split(/[\/\,\&x\×\+]|feat\.?/g)
        .map(a => a.trim())
        .filter(a => a.length >= 3); // ignore very short words
        
      for (const artist of individualArtists) {
        if (cleanedYT.toLowerCase().includes(artist) || descLower.includes(artist)) {
          score += 40; // High boost for matching one of the original artists
          break;
        }
      }
    }
    
    // 3. Trigram overlap (fuzzy matching on titles)
    const ytTrigrams = getTrigrams(normalizedYT);
    const gameTrigrams = getTrigrams(normGame);
    let trigramOverlap = 0;
    for (const t of ytTrigrams) {
      if (gameTrigrams.includes(t)) trigramOverlap++;
    }
    score += trigramOverlap * 3;
    
    if (score > 2) {
      list.push({ song, score });
    }
  }
  
  // Sort descending by score
  list.sort((a, b) => b.score - a.score);
  
  // Return top 5 candidate songs
  return list.slice(0, 5).map(x => x.song);
}

// Ask Ollama to choose the correct song from candidates
async function askOllamaToMatch(originalTitle, cleanedTitle, description, candidates) {
  const descContext = description
    ? description.split('\n').slice(0, 10).join('\n').trim()
    : '';

  const candidateListText = candidates.map((c, idx) => {
    return `${idx + 1}. Song Title: "${c.title}" | Artist: "${c.artist}" | Category: "${c.category}"`;
  }).join('\n');

  const prompt = `You are a Japanese rhythm game music expert.
We have a YouTube cover video and want to identify which game song it covers.

YouTube Cover Title: "${originalTitle}"
Cleaned Title: "${cleanedTitle}"
Video Description Context:
${descContext}

Here is a list of candidate songs from the game database:
${candidateListText}

Choose which candidate song matches the YouTube cover video. 
If none of the candidates match, choose 0.

Respond with ONLY the index number (0, 1, 2, 3, 4, or 5) of the matching song. Do not output any explanation or extra text.`;

  try {
    const response = await queryOllama(prompt);
    const match = response.trim().match(/[0-5]/);
    if (match) {
      const idx = parseInt(match[0], 10);
      if (idx > 0 && idx <= candidates.length) {
        return candidates[idx - 1];
      }
    }
    return null;
  } catch (err) {
    console.error(`     Ollama match error for "${cleanedTitle}":`, err.message);
    return null;
  }
}

// Download cover image
function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(destPath)) {
      resolve(); // Skip if exists
      return;
    }

    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${res.statusCode} for URL ${url}`));
        return;
      }

      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => { }); // delete partial file
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Main execution function
async function main() {
  console.log('--- Starting Song Preprocessing and Matching ---');

  // 1. Read and Parse Game Songs
  console.log('Loading game song databases...');
  const chuniData = JSON.parse(fs.readFileSync(path.join(SONG_DATA_DIR, 'songdata_chuni.json'), 'utf8'));
  const maimaiData = JSON.parse(fs.readFileSync(path.join(SONG_DATA_DIR, 'songdata_maimai.json'), 'utf8'));

  // Apply category filters
  const filteredChuni = chuniData.songs.filter(s => CHUNI_CATEGORIES.includes(s.category));
  const filteredMaimai = maimaiData.songs.filter(s => MAIMAI_CATEGORIES.includes(s.category));

  console.log(`Loaded ${filteredChuni.length} CHUNITHM songs (filtered).`);
  console.log(`Loaded ${filteredMaimai.length} maimai songs (filtered).`);

  // Combine all candidate songs
  const allGameSongs = [];

  filteredChuni.forEach(s => {
    allGameSongs.push({
      ...s,
      game: 'chunithm'
    });
  });

  filteredMaimai.forEach(s => {
    const existing = allGameSongs.find(x => normalizeForMatch(x.title) === normalizeForMatch(s.title));
    if (existing) {
      existing.game = 'both'; // Song exists in both games
      existing.maimaiSheets = s.sheets;
      existing.chuniSheets = existing.sheets;
      existing.maimaiImageName = s.imageName;
    } else {
      allGameSongs.push({
        ...s,
        game: 'maimai',
        maimaiSheets: s.sheets,
        maimaiImageName: s.imageName
      });
    }
  });

  console.log(`Total unique candidate game songs: ${allGameSongs.length}`);

  // Save filtered game songs list for the user to inspect
  fs.writeFileSync(
    path.join(__dirname, '../src/data/filtered_game_songs.json'),
    JSON.stringify(allGameSongs, null, 2),
    'utf8'
  );
  console.log('Saved filtered game songs list to src/data/filtered_game_songs.json');

  // 2. Read and Parse YouTube CSV
  console.log('Loading YouTube covers list (Meen-Thaisub.csv)...');
  const csvText = fs.readFileSync(path.join(__dirname, '../Meen-Thaisub.csv'), 'utf8');
  const csvRows = parseCSV(csvText);

  const youtubeVideos = [];
  for (let i = 1; i < csvRows.length; i++) {
    const row = csvRows[i];
    if (row && row.length > 10 && row[4]) {
      youtubeVideos.push({
        title: row[4],
        url: row[5],
        videoId: row[6],
        description: row[10] || ''
      });
    }
  }
  console.log(`Parsed ${youtubeVideos.length} YouTube videos.`);

  // 3. Match Songs
  const matchedData = [];
  let exactMatchCount = 0;
  let ollamaMatchCount = 0;
  let noMatchCount = 0;

  for (let i = 0; i < youtubeVideos.length; i++) {
    const ytVideo = youtubeVideos[i];
    const originalTitle = ytVideo.title;
    const cleanedYT = cleanTitle(originalTitle);

    // Ignore non-song content
    if (
      originalTitle.includes('เล่นเกม Identity V') ||
      originalTitle.includes('ร้องเพลงอะไรดี') ||
      originalTitle.includes('Q&A ของผู้ติดตาม') ||
      originalTitle.includes('วาดรูปเล่น')
    ) {
      console.log(`[Skipping] ${originalTitle} (Non-song video)`);
      continue;
    }

    console.log(`\n[Processing ${i + 1}/${youtubeVideos.length}] "${originalTitle}" -> Cleaned: "${cleanedYT}"`);

    let matchedSong = null;

    // Fast Path: Check if there's a safe match in the database
    const safeMatch = allGameSongs.find(s => isSafeMatch(s.title, cleanedYT));
    
    if (safeMatch) {
      matchedSong = safeMatch;
      console.log(`  -> Safe Match found! Game Song: "${matchedSong.title}" (${matchedSong.artist})`);
      exactMatchCount++;
    } else {
      // Ollama Path: Get top 5 candidates based on similarity, then ask Ollama to choose
      const candidates = getTopCandidates(cleanedYT, ytVideo.description, allGameSongs);
      
      if (candidates.length > 0) {
        console.log(`  -> Found ${candidates.length} candidates. Querying Ollama (${OLLAMA_MODEL}) to select...`);
        matchedSong = await askOllamaToMatch(originalTitle, cleanedYT, ytVideo.description, candidates);
        
        if (matchedSong) {
          console.log(`  -> Ollama Match found! Game Song: "${matchedSong.title}" (${matchedSong.artist})`);
          ollamaMatchCount++;
        }
      }
    }

    if (matchedSong) {
      // 4. Download cover images for matched songs
      let maimaiLocalPath = null;
      let chuniLocalPath = null;

      try {
        if (matchedSong.game === 'maimai' || matchedSong.game === 'both') {
          const imgName = matchedSong.maimaiImageName || matchedSong.imageName;
          const url = `https://dp4p6x0xfi5o9.cloudfront.net/maimai/img/cover/${imgName}`;
          const dest = path.join(PUBLIC_IMG_DIR, `maimai_${imgName}`);
          await downloadImage(url, dest);
          maimaiLocalPath = `/img/covers/maimai_${imgName}`;
        }
        if (matchedSong.game === 'chunithm' || matchedSong.game === 'both') {
          const imgName = matchedSong.imageName;
          const url = `https://dp4p6x0xfi5o9.cloudfront.net/chunithm/img/cover/${imgName}`;
          const dest = path.join(PUBLIC_IMG_DIR, `chuni_${imgName}`);
          await downloadImage(url, dest);
          chuniLocalPath = `/img/covers/chuni_${imgName}`;
        }
        console.log(`     Covers downloaded successfully.`);
      } catch (err) {
        console.error(`     Image download error:`, err.message);
      }

      matchedData.push({
        id: matchedSong.songId,
        title: matchedSong.title,
        artist: matchedSong.artist,
        game: matchedSong.game,
        category: matchedSong.category,
        bpm: matchedSong.bpm,
        releaseDate: matchedSong.releaseDate,
        sheets: matchedSong.sheets || [],
        maimaiSheets: matchedSong.maimaiSheets || [],
        chuniSheets: matchedSong.chuniSheets || [],
        youtube: {
          title: originalTitle,
          url: ytVideo.url,
          videoId: ytVideo.videoId
        },
        localImagePaths: {
          maimai: maimaiLocalPath,
          chunithm: chuniLocalPath
        }
      });
    } else {
      console.log(`  -> [No Match] Could not match to any game song.`);
      noMatchCount++;
    }
  }

  // Write matched data to src/data/matched_songs.json
  fs.writeFileSync(
    path.join(__dirname, '../src/data/matched_songs.json'),
    JSON.stringify(matchedData, null, 2),
    'utf8'
  );

  console.log('\n--- Preprocessing & Matching Complete ---');
  console.log(`Total Videos Processed: ${youtubeVideos.length}`);
  console.log(`Exact Matches: ${exactMatchCount}`);
  console.log(`Ollama Matches: ${ollamaMatchCount}`);
  console.log(`No Matches: ${noMatchCount}`);
  console.log(`Output saved to: src/data/matched_songs.json`);
}

main().catch(err => {
  console.error('Fatal error in main processing:', err);
});
