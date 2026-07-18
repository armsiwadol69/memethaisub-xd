'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

import matchedSongsData from '../data/matched_songs.json';
import filteredGameSongsData from '../data/filtered_game_songs.json';

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
  id: string;
  title: string;
  artist: string;
  game: string; // 'maimai' | 'chunithm' | 'both'
  category: string;
  bpm: number;
  releaseDate: string;
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

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeRemapSong, setActiveRemapSong] = useState<Song | null>(null);
  const [activeRemapCardId, setActiveRemapCardId] = useState<string>('');
  const [modalSearch, setModalSearch] = useState('');

  // Load initial data
  useEffect(() => {
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
      localStorage.removeItem('verifiedCardIds');
    }
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
            localImagePaths: s.localImagePaths,
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
  const categories = Array.from(new Set(songs.map(s => s.category).filter(Boolean)));

  // Filter logic
  const filteredSongs = songs.filter(s => {
    const cardId = s.cardId || '';
    const currentSong = remappedSongs[cardId] || s;

    // If not in edit mode, hide unmatched songs!
    if (!editMode && !currentSong.id) return false;

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
    const hasSheetInRange = currentSong.sheets.some(sheet => {
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

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.logoGlow}>M</div>
          <div className={styles.titleText}>
            <h1>Meen Thaisub Song Matcher</h1>
            <p>ระบบค้นหา กรอง และจัดการข้อมูลเพลงซับไทยที่จับคู่กับฐานข้อมูลเกม maimai & CHUNITHM</p>
          </div>
        </div>
        
        <div className={styles.controls}>
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
          const currentSong = remappedSongs[cardId] || s;
          const isHidden = hiddenCardIds.has(cardId);
          
          // Image Path select
          const imagePath = currentSong.game === 'maimai' || currentSong.game === 'both'
            ? s.localImagePaths.maimai
            : s.localImagePaths.chunithm;

          // Skip display of hidden songs unless in editMode
          if (isHidden && !editMode) return null;

          return (
            <div 
              key={cardId} 
              className={`${styles.card} ${isHidden ? styles.cardHidden : ''}`}
            >
              {/* Cover Image */}
              <div className={styles.coverContainer}>
                {imagePath ? (
                  <img 
                    src={imagePath} 
                    alt={currentSong.title || 'No Title'} 
                    className={styles.coverImg}
                    onError={(e) => {
                      // fallback to raw placeholder if local download didn't finish
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300&auto=format&fit=crop';
                    }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#13182b', color: 'rgba(255,255,255,0.2)' }}>
                    No Cover
                  </div>
                )}
                
                {/* Game Tag Badge */}
                {currentSong.game ? (
                  <div className={`${styles.gameBadge} ${
                    currentSong.game === 'maimai' ? styles.badgeMaimai : 
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

                {/* Difficulty badges */}
                <div className={styles.sheetsWrapper}>
                  {currentSong.sheets && currentSong.sheets.map((sheet, index) => {
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
                    ดูวิดีโอซับไทยบน YouTube
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
    </div>
  );
}
