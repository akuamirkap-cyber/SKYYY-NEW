import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, type GameState, type HudStats, type PopupEvent } from './game/Game';
import { BLOOM_PRESETS, DEFAULT_TUNE, FEEL_PRESETS, LIGHT_PRESETS, MASTER_PRESETS, type Tune } from './game/tune';
import { GameOver, Hud, PauseOverlay, Popups, StartScreen, TouchControls } from './components/HUD';
import { QuickGlare, SettingsPanel } from './components/SettingsPanel';

const INITIAL: HudStats = {
  score: 0,
  best: 0,
  combo: 0,
  mult: 1,
  speed: 0,
  flow: 45,
  airborne: false,
  distance: 0,
  state: 'menu',
  trick: '',
  airTime: 0,
  palette: 'Golden',
  clearance: 0.6,
  flipDeg: 0,
  spinDeg: 0,
  landState: 'none',
  timeToLand: 9,
  airJumpsLeft: 0,
  airJumpsMax: 1,
  chain: 0,
  chainPoints: 0,
  chainTime: 0,
  airFlash: 0,
  autoOn: false,
  plan: 'none',
  navOn: false,
  navDist: 0,
  navBearing: 0,
  navDrop: 0,
  onWater: false,
  beamOn: false,
  beamDist: 0,
  beamBearing: 0,
  gapOn: false,
  gapDist: 0,
  gapW: 0,
  jumpNow: false,
  bestDist: 0,
  overReason: '',
  shield: 3,
  maxShield: 3,
  sectorName: 'Lembah Awal',
  sectorSubtitle: 'Pasir lembut',
  altitudeDrop: 0,
  crystalsCollected: 0,
  camStyle: 1,
  runTime: 0,
  relicGateOn: false,
  relicGateIndex: 0,
  relicGateDist: 0,
  relicGateBearing: 0,
  relicStreak: 0,
  relicsPassed: 0,
  relicsMissed: 0,
  boosting: false,
  raceRank: 1,
  raceTotal: 7,
  botLeaderName: 'Kamu',
  botLeaderDist: 0,
  jumpStyle: 1,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [stats, setStats] = useState<HudStats>(INITIAL);
  const [state, setState] = useState<GameState>('menu');
  const [popups, setPopups] = useState<PopupEvent[]>([]);
  const [muted, setMuted] = useState(false);
  const [tune, setTune] = useState<Tune>({ ...DEFAULT_TUNE });
  const [showTune, setShowTune] = useState(false);
  const [feelName, setFeelName] = useState('Silk');
  const [lightName, setLightName] = useState('Netral');
  const [bloomName, setBloomName] = useState('Data 1 (Tinggi)');
  const [touch] = useState(
    () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0),
  );

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const game = new Game(el, {
      onStats: setStats,
      onState: setState,
      onPopup: (p) => {
        setPopups((prev) => [...prev.slice(-3), p]);
        window.setTimeout(() => setPopups((prev) => prev.filter((x) => x.id !== p.id)), 1500);
      },
    });
    gameRef.current = game;

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (game.state === 'playing') game.setPaused(true);
        else if (game.state === 'paused') game.setPaused(false);
      }
      if (e.code === 'KeyT') setShowTune((v) => !v);
    };
    const onBlur = () => game.setPaused(true);
    const onVis = () => {
      if (document.hidden) game.setPaused(true);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVis);

    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVis);
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  const begin = useCallback(() => gameRef.current?.begin(), []);
  const restart = useCallback(() => {
    setShowTune(false);
    gameRef.current?.restart();
  }, []);
  const resume = useCallback(() => {
    setShowTune(false);
    gameRef.current?.setPaused(false);
  }, []);
  const pause = useCallback(() => gameRef.current?.setPaused(true), []);
  const jump = useCallback(() => gameRef.current?.jumpOrTrick(), []);
  const boost = useCallback((on: boolean) => gameRef.current?.setBoost(on), []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      gameRef.current?.audio.setMuted(!m);
      return !m;
    });
  }, []);

  const toggleJumpStyle = useCallback(() => {
    gameRef.current?.toggleJumpStyle();
  }, []);

  const applyTune = useCallback((t: Partial<Tune>) => {
    gameRef.current?.setTune(t);
    setTune((prev) => ({ ...prev, ...t }));
  }, []);

  const applyMaster = useCallback(
    (name: string) => {
      const preset = MASTER_PRESETS.find((m) => m.name === name) ?? MASTER_PRESETS[0];
      applyTune(preset.values);
      setLightName(preset.lightName);
      setBloomName(preset.bloomName);
    },
    [applyTune],
  );

  const speedLines = Math.max(0, Math.min(0.3, (stats.speed - 40) / 210)) + (stats.flow > 0 && stats.speed > 60 ? 0.05 : 0);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#101820]">
      <div ref={mountRef} className="absolute inset-0" />

      {/* vignette gelap dihilangkan — layar jernih penuh */}
      <div className="grain pointer-events-none absolute inset-0 z-10" />

      {state !== 'menu' && (
        <Hud
          stats={stats}
          speedLines={speedLines}
          muted={muted}
          onMute={toggleMute}
          onPause={pause}
          onTune={() => setShowTune(true)}
          onToggleJumpStyle={toggleJumpStyle}
        />
      )}

      <Popups items={popups} />

      {touch && state === 'playing' && (
        <TouchControls
          onJump={jump}
          onJumpUp={() => gameRef.current?.releaseJump()}
          onBoost={boost}
          onAirJump={() => gameRef.current?.airJump()}
          onGrab={(on) => gameRef.current?.setGrab(on)}
          onFront={(on) => gameRef.current?.setFrontFlip(on)}
          onCombo={() => gameRef.current?.pressCombo()}
          onBoardFlip={() => gameRef.current?.pressRandomBoardTrick()}
          onDashLeft={() => gameRef.current?.dashLeft()}
          onDashRight={() => gameRef.current?.dashRight()}
          onSteerLeft={(on) => gameRef.current?.setSteerLeft(on)}
          onSteerRight={(on) => gameRef.current?.setSteerRight(on)}
          airborne={stats.airborne}
          flow={stats.flow}
        />
      )}

      {state === 'menu' && (
        <StartScreen
          best={stats.best}
          onBegin={begin}
          onTune={() => setShowTune(true)}
          feel={feelName}
          onFeel={(name) => {
            const preset = FEEL_PRESETS.find((p) => p.name === name);
            if (preset) applyTune(preset.values);
            setFeelName(name);
          }}
          bloom={bloomName}
          onBloom={(name) => {
            const preset = BLOOM_PRESETS.find((p) => p.name === name);
            if (preset) applyTune(preset.values);
            setBloomName(name);
          }}
          light={lightName}
          onLight={(name) => {
            const preset = LIGHT_PRESETS.find((p) => p.name === name);
            if (preset) applyTune(preset.values);
            setLightName(name);
          }}
          palette={stats.palette}
          onPalette={(idx) => {
            applyTune({ palette: idx, cycle: false });
          }}
          onApplyMaster={applyMaster}
        />
      )}
      {state === 'over' && !showTune && (
        <GameOver stats={stats} onRestart={restart} onTune={() => setShowTune(true)} />
      )}
      {state === 'paused' && !showTune && (
        <PauseOverlay
          onResume={resume}
          onRestart={restart}
          onTune={() => setShowTune(true)}
          score={stats.score}
        />
      )}
      {state === 'playing' && !showTune && (
        <div className="pointer-events-none absolute bottom-6 left-5 z-20 hidden sm:block sm:left-8">
          <div className="text-[9px] tracking-[0.34em] text-sand-200/50 uppercase">
            klik kiri = freestyle otomatis · klik kanan/space = lompat · Q/E elak · 1/2/3/4 kamera · drag = sudut kamera · scroll = zoom · T setting
          </div>
        </div>
      )}

      {!showTune && <QuickGlare tune={tune} onChange={applyTune} />}

      <SettingsPanel
        open={showTune}
        tune={tune}
        onChange={applyTune}
        onTeleport={() => {
          const g = gameRef.current;
          if (!g) return;
          if (g.state === 'menu') g.begin();
          g.teleportToWaterfall();
          setShowTune(false);
          if (g.state === 'paused') g.setPaused(false);
        }}
        onClose={() => {
          setShowTune(false);
          if (gameRef.current?.state === 'paused') gameRef.current.setPaused(false);
        }}
      />
    </div>
  );
}
