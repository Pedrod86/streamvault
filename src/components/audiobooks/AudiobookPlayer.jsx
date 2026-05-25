import React, { useEffect, useRef, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Play, Pause, SkipBack, SkipForward, X, List,
  Timer, Gauge, ChevronLeft, ChevronRight, BookOpen, Volume2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const SLEEP_OPTIONS = [0, 5, 10, 15, 30, 60]; // minutes, 0 = off

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function AudiobookPlayer({ book, onClose }) {
  const audioRef = useRef(null);
  const sleepTimerRef = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(book.durationSeconds || 0);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [sleepMin, setSleepMin] = useState(0);
  const [sleepRemaining, setSleepRemaining] = useState(0);
  const [chapters, setChapters] = useState([]);
  const [showChapters, setShowChapters] = useState(false);
  const [showSleep, setShowSleep] = useState(false);
  const [showSpeed, setShowSpeed] = useState(false);
  const [currentChapterIdx, setCurrentChapterIdx] = useState(0);

  // Fetch chapters
  useEffect(() => {
    base44.functions.invoke('embyAudiobooks', { action: 'chapters', itemId: book.id })
      .then(res => {
        if (res.data?.chapters?.length) setChapters(res.data.chapters);
      })
      .catch(() => {});
  }, [book.id]);

  // Update current chapter index based on playback position
  useEffect(() => {
    if (!chapters.length) return;
    let idx = 0;
    for (let i = 0; i < chapters.length; i++) {
      if (currentTime >= chapters[i].startSeconds) idx = i;
    }
    setCurrentChapterIdx(idx);
  }, [currentTime, chapters]);

  // Sleep timer countdown
  useEffect(() => {
    clearInterval(sleepTimerRef.current);
    if (sleepMin === 0) { setSleepRemaining(0); return; }
    let remaining = sleepMin * 60;
    setSleepRemaining(remaining);
    sleepTimerRef.current = setInterval(() => {
      remaining--;
      setSleepRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(sleepTimerRef.current);
        setSleepMin(0);
        audioRef.current?.pause();
        setPlaying(false);
      }
    }, 1000);
    return () => clearInterval(sleepTimerRef.current);
  }, [sleepMin]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play(); setPlaying(true); }
  };

  const onTimeUpdate = useCallback(() => {
    setCurrentTime(audioRef.current?.currentTime || 0);
  }, []);

  const onLoadedMetadata = useCallback(() => {
    setDuration(audioRef.current?.duration || book.durationSeconds || 0);
  }, [book.durationSeconds]);

  const seek = (val) => {
    if (audioRef.current) audioRef.current.currentTime = val[0];
    setCurrentTime(val[0]);
  };

  const onVolumeChange = (val) => {
    const v = val[0];
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  const skip = (secs) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + secs));
    }
  };

  const cycleSpeed = () => {
    const nextIdx = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(nextIdx);
    const s = SPEEDS[nextIdx];
    setSpeed(s);
    if (audioRef.current) audioRef.current.playbackRate = s;
  };

  const jumpToChapter = (ch) => {
    if (audioRef.current) {
      audioRef.current.currentTime = ch.startSeconds;
      setCurrentTime(ch.startSeconds);
      audioRef.current.play();
      setPlaying(true);
    }
    setShowChapters(false);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const currentChapter = chapters[currentChapterIdx];

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-5 h-5" />
        </button>
        <span className="text-sm font-medium text-foreground truncate flex-1">Now Playing</span>
        {sleepRemaining > 0 && (
          <span className="text-xs text-primary font-semibold px-2 py-0.5 rounded-full bg-primary/10">
            Sleep {formatTime(sleepRemaining)}
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-start px-6 pt-8 pb-4 overflow-y-auto gap-6 max-w-lg mx-auto w-full">
        {/* Cover art */}
        <div className="w-52 h-52 sm:w-64 sm:h-64 rounded-2xl overflow-hidden bg-secondary flex items-center justify-center shadow-2xl shrink-0">
          {book.posterUrl ? (
            <img src={book.posterUrl} alt={book.title} className="w-full h-full object-cover" />
          ) : (
            <BookOpen className="w-20 h-20 text-muted-foreground" />
          )}
        </div>

        {/* Title + author */}
        <div className="text-center space-y-1">
          <h2 className="font-heading font-bold text-xl text-foreground leading-tight">{book.title}</h2>
          {book.author && <p className="text-muted-foreground text-sm">{book.author}</p>}
          {book.narrator && <p className="text-xs text-muted-foreground">Narrated by {book.narrator}</p>}
          {currentChapter && (
            <p className="text-xs text-primary font-medium mt-1">{currentChapter.name}</p>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full space-y-1.5">
          <Slider
            min={0}
            max={Math.max(duration, 1)}
            step={1}
            value={[currentTime]}
            onValueChange={seek}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>-{formatTime(duration - currentTime)}</span>
          </div>
        </div>

        {/* Volume */}
        <div className="w-full flex items-center gap-3">
          <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={[volume]}
            onValueChange={onVolumeChange}
            className="flex-1"
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-6">
          <button onClick={() => skip(-30)} className="text-muted-foreground hover:text-foreground transition-colors flex flex-col items-center gap-0.5">
            <SkipBack className="w-7 h-7" />
            <span className="text-[10px]">30s</span>
          </button>
          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
          >
            {playing ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
          </button>
          <button onClick={() => skip(30)} className="text-muted-foreground hover:text-foreground transition-colors flex flex-col items-center gap-0.5">
            <SkipForward className="w-7 h-7" />
            <span className="text-[10px]">30s</span>
          </button>
        </div>

        {/* Chapter prev/next */}
        {chapters.length > 1 && (
          <div className="flex items-center gap-4">
            <button
              onClick={() => chapters[currentChapterIdx - 1] && jumpToChapter(chapters[currentChapterIdx - 1])}
              disabled={currentChapterIdx === 0}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Prev Chapter
            </button>
            <button
              onClick={() => chapters[currentChapterIdx + 1] && jumpToChapter(chapters[currentChapterIdx + 1])}
              disabled={currentChapterIdx >= chapters.length - 1}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              Next Chapter <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Speed / Sleep / Chapters buttons */}
        <div className="flex gap-3 flex-wrap justify-center">
          {/* Speed */}
          <div className="relative">
            <button
              onClick={() => { setShowSpeed(p => !p); setShowSleep(false); setShowChapters(false); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary text-sm font-medium text-foreground hover:bg-secondary/80 transition-colors"
            >
              <Gauge className="w-4 h-4 text-primary" />
              {speed}x
            </button>
            {showSpeed && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-card border border-border rounded-xl overflow-hidden shadow-xl z-20 w-32">
                {SPEEDS.map(s => (
                  <button key={s} onClick={() => { setSpeed(s); setSpeedIdx(SPEEDS.indexOf(s)); if (audioRef.current) audioRef.current.playbackRate = s; setShowSpeed(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${speed === s ? 'text-primary font-semibold' : 'text-foreground hover:bg-secondary'}`}>
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sleep timer */}
          <div className="relative">
            <button
              onClick={() => { setShowSleep(p => !p); setShowSpeed(false); setShowChapters(false); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${sleepMin > 0 ? 'bg-primary/20 text-primary' : 'bg-secondary text-foreground hover:bg-secondary/80'}`}
            >
              <Timer className="w-4 h-4" />
              {sleepMin > 0 ? `${sleepMin}m` : 'Sleep'}
            </button>
            {showSleep && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-card border border-border rounded-xl overflow-hidden shadow-xl z-20 w-36">
                {SLEEP_OPTIONS.map(m => (
                  <button key={m} onClick={() => { setSleepMin(m); setShowSleep(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${sleepMin === m ? 'text-primary font-semibold' : 'text-foreground hover:bg-secondary'}`}>
                    {m === 0 ? 'Off' : `${m} minutes`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chapters list */}
          {chapters.length > 0 && (
            <button
              onClick={() => { setShowChapters(p => !p); setShowSpeed(false); setShowSleep(false); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary text-sm font-medium text-foreground hover:bg-secondary/80 transition-colors"
            >
              <List className="w-4 h-4 text-primary" />
              Chapters ({chapters.length})
            </button>
          )}
        </div>

        {/* Chapter list panel */}
        {showChapters && chapters.length > 0 && (
          <div className="w-full bg-card border border-border rounded-xl overflow-hidden max-h-64 overflow-y-auto">
            <div className="px-4 py-2.5 border-b border-border text-sm font-semibold text-foreground">Chapters</div>
            {chapters.map((ch, i) => (
              <button
                key={i}
                onClick={() => jumpToChapter(ch)}
                className={`w-full text-left px-4 py-3 text-sm border-b border-border/50 last:border-0 transition-colors ${
                  i === currentChapterIdx ? 'text-primary bg-primary/10 font-medium' : 'text-foreground hover:bg-secondary'
                }`}
              >
                <div>{ch.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{formatTime(ch.startSeconds)}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={book.streamUrl}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={() => setPlaying(false)}
        preload="metadata"
      />
    </div>
  );
}