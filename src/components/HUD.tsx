import type { HudStats, PopupEvent } from '../game/Game';
import { BLOOM_PRESETS, FEEL_PRESETS, LIGHT_PRESETS } from '../game/tune';
import { PALETTES } from '../game/palette';

const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[9px] font-medium uppercase tracking-[0.42em] text-sand-200/70">{children}</div>;
}

export function Hud({
  stats,
  speedLines,
  muted,
  onMute,
  onPause,
  onTune,
  onToggleJumpStyle,
}: {
  stats: HudStats;
  speedLines: number;
  muted: boolean;
  onMute: () => void;
  onPause: () => void;
  onTune: () => void;
  onToggleJumpStyle?: () => void;
}) {
  const speedT = Math.min(1, stats.speed / 105);
  const C = 2 * Math.PI * 34;
  const boostingFlow = stats.flow;

  return (
    <>
      {/* speed streaks */}
      <div className="speedlines pointer-events-none absolute inset-0 z-10" style={{ opacity: speedLines }} />

      {/* bodycam frame (mode kamera 4) */}
      {stats.camStyle === 3 && <BodycamOverlay stats={stats} />}

      {/* top left : score */}
      <div className="pointer-events-none absolute top-5 left-5 z-20 sm:top-7 sm:left-8">
        <Label>score</Label>
        <div className="tnum font-display text-5xl leading-none font-light text-sand-50 drop-shadow-[0_4px_18px_rgba(40,16,0,0.55)] sm:text-6xl">
          {fmt(stats.score)}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.3em] text-sand-200/60">best {fmt(stats.best)}</span>
          {stats.mult > 1 && (
            <span
              className="rounded-full border border-sand-200/40 bg-sand-400/20 px-2 py-[3px] text-[10px] font-semibold tracking-[0.18em] text-sand-50"
              style={{ boxShadow: '0 0 18px rgba(255,206,140,0.45)' }}
            >
              ×{stats.mult}
            </span>
          )}
          {stats.airborne && (
            <span className="anim-breathe text-[10px] font-semibold tracking-[0.3em] text-cyan-100">AIR</span>
          )}
        </div>
      </div>

      {/* ---- AIR: trick readout + landing gauge */}
      {stats.airborne && (stats.airTime > 0.25 || stats.airJumpsLeft < stats.airJumpsMax) && (
        <AirGauge stats={stats} />
      )}

      {/* ---- chain meter (between jumps) */}
      {!stats.airborne && stats.chain > 0 && stats.chainTime > 0 && (
        <div className="pointer-events-none absolute top-[27%] left-1/2 z-20 -translate-x-1/2 text-center">
          <div className="font-display text-xl font-light tracking-[0.3em] text-sand-50/90">
            CHAIN ×{stats.chain}
          </div>
          <div className="tnum text-[10px] tracking-[0.3em] text-sand-200/70">{fmt(stats.chainPoints)}</div>
          <div className="mx-auto mt-2 h-[3px] w-40 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-200 to-amber-200"
              style={{ width: `${stats.chainTime * 100}%` }}
            />
          </div>
          <div className="mt-1 text-[8px] tracking-[0.3em] text-sand-200/50 uppercase">lompat lagi untuk lanjut</div>
        </div>
      )}

      {/* top right : buttons */}
      <div className="absolute top-5 right-5 z-30 flex items-center gap-2 sm:top-7 sm:right-8">
        {onToggleJumpStyle && (
          <button
            onClick={onToggleJumpStyle}
            className={`glass flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-[10px] font-semibold tracking-[0.2em] uppercase transition hover:scale-105 active:scale-95 ${
              stats.jumpStyle === 1
                ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-200 shadow-[0_0_12px_rgba(80,220,255,0.45)]'
                : 'border-amber-300/70 bg-amber-400/20 text-amber-200 shadow-[0_0_12px_rgba(255,190,60,0.45)]'
            }`}
            title="Ganti Mode Lompatan (Tombol V): Rendah (Pasir Menempel) vs Tinggi (Melayang)"
          >
            <span className="text-[12px]">{stats.jumpStyle === 1 ? '🏄' : '🦅'}</span>
            <span className="hidden sm:inline">
              {stats.jumpStyle === 1 ? 'Lompat Rendah' : 'Lompat Tinggi'}
            </span>
          </button>
        )}
        <button
          onClick={onMute}
          className="glass flex h-9 w-9 items-center justify-center rounded-full text-sand-50 transition hover:scale-105 active:scale-95"
          aria-label="mute"
        >
          {muted ? '✕' : '♪'}
        </button>
        <button
          onClick={onTune}
          className="glass flex h-9 w-9 items-center justify-center rounded-full text-[13px] text-sand-50 transition hover:scale-105 active:scale-95"
          aria-label="settings"
        >
          ☾
        </button>
        <button
          onClick={onPause}
          className="glass flex h-9 items-center justify-center rounded-full px-4 text-[10px] font-semibold tracking-[0.28em] text-sand-50 uppercase transition hover:scale-105 active:scale-95"
        >
          pause
        </button>
      </div>

      {/* bottom right : speed ring */}
      <div className="pointer-events-none absolute right-5 bottom-5 z-20 sm:right-8 sm:bottom-8">
        <div className="relative h-[92px] w-[92px]">
          <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,240,220,0.16)" strokeWidth="4" />
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke="url(#sg)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - speedT)}
              style={{ filter: 'drop-shadow(0 0 8px rgba(255,196,120,0.75))', transition: 'stroke-dashoffset 90ms linear' }}
            />
            <defs>
              <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#8fe6ff" />
                <stop offset="100%" stopColor="#ffc478" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="tnum font-display text-2xl leading-none font-light">{Math.round(stats.speed * 2.1)}</div>
            <div className="mt-[2px] text-[8px] tracking-[0.3em] text-sand-200/60">KM/H</div>
          </div>
        </div>
      </div>

      {/* bottom center : flow meter */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 w-[min(300px,60vw)] -translate-x-1/2 sm:bottom-8">
        <div className="mb-[6px] flex items-center justify-between">
          <Label>flow</Label>
          <span className="text-[9px] tracking-[0.28em] text-sand-200/50 uppercase">
            {boostingFlow > 2 ? 'hold shift' : 'tricks refill'}
          </span>
        </div>
        <div className="h-[7px] w-full overflow-hidden rounded-full border border-sand-200/25 bg-black/25">
          <div
            className="h-full rounded-full transition-[width] duration-100"
            style={{
              width: `${boostingFlow}%`,
              background: 'linear-gradient(90deg,#8fe6ff,#ffd9a1 65%,#fff3e0)',
              boxShadow: '0 0 16px rgba(255,206,150,0.7)',
            }}
          />
        </div>
      </div>

      {/* distance & mountain descent HUD */}
      <div className="pointer-events-none absolute top-4 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center text-center sm:top-6">
        {/* Badges: Mountain sector + 7-Player Race position */}
        <div className="flex items-center gap-2">
          {/* Mountain sector badge */}
          <div className="glass flex items-center gap-2 rounded-full px-3.5 py-1 backdrop-blur-md">
            <span className="text-[10px]">🏔️</span>
            <span className="font-display text-[12px] font-semibold tracking-wider text-sand-50">
              {stats.sectorName}
            </span>
            <span className="text-[9px] text-sand-200/60 hidden sm:inline">· {stats.sectorSubtitle}</span>
          </div>

          {/* Race Rank Badge */}
          <div
            className={`glass flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold transition-all duration-300 ${
              stats.raceRank === 1
                ? 'border-amber-300/80 bg-amber-400/25 text-amber-200 shadow-[0_0_14px_rgba(255,200,60,0.5)]'
                : stats.raceRank <= 3
                  ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-200 shadow-[0_0_10px_rgba(100,220,255,0.4)]'
                  : 'border-white/20 text-sand-200/80'
            }`}
          >
            <span className="text-[10px]">{stats.raceRank === 1 ? '👑' : '🏁'}</span>
            <span className="font-display text-[12px] tracking-wider uppercase">
              POSISI {stats.raceRank} / {stats.raceTotal}
            </span>
            {stats.raceRank > 1 && stats.botLeaderDist > 10 && (
              <span className="tnum text-[9px] text-sand-200/60 hidden sm:inline">
                ({Math.round(stats.botLeaderDist)}m di blkg {stats.botLeaderName})
              </span>
            )}
          </div>
        </div>

        {/* Downhill distance & altitude */}
        <div className="mt-1.5 flex items-center gap-3">
          <div className="tnum font-display text-base font-light tracking-[0.2em] text-sand-50/90 sm:text-lg">
            {fmt(stats.distance)} m
          </div>
          <div className="h-2.5 w-[1px] bg-sand-200/30" />
          <div className="tnum text-[10px] font-semibold tracking-wider text-cyan-200">
            ▼ Alt: -{Math.round(stats.altitudeDrop)} m
          </div>
        </div>

        {/* Safety Shields & Energy Crystals Status */}
        <div className="mt-1.5 flex items-center gap-4">
          {/* 3 Shields */}
          <div className="flex items-center gap-1.5" title="Perisai Aman Turun Gunung">
            <span className="text-[8px] font-bold tracking-[0.2em] text-sand-200/70 uppercase">Perisai:</span>
            {[0, 1, 2].map((i) => {
              const active = i < stats.shield;
              return (
                <div
                  key={i}
                  className={`h-3 w-3 rounded-full border transition-all duration-300 ${
                    active
                      ? 'border-cyan-200 bg-cyan-400 shadow-[0_0_8px_rgba(110,230,255,0.9)]'
                      : 'border-white/20 bg-black/40'
                  }`}
                />
              );
            })}
          </div>

          <div className="h-2.5 w-[1px] bg-sand-200/30" />

          {/* Crystals */}
          <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-200" title="Kristal Surya Terkumpul">
            <span className="anim-breathe text-amber-300">✦</span>
            <span className="tnum text-[10px] text-sand-50">{stats.crystalsCollected}</span>
          </div>

          {/* Relic streak */}
          {stats.relicStreak > 0 && (
            <>
              <div className="h-2.5 w-[1px] bg-sand-200/30" />
              <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-300" title="Relic Slalom Streak">
                <span className="anim-breathe">⚡</span>
                <span className="tnum text-[10px] text-amber-200">×{stats.relicStreak}</span>
              </div>
            </>
          )}
        </div>

        {/* downhill relic gate navigator */}
        {stats.relicGateOn && (
          <div
            className="glass mt-2 flex items-center gap-2 rounded-full px-3 py-[5px]"
            style={{
              borderColor: 'rgba(255, 215, 80, 0.65)',
              boxShadow: '0 0 16px rgba(255, 200, 50, 0.25)',
            }}
          >
            <svg
              viewBox="0 0 20 20"
              className="h-4 w-4 transition-transform duration-150"
              style={{ transform: `rotate(${(stats.relicGateBearing * 180) / Math.PI}deg)` }}
            >
              <path d="M10 1.5 L16 16 L10 12.5 L4 16 Z" fill="#ffd54f" />
            </svg>
            <span className="anim-breathe text-[9px] font-semibold tracking-[0.24em] text-amber-300 uppercase">
              ⚡ relik #{stats.relicGateIndex}
            </span>
            <span className="tnum text-[10px] font-semibold text-sand-50">{fmt(stats.relicGateDist)} m</span>
            {stats.relicStreak > 0 && (
              <span className="rounded-full bg-amber-400/30 px-1.5 py-0.5 text-[8px] font-bold text-amber-200">
                ×{stats.relicStreak}
              </span>
            )}
          </div>
        )}

        {/* waterfall navigator */}
        {stats.navOn && (
          <div className="glass mt-2 flex items-center gap-2 rounded-full px-3 py-[5px]">
            <svg
              viewBox="0 0 20 20"
              className="h-4 w-4 transition-transform duration-150"
              style={{ transform: `rotate(${(stats.navBearing * 180) / Math.PI}deg)` }}
            >
              <path d="M10 2 L16 15 L10 12 L4 15 Z" fill="#bff0ff" />
            </svg>
            <span className="text-[9px] font-semibold tracking-[0.24em] text-cyan-50 uppercase">
              air terjun {Math.round(stats.navDrop)} m
            </span>
            <span className="tnum text-[10px] text-sand-100/80">{fmt(stats.navDist)} m</span>
          </div>
        )}
        {/* sinar putih — tujuan utama */}
        {stats.beamOn && (
          <div
            className="glass mt-2 flex items-center gap-2 rounded-full px-3 py-[5px]"
            style={{ borderColor: 'rgba(255,255,255,0.6)', boxShadow: '0 0 18px rgba(255,255,255,0.25)' }}
          >
            <svg
              viewBox="0 0 20 20"
              className="h-4 w-4 transition-transform duration-150"
              style={{ transform: `rotate(${(stats.beamBearing * 180) / Math.PI}deg)` }}
            >
              <path d="M10 1.5 L16 16 L10 12.5 L4 16 Z" fill="#ffffff" />
            </svg>
            <span className="anim-breathe text-[9px] font-semibold tracking-[0.24em] text-white uppercase">
              ✦ sinar
            </span>
            <span className="tnum text-[10px] font-semibold text-sand-50">{fmt(stats.beamDist)} m</span>
          </div>
        )}
        {stats.onWater && (
          <div className="mt-1 text-[8px] tracking-[0.34em] text-cyan-100/70 uppercase">〰 di atas sungai</div>
        )}
        {/* chasm warning */}
        {stats.gapOn && !stats.jumpNow && (
          <div
            className="glass mt-2 flex items-center gap-2 rounded-full px-3 py-[5px]"
            style={{ borderColor: stats.gapDist < 90 ? 'rgba(255,170,110,0.7)' : undefined }}
          >
            <span className="text-[11px] text-amber-200">▼</span>
            <span className="text-[9px] font-semibold tracking-[0.26em] text-amber-50 uppercase">
              jurang {Math.round(stats.gapW)} m
            </span>
            <span className="tnum text-[10px] text-sand-100/80">{fmt(stats.gapDist)} m</span>
          </div>
        )}
      </div>

      {/* big jump cue right before the lip */}
      {stats.jumpNow && (
        <div className="pointer-events-none absolute top-[30%] left-1/2 z-20 -translate-x-1/2 text-center">
          <div className="anim-breathe font-display text-5xl font-light tracking-[0.3em] text-amber-50 drop-shadow-[0_0_26px_rgba(255,170,90,0.95)]">
            LOMPAT!
          </div>
          <div className="mt-1 text-[10px] font-semibold tracking-[0.4em] text-amber-100/80 uppercase">
            space · jurang {Math.round(stats.gapW)} m
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Landing gauge: a ring with the board's flip angle drawn as a line.
 * Gold = perfect, white = clean, red = you will land sketchy.
 */
function AirGauge({ stats }: { stats: HudStats }) {
  const st = stats.landState;
  const color = st === 'perfect' ? '#ffd88a' : st === 'clean' ? '#e8f7ff' : '#ff8f8f';
  const glow = st === 'perfect' ? 'rgba(255,210,130,0.9)' : st === 'clean' ? 'rgba(170,230,255,0.7)' : 'rgba(255,120,120,0.8)';
  const soon = stats.timeToLand < 0.55;
  const a = -stats.flipDeg; // board nose angle (backflip = counter-clockwise)
  const spinK = Math.cos((stats.spinDeg * Math.PI) / 180); // squash for spin
  return (
    <div className="pointer-events-none absolute top-[24%] left-1/2 z-20 -translate-x-1/2 text-center">
      <div className="font-display text-2xl font-light tracking-[0.2em] text-cyan-50 drop-shadow-[0_0_22px_rgba(140,230,255,0.8)] sm:text-3xl">
        {stats.trick}
      </div>
      <div className="relative mx-auto mt-3 h-20 w-20">
        <svg viewBox="0 0 80 80" className="h-full w-full" style={{ filter: `drop-shadow(0 0 8px ${glow})` }}>
          {/* safe zone arc at the bottom = upright */}
          <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
          <path d="M 18 60 A 30 30 0 0 0 62 60" fill="none" stroke="rgba(255,216,138,0.45)" strokeWidth="3" strokeLinecap="round" />
          {/* the board */}
          <g transform={`rotate(${a} 40 40)`}>
            <line
              x1={40 - 24 * spinK}
              y1="40"
              x2={40 + 24 * spinK}
              y2="40"
              stroke={color}
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle cx={40 + 24 * spinK} cy="40" r="3.2" fill={color} />
            <line x1="40" y1="40" x2="40" y2="22" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.8" />
          </g>
        </svg>
      </div>
      <div
        className={`mt-1 text-[10px] font-semibold tracking-[0.4em] uppercase transition-opacity ${soon ? 'opacity-100' : 'opacity-60'}`}
        style={{ color }}
      >
        {st === 'perfect' ? 'perfect ✦' : st === 'clean' ? 'aman' : 'tegakkan!'}
      </div>
      {stats.plan !== 'none' && (
        <div className="mt-1 text-[8px] font-semibold tracking-[0.32em] text-cyan-100/75 uppercase">
          {stats.plan === 'build'
            ? stats.autoOn
              ? '✦ auto freestyle'
              : 'freestyle'
            : stats.plan === 'finish'
              ? 'mempercepat → mendarat pas'
              : 'kembali ke normal'}
        </div>
      )}
      {stats.airJumpsMax > 0 && (
        <div className="mt-2 flex items-center justify-center gap-[6px]">
          {Array.from({ length: stats.airJumpsMax }).map((_, i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full border border-cyan-100/70 transition"
              style={{
                background: i < stats.airJumpsLeft ? '#bfe8ff' : 'transparent',
                boxShadow: i < stats.airJumpsLeft ? '0 0 8px rgba(160,225,255,0.9)' : 'none',
              }}
            />
          ))}
          <span className="ml-1 text-[8px] tracking-[0.3em] text-cyan-100/60 uppercase">space lagi = air jump</span>
        </div>
      )}
      <div className="tnum mt-1 text-[9px] tracking-[0.4em] text-cyan-100/55 uppercase">
        {stats.airTime.toFixed(1)}s
      </div>
      {stats.airFlash > 0 && (
        <div
          className="absolute top-1/2 left-1/2 -z-10 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            opacity: stats.airFlash * 0.6,
            transform: `translate(-50%,-50%) scale(${1.6 - stats.airFlash * 0.6})`,
            border: '2px solid rgba(190,232,255,0.8)',
          }}
        />
      )}
    </div>
  );
}

export function Popups({ items }: { items: PopupEvent[] }) {
  const tone: Record<PopupEvent['tone'], string> = {
    gold: 'text-sand-50 drop-shadow-[0_0_24px_rgba(255,190,110,0.9)]',
    cyan: 'text-cyan-50 drop-shadow-[0_0_24px_rgba(140,230,255,0.9)]',
    rose: 'text-rose-100 drop-shadow-[0_0_24px_rgba(255,150,150,0.85)]',
  };
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[44%] z-20">
      {items.map((p) => (
        <div
          key={p.id}
          className="anim-pop absolute left-1/2 w-full text-center"
          style={{ top: `${(p.id % 3) * -6}px` }}
        >
          <div className={`font-display text-4xl font-light tracking-[0.14em] ${tone[p.tone]}`}>{p.text}</div>
          {p.sub && (
            <div className="mt-1 text-[11px] font-semibold tracking-[0.4em] text-sand-50/80 uppercase">{p.sub}</div>
          )}
        </div>
      ))}
    </div>
  );
}

