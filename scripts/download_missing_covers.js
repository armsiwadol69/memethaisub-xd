const fs = require('fs');
const path = require('path');
const https = require('https');

// Paths
const MATCHED_SONGS_PATH = path.join(__dirname, '../src/data/matched_songs.json');
const FILTERED_GAME_SONGS_PATH = path.join(__dirname, '../src/data/filtered_game_songs.json');
const PUBLIC_IMG_DIR = path.join(__dirname, '../public/img/covers');

// Make sure covers directory exists
fs.mkdirSync(PUBLIC_IMG_DIR, { recursive: true });

// Download helper
function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed with status code: ${res.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {}); // clean up partial file
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  console.log('--- Starting Missing Cover Images Sync ---');

  if (!fs.existsSync(MATCHED_SONGS_PATH)) {
    console.error(`Error: matched_songs.json not found at ${MATCHED_SONGS_PATH}`);
    console.log('Please run match_songs.js first or copy matched_songs.json into the src/data directory.');
    return;
  }

  // Load matched songs & game database
  const matchedSongs = JSON.parse(fs.readFileSync(MATCHED_SONGS_PATH, 'utf8'));
  console.log(`Loaded ${matchedSongs.length} entries from matched_songs.json.`);

  let gameSongs = [];
  if (fs.existsSync(FILTERED_GAME_SONGS_PATH)) {
    gameSongs = JSON.parse(fs.readFileSync(FILTERED_GAME_SONGS_PATH, 'utf8'));
    console.log(`Loaded ${gameSongs.length} game songs for self-healing cover lookup.`);
  }

  let downloadCount = 0;
  let existCount = 0;
  let errorCount = 0;

  for (let i = 0; i < matchedSongs.length; i++) {
    const song = matchedSongs[i];
    if (!song.localImagePaths) continue;

    let maimaiPath = song.localImagePaths.maimai;
    let chunithmPath = song.localImagePaths.chunithm;

    // Self-healing: if image paths are null in JSON, lookup the database using song ID
    if ((!maimaiPath || !chunithmPath) && song.id) {
      const dbSong = gameSongs.find(x => x.songId === song.id);
      if (dbSong) {
        if (!maimaiPath && (song.game === 'maimai' || song.game === 'both')) {
          const imgName = dbSong.maimaiImageName || dbSong.imageName;
          if (imgName) maimaiPath = `/img/covers/maimai_${imgName}`;
        }
        if (!chunithmPath && (song.game === 'chunithm' || song.game === 'both')) {
          const imgName = dbSong.imageName; // ALWAYS use imageName for chunithm
          if (imgName) chunithmPath = `/img/covers/chuni_${imgName}`;
        }
      }
    }

    // Check maimai cover
    if (maimaiPath) {
      const fileName = path.basename(maimaiPath);
      const dest = path.join(PUBLIC_IMG_DIR, fileName);
      if (fs.existsSync(dest)) {
        existCount++;
      } else {
        const rawImageName = fileName.replace('maimai_', '');
        const url = `https://dp4p6x0xfi5o9.cloudfront.net/maimai/img/cover/${rawImageName}`;
        console.log(`[Downloading maimai cover] "${song.title}" -> ${fileName}...`);
        try {
          await downloadImage(url, dest);
          downloadCount++;
          // sleep brief moment to respect rate limit
          await new Promise(r => setTimeout(r, 200));
        } catch (err) {
          console.error(`❌ Failed to download maimai cover for "${song.title}" from ${url}:`, err.message);
          errorCount++;
        }
      }
    }

    // Check chunithm cover
    if (chunithmPath) {
      const fileName = path.basename(chunithmPath);
      const dest = path.join(PUBLIC_IMG_DIR, fileName);
      if (fs.existsSync(dest)) {
        existCount++;
      } else {
        const rawImageName = fileName.replace('chuni_', '');
        const url = `https://dp4p6x0xfi5o9.cloudfront.net/chunithm/img/cover/${rawImageName}`;
        console.log(`[Downloading chunithm cover] "${song.title}" -> ${fileName}...`);
        try {
          await downloadImage(url, dest);
          downloadCount++;
          // sleep brief moment to respect rate limit
          await new Promise(r => setTimeout(r, 200));
        } catch (err) {
          console.error(`❌ Failed to download chunithm cover for "${song.title}" from ${url}:`, err.message);
          errorCount++;
        }
      }
    }
  }

  console.log('\n--- Sync Process Completed ---');
  console.log(`Existing Covers Checked & Verified: ${existCount}`);
  console.log(`Newly Downloaded Missing Covers: ${downloadCount}`);
  console.log(`Errors Encountered: ${errorCount}`);
}

main().catch(err => {
  console.error('Fatal error running sync script:', err);
});
