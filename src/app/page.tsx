'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import Swal from 'sweetalert2';

import matchedSongsData from '../data/matched_songs.json';
import filteredGameSongsData from '../data/filtered_game_songs.json';

declare global {
  interface Window {
    html2canvas: any;
  }
}

// Types
interface Sheet {
  type: string;
  difficulty: string;
  level: string;
  levelValue: number;
}

interface YouTubeInfo {
  title: string;
  url: string;
  videoId: string;
}

interface Song {
  cardId?: string;
  id: string | null;
  title: string | null;
  artist: string | null;
  game: string | null;
  category: string | null;
  bpm: number | null;
  releaseDate: string | null;
  sheets: Sheet[];
  maimaiSheets?: Sheet[];
  chuniSheets?: Sheet[];
  youtube: YouTubeInfo;
  localImagePaths: {
    maimai: string | null;
    chunithm: string | null;
  };
  verified?: boolean;
}

interface GameSong {
  songId: string;
  title: string;
  artist: string;
  category: string;
  game: string;
  bpm: number;
  releaseDate: string;
  sheets: Sheet[];
  imageName: string;
  maimaiImageName?: string;
}

export default function Home() {
  const [songs, setSongs] = useState<Song[]>(() => {
    // Generate stable unique compound key cardId on load
    return (matchedSongsData as Song[]).map((s, idx) => ({
      ...s,
      cardId: `${s.youtube.videoId}::${s.id || 'unmatched'}::${idx}`
    }));
  });

  const [gameSongs, setGameSongs] = useState<GameSong[]>(filteredGameSongsData as GameSong[]);

  // Filtering States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState<'all' | 'maimai' | 'chunithm'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDifficultyType, setSelectedDifficultyType] = useState<string>('all');
  const [minLevel, setMinLevel] = useState<number>(1);
  const [maxLevel, setMaxLevel] = useState<number>(15);

  // Edit Mode States (Keyed by cardId)
  const [editMode, setEditMode] = useState(false);
  const [hiddenCardIds, setHiddenCardIds] = useState<Set<string>>(new Set());
  const [remappedSongs, setRemappedSongs] = useState<Record<string, GameSong>>({});
  const [verifiedCardIds, setVerifiedCardIds] = useState<Set<string>>(new Set());

  // Played Status States
  const [playedSongs, setPlayedSongs] = useState<Record<string, { maimai?: 'played' | 'fc' | 'ap' | null; chunithm?: 'played' | 'fc' | 'aj' | null }>>({})

  // Randomizer States
  const [isRandomizerOpen, setIsRandomizerOpen] = useState(false);
  const [randomPool, setRandomPool] = useState<'all' | 'unplayed'>('all');
  const [spinSpeed, setSpinSpeed] = useState<'fast' | 'slow'>('fast');
  const [isSpinning, setIsSpinning] = useState(false);
  const [spunSong, setSpunSong] = useState<any | null>(null);
  const [funnyMessage, setFunnyMessage] = useState('');

  // Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // SNS Share States
  const [isSnsModalOpen, setIsSnsModalOpen] = useState(false);
  const [playerName, setPlayerName] = useState('Meen Thaisub\'s FC');
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeRemapSong, setActiveRemapSong] = useState<Song | null>(null);
  const [activeRemapCardId, setActiveRemapCardId] = useState<string>('');
  const [modalSearch, setModalSearch] = useState('');

  // Load initial data from localStorage (runs only on client, after hydration)
  useEffect(() => {
    setIsHydrated(true);

    // Load playedSongs
    const savedPlayed = localStorage.getItem('playedSongs');
    if (savedPlayed) setPlayedSongs(JSON.parse(savedPlayed));

    // Load playerName
    const savedName = localStorage.getItem('playerName');
    if (savedName) setPlayerName(savedName);

    // Load LocalStorage edits
    const savedHidden = localStorage.getItem('hiddenCardIds');
    if (savedHidden) {
      setHiddenCardIds(new Set(JSON.parse(savedHidden)));
    }
    const savedRemapped = localStorage.getItem('remappedSongs_v2');
    if (savedRemapped) {
      setRemappedSongs(JSON.parse(savedRemapped));
    }

    // Load Verified status from LocalStorage AND baked-in json
    const savedVerified = localStorage.getItem('verifiedCardIds');
    let localVerified = new Set<string>();
    if (savedVerified) {
      localVerified = new Set(JSON.parse(savedVerified));
    }
    // Scan baked-in data for pre-verified songs
    songs.forEach((s) => {
      if (s.verified && s.cardId) {
        localVerified.add(s.cardId);
      }
    });
    setVerifiedCardIds(localVerified);

    // Load html2canvas script dynamically from CDN
    if (!window.html2canvas) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Sync edits to LocalStorage
  const hideSong = (cardId: string) => {
    const updated = new Set(hiddenCardIds);
    if (updated.has(cardId)) {
      updated.delete(cardId);
    } else {
      updated.add(cardId);
    }
    setHiddenCardIds(updated);
    localStorage.setItem('hiddenCardIds', JSON.stringify(Array.from(updated)));
  };

  const toggleVerify = (cardId: string) => {
    const updated = new Set(verifiedCardIds);
    if (updated.has(cardId)) {
      updated.delete(cardId);
    } else {
      updated.add(cardId);
    }
    setVerifiedCardIds(updated);
    localStorage.setItem('verifiedCardIds', JSON.stringify(Array.from(updated)));
  };

  const remapSong = (cardId: string, newGameSong: GameSong) => {
    const updated = { ...remappedSongs, [cardId]: newGameSong };
    setRemappedSongs(updated);
    localStorage.setItem('remappedSongs_v2', JSON.stringify(updated));
    setIsModalOpen(false);
  };

  // Add another song mapping for the same YouTube Video (Multiple cabinets)
  const addAnotherMapping = (sourceSong: Song) => {
    const newIndex = songs.length;
    const newSong: Song = {
      id: '',
      title: '',
      artist: '',
      game: '',
      category: '',
      bpm: 0,
      releaseDate: '',
      sheets: [],
      youtube: sourceSong.youtube,
      localImagePaths: { maimai: null, chunithm: null }
    };
    newSong.cardId = `${sourceSong.youtube.videoId}::unmatched::${newIndex}`;
    setSongs(prev => [...prev, newSong]);
  };

  const resetEdits = () => {
    if (confirm('คุณต้องการรีเซ็ตการแก้ไขทั้งหมดกลับเป็นค่าเริ่มต้น (AI Match) ใช่หรือไม่?')) {
      setHiddenCardIds(new Set());
      setRemappedSongs({});
      setVerifiedCardIds(new Set());
      localStorage.removeItem('hiddenCardIds');
      localStorage.removeItem('remappedSongs_v2');
    }
  };

  const setPlayedStage = (cardId: string, game: 'maimai' | 'chunithm', stage: 'played' | 'fc' | 'ap' | 'aj' | null) => {
    setPlayedSongs(prev => {
      const current = prev[cardId] || {};
      const newVal = current[game] === stage ? null : stage;
      const updated = {
        ...prev,
        [cardId]: { ...current, [game]: newVal }
      };
      localStorage.setItem('playedSongs', JSON.stringify(updated));
      return updated;
    });
  };

  const getFunnyLandingMessage = (song: any) => {
    const maxLevelValue = Math.max(...(song.sheets || []).map((sh: any) => sh.levelValue || 0));

    if (maxLevelValue >= 14.5) {
      return '💀 ระดับภัยพิบัติแห่งชาติ Lv.14.5+!! แนะนำให้เตรียมถังออกซิเจน โทรจองคิวนักกายภาพบำบัด และลาพักร้อนล่วงหน้าได้เลยครับ ข้อนิ้วไม่หลุดก็บุญแล้ว! 🏥🚑';
    }
    if (maxLevelValue >= 14) {
      return '💀 ระดับความยากนรก Lv.14! แนะนำให้เตรียมใบรับรองแพทย์และยาเคาน์เตอร์เพนชโลมมือด่วน ๆ ครับ 🏥';
    }
    if (maxLevelValue >= 13) {
      return '🔥 โหมดคัดกรองมนุษย์จริง Lv.13! เตรียมหน้าจอตู้ให้พร้อม เพราะเหงื่อจะไหลท่วมจนสไลด์ไม่ไปแน่นอนครับ สู้ ๆ นะน้อน ๆ! 💦🥵';
    }
    if (maxLevelValue >= 11) {
      return '⚡ เลเวล 11-12 กำลังตึงมือ! ได้เวลาโชว์ฟอร์มสะบัดข้อมือขั้นเทพให้เด็กนักเรียนแถวนั้นยืนอ้าปากค้างแล้วครับ! 😎💫';
    }
    if (maxLevelValue >= 7) {
      return '✨ เลเวล 7-10 ชิล ๆ สบายใจ! กดไปฮัมเพลงไปได้ชวนฝัน ไม่ต้องเกร็งกล้ามเนื้อตานะครับเพื่อนรัก 🌸🎶';
    }
    return '👶 เลเวลสำหรับผู้เริ่มต้น! สามารถกดเล่นด้วยจมูก หรือเล่นขณะหลับตาข้างเดียวก็การันตี AP/AJ สบาย ๆ ครับ 🍼😴';
  };

  const startRandomization = () => {
    const pool = songs.filter(s => {
      const cardId = s.cardId || '';
      const currentSong = (remappedSongs[cardId] || s) as any;
      const currentId = currentSong.songId || currentSong.id;
      if (!currentId) return false;

      if (randomPool === 'unplayed') {
        const played = playedSongs[cardId] || {};
        const isMaimaiPlayed = currentSong.game === 'maimai' && played.maimai;
        const isChuniPlayed = currentSong.game === 'chunithm' && played.chunithm;
        const isBothPlayed = currentSong.game === 'both' && played.maimai && played.chunithm;
        if (isMaimaiPlayed || isChuniPlayed || isBothPlayed) return false;
      }
      return true;
    });

    if (pool.length === 0) {
      alert('ไม่เหลือเพลงให้สุ่มแล้วครับ! คุณเคลียร์หมดคลังแล้ว เก่งเกินมนุษย์ 🏆');
      return;
    }

    setIsSpinning(true);
    setSpunSong(null);

    const rollingPhrases = [
      '🔍 กำลังสืบค้นดวงชะตานิ้วมือของคุณ...',
      '💀 วอร์มนิ้วด่วน เพลงยากกำลังจะมา...',
      '🎵 ขอเพลงนี้ละกัน... เอ๊ะ ง่ายไป ข้าม!',
      '🌀 กำลังกวนบ่อเพลง Vocaloid...',
      '🎹 หาเพลงที่ถ้าสไลด์พลาดแล้วร้องกรี๊ด...',
      '⚡ ชาร์จพลังงานดนตรี 100%...',
      '🎮 คัดเลือกเพลงสู้ชีวิต...'
    ];

    let ticks = 0;
    const maxTicks = spinSpeed === 'fast' ? 14 : 26;
    let duration = 65;

    const tick = () => {
      ticks++;
      const randomIdx = Math.floor(Math.random() * pool.length);
      const chosen = pool[randomIdx];
      const remapped = remappedSongs[chosen.cardId || ''] || chosen;
      setSpunSong(remapped);
      setFunnyMessage(rollingPhrases[Math.floor(Math.random() * rollingPhrases.length)]);

      if (ticks < maxTicks) {
        duration += ticks * (spinSpeed === 'fast' ? 14 : 11);
        setTimeout(tick, duration);
      } else {
        setIsSpinning(false);
        const finalIdx = Math.floor(Math.random() * pool.length);
        const finalChosen = pool[finalIdx];
        const finalSongDetails = (remappedSongs[finalChosen.cardId || ''] || finalChosen) as any;
        setSpunSong(finalSongDetails);
        setFunnyMessage(getFunnyLandingMessage(finalSongDetails));
      }
    };

    setTimeout(tick, duration);
  };

  const generateShareImage = () => {
    const target = document.getElementById('sns-share-card-container');
    if (!target) {
      alert('ไม่พบกรอบรูปภาพสรุปผลงาน!');
      return;
    }
    if (!window.html2canvas) {
      alert('กำลังดาวน์โหลดส่วนเสริมการสร้างรูปภาพจากเซิร์ฟเวอร์ย่อย กรุณารออีก 1-2 วินาทีแล้วลองอีกครั้งครับ...');
      return;
    }

    window.html2canvas(target, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#0a0d1a',
      scale: 2
    }).then((canvas: HTMLCanvasElement) => {
      const link = document.createElement('a');
      link.download = `${playerName.trim() || 'Player'}_meen_thaisub_summary.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  };

  const handleMaimaiImport = (fileContent: string) => {
    setIsImporting(true);
    Swal.fire({
      title: 'กำลังนำเข้าข้อมูล maimai...',
      html: '<span style="font-size:2.5rem">🎮</span><br/>กำลังเทียบชื่อเพลง กรุณารอสักครู่',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      background: '#1a1a2e',
      color: '#fff',
      didOpen: () => { Swal.showLoading(); }
    });

    setTimeout(() => {
      try {
        const data = JSON.parse(fileContent);
        if (!Array.isArray(data)) {
          setIsImporting(false);
          Swal.fire({ icon: 'error', title: 'รูปแบบไฟล์ผิด', text: 'ต้องเป็น JSON Array', background: '#1a1a2e', color: '#fff', confirmButtonColor: '#00d9ff' });
          return;
        }

        const stagePriority: Record<string, number> = { ap: 3, fc: 2, played: 1 };
        const titleMap: Record<string, 'played' | 'fc' | 'ap'> = {};

        data.forEach((entry: any) => {
          const title = entry.songName || entry.title;
          if (!title) return;
          const fcap = (entry.fcap || '').toUpperCase();
          let stage: 'played' | 'fc' | 'ap' = 'played';
          if (fcap.includes('AP')) stage = 'ap';
          else if (fcap.includes('FC')) stage = 'fc';
          const existing = titleMap[title];
          if (!existing || stagePriority[stage] > stagePriority[existing]) titleMap[title] = stage;
        });

        let updatedCount = 0;

        setPlayedSongs(prev => {
          const updated = { ...prev };
          Object.entries(titleMap).forEach(([title, stage]) => {
            const match = songs.find(s => {
              const cardId = s.cardId || '';
              const current = (remappedSongs[cardId] || s) as any;
              const gameTitle = (current.title || '').toLowerCase().trim();
              const ytTitle = (s.youtube?.title || '').toLowerCase().trim();
              const lookup = title.toLowerCase().trim();
              return gameTitle === lookup || ytTitle === lookup;
            });
            if (match && match.cardId) {
              const currentRecord = updated[match.cardId] || {};
              const existing = currentRecord.maimai;
              const existingPriority = existing ? (stagePriority[existing] || 0) : 0;
              if (stagePriority[stage] > existingPriority) {
                updated[match.cardId] = { ...currentRecord, maimai: stage };
                updatedCount++;
              }
            }
          });
          localStorage.setItem('playedSongs', JSON.stringify(updated));
          return updated;
        });

        setIsImporting(false);
        setTimeout(() => {
          Swal.fire({
            icon: 'success',
            title: '🎉 นำเข้า maimai สำเร็จ!',
            html: `<p>พบเพลงที่ตรงกับซับไทย <strong style="color:#00d9ff;font-size:1.8rem">${updatedCount}</strong> เพลง</p>`,
            background: '#1a1a2e',
            color: '#fff',
            confirmButtonColor: '#00d9ff',
            confirmButtonText: 'เยี่ยมเลย!'
          });
        }, 50);
      } catch (e: any) {
        setIsImporting(false);
        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: e.message, background: '#1a1a2e', color: '#fff', confirmButtonColor: '#ff4444' });
      }
    }, 300);
  };

  const handleChunithmImport = (fileContent: string) => {
    setIsImporting(true);
    Swal.fire({
      title: 'กำลังนำเข้าข้อมูล CHUNITHM...',
      html: '<span style="font-size:2.5rem">🎵</span><br/>กำลังวิเคราะห์ best / new / score กรุณารอสักครู่',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      background: '#1a1a2e',
      color: '#fff',
      didOpen: () => { Swal.showLoading(); }
    });

    setTimeout(() => {
      try {
        const data = JSON.parse(fileContent);
        const stagePriority: Record<string, number> = { aj: 3, fc: 2, played: 1 };
        const titleMap: Record<string, 'played' | 'fc' | 'aj'> = {};

        const processEntry = (entry: any, requireScore = false) => {
          const title = entry.title || entry.songName;
          if (!title) return;
          if (requireScore && (!entry.score || entry.score === 0)) return;
          let stage: 'played' | 'fc' | 'aj' = 'played';
          if (entry.isAllJustice) stage = 'aj';
          else if (entry.isFullCombo || entry.fullChainLv > 0) stage = 'fc';
          const existing = titleMap[title];
          if (!existing || stagePriority[stage] > stagePriority[existing]) titleMap[title] = stage;
        };

        if (Array.isArray(data.best)) data.best.forEach((e: any) => processEntry(e, false));
        if (Array.isArray(data.new)) data.new.forEach((e: any) => processEntry(e, false));
        if (Array.isArray(data.score)) data.score.forEach((e: any) => processEntry(e, true));
        if (Object.keys(titleMap).length === 0 && Array.isArray(data)) data.forEach((e: any) => processEntry(e, true));

        if (Object.keys(titleMap).length === 0) {
          setIsImporting(false);
          Swal.fire({ icon: 'error', title: 'รูปแบบไฟล์ผิด', text: 'ไม่พบข้อมูลเพลง CHUNITHM', background: '#1a1a2e', color: '#fff', confirmButtonColor: '#ffaa00' });
          return;
        }

        if (data.name) {
          setPlayerName(data.name);
          localStorage.setItem('playerName', data.name);
        }

        const playedCount = Object.values(titleMap).filter(s => s === 'played').length;
        const fcCount = Object.values(titleMap).filter(s => s === 'fc').length;
        const ajCount = Object.values(titleMap).filter(s => s === 'aj').length;

        let updatedCount = 0;

        setPlayedSongs(prev => {
          const updated = { ...prev };
          Object.entries(titleMap).forEach(([title, stage]) => {
            const match = songs.find(s => {
              const cardId = s.cardId || '';
              const current = (remappedSongs[cardId] || s) as any;
              const gameTitle = (current.title || '').toLowerCase().trim();
              const ytTitle = (s.youtube?.title || '').toLowerCase().trim();
              const lookup = title.toLowerCase().trim();
              return gameTitle === lookup || ytTitle === lookup;
            });
            if (match && match.cardId) {
              const currentRecord = updated[match.cardId] || {};
              const existing = currentRecord.chunithm;
              const existingPriority = existing ? (stagePriority[existing] || 0) : 0;
              if (stagePriority[stage] > existingPriority) {
                updated[match.cardId] = { ...currentRecord, chunithm: stage };
                updatedCount++;
              }
            }
          });
          localStorage.setItem('playedSongs', JSON.stringify(updated));
          return updated;
        });

        setIsImporting(false);
        setTimeout(() => {
          Swal.fire({
            icon: 'success',
            title: '🎉 นำเข้า CHUNITHM สำเร็จ!',
            html: `
              <p>ชื่อผู้เล่น: <strong style="color:#ffaa00">${data.name || 'ไม่พบชื่อ'}</strong></p>
              <p>เพลงที่ตรงกับซับไทย <strong style="color:#ffaa00;font-size:1.8rem">${updatedCount}</strong> เพลง</p>
              <div style="display:flex;justify-content:center;gap:1.5rem;margin-top:0.8rem;font-size:0.85rem">
                <span>🎮 เล่นแล้ว <strong>${playedCount}</strong></span>
                <span>🔥 FC <strong>${fcCount}</strong></span>
                <span>✨ AJ <strong>${ajCount}</strong></span>
              </div>
            `,
            background: '#1a1a2e',
            color: '#fff',
            confirmButtonColor: '#ffaa00',
            confirmButtonText: 'แจ่มมาก!'
          });
        }, 50);
      } catch (e: any) {
        setIsImporting(false);
        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: e.message, background: '#1a1a2e', color: '#fff', confirmButtonColor: '#ff4444' });
      }
    }, 300);
  };


  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, song: any) => {
    const imgEl = e.currentTarget;
    const imgName = song.maimaiImageName || song.imageName;

    // If it was trying to load the local path and failed, fallback to direct CDN URL
    if (imgEl.src && imgEl.src.includes('/img/covers/')) {
      const cdnPrefix = song.game === 'maimai' || song.game === 'both'
        ? 'https://dp4p6x0xfi5o9.cloudfront.net/maimai/img/cover/'
        : 'https://dp4p6x0xfi5o9.cloudfront.net/chunithm/img/cover/';

      if (imgName) {
        imgEl.src = cdnPrefix + imgName;
        return;
      }
    }

    // If CDN fails too, show generic placeholder
    imgEl.src = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300&auto=format&fit=crop';
  };

  const getCoverPath = (song: any) => {
    if (!song) return null;

    // 1. Try to get from localImagePaths if they are non-null
    if (song.localImagePaths) {
      if (song.game === 'maimai' && song.localImagePaths.maimai) {
        return song.localImagePaths.maimai;
      }
      if (song.game === 'chunithm' && song.localImagePaths.chunithm) {
        return song.localImagePaths.chunithm;
      }
      const fallback = song.localImagePaths.maimai || song.localImagePaths.chunithm;
      if (fallback) return fallback;
    }

    // 2. If null, lookup in database to get the correct imageName for each game
    const songId = song.id || song.songId;
    if (songId) {
      const dbSong = gameSongs.find((x: GameSong) => x.songId === songId);
      if (dbSong) {
        if (song.game === 'maimai' || song.game === 'both') {
          const imgName = dbSong.maimaiImageName || dbSong.imageName;
          if (imgName) return `/img/covers/maimai_${imgName}`;
        } else {
          const imgName = dbSong.imageName;
          if (imgName) return `/img/covers/chuni_${imgName}`;
        }
      }
    }

    // 3. Fallback to properties directly if present
    if (song.game === 'maimai' || song.game === 'both') {
      const imgName = song.maimaiImageName || song.imageName;
      if (imgName) return `/img/covers/maimai_${imgName}`;
    } else {
      const imgName = song.imageName;
      if (imgName) return `/img/covers/chuni_${imgName}`;
    }
    return null;
  };

  const renderSheetsList = (sheets: Sheet[] | undefined) => {
    if (!sheets || sheets.length === 0) return null;
    return (
      <div className={styles.sheetsWrapper}>
        {sheets.map((sheet, index) => {
          let diffClass = '';
          if (sheet.difficulty === 'basic') diffClass = styles.sheetBasic;
          else if (sheet.difficulty === 'advanced') diffClass = styles.sheetAdvanced;
          else if (sheet.difficulty === 'expert') diffClass = styles.sheetExpert;
          else if (sheet.difficulty === 'master') diffClass = styles.sheetMaster;
          else if (sheet.difficulty === 'remaster') diffClass = styles.sheetRemaster;

          return (
            <span key={index} className={`${styles.sheetBadge} ${diffClass}`}>
              {sheet.difficulty.toUpperCase()} {sheet.level}
            </span>
          );
        })}
      </div>
    );
  };

  // Export Cleaned JSON
  const exportCleanedJSON = () => {
    const cleaned = songs
      .filter(s => s.cardId && !hiddenCardIds.has(s.cardId))
      .map(s => {
        const cardId = s.cardId || '';
        const remapped = remappedSongs[cardId];
        const isVerified = verifiedCardIds.has(cardId);

        if (remapped) {
          const newMaimaiPath = remapped.game === 'maimai' || remapped.game === 'both'
            ? `/img/covers/maimai_${remapped.maimaiImageName || remapped.imageName}`
            : null;
          const newChuniPath = remapped.game === 'chunithm' || remapped.game === 'both'
            ? `/img/covers/chuni_${remapped.imageName}`
            : null;

          return {
            id: remapped.songId,
            title: remapped.title,
            artist: remapped.artist,
            game: remapped.game,
            category: remapped.category,
            bpm: remapped.bpm,
            releaseDate: remapped.releaseDate,
            sheets: remapped.sheets,
            maimaiSheets: remapped.game === 'maimai' || remapped.game === 'both' ? remapped.sheets : [],
            chuniSheets: remapped.game === 'chunithm' || remapped.game === 'both' ? remapped.sheets : [],
            youtube: s.youtube,
            localImagePaths: {
              maimai: newMaimaiPath,
              chunithm: newChuniPath
            },
            verified: isVerified
          };
        }

        // Remove cardId before export to keep JSON clean
        const { cardId: _, ...exportedSong } = s;
        return {
          ...exportedSong,
          verified: isVerified
        };
      })
      .filter(s => s.id); // Filter out unmatched mappings (id is null/empty) on export

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(cleaned, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'matched_songs.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    alert('ดาวน์โหลดไฟล์ matched_songs.json เรียบร้อยแล้ว!\nกรุณานำไฟล์นี้ไปแทนที่ไฟล์เดิมในโฟลเดอร์ src/data/ เพื่อนำไป Deploy หน้าร้านจริงครับ');
  };

  // Get categories list (filter out null categories)
  const categories = Array.from(
    new Set(songs.map(s => s.category).filter((cat): cat is string => !!cat))
  );

  // Filter logic
  const filteredSongs = songs.filter(s => {
    const cardId = s.cardId || '';
    const currentSong = (remappedSongs[cardId] || s) as any;
    const currentId = currentSong.songId || currentSong.id;

    // If not in edit mode, hide unmatched songs!
    if (!editMode && !currentId) return false;

    const songTitle = currentSong.title || '';
    const songArtist = currentSong.artist || '';
    const ytTitle = s.youtube.title || '';

    // 1. Search Query (matches Title, Artist, or YouTube Title)
    const matchesSearch =
      songTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      songArtist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ytTitle.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // 2. Game filter
    const game = currentSong.game;
    if (selectedGame === 'maimai' && game === 'chunithm') return false;
    if (selectedGame === 'chunithm' && game === 'maimai') return false;

    // 3. Category filter
    if (selectedCategory !== 'all' && currentSong.category !== selectedCategory) return false;

    // 4. Difficulty level range
    const hasSheetInRange = currentSong.sheets.some((sheet: Sheet) => {
      // Filter by level value
      const levelMatches = sheet.levelValue >= minLevel && sheet.levelValue <= maxLevel;
      // Filter by type if selected
      const typeMatches = selectedDifficultyType === 'all' || sheet.difficulty === selectedDifficultyType;
      return levelMatches && typeMatches;
    });

    if (currentSong.sheets && currentSong.sheets.length > 0 && !hasSheetInRange) return false;

    return true;
  });

  // Modal Candidates
  const modalCandidates = gameSongs.filter(gs => {
    if (!modalSearch) return false;
    return (
      gs.title.toLowerCase().includes(modalSearch.toLowerCase()) ||
      gs.artist.toLowerCase().includes(modalSearch.toLowerCase())
    );
  }).slice(0, 15);

  // Total stats calculations for SNS Card
  let maimaiPlayedCount = 0;
  let maimaiFcCount = 0;
  let maimaiApCount = 0;
  let chuniPlayedCount = 0;
  let chuniFcCount = 0;
  let chuniAjCount = 0;

  Object.values(playedSongs).forEach((s: any) => {
    if (s.maimai === 'played') maimaiPlayedCount++;
    if (s.maimai === 'fc') { maimaiPlayedCount++; maimaiFcCount++; }
    if (s.maimai === 'ap') { maimaiPlayedCount++; maimaiFcCount++; maimaiApCount++; }
    if (s.chunithm === 'played') chuniPlayedCount++;
    if (s.chunithm === 'fc') { chuniPlayedCount++; chuniFcCount++; }
    if (s.chunithm === 'aj') { chuniPlayedCount++; chuniFcCount++; chuniAjCount++; }
  });

  const totalPlayed = maimaiPlayedCount + chuniPlayedCount;

  const achievementSongs = songs
    .map(s => {
      const cardId = s.cardId || '';
      const currentSong = remappedSongs[cardId] || s;
      const achievements = playedSongs[cardId] || {};
      return {
        song: currentSong,
        originalSong: s,
        achievements
      };
    })
    .filter(item => {
      return item.achievements.maimai || item.achievements.chunithm;
    });

  // Sort helper to evaluate achievement rank
  const getAchievementScore = (item: any) => {
    let score = 0;
    if (item.achievements.maimai === 'ap') score += 100;
    else if (item.achievements.maimai === 'fc') score += 50;
    else if (item.achievements.maimai === 'played') score += 10;

    if (item.achievements.chunithm === 'aj') score += 100;
    else if (item.achievements.chunithm === 'fc') score += 50;
    else if (item.achievements.chunithm === 'played') score += 10;
    return score;
  };

  achievementSongs.sort((a, b) => getAchievementScore(b) - getAchievementScore(a));

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.logoGlow}>M</div>
          <div className={styles.titleText}>
            <h1>Meen Thaisub's FC Song Picker</h1>
            <p>ระบบค้นหา กรอง และจัดการข้อมูลเพลงซับไทยที่จับคู่กับฐานข้อมูลเกม maimai & CHUNITHM</p>
          </div>
        </div>

        <div className={styles.controls}>
          <button
            className={styles.btnImportTrigger}
            onClick={() => setIsImportModalOpen(true)}
            style={{ marginRight: '0.4rem' }}
          >
            📥 นำเข้าสถิติ
          </button>
          <button
            className={styles.btnSnsTrigger}
            onClick={() => setIsSnsModalOpen(true)}
            style={{ marginRight: '0.4rem' }}
          >
            📸 สรุป SNS
          </button>
          <button
            className={styles.btnRandomizerTrigger}
            onClick={() => {
              setIsRandomizerOpen(true);
              setSpunSong(null);
              setFunnyMessage('');
            }}
          >
            🎲 สุ่มเพลงขำๆ
          </button>
          {process.env.NODE_ENV !== 'production' && (
            <>
              <button
                className={`${styles.editToggle} ${editMode ? styles.editToggleActive : ''}`}
                onClick={() => setEditMode(!editMode)}
              >
                <div className={styles.toggleDot}></div>
                <span>{editMode ? 'ปิดโหมดแก้ไขข้อมูล' : 'เปิดโหมดแก้ไขข้อมูล (Edit Mode)'}</span>
              </button>

              {editMode && (
                <>
                  <button className={styles.btnSecondary} onClick={resetEdits}>
                    รีเซ็ตค่าเริ่มต้น
                  </button>
                  <button className={styles.exportButton} onClick={exportCleanedJSON}>
                    ส่งออกข้อมูล JSON (Export)
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </header>

      {/* Filters Panel */}
      <section className={styles.filtersPanel}>
        <div className={styles.filterGroup}>
          <label>ค้นหาเพลง / ศิลปิน / ชื่อวิดีโอ</label>
          <div className={styles.searchInputWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="พิมพ์ชื่อเพลงหรือศิลปินที่ต้องการ..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>

        <div className={styles.filterGroup}>
          <label>เกมตู้</label>
          <select
            value={selectedGame}
            onChange={e => setSelectedGame(e.target.value as any)}
            className={styles.selectInput}
          >
            <option value="all">ทั้งหมด (All Games)</option>
            <option value="maimai">maimai DX</option>
            <option value="chunithm">CHUNITHM</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>ระดับความยาก (Level)</label>
          <div className={styles.difficultyRange}>
            <select
              value={minLevel}
              onChange={e => setMinLevel(Number(e.target.value))}
              className={styles.selectInput}
            >
              {Array.from({ length: 15 }, (_, i) => i + 1).map(lv => (
                <option key={lv} value={lv}>Lv.{lv}</option>
              ))}
            </select>
            <span className={styles.rangeSeparator}>ถึง</span>
            <select
              value={maxLevel}
              onChange={e => setMaxLevel(Number(e.target.value))}
              className={styles.selectInput}
            >
              {Array.from({ length: 15 }, (_, i) => i + 1).map(lv => (
                <option key={lv} value={lv}>Lv.{lv}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.filterGroup}>
          <label>หมวดหมู่ (Category)</label>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className={styles.selectInput}
          >
            <option value="all">ทั้งหมด (All Categories)</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Difficulty Type Selectors */}
      <section style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginRight: '0.5rem' }}>ความยากการ์ด:</span>
        {['all', 'basic', 'advanced', 'expert', 'master', 'remaster'].map(type => (
          <button
            key={type}
            onClick={() => setSelectedDifficultyType(type)}
            className={`${styles.categoryPill} ${selectedDifficultyType === type ? styles.categoryPillActive : ''}`}
            style={{ textTransform: 'capitalize' }}
          >
            {type}
          </button>
        ))}
      </section>

      {/* Stats */}
      <div className={styles.statsInfo}>
        <div>พบทั้งหมด <strong>{filteredSongs.length}</strong> เพลง (จากซับไทย {songs.length} วิดีโอ)</div>
        {editMode && (
          <div style={{ color: 'rgb(var(--secondary-rgb))', fontSize: '0.85rem' }}>
            * ซ่อนไว้แล้ว {hiddenCardIds.size} เพลง | แก้ไขจับคู่คู่มือ {Object.keys(remappedSongs).length} เพลง
          </div>
        )}
      </div>

      {/* Grid */}
      <main className={styles.grid}>
        {filteredSongs.map(s => {
          const cardId = s.cardId || '';
          // Apply remapped data if edited
          const currentSong = (remappedSongs[cardId] || s) as any;
          const isHidden = hiddenCardIds.has(cardId);

          // Image Path select
          const imagePath = getCoverPath(currentSong);

          // Skip display of hidden songs unless in editMode
          if (isHidden && !editMode) return null;

          return (
            <div
              key={cardId}
              className={`${styles.card} ${isHidden ? styles.cardHidden : ''}`}
            >
              {/* Cover Image */}
              <div className={styles.coverContainer}>
                <a
                  href={s.youtube.url}
                  target="_blank"
                  rel="noreferrer"
                  title={`ดูคลิป YouTube: ${s.youtube.title}`}
                  style={{ display: 'block', width: '100%', height: '100%' }}
                >
                  {imagePath ? (
                    <img
                      src={imagePath}
                      alt={currentSong.title || 'No Title'}
                      className={styles.coverImg}
                      onError={(e) => handleImageError(e, currentSong)}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#13182b', color: 'rgba(255,255,255,0.2)' }}>
                      No Cover
                    </div>
                  )}
                </a>

                {/* Game Tag Badge */}
                {currentSong.game ? (
                  <div className={`${styles.gameBadge} ${currentSong.game === 'maimai' ? styles.badgeMaimai :
                    currentSong.game === 'chunithm' ? styles.badgeChuni : styles.badgeBoth
                    }`}>
                    {currentSong.game === 'both' ? 'maimai / CHUNI' : currentSong.game}
                  </div>
                ) : (
                  <div className={styles.gameBadge} style={{ background: '#4a5568', color: '#fff', boxShadow: 'none' }}>
                    ยังไม่จับคู่
                  </div>
                )}

                {/* Category */}
                {currentSong.category && (
                  <div className={styles.categoryBadge}>
                    {currentSong.category}
                  </div>
                )}

                {/* Verified Badge */}
                {verifiedCardIds.has(cardId) && (
                  <div className={styles.verifiedBadge}>
                    ✓ ตรวจสอบแล้ว
                  </div>
                )}
              </div>

              {/* Details */}
              <div className={styles.cardDetails}>
                <h3 className={styles.cardTitle} title={currentSong.title || 'ยังไม่ได้จับคู่เพลง'}>
                  {currentSong.title || '⚠️ ยังไม่ได้จับคู่เพลง'}
                </h3>
                <p className={styles.cardArtist} title={currentSong.artist || 'กรุณากดแก้ไขเพื่อจับคู่เพลง'}>
                  {currentSong.artist || 'กรุณาใช้โหมดแก้ไข เพื่อค้นหาและจับคู่เพลงนี้'}
                </p>

                {/* Difficulty Section */}
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.2rem' }}>
                  {(currentSong.game === 'maimai' || currentSong.game === 'both') && (
                    <div className={styles.gameSheets}>
                      <span className={styles.gameLabelSmall} style={{ color: '#00d9ff' }}>maimai DX</span>
                      {renderSheetsList(currentSong.maimaiSheets && currentSong.maimaiSheets.length > 0 ? currentSong.maimaiSheets : currentSong.sheets)}
                    </div>
                  )}
                  {(currentSong.game === 'chunithm' || currentSong.game === 'both') && (
                    <div className={styles.gameSheets}>
                      <span className={styles.gameLabelSmall} style={{ color: '#ffaa00' }}>CHUNITHM</span>
                      {renderSheetsList(currentSong.chuniSheets && currentSong.chuniSheets.length > 0 ? currentSong.chuniSheets : currentSong.sheets)}
                    </div>
                  )}
                </div>

                {/* Played Toggle Section */}
                <div className={styles.playedSection} suppressHydrationWarning>
                  {(currentSong.game === 'maimai' || currentSong.game === 'both') && (
                    <div className={styles.playedRow}>
                      <span className={styles.playedRowLabel} style={{ color: '#00d9ff' }}>maimai DX:</span>
                      <div className={styles.stagePills}>
                        <button
                          suppressHydrationWarning
                          className={`${styles.stagePill} ${playedSongs[cardId]?.maimai === 'played' ? styles.pillPlayedActive : ''}`}
                          onClick={() => setPlayedStage(cardId, 'maimai', 'played')}
                          title="ทำเครื่องหมาย: เล่นแล้ว"
                        >
                          PLAY
                        </button>
                        <button
                          suppressHydrationWarning
                          className={`${styles.stagePill} ${playedSongs[cardId]?.maimai === 'fc' ? styles.pillFcActive : ''}`}
                          onClick={() => setPlayedStage(cardId, 'maimai', 'fc')}
                          title="ทำเครื่องหมาย: Full Combo"
                        >
                          FC
                        </button>
                        <button
                          suppressHydrationWarning
                          className={`${styles.stagePill} ${playedSongs[cardId]?.maimai === 'ap' ? styles.pillApActive : ''}`}
                          onClick={() => setPlayedStage(cardId, 'maimai', 'ap')}
                          title="ทำเครื่องหมาย: All Perfect"
                        >
                          AP
                        </button>
                      </div>
                    </div>
                  )}
                  {(currentSong.game === 'chunithm' || currentSong.game === 'both') && (
                    <div className={styles.playedRow}>
                      <span className={styles.playedRowLabel} style={{ color: '#ffaa00' }}>CHUNITHM:</span>
                      <div className={styles.stagePills}>
                        <button
                          suppressHydrationWarning
                          className={`${styles.stagePill} ${playedSongs[cardId]?.chunithm === 'played' ? styles.pillPlayedActive : ''}`}
                          onClick={() => setPlayedStage(cardId, 'chunithm', 'played')}
                          title="ทำเครื่องหมาย: เล่นแล้ว"
                        >
                          PLAY
                        </button>
                        <button
                          suppressHydrationWarning
                          className={`${styles.stagePill} ${playedSongs[cardId]?.chunithm === 'fc' ? styles.pillFcActive : ''}`}
                          onClick={() => setPlayedStage(cardId, 'chunithm', 'fc')}
                          title="ทำเครื่องหมาย: Full Chain"
                        >
                          FC
                        </button>
                        <button
                          suppressHydrationWarning
                          className={`${styles.stagePill} ${playedSongs[cardId]?.chunithm === 'aj' ? styles.pillAjActive : ''}`}
                          onClick={() => setPlayedStage(cardId, 'chunithm', 'aj')}
                          title="ทำเครื่องหมาย: All Justice"
                        >
                          AJ
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* YouTube Link */}
                <div className={styles.ytSection}>
                  <div className={styles.ytTitle} title={s.youtube.title}>
                    <span className={styles.ytIcon}>▶</span>
                    <span>{s.youtube.title}</span>
                  </div>
                  <a
                    href={s.youtube.url}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.ytButton}
                  >
                    ดูวิดีโอบน Youtube
                  </a>
                </div>
              </div>

              {/* Edit Mode Buttons Overlay */}
              {editMode && (
                <div className={styles.editOverlay}>
                  <button
                    className={`${styles.editButton} ${styles.remapBtn}`}
                    onClick={() => {
                      setActiveRemapSong(s);
                      setActiveRemapCardId(cardId);
                      setModalSearch(currentSong.title || ''); // prefill with current title
                      setIsModalOpen(true);
                    }}
                    title="แก้ไขความถูกต้องของการจับคู่เพลง"
                  >
                    🔗 แก้ไข
                  </button>
                  <button
                    className={`${styles.editButton} ${styles.addBtn}`}
                    onClick={() => addAnotherMapping(s)}
                    title="เพิ่มคู่เทียบตู้อื่น หรือจับคู่เพลงที่สองเพิ่ม"
                  >
                    ➕ จับคู่เพิ่ม
                  </button>
                  <button
                    className={`${styles.editButton} ${styles.verifyBtn} ${verifiedCardIds.has(cardId) ? styles.verifyBtnActive : ''}`}
                    onClick={() => toggleVerify(cardId)}
                    title={verifiedCardIds.has(cardId) ? "ยกเลิกการยืนยัน" : "ยืนยันความถูกต้อง"}
                  >
                    {verifiedCardIds.has(cardId) ? '✓ เลิกตรวจ' : '✓ ยืนยัน'}
                  </button>
                  <button
                    className={`${styles.editButton} ${styles.hideBtn}`}
                    onClick={() => hideSong(cardId)}
                    title={isHidden ? "ยกเลิกการซ่อน" : "ซ่อนเพลงนี้"}
                  >
                    {isHidden ? '👁️ แสดง' : '🚫 ซ่อน'}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {filteredSongs.length === 0 && (
          <div className={styles.emptyState}>
            ไม่พบผลลัพธ์ที่ตรงกับตัวกรองของคุณ ลองเปลี่ยนคำค้นหาหรือตัวกรองดูนะครับ 🔍
          </div>
        )}
      </main>

      {/* Remap Modal */}
      {isModalOpen && activeRemapSong && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>แก้ไขการจับคู่เพลงด้วยตัวเอง</h2>
              <button className={styles.closeButton} onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.ytSourceInfo}>
                <label>คลิป YouTube ต้นทาง</label>
                <div className={styles.ytSourceTitle}>{activeRemapSong.youtube.title}</div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.3rem' }}>
                  ลิ้งก์: <a href={activeRemapSong.youtube.url} target="_blank" rel="noreferrer" style={{ color: 'rgb(var(--primary-rgb))' }}>{activeRemapSong.youtube.url}</a>
                </div>
              </div>

              <div className={styles.modalSearchBox}>
                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                  ค้นหาเพลงที่ถูกต้องในคลังเกมตู้
                </label>
                <input
                  type="text"
                  placeholder="พิมพ์ชื่อเพลงภาษาอังกฤษ, ญี่ปุ่น หรือศิลปิน..."
                  value={modalSearch}
                  onChange={e => setModalSearch(e.target.value)}
                  className={styles.searchInput}
                  style={{ background: 'rgba(0,0,0,0.3)' }}
                />
              </div>

              <div className={styles.candidateList}>
                {modalCandidates.map(candidate => (
                  <div key={candidate.songId} className={styles.candidateItem}>
                    <div className={styles.candidateSongInfo}>
                      <span className={styles.candidateSongTitle} title={candidate.title}>
                        {candidate.title}
                      </span>
                      <span className={styles.candidateSongArtist} title={candidate.artist}>
                        {candidate.artist}
                      </span>
                    </div>

                    <button
                      className={styles.selectCandidateBtn}
                      onClick={() => remapSong(activeRemapCardId, candidate)}
                    >
                      เลือกเพลงนี้ 🔗
                    </button>
                  </div>
                ))}

                {modalSearch && modalCandidates.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,0.3)' }}>
                    ไม่พบเพลงนี้ในฐานข้อมูลเกมตู้ 🔍
                  </div>
                )}

                {!modalSearch && (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,0.3)' }}>
                    กรุณาพิมพ์เพื่อเริ่มค้นหาเพลงในฐานข้อมูล
                  </div>
                )}
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setIsModalOpen(false)}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Randomizer Modal */}
      {isRandomizerOpen && (
        <div className={styles.modalBackdrop}>
          <div className={`${styles.modal} ${styles.randomizerModal}`}>
            <div className={styles.modalHeader}>
              <h2>🎲 สุ่มเพลงวัดดวง Meen Thaisub</h2>
              <button className={styles.closeButton} onClick={() => setIsRandomizerOpen(false)} disabled={isSpinning}>×</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.randomOptions}>
                <label className={styles.randomOptionLabel}>
                  <input
                    type="radio"
                    name="randomPool"
                    checked={randomPool === 'all'}
                    onChange={() => setRandomPool('all')}
                    disabled={isSpinning}
                  />
                  สุ่มจากทั้งหมด
                </label>
                <label className={styles.randomOptionLabel}>
                  <input
                    type="radio"
                    name="randomPool"
                    checked={randomPool === 'unplayed'}
                    onChange={() => setRandomPool('unplayed')}
                    disabled={isSpinning}
                  />
                  ไม่รวมที่เล่นแล้ว
                </label>
              </div>

              {/* Speed Switch Options */}
              <div className={styles.randomOptions} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.6rem', marginTop: '0.4rem' }}>
                <label className={styles.randomOptionLabel}>
                  <input
                    type="radio"
                    name="spinSpeed"
                    checked={spinSpeed === 'fast'}
                    onChange={() => setSpinSpeed('fast')}
                    disabled={isSpinning}
                  />
                  ⚡ สุ่มเร็ว (4-5 วิ)
                </label>
                <label className={styles.randomOptionLabel}>
                  <input
                    type="radio"
                    name="spinSpeed"
                    checked={spinSpeed === 'slow'}
                    onChange={() => setSpinSpeed('slow')}
                    disabled={isSpinning}
                  />
                  🎭 สุ่มแบบดราม่า (8 วิ)
                </label>
              </div>

              <div className={`${styles.randomizerSlot} ${isSpinning ? styles.randomizerSlotSpinning : ''}`}>
                {spunSong ? (
                  <>
                    <img
                      src={getCoverPath(spunSong) || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300&auto=format&fit=crop'}
                      alt="Spinning cover"
                      className={`${styles.slotCover} ${isSpinning ? styles.slotCoverSpinning : ''}`}
                      onError={(e) => handleImageError(e, spunSong)}
                    />
                    <div className={styles.slotTitle}>{spunSong.title || 'กำลังสุ่ม...'}</div>
                    <div className={styles.slotArtist}>{spunSong.artist || 'PinocchioP, etc.'}</div>
                  </>
                ) : (
                  <div style={{ fontSize: '3rem', margin: '2rem 0' }}>🎲</div>
                )}

                {funnyMessage && (
                  <div className={styles.funnyPhrase}>
                    {funnyMessage}
                  </div>
                )}
              </div>

              <button
                className={`${styles.btnPrimary} ${styles.btnRandomizer}`}
                onClick={startRandomization}
                disabled={isSpinning}
                style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
              >
                {isSpinning ? '🎰 กำลังหมุนติ้ว ๆ...' : '🎰 หมุนวงล้อวัดดวง!'}
              </button>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.btnSecondary}
                onClick={() => setIsRandomizerOpen(false)}
                disabled={isSpinning}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SNS Share Modal */}
      {isSnsModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={`${styles.modal} ${styles.snsModal}`}>
            <div className={styles.modalHeader}>
              <h2>📸 สร้างรูปภาพสรุปความสำเร็จ (SNS Share)</h2>
              <button className={styles.closeButton} onClick={() => setIsSnsModalOpen(false)}>×</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.playerNameGroup} style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                  ชื่อผู้เล่นบนการ์ดสรุปผลงาน:
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => {
                    setPlayerName(e.target.value);
                    localStorage.setItem('playerName', e.target.value);
                  }}
                  className={styles.searchInput}
                  placeholder="ใส่ชื่อผู้เล่นที่ต้องการโชว์..."
                  style={{ background: 'rgba(0,0,0,0.3)' }}
                />
              </div>

              <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, display: 'block', textAlign: 'left', marginBottom: '0.4rem' }}>
                พรีวิวรูปภาพที่จะดาวน์โหลด (ภาพสรุป 30 เพลงแรกที่ทำสถิติสูงสุด):
              </label>

              {/* Preview Box wrapper */}
              <div className={styles.snsPreviewWrapper}>
                <div id="sns-share-card-container" className={styles.snsShareCard}>
                  {/* Poster Header */}
                  <div className={styles.snsHeader}>
                    <div className={styles.snsHeaderLeft}>
                      <div className={styles.snsReportTitle}>MEEN THAISUB ACHIEVEMENT REPORT</div>
                      <div className={styles.snsPlayerName}>{playerName || 'npm i 🌟'}</div>
                    </div>
                    <div className={styles.snsHeaderRight}>
                      <div className={styles.snsStatItem}>
                        <div className={styles.snsStatValue} style={{ color: '#00d9ff' }}>{maimaiPlayedCount}</div>
                        <div className={styles.snsStatLabel}>maimai PLAYED</div>
                      </div>
                      <div className={styles.snsStatItem}>
                        <div className={styles.snsStatValue} style={{ color: '#ffaa00' }}>{chuniPlayedCount}</div>
                        <div className={styles.snsStatLabel}>CHUNI PLAYED</div>
                      </div>
                    </div>
                  </div>

                  {/* Cabinet Stats row */}
                  <div className={styles.snsSubStats}>
                    <div className={styles.snsSubStatCol} style={{ borderColor: '#00d9ff' }}>
                      <span className={styles.snsGameTitle} style={{ color: '#00d9ff' }}>maimai DX</span>
                      <span>เล่น: <strong>{maimaiPlayedCount}</strong></span>
                      <span>FC: <strong>{maimaiFcCount}</strong></span>
                      <span>AP: <strong style={{ color: '#ff007f' }}>{maimaiApCount}</strong></span>
                    </div>
                    <div className={styles.snsSubStatCol} style={{ borderColor: '#ffaa00' }}>
                      <span className={styles.snsGameTitle} style={{ color: '#ffaa00' }}>CHUNITHM</span>
                      <span>เล่น: <strong>{chuniPlayedCount}</strong></span>
                      <span>FC: <strong>{chuniFcCount}</strong></span>
                      <span>AJ: <strong style={{ color: '#ffcc00' }}>{chuniAjCount}</strong></span>
                    </div>
                  </div>

                  {/* Grid of Mini cards */}
                  <div className={styles.snsGrid}>
                    {achievementSongs.slice(0, 30).map((item, index) => {
                      const coverPath = getCoverPath(item.song);
                      const maimaiAch = item.achievements.maimai;
                      const chuniAch = item.achievements.chunithm;
                      return (
                        <div key={item.originalSong.cardId} className={styles.snsMiniCard}>
                          <div className={styles.snsMiniIndex}>#{index + 1}</div>
                          <img
                            src={coverPath || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=150'}
                            alt="cover"
                            className={styles.snsMiniCover}
                            onError={(e) => {
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=150';
                            }}
                          />
                          <div className={styles.snsMiniDetails}>
                            <div className={styles.snsMiniTitle} title={item.song.title}>
                              {item.song.title}
                            </div>
                            <div className={styles.snsMiniBadges}>
                              {maimaiAch && (
                                <span className={`${styles.snsBadge} ${maimaiAch === 'ap' ? styles.snsBadgeAp :
                                  maimaiAch === 'fc' ? styles.snsBadgeFc : styles.snsBadgePlay
                                  }`}>
                                  DX: {maimaiAch.toUpperCase()}
                                </span>
                              )}
                              {chuniAch && (
                                <span className={`${styles.snsBadge} ${chuniAch === 'aj' ? styles.snsBadgeAj :
                                  chuniAch === 'fc' ? styles.snsBadgeFc : styles.snsBadgePlay
                                  }`}>
                                  CHUNI: {chuniAch.toUpperCase()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {achievementSongs.length === 0 && (
                      <div className={styles.snsEmpty}>
                        ยังไม่มีข้อมูลประวัติการเล่นเพลงในขณะนี้<br />
                        กรุณากดมาร์กปุ่ม [PLAY / FC / AP / AJ] บนการ์ดเพลงต่าง ๆ ก่อนนะครับ! 🎮
                      </div>
                    )}
                  </div>

                  <div className={styles.snsFooter}>
                    Generated via Meen Thaisub's FC Song Picker • https://github.com/armsiwadol69/memethaisub
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={`${styles.btnPrimary} ${styles.btnSnsDownload}`}
                onClick={generateShareImage}
                disabled={achievementSongs.length === 0}
                style={{ background: 'linear-gradient(135deg, #7f00ff, #00d9ff)' }}
              >
                📥 ดาวน์โหลดรูปภาพสรุป (Download PNG)
              </button>
              <button className={styles.btnSecondary} onClick={() => setIsSnsModalOpen(false)}>
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={`${styles.modal} ${styles.importModal}`}>
            <div className={styles.modalHeader}>
              <h2>📥 นำเข้าประวัติการเล่นอัตโนมัติ</h2>
              <button className={styles.closeButton} onClick={() => setIsImportModalOpen(false)} disabled={isImporting}>×</button>
            </div>

            <div className={styles.modalBody}>
              <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                คุณสามารถอัปโหลดไฟล์สถิติการเล่นส่วนตัว (JSON) จากเว็บเช็คเรตติ้งเกมตู้ maimai หรือ CHUNITHM เพื่อให้ระบบทำการติ๊กสถานะความสำเร็จ <strong>[ PLAY / FC / AP / AJ ]</strong> บนการ์ดเพลงต่าง ๆ ให้คุณโดยอัตโนมัติทันที!
              </p>

              <div className={styles.importGrid}>
                {/* maimai column */}
                <div className={styles.importCol}>
                  <div className={styles.importColHeader} style={{ color: '#00d9ff' }}>
                    <span>🎮 maimai DX (.json)</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', margin: '0.5rem 0 1rem 0' }}>
                    อัปโหลดไฟล์คะแนนของตู้ maimai DX ที่เป็นรูปแบบลิสต์บทเพลง
                  </p>
                  <input
                    type="file"
                    accept=".json"
                    id="maimai-file-input"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          if (evt.target?.result) {
                            handleMaimaiImport(evt.target.result as string);
                          }
                        };
                        reader.readAsText(file);
                      }
                    }}
                  />
                  <button
                    className={styles.btnSecondary}
                    onClick={() => document.getElementById('maimai-file-input')?.click()}
                    disabled={isImporting}
                    style={{ width: '100%', borderColor: 'rgba(0, 217, 255, 0.3)', color: isImporting ? 'rgba(0,217,255,0.4)' : '#00d9ff', opacity: isImporting ? 0.5 : 1, cursor: isImporting ? 'not-allowed' : 'pointer' }}
                  >
                    {isImporting ? '⏳ กำลังประมวลผล...' : '📂 เลือกไฟล์ของ maimai DX'}
                  </button>
                </div>

                {/* chunithm column */}
                <div className={styles.importCol}>
                  <div className={styles.importColHeader} style={{ color: '#ffaa00' }}>
                    <span>🎹 CHUNITHM (.json)</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', margin: '0.5rem 0 1rem 0' }}>
                    อัปโหลดไฟล์ประวัติการเล่นตู้อันมีข้อมูล best / score ล่าสุด
                  </p>
                  <input
                    type="file"
                    accept=".json"
                    id="chuni-file-input"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          if (evt.target?.result) {
                            handleChunithmImport(evt.target.result as string);
                          }
                        };
                        reader.readAsText(file);
                      }
                    }}
                  />
                  <button
                    className={styles.btnSecondary}
                    onClick={() => document.getElementById('chuni-file-input')?.click()}
                    disabled={isImporting}
                    style={{ width: '100%', borderColor: 'rgba(255, 170, 0, 0.3)', color: isImporting ? 'rgba(255,170,0,0.4)' : '#ffaa00', opacity: isImporting ? 0.5 : 1, cursor: isImporting ? 'not-allowed' : 'pointer' }}
                  >
                    {isImporting ? '⏳ กำลังประมวลผล...' : '📂 เลือกไฟล์ของ CHUNITHM'}
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setIsImportModalOpen(false)}>
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