const KEYS: [string, string][] = [
  ['KLIK KIRI', 'FREESTYLE otomatis — tiap klik gaya beda, acak adil tanpa terlewat'],
  ['KLIK KANAN / SPACE', 'lompat · lagi di udara = AIR JUMP · tahan = flip'],
  ['Q / E', 'manuver mengelak kilat kiri / kanan (hindari batu)'],
  ['S / ↓', 'AUTO frontflip · mendarat pas otomatis'],
  ['E', 'AUTO backflip (saat di udara)'],
  ['F', 'AUTO combo skate (flip pedang + grab)'],
  ['J K L I U O', 'flip pedang: kickflip · heel · tre · shuv · impossible · laser'],
  ['Z X C V B G', 'grab: indy · method · melon · stalefish · superman · christ'],
  ['A / D', 'carve · spin di udara'],
  ['SHIFT', 'boost · GRAB di udara'],
  ['W / ↑', 'air jump juga (pakai 10 flow)'],
  ['1 / 2 / 3 / 4', 'kamera: klasik · SEKIRO third-person · sinematik · BODYCAM'],
  ['V', 'ganti MODE LOMPATAN: Rendah (Menempel Pasir) ⇄ Tinggi (Melayang Bebas)'],
  ['DRAG · SCROLL', 'semua mode: drag = sudut kamera · scroll = zoom'],
  ['R · T', 'run baru · setting'],
];

/** Overlay bodycam: sudut bingkai + REC + baterai (dari shield) — pure DOM. */
function BodycamOverlay({ stats }: { stats: HudStats }) {
  const t = Math.max(0, stats.runTime);
  const mm = String(Math.floor(t / 60)).padStart(2, '0');
  const ss = String(Math.floor(t % 60)).padStart(2, '0');
  const bat = Math.max(0, Math.round((stats.shield / Math.max(1, stats.maxShield)) * 100));
  const corner = 'absolute h-7 w-7 border-sand-50/70';
  return (
    <div className="pointer-events-none absolute inset-0 z-10 font-mono">
      <div className={`${corner} top-4 left-4 rounded-tl-md border-t-2 border-l-2`} />
      <div className={`${corner} top-4 right-4 rounded-tr-md border-t-2 border-r-2`} />
      <div className={`${corner} bottom-4 left-4 rounded-bl-md border-b-2 border-l-2`} />
      <div className={`${corner} bottom-4 right-4 rounded-br-md border-b-2 border-r-2`} />
      <div className="absolute top-[4.6rem] right-9 flex items-center gap-2 text-[11px] tracking-[0.18em] text-sand-50/90">
        <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.9)]" />
        REC {mm}:{ss}
        <span className="ml-2 text-sand-50/60">BAT {bat}%</span>
      </div>
      <div className="absolute bottom-[4.2rem] right-9 text-[9px] tracking-[0.26em] text-sand-50/50">
        BODYCAM V1 · 1080p60
      </div>
    </div>
  );
}

export function StartScreen({
  best,
  onBegin,
  onTune,
  feel,
  onFeel,
  light,
  onLight,
  bloom,
  onBloom,
  palette,
  onPalette,
  onApplyMaster,
}: {
  best: number;
  onBegin: () => void;
  onTune: () => void;
  feel: string;
  onFeel: (name: string) => void;
  light: string;
  onLight: (name: string) => void;
  bloom: string;
  onBloom: (name: string) => void;
  palette?: string;
  onPalette?: (idx: number) => void;
  onApplyMaster?: (name: string) => void;
}) {
  const isMasterActive = palette === 'Twilight' && light === 'Netral' && (bloom === 'Data 1 (Tinggi)' || bloom === 'Data 1');

  return (
    <div className="absolute inset-0 z-40 overflow-y-auto bg-gradient-to-b from-[#182332]/50 via-transparent to-[#10141c]/65">
      <div className="anim-rise mx-auto flex min-h-full flex-col items-center justify-center px-6 py-10 text-center">
        <div className="mb-4 text-[10px] font-semibold tracking-[0.5em] text-cyan-200/90 uppercase">
          MISI DOWNHILL · TURUN GUNUNG MEGA AMAN
        </div>
        <h1 className="title-sheen font-display text-6xl leading-[0.92] font-light tracking-tight sm:text-8xl">
          Sword
          <span className="mx-3 italic opacity-80">of the</span>
          Sea
        </h1>
        <p className="mt-5 max-w-lg text-[13px] leading-relaxed font-light text-sand-100/90">
          Meluncur menuruni gunung mega raksasa yang lembut dengan aman ala Alto's Odyssey dalam 3D! Manfaatkan gundukan pelontar untuk lompatan tinggi, kumpulkan Kristal Surya pemulih perisai, meluncur di jalur akselerasi kilat, dan hindari rintangan batu serta jurang ngarai.
        </p>

        {/* feel + lighting + biome presets, right on the title screen */}
        <div className="mt-7 w-full max-w-2xl">
          {/* Master 1-Click Preset: Twilight + Netral + Bloom Data 1 (Tinggi) */}
          <div className="mb-6 rounded-2xl border border-amber-300/40 bg-gradient-to-r from-purple-900/40 via-amber-900/30 to-rose-900/40 p-4 text-left shadow-lg backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-400/25 px-2.5 py-[3px] text-[8px] font-bold tracking-[0.2em] text-amber-200 uppercase">
                    ✨ Mode Preset Khusus
                  </span>
                  <span className="font-display text-[17px] font-semibold text-sand-50">
                    Twilight Netral (Data 1 Tinggi)
                  </span>
                </div>
                <div className="mt-1 text-[8.5px] leading-relaxed text-sand-200/80">
                  Langit Twilight (Ungu Senja) · Pencahayaan Netral · Bloom Data 1 (Silau 65%, Bloom 126%, Exposure 160%)
                </div>
              </div>
              <button
                onClick={() => onApplyMaster?.('Twilight Netral (Data 1 Tinggi)')}
                className={`rounded-xl px-5 py-2.5 font-display text-[15px] font-bold tracking-wider uppercase transition shrink-0 ${
                  isMasterActive
                    ? 'border border-amber-300 bg-amber-300 text-stone-900 shadow-[0_0_20px_rgba(255,200,100,0.7)]'
                    : 'border border-amber-200/40 bg-white/15 text-sand-50 hover:bg-white/25 active:scale-95'
                }`}
              >
                {isMasterActive ? '✓ Aktif Sekarang' : 'Terapkan Preset'}
              </button>
            </div>
          </div>

          {/* Biome selector */}
          {onPalette && (
            <div className="mb-5">
              <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.36em] text-sand-200/70">
                puncak alam (mega biome & langit)
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PALETTES.map((p, idx) => {
                  const icons: Record<string, string> = {
                    'Pasir Gurun Dulu': '🏜️ Pasir Gurun',
                    'Salju Mega': '❄️ Salju Abadi',
                    'Rumput Hijau Indah': '🌿 Padang Hijau',
                    'Ember': '🔥 Ember Senja',
                    'Noon': '☀️ Siang Terik',
                    'Twilight': '🌆 Twilight (Senja)',
                    'Moonlit': '🌙 Bulan Purnama',
                  };
                  return (
                    <button
                      key={p.name}
                      onClick={() => onPalette(idx)}
                      className={`rounded-xl border px-3 py-2.5 transition text-left ${
                        palette === p.name
                          ? 'border-cyan-300/90 bg-cyan-400/20 shadow-[0_0_16px_rgba(100,210,255,0.35)]'
                          : 'border-sand-200/25 bg-black/25 hover:border-sand-200/60'
                      }`}
                    >
                      <div className="font-display text-[14px] leading-tight text-sand-50">
                        {icons[p.name] || p.name}
                      </div>
                      <div className="mt-1 text-[7px] uppercase tracking-[0.08em] text-sand-200/60">
                        {p.name === 'Twilight' ? 'Langit Ungu Senja' : p.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.36em] text-sand-200/60">
            rasa melayang
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {FEEL_PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => onFeel(p.name)}
                className={`rounded-xl border px-2 py-2 transition ${
                  feel === p.name
                    ? 'border-sand-100/90 bg-white/15'
                    : 'border-sand-200/25 bg-black/20 hover:border-sand-200/60'
                }`}
                title={p.desc}
              >
                <div className="font-display text-[15px] leading-none">{p.name}</div>
                <div className="mt-1 text-[6.5px] leading-tight uppercase tracking-[0.08em] text-sand-200/55">
                  {p.desc}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 mb-2 text-[9px] font-semibold uppercase tracking-[0.36em] text-sand-200/60">
            tingkat bloom / silau
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {BLOOM_PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => onBloom(p.name)}
                className={`rounded-xl border px-2 py-2 transition ${
                  bloom === p.name
                    ? 'border-sand-100/90 bg-white/20 shadow-[0_0_12px_rgba(255,255,255,0.3)]'
                    : 'border-sand-200/25 bg-black/20 hover:border-sand-200/60'
                }`}
                title={p.desc}
              >
                <div className="font-display text-[15px] leading-none">
                  {p.name === 'Data 1 (Tinggi)' ? '⚡ Data 1 (Tinggi)' : p.name === 'Data 1' ? '✨ Data 1' : p.name}
                </div>
                <div className="mt-1 text-[6.5px] leading-tight uppercase tracking-[0.06em] text-sand-200/55">
                  {p.name.startsWith('Data 1') ? 'Silau 65% · Bloom 126%' : p.desc}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 mb-2 text-[9px] font-semibold uppercase tracking-[0.36em] text-sand-200/60">
            pencahayaan
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {LIGHT_PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => onLight(p.name)}
                className={`rounded-xl border px-2 py-2 transition ${
                  light === p.name
                    ? 'border-sand-100/90 bg-white/15'
                    : 'border-sand-200/25 bg-black/20 hover:border-sand-200/60'
                }`}
                title={p.desc}
              >
                <div className="font-display text-[15px] leading-none">{p.name}</div>
                <div className="mt-1 text-[6.5px] leading-tight uppercase tracking-[0.08em] text-sand-200/55">
                  {p.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-7 flex items-center gap-4">
          <button
            onClick={onBegin}
            className="anim-ring group flex items-center gap-3 rounded-full border border-sand-200/50 bg-sand-50/95 px-10 py-4 text-sand-900 transition hover:scale-[1.04] active:scale-95"
          >
            <span className="text-[13px] font-semibold tracking-[0.42em] uppercase">ride</span>
            <span className="text-lg transition group-hover:translate-x-1">→</span>
          </button>
          <button
            onClick={onTune}
            className="glass rounded-full px-6 py-4 text-[11px] font-semibold tracking-[0.3em] text-sand-50 uppercase transition hover:scale-105 active:scale-95"
          >
            setting
          </button>
        </div>
        <div className="mt-4 text-[10px] tracking-[0.34em] text-sand-200/60 uppercase">press space to ride</div>

        <div className="mt-10 grid w-full max-w-lg grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {KEYS.map(([k, d]) => (
            <div key={k} className="flex items-center justify-between gap-3 border-b border-sand-200/15 pb-2">
              <span className="rounded-md border border-sand-200/30 bg-black/20 px-2 py-[3px] text-[10px] font-semibold tracking-[0.16em] text-sand-50">
                {k}
              </span>
              <span className="text-[11px] font-light text-sand-100/75">{d}</span>
            </div>
          ))}
        </div>

        {best > 0 && (
          <div className="mt-8 text-[10px] tracking-[0.4em] text-sand-200/60 uppercase">best {fmt(best)}</div>
        )}
      </div>
    </div>
  );
}

export function GameOver({
  stats,
  onRestart,
  onTune,
}: {
  stats: HudStats;
  onRestart: () => void;
  onTune: () => void;
}) {
  const record = stats.distance >= stats.bestDist - 0.5 && stats.distance > 50;
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-[#12080a]/65 backdrop-blur-[3px]"
      style={{ animation: 'riseIn 700ms 0.8s cubic-bezier(0.22,1,0.36,1) both' }}
    >
      <div className="glass flex w-[min(420px,92vw)] flex-col items-center rounded-3xl px-8 py-8 text-center border border-sand-200/20 shadow-2xl">
        <div className="text-[11px] font-bold tracking-[0.4em] text-rose-200 uppercase">
          {stats.overReason === 'wall' ? '💥 Menabrak Rintangan Lereng' : '▼ Jatuh ke Jurang Gunung'}
        </div>
        <div className="mt-1 text-[9px] font-medium tracking-[0.25em] text-cyan-200/80">
          Sektor: {stats.sectorName}
        </div>

        <div className="mt-4 text-[9px] tracking-[0.4em] text-sand-200/60 uppercase">jarak tempuh downhill</div>
        <div className="tnum font-display text-6xl leading-none font-light text-sand-50">
          {fmt(stats.distance)}
          <span className="ml-1 text-2xl text-sand-200/70">m</span>
        </div>
        {record ? (
          <div className="mt-2 text-[10px] font-semibold tracking-[0.36em] text-amber-200 uppercase">✦ Rekor Downhill Baru ✦</div>
        ) : (
          <div className="mt-2 text-[10px] tracking-[0.3em] text-sand-200/60 uppercase">
            terjauh {fmt(stats.bestDist)} m
          </div>
        )}

        <div className="mt-5 grid w-full grid-cols-3 gap-2 border-t border-sand-200/15 pt-4 text-center">
          <div>
            <div className="text-[8px] tracking-[0.2em] text-sand-200/60 uppercase">Altitude</div>
            <div className="tnum font-display text-xl font-light text-cyan-200">-{Math.round(stats.altitudeDrop)}m</div>
          </div>
          <div>
            <div className="text-[8px] tracking-[0.2em] text-sand-200/60 uppercase">Kristal</div>
            <div className="tnum font-display text-xl font-light text-amber-200">✦ {stats.crystalsCollected}</div>
          </div>
          <div>
            <div className="text-[8px] tracking-[0.2em] text-sand-200/60 uppercase">Skor</div>
            <div className="tnum font-display text-xl font-light text-sand-50">{fmt(stats.score)}</div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onRestart}
            className="anim-ring rounded-full bg-sand-50 px-8 py-3 text-[11px] font-semibold tracking-[0.34em] text-sand-900 uppercase transition hover:scale-105 active:scale-95"
          >
            turun lagi
          </button>
          <button
            onClick={onTune}
            className="rounded-full border border-sand-200/40 px-5 py-3 text-[11px] font-semibold tracking-[0.3em] text-sand-50 uppercase transition hover:scale-105 active:scale-95"
          >
            setting
          </button>
        </div>
        <div className="mt-4 text-[9px] tracking-[0.3em] text-sand-200/45 uppercase">space untuk ulang</div>
      </div>
    </div>
  );
}

export function PauseOverlay({
  onResume,
  onRestart,
  onTune,
  score,
}: {
  onResume: () => void;
  onRestart: () => void;
  onTune: () => void;
  score: number;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#1a0d05]/60 backdrop-blur-[3px]">
      <div className="anim-rise glass flex flex-col items-center rounded-3xl px-12 py-10 text-center">
        <div className="text-[10px] tracking-[0.5em] text-sand-200/70 uppercase">paused</div>
        <div className="tnum font-display mt-3 text-5xl font-light">{fmt(score)}</div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={onResume}
            className="rounded-full bg-sand-50 px-6 py-3 text-[11px] font-semibold tracking-[0.3em] text-sand-900 uppercase transition hover:scale-105 active:scale-95"
          >
            resume
          </button>
          <button
            onClick={onTune}
            className="rounded-full border border-sand-200/40 px-6 py-3 text-[11px] font-semibold tracking-[0.3em] text-sand-50 uppercase transition hover:scale-105 active:scale-95"
          >
            look &amp; feel
          </button>
          <button
            onClick={onRestart}
            className="rounded-full border border-sand-200/40 px-6 py-3 text-[11px] font-semibold tracking-[0.3em] text-sand-50 uppercase transition hover:scale-105 active:scale-95"
          >
            new run
          </button>
        </div>
        <div className="mt-6 text-[10px] tracking-[0.3em] text-sand-200/50 uppercase">esc to resume</div>
      </div>
    </div>
  );
}

export function TouchControls({
  onJump,
  onJumpUp,
  onBoost,
  onAirJump,
  onGrab,
  onFront,
  onCombo,
  onBoardFlip,
  onDashLeft,
  onDashRight,
  onSteerLeft,
  onSteerRight,
  airborne,
  flow,
}: {
  onBoardFlip: () => void;
  onJump: () => void;
  onJumpUp: () => void;
  onBoost: (on: boolean) => void;
  onAirJump: () => void;
  onGrab: (on: boolean) => void;
  onFront: (on: boolean) => void;
  onCombo: () => void;
  onDashLeft?: () => void;
  onDashRight?: () => void;
  onSteerLeft?: (on: boolean) => void;
  onSteerRight?: (on: boolean) => void;
  airborne: boolean;
  flow: number;
}) {
  const hold = (on?: (v: boolean) => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      on?.(true);
    },
    onPointerUp: () => on?.(false),
    onPointerLeave: () => on?.(false),
    onPointerCancel: () => on?.(false),
  });
  return (
    <div className="absolute inset-x-0 bottom-24 z-30 flex items-end justify-between px-5">
      <div className="flex flex-col gap-3">
        {/* Responsive Steer Controls for Touch */}
        <div className="flex gap-2">
          <button
            {...hold(onSteerLeft)}
            className="glass flex h-14 w-16 items-center justify-center rounded-2xl text-[11px] font-bold tracking-wider text-sand-100 transition active:scale-95 active:bg-cyan-400/30 active:text-cyan-200"
            title="Belok Kiri"
          >
            ◀ KIRI
          </button>
          <button
            {...hold(onSteerRight)}
            className="glass flex h-14 w-16 items-center justify-center rounded-2xl text-[11px] font-bold tracking-wider text-sand-100 transition active:scale-95 active:bg-cyan-400/30 active:text-cyan-200"
            title="Belok Kanan"
          >
            KANAN ▶
          </button>
        </div>

        <button
          {...hold(airborne ? onGrab : onBoost)}
          className="glass flex h-16 w-16 flex-col items-center justify-center rounded-full active:scale-95"
        >
          <span className="text-[9px] font-semibold tracking-[0.16em] uppercase">{airborne ? 'grab' : 'boost'}</span>
          {!airborne && <span className="tnum mt-[2px] text-[9px] text-sand-200/70">{Math.round(flow)}%</span>}
        </button>
        <div className="flex gap-2">
          <button
            {...hold(onFront)}
            className="glass flex h-14 w-14 flex-col items-center justify-center rounded-full transition active:scale-95"
          >
            <span className="text-[8px] font-semibold tracking-[0.1em] uppercase">front</span>
            <span className="text-[6px] tracking-[0.1em] text-cyan-100/70 uppercase">auto</span>
          </button>
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCombo();
            }}
            className="glass flex h-14 w-14 flex-col items-center justify-center rounded-full transition active:scale-95"
          >
            <span className="text-[8px] font-semibold tracking-[0.1em] uppercase">combo</span>
            <span className="text-[6px] tracking-[0.1em] text-cyan-100/70 uppercase">auto</span>
          </button>
        </div>
        {/* Evade / Dash Buttons */}
        <div className="flex gap-2">
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDashLeft?.();
            }}
            className="glass flex h-11 w-14 items-center justify-center rounded-xl text-[10px] font-bold text-sand-200 transition active:scale-95"
            title="Mengelak Kiri"
          >
            ◀ ELAK
          </button>
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDashRight?.();
            }}
            className="glass flex h-11 w-14 items-center justify-center rounded-xl text-[10px] font-bold text-sand-200 transition active:scale-95"
            title="Mengelak Kanan"
          >
            ELAK ▶
          </button>
        </div>
      </div>
      <div className="flex items-end gap-3">
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onBoardFlip();
          }}
          className="glass flex h-16 w-16 flex-col items-center justify-center rounded-full transition active:scale-95"
        >
          <span className="text-[9px] font-semibold tracking-[0.14em] uppercase">flip</span>
          <span className="text-[6px] tracking-[0.1em] text-cyan-100/70 uppercase">pedang</span>
        </button>
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAirJump();
          }}
          className={`glass flex h-16 w-16 items-center justify-center rounded-full transition active:scale-95 ${airborne ? 'opacity-100' : 'opacity-40'}`}
        >
          <span className="text-[9px] font-semibold tracking-[0.14em] uppercase">air</span>
        </button>
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onJump();
          }}
          onPointerUp={onJumpUp}
          onPointerLeave={onJumpUp}
          onPointerCancel={onJumpUp}
          className="glass flex h-24 w-24 flex-col items-center justify-center rounded-full active:scale-95"
        >
          <span className="text-[11px] font-semibold tracking-[0.24em] uppercase">jump</span>
          <span className="mt-1 text-[7px] tracking-[0.14em] text-sand-200/60 uppercase">tahan = flip</span>
        </button>
      </div>
    </div>
  );
}


