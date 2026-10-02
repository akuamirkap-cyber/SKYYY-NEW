import { useEffect, useState } from 'react';
import { PALETTES } from '../game/palette';
import {
  AIR_PRESETS,
  BLOOM_PRESETS,
  CAM_PRESETS,
  DEFAULT_TUNE,
  FEEL_PRESETS,
  FOG_PRESETS,
  LIGHT_PRESETS,
  MASTER_PRESETS,
  SWORD_SKINS,
  WORLD_PRESETS,
  type Tune,
} from '../game/tune';
import { ETHEREAL_SKINS, SCARF_COLORS } from '../game/scarf';
import { ACCENT_METALS, CRYSTAL_SKINS } from '../game/crystal';
import { BOARD_TRICKS, GRABS } from '../game/tricks';
import { WATER_PALETTES } from '../game/river';

const BODY_PRESETS = [
  { name: 'Cebol', desc: 'proporsi pas & ramping', v: { bodyHeight: 0.55, headSize: 1.0 } },
  { name: 'Pendek', desc: 'mungil, atletis & lincah', v: { bodyHeight: 0.78, headSize: 1.0 } },
  { name: 'Normal', desc: 'proporsi dewasa (default) ala Silver Surfer', v: { bodyHeight: 1, headSize: 1 } },
];

type Tab = 'feel' | 'move' | 'air' | 'book' | 'bloom' | 'light' | 'fog' | 'world' | 'water' | 'sky' | 'scarf' | 'grade' | 'cam' | 'fx';

const TABS: [Tab, string][] = [
  ['feel', 'Hover'],
  ['move', 'Gerakan'],
  ['air', 'Udara & Trik'],
  ['book', 'Buku Trik'],
  ['bloom', 'Bloom'],
  ['light', 'Cahaya'],
  ['fog', 'Kabut'],
  ['world', 'Dunia'],
  ['sky', 'Langit & Paus'],
  ['scarf', 'Karakter & Slayer'],
  ['grade', 'Warna'],
  ['cam', 'Kamera'],
  ['fx', 'Efek'],
];

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  fmt,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
}) {
  return (
    <label className="block py-[7px]">
      <div className="mb-[5px] flex items-baseline justify-between gap-3">
        <span className="text-[9px] font-semibold uppercase tracking-[0.26em] text-sand-200/80">{label}</span>
        <span className="tnum text-[10px] font-light text-sand-100/75">
          {fmt ? fmt(value) : `${Math.round(value * 100)}%`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="slider w-full"
      />
      {hint && <div className="mt-1 text-[8px] uppercase tracking-[0.16em] text-sand-200/35">{hint}</div>}
    </label>
  );
}

function ColorPick({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center justify-between gap-3 py-[6px] ${disabled ? 'opacity-40' : ''}`}>
      <span>
        <span className="block text-[9px] font-semibold uppercase tracking-[0.26em] text-sand-200/80">{label}</span>
        {hint && <span className="block text-[8px] uppercase tracking-[0.14em] text-sand-200/35">{hint}</span>}
      </span>
      <span className="relative h-8 w-14 shrink-0 overflow-hidden rounded-lg border border-sand-200/40">
        <span className="absolute inset-0" style={{ background: value }} />
        <input
          type="color"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </span>
    </label>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="mt-2 flex w-full items-center justify-between rounded-xl border border-sand-200/20 bg-black/15 px-3 py-2 transition hover:border-sand-200/45"
    >
      <span className="text-[9px] font-semibold uppercase tracking-[0.26em] text-sand-200/80">{label}</span>
      <span className={`relative h-4 w-8 rounded-full transition ${on ? 'bg-sand-200/90' : 'bg-sand-200/25'}`}>
        <span
          className={`absolute top-[2px] h-3 w-3 rounded-full bg-[#2a1a0c] transition-all ${on ? 'left-[18px]' : 'left-[2px]'}`}
        />
      </span>
    </button>
  );
}

/**
 * Always-available quick glare control. A floating ☀ button opens a
 * compact panel so glare can be fixed instantly, mid-ride.
 */
export function QuickGlare({ tune, onChange }: { tune: Tune; onChange: (t: Partial<Tune>) => void }) {
  const [open, setOpen] = useState(false);
  const [l, setL] = useState(tune);
  useEffect(() => setL(tune), [tune]);
  const set = (patch: Partial<Tune>) => {
    setL((s) => ({ ...s, ...patch }));
    onChange(patch);
  };

  return (
    <div className="absolute top-16 right-5 z-[45] flex flex-col items-end sm:top-[76px] sm:right-8">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`glass flex h-9 items-center gap-2 rounded-full px-3 text-[9px] font-semibold uppercase tracking-[0.22em] text-sand-50 transition hover:scale-105 active:scale-95 ${
          open ? 'bg-white/25' : ''
        }`}
        title="atur silau / bloom"
      >
        <span className="text-[13px]">☀</span> silau
      </button>
      {open && (
        <div className="anim-rise glass mt-2 w-[min(340px,92vw)] rounded-2xl px-4 py-3">
          <div className="mb-2 grid grid-cols-3 sm:grid-cols-5 gap-1">
            {BLOOM_PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => set(p.values)}
                className={`rounded-lg border border-sand-200/25 bg-black/20 px-1 py-[6px] text-[8px] font-semibold uppercase leading-tight tracking-[0.06em] transition hover:border-sand-100/70 ${
                  p.name === 'Data 1' ? 'border-amber-300/60 bg-amber-400/15 text-amber-200' : ''
                }`}
              >
                {p.name === 'Data 1' ? '✨ Data 1' : p.name}
              </button>
            ))}
          </div>
          <Slider
            label="tingkat silau (master)"
            hint="satu slider untuk semua sumber cahaya terang"
            value={l.glare}
            min={0}
            max={1.5}
            onChange={(v) => set({ glare: v })}
          />
          <Slider label="bloom" value={l.bloom} min={0} max={2.2} onChange={(v) => set({ bloom: v })} />
          <Slider
            label="ambang bloom"
            value={l.bloomThreshold}
            min={-0.3}
            max={0.8}
            onChange={(v) => set({ bloomThreshold: v })}
            fmt={(v) => v.toFixed(2)}
          />
          <Slider
            label="redam putih terang"
            hint="menekan area putih yang menyilaukan"
            value={l.highlights}
            min={0}
            max={1}
            onChange={(v) => set({ highlights: v })}
          />
          <Slider
            label="bulatan matahari"
            value={l.sunDisc}
            min={0}
            max={1.5}
            onChange={(v) => set({ sunDisc: v })}
          />
          <Slider
            label="objek bersinar"
            value={l.emissive}
            min={0}
            max={1.5}
            onChange={(v) => set({ emissive: v })}
          />
          <Slider
            label="pencahayaan pedang skate"
            hint="redupkan atau sesuaikan pendar bilah pedang"
            value={l.swordGlow ?? 0.22}
            min={0}
            max={1.5}
            step={0.01}
            onChange={(v) => set({ swordGlow: v })}
            fmt={(v) => (v < 0.05 ? 'mati' : v < 0.25 ? 'kecil / sejuk' : v < 0.6 ? 'sedang' : 'terang')}
          />
          <Slider label="exposure" value={l.exposure} min={0.6} max={1.6} onChange={(v) => set({ exposure: v })} />
        </div>
      )}
    </div>
  );
}

export function SettingsPanel({
  open,
  tune,
  onChange,
  onClose,
  onTeleport,
}: {
  open: boolean;
  tune: Tune;
  onChange: (t: Partial<Tune>) => void;
  onClose: () => void;
  onTeleport?: () => void;
}) {
  const [tab, setTab] = useState<Tab>('feel');
  const [l, setL] = useState(tune);
  useEffect(() => setL(tune), [tune]);
  if (!open) return null;

  const set = (patch: Partial<Tune>) => {
    setL((s) => ({ ...s, ...patch }));
    onChange(patch);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#150a04]/55 px-3 backdrop-blur-[3px]">
      <div className="anim-rise glass flex max-h-[94vh] w-[min(430px,96vw)] flex-col rounded-3xl">
        {/* header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-3">
          <div>
            <div className="text-[9px] uppercase tracking-[0.5em] text-sand-200/60">tune everything</div>
            <h2 className="font-display text-3xl leading-none font-light">Look &amp; Feel</h2>
          </div>
          <button
            onClick={onClose}
            className="glass flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sand-50 transition hover:scale-105"
          >
            ✕
          </button>
        </div>

        {/* tabs */}
        <div className="grid grid-cols-4 gap-1 px-4 sm:grid-cols-6">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-lg px-1 py-2 text-[8.5px] leading-tight font-semibold uppercase tracking-[0.12em] transition ${
                tab === id ? 'bg-sand-50/90 text-sand-900' : 'text-sand-200/60 hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Master Preset Banner: Twilight Netral (Data 1) */}
        <div className="mx-4 mt-2.5 mb-1 flex items-center justify-between gap-2 rounded-xl border border-amber-300/40 bg-gradient-to-r from-purple-950/70 via-amber-950/50 to-rose-950/60 p-2.5 shadow-sm">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-amber-400/25 px-2 py-[2px] text-[7.5px] font-bold tracking-[0.18em] text-amber-200 uppercase">
                ✨ Preset Pilihan
              </span>
              <span className="font-display text-[13.5px] font-semibold text-sand-50 truncate">
                Twilight Netral (Data 1)
              </span>
            </div>
            <div className="text-[7.5px] text-sand-200/70 truncate">
              Langit Twilight · Cahaya Netral · Bloom Data 1 (Silau 65%, Bloom 126%)
            </div>
          </div>
          <button
            onClick={() => set(MASTER_PRESETS[0].values)}
            className="rounded-lg border border-amber-300/60 bg-amber-300/25 hover:bg-amber-300/40 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-amber-100 transition shrink-0 active:scale-95 shadow-xs"
          >
            Aktifkan
          </button>
        </div>

        {/* body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-3 pb-6">
          {tab === 'feel' && (
            <>
              <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                preset feel — sekali klik
              </div>
              <div className="grid grid-cols-3 gap-2">
                {FEEL_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => set(p.values)}
                    className="rounded-xl border border-sand-200/25 bg-black/20 px-2 py-2 text-left transition hover:border-sand-100/70 hover:bg-white/10"
                  >
                    <div className="font-display text-[15px] leading-none">{p.name}</div>
                    <div className="mt-1 text-[7px] leading-tight uppercase tracking-[0.1em] text-sand-200/55">
                      {p.desc}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-5 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                melayang / hover
              </div>
              <Slider
                label="ride height"
                hint="seberapa jauh pisau melayang di atas pasir"
                value={l.rideHeight}
                min={0.15}
                max={1.8}
                onChange={(v) => set({ rideHeight: v })}
                fmt={(v) => v.toFixed(2)}
              />
              <Slider
                label="softness"
                hint="kelembutan suspensi — tinggi = floaty & memantul"
                value={l.softness}
                min={0.5}
                max={2.2}
                onChange={(v) => set({ softness: v })}
                fmt={(v) => (v < 0.9 ? 'kaku' : v < 1.4 ? 'seimbang' : v < 1.9 ? 'lembut' : 'sangat floaty')}
              />
              <Slider
                label="kehalusan kontur"
                hint="radius penghalusan permukaan — tinggi = gunung kasar pun terasa mulus"
                value={l.bumpFilter}
                min={0}
                max={4}
                onChange={(v) => set({ bumpFilter: v })}
                fmt={(v) =>
                  `${(1.5 + v * 4.5).toFixed(0)} m · ${v < 0.8 ? 'ikut pasir' : v < 2 ? 'halus' : v < 3 ? 'sangat halus' : 'sutra'}`
                }
              />
              <Slider
                label="tilt"
                hint="seberapa kuat pisau miring mengikuti dune"
                value={l.tilt}
                min={0}
                max={2}
                onChange={(v) => set({ tilt: v })}
              />
              <Slider
                label="tilt smoothing"
                hint="kecepatan reaksi kemiringan — rendah = sangat luwes"
                value={l.tiltSmooth}
                min={0.35}
                max={2.2}
                onChange={(v) => set({ tiltSmooth: v })}
                fmt={(v) => (v < 0.8 ? 'sangat luwes' : v < 1.4 ? 'natural' : 'responsif')}
              />
              <Slider
                label="glide / anticipation"
                hint="hidung pisau menunduk sebelum turun & terangkat saat naik"
                value={l.glide}
                min={0}
                max={2.2}
                onChange={(v) => set({ glide: v })}
              />

              <div className="mt-5 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                menanjak
              </div>
              <Slider
                label="tenaga tanjakan"
                hint="100% = naik bukit securam apa pun tanpa melambat"
                value={l.climb}
                min={0}
                max={1}
                onChange={(v) => set({ climb: v })}
                fmt={(v) => (v < 0.3 ? 'realistis' : v < 0.75 ? 'dibantu' : 'kuat')}
              />
              <Slider
                label="kecepatan minimum"
                hint="kamu tidak akan pernah melambat di bawah ini"
                value={l.minSpeed}
                min={0}
                max={60}
                step={1}
                onChange={(v) => set({ minSpeed: v })}
                fmt={(v) => `${Math.round(v * 2.1)} km/h`}
              />
            </>
          )}

          {tab === 'sky' && (
            <>
              <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                palet warna langit
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {PALETTES.map((p, i) => (
                  <button
                    key={p.name}
                    onClick={() => set({ palette: i })}
                    className={`relative h-16 overflow-hidden rounded-xl border transition ${
                      l.palette === i ? 'border-sand-100/90' : 'border-sand-200/20 hover:border-sand-200/50'
                    }`}
                  >
                    <span
                      className="absolute inset-0"
                      style={{
                        background: `linear-gradient(to bottom, ${p.skyTop} 0%, ${p.skyMid} 42%, ${p.skyHor} 72%, ${p.skyLow} 100%)`,
                      }}
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-black/50 py-[2px] text-[6.5px] uppercase tracking-[0.08em] text-white/90">
                      {p.name}
                    </span>
                  </button>
                ))}
              </div>
              <Toggle label="putar waktu otomatis" on={l.cycle} onChange={(v) => set({ cycle: v })} />
              <Slider
                label="aurora ✦"
                hint="tirai cahaya polar — warnanya otomatis menyesuaikan palet langit"
                value={l.aurora}
                min={0}
                max={2}
                onChange={(v) => set({ aurora: v })}
                fmt={(v) => (v === 0 ? 'mati' : v < 0.8 ? 'samar' : v < 1.4 ? 'normal' : 'gemilang')}
              />

              <div className="mt-6 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                🐋 paus langit
              </div>
              <Slider
                label="jumlah paus"
                value={l.whales}
                min={0}
                max={6}
                step={1}
                onChange={(v) => set({ whales: v })}
                fmt={(v) => (v === 0 ? 'tidak ada' : `${v} ekor`)}
              />
              <Slider
                label="ukuran"
                hint="seberapa raksasa paus di langit"
                value={l.whaleSize}
                min={0.4}
                max={2.6}
                onChange={(v) => set({ whaleSize: v })}
                fmt={(v) => `${Math.round(60 * v)} m`}
              />
              <Slider
                label="ketinggian terbang"
                value={l.whaleHeight}
                min={0.3}
                max={2.2}
                onChange={(v) => set({ whaleHeight: v })}
              />
              <Slider
                label="kecepatan berenang"
                value={l.whaleSpeed}
                min={0.2}
                max={2.5}
                onChange={(v) => set({ whaleSpeed: v })}
              />
              <Slider
                label="cahaya tepi paus"
                hint="rim light yang membuat siluet paus bersinar"
                value={l.whaleGlow}
                min={0}
                max={2.5}
                onChange={(v) => set({ whaleGlow: v })}
              />
              <Slider
                label="kabut pada paus"
                hint="rendah = paus jelas & tajam · tinggi = samar di atmosfer"
                value={l.whaleHaze}
                min={0}
                max={2}
                onChange={(v) => set({ whaleHaze: v })}
              />
              <Toggle label="nyanyian paus" on={l.whaleSong} onChange={(v) => set({ whaleSong: v })} />

              <div className="mt-5 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                🐟 kawanan ikan
              </div>
              <Slider
                label="ikan per paus"
                hint="spiral ganda di tubuh · halo di kepala · pita di belakang ekor"
                value={l.fishCount}
                min={0}
                max={90}
                step={5}
                onChange={(v) => set({ fishCount: v })}
                fmt={(v) => (v === 0 ? 'tidak ada' : `${v} ekor`)}
              />
              <Slider
                label="ukuran ikan"
                value={l.fishSize}
                min={0.4}
                max={2.5}
                onChange={(v) => set({ fishSize: v })}
              />
              <Slider
                label="kilau ikan"
                value={l.fishGlow}
                min={0}
                max={2}
                onChange={(v) => set({ fishGlow: v })}
              />

              <div className="mt-5 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                🪽 ikan pari
              </div>
              <div className="mb-1 grid grid-cols-3 gap-2">
                {[
                  ['Formasi V', 0],
                  ['Lingkaran', 1],
                  ['Gelombang', 2],
                ].map(([name, v]) => (
                  <button
                    key={name as string}
                    onClick={() => set({ mantaFormation: v as number })}
                    className={`rounded-xl border py-2 font-display text-[14px] transition ${
                      l.mantaFormation === v
                        ? 'border-sand-100/90 bg-white/15'
                        : 'border-sand-200/25 bg-black/20 hover:border-sand-100/70'
                    }`}
                  >
                    {name as string}
                  </button>
                ))}
              </div>
              <Slider
                label="jumlah ikan pari"
                value={l.mantas}
                min={0}
                max={12}
                step={1}
                onChange={(v) => set({ mantas: v })}
                fmt={(v) => (v === 0 ? 'tidak ada' : `${v} ekor`)}
              />
              <Slider
                label="ukuran"
                value={l.mantaSize}
                min={0.5}
                max={3}
                onChange={(v) => set({ mantaSize: v })}
                fmt={(v) => `${Math.round(16 * v)} m`}
              />
              <Slider
                label="ketinggian terbang"
                value={l.mantaHeight}
                min={0.3}
                max={2.5}
                onChange={(v) => set({ mantaHeight: v })}
              />
              <Slider
                label="kecepatan"
                value={l.mantaSpeed}
                min={0.2}
                max={2.5}
                onChange={(v) => set({ mantaSpeed: v })}
              />

              <div className="mt-5 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                🐠 ikan terbang
              </div>
              <Slider
                label="seberapa sering melompat"
                hint="kawanan ikan melompat dari pasir & melayang di sampingmu"
                value={l.flyingFish}
                min={0}
                max={3}
                onChange={(v) => set({ flyingFish: v })}
                fmt={(v) => (v < 0.02 ? 'mati' : v < 0.7 ? 'jarang' : v < 1.6 ? 'sedang' : 'sering')}
              />
              <Slider
                label="ukuran ikan terbang"
                value={l.flyingFishSize}
                min={0.5}
                max={3}
                onChange={(v) => set({ flyingFishSize: v })}
              />
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  ['Sepasang', { whales: 2, whaleSize: 1.4, whaleHeight: 0.9 }],
                  ['Kawanan', { whales: 4, whaleSize: 1.6, whaleHeight: 1 }],
                  ['Leviathan', { whales: 1, whaleSize: 2.6, whaleHeight: 1.25, whaleSpeed: 0.6 }],
                ].map(([name, v]) => (
                  <button
                    key={name as string}
                    onClick={() => set(v as Partial<Tune>)}
                    className="rounded-xl border border-sand-200/25 bg-black/20 py-2 font-display text-[14px] transition hover:border-sand-100/70"
                  >
                    {name as string}
                  </button>
                ))}
              </div>
              <div className="mt-4 text-[8px] leading-relaxed uppercase tracking-[0.16em] text-sand-200/40">
                siklus otomatis menggerakkan matahari & mencampur semua mood secara kontinu: golden → noon → ember →
                twilight → moonlit
              </div>
            </>
          )}

          {tab === 'light' && (
            <>
              <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                preset pencahayaan — sekali klik
              </div>
              <div className="grid grid-cols-3 gap-2">
                {LIGHT_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => set(p.values)}
                    className="rounded-xl border border-sand-200/25 bg-black/20 px-2 py-2 text-left transition hover:border-sand-100/70 hover:bg-white/10"
                  >
                    <div className="font-display text-[15px] leading-none">{p.name}</div>
                    <div className="mt-1 text-[6.5px] leading-tight uppercase tracking-[0.1em] text-sand-200/55">
                      {p.desc}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-5 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                arah matahari
              </div>
              <Slider
                label="azimuth / putaran"
                hint="putar matahari mengelilingi dunia"
                value={l.sunAz}
                min={-3.14}
                max={3.14}
                step={0.01}
                onChange={(v) => set({ sunAz: v })}
                fmt={(v) => `${Math.round((v * 180) / Math.PI)}°`}
              />
              <Slider
                label="elevasi / ketinggian"
                hint="rendah = senja dramatis, tinggi = siang terik"
                value={l.sunEl}
                min={-0.1}
                max={1}
                step={0.01}
                onChange={(v) => set({ sunEl: v })}
                fmt={(v) => `${Math.round((v * 180) / Math.PI)}°`}
              />

              <div className="mt-5 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                kekuatan cahaya
              </div>
              <Slider
                label="key / matahari"
                hint="cahaya utama — sumber bayangan"
                value={l.sunlight}
                min={0}
                max={2.6}
                onChange={(v) => set({ sunlight: v })}
              />
              <Slider
                label="ambient / langit"
                hint="cahaya biru lembut dari langit"
                value={l.ambient}
                min={0}
                max={2.4}
                onChange={(v) => set({ ambient: v })}
              />
              <Slider
                label="bounce dari pasir"
                hint="pantulan hangat dari tanah ke objek"
                value={l.bounce}
                min={0}
                max={2.4}
                onChange={(v) => set({ bounce: v })}
              />
              <Slider
                label="fill sisi gelap"
                hint="menerangi sisi yang tak kena matahari"
                value={l.fill}
                min={0}
                max={2.4}
                onChange={(v) => set({ fill: v })}
              />
              <Slider
                label="rim / tepi"
                hint="garis cahaya di tepi rider — sangat sinematik"
                value={l.rim}
                min={0}
                max={2.6}
                onChange={(v) => set({ rim: v })}
              />
              <Slider
                label="kecerahan pasir"
                value={l.terrainLight}
                min={0.35}
                max={1.7}
                onChange={(v) => set({ terrainLight: v })}
              />
              <Slider
                label="kekuatan bayangan"
                value={l.shadow}
                min={0}
                max={2.2}
                onChange={(v) => set({ shadow: v })}
              />
              <Slider
                label="glow halo matahari"
                value={l.skyGlow}
                min={0}
                max={2.6}
                onChange={(v) => set({ skyGlow: v })}
              />
              <Slider
                label="haze / kabut"
                hint="tebal kabut di kejauhan"
                value={l.haze}
                min={0}
                max={2.4}
                onChange={(v) => set({ haze: v })}
              />
              <Slider
                label="kabut ikut warna matahari"
                hint="seberapa hangat kabut tersinari matahari"
                value={l.fogTint}
                min={0}
                max={3}
                onChange={(v) => set({ fogTint: v })}
              />

              <div className="mt-5 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                warna cahaya kustom
              </div>
              <Toggle
                label="pakai warna sendiri"
                on={l.customColors}
                onChange={(v) => set({ customColors: v })}
              />
              <div className="mt-1">
                <Slider
                  label="kekuatan warna kustom"
                  hint="0 = warna mood langit · 100% = warna pilihanmu sepenuhnya"
                  value={l.colorMix}
                  min={0}
                  max={1}
                  onChange={(v) => set({ colorMix: v })}
                />
                <ColorPick
                  label="warna matahari"
                  hint="key light + halo + rim"
                  value={l.sunC}
                  disabled={!l.customColors}
                  onChange={(v) => set({ sunC: v })}
                />
                <ColorPick
                  label="warna ambient / langit"
                  hint="cahaya dari atas + fill"
                  value={l.ambientC}
                  disabled={!l.customColors}
                  onChange={(v) => set({ ambientC: v })}
                />
                <ColorPick
                  label="warna bounce pasir"
                  hint="pantulan dari bawah"
                  value={l.bounceC}
                  disabled={!l.customColors}
                  onChange={(v) => set({ bounceC: v })}
                />
                <ColorPick
                  label="langit atas"
                  value={l.skyTopC}
                  disabled={!l.customColors}
                  onChange={(v) => set({ skyTopC: v })}
                />
                <ColorPick
                  label="cakrawala"
                  value={l.skyHorC}
                  disabled={!l.customColors}
                  onChange={(v) => set({ skyHorC: v })}
                />
                <ColorPick
                  label="kabut"
                  value={l.fogC}
                  disabled={!l.customColors}
                  onChange={(v) => set({ fogC: v })}
                />
              </div>

              <div className="mt-5 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                post-processing
              </div>
              <Slider label="bloom" hint="pendar pada bagian terang" value={l.bloom} min={0} max={2.5} onChange={(v) => set({ bloom: v })} />
              <Slider
                label="exposure"
                hint="kecerahan keseluruhan"
                value={l.exposure}
                min={0.6}
                max={1.6}
                onChange={(v) => set({ exposure: v })}
              />
              <button
                onClick={() =>
                  set({
                    sunAz: 0,
                    sunEl: 0,
                    sunlight: 1,
                    ambient: 1,
                    bounce: 1,
                    fill: 1,
                    rim: 0.55,
                    skyGlow: 1,
                    terrainLight: 1,
                    shadow: 1,
                    fogTint: 1,
                    customColors: false,
                  })
                }
                className="mt-4 w-full rounded-xl border border-sand-200/25 py-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-100/80 transition hover:bg-white/10"
              >
                ikuti mood langit
              </button>
            </>
          )}

          {tab === 'move' && (
            <>
              <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                gerakan & kontrol — carv, luncur & tanjakan
              </div>
              <Slider
                label="kecepatan belok ✦"
                hint="seberapa cepat rider carve kiri/kanan (A · D)"
                value={l.turn}
                min={0.3}
                max={2.5}
                onChange={(v) => set({ turn: v })}
                fmt={(v) => (v < 0.7 ? 'pelayar' : v < 1.4 ? 'normal' : v < 2 ? 'lincah' : 'belut')}
              />
              <Slider
                label="belok di udara"
                hint="kontrol arah saat melayang (spin di udara tetap dari tune trik)"
                value={l.airTurn}
                min={0.2}
                max={1.3}
                onChange={(v) => set({ airTurn: v })}
                fmt={(v) => `${Math.round(v * 100)}%`}
              />
              <Slider
                label="kecepatan luncur"
                hint="pace keseluruhan menuruni gunung"
                value={l.speed}
                min={0.5}
                max={1.6}
                onChange={(v) => set({ speed: v })}
                fmt={(v) => (v < 0.8 ? 'santai' : v < 1.2 ? 'normal' : 'ngebut')}
              />
              <Slider
                label="daya tanjakan"
                hint="0 = tanjakan benar-benar memperlambat · 1 = tanjakan gratis"
                value={l.climb}
                min={0}
                max={1}
                onChange={(v) => set({ climb: v })}
                fmt={(v) => (v < 0.3 ? 'realistis' : v < 0.7 ? 'seimbang' : 'bebas mendaki')}
              />
              <Slider
                label="kecepatan minimum"
                hint="jarak per detik yang tak pernah hilang walau di tanjakan"
                value={l.minSpeed}
                min={0}
                max={40}
                step={1}
                onChange={(v) => set({ minSpeed: v })}
                fmt={(v) => `${Math.round(v)} m/s`}
              />
              <div className="mt-4 rounded-2xl border border-sand-200/20 bg-black/25 px-3 py-2 text-[9px] leading-relaxed text-sand-200/65">
                gravitasi, melayang di puncak, kecepatan salto & spin ada di tab
                <b> Udara &amp; Trik</b> · freestyle otomatis: <b>KLIK KIRI</b> — tiap klik
                gaya berbeda, acak adil tanpa gaya terlewat.
              </div>
            </>
          )}

          {tab === 'air' && (
            <>
              <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                gaya udara — sekali klik
              </div>
              <div className="grid grid-cols-2 gap-2">
                {AIR_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => set(p.values)}
                    className="rounded-xl border border-sand-200/25 bg-black/20 px-3 py-2 text-left transition hover:border-sand-100/70 hover:bg-white/10"
                  >
                    <div className="font-display text-[16px] leading-none">{p.name}</div>
                    <div className="mt-1 text-[7px] leading-tight uppercase tracking-[0.1em] text-sand-200/55">
                      {p.desc}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-5 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                lompatan & momentum
              </div>
              <Slider
                label="kekuatan lompat"
                value={l.jumpPower}
                min={0.5}
                max={1.8}
                onChange={(v) => set({ jumpPower: v })}
              />
              <Slider
                label="terbang dari bukit"
                hint="seberapa mudah & jauh kamu terlempar dari puncak bukit — rendah = lebih menempel kontur"
                value={l.launchBoost}
                min={0}
                max={2.2}
                onChange={(v) => set({ launchBoost: v })}
              />
              <Slider
                label="melayang di puncak"
                hint="waktu gantung di titik tertinggi lompatan"
                value={l.floaty}
                min={0}
                max={1.8}
                onChange={(v) => set({ floaty: v })}
              />
              <Slider label="gravitasi" value={l.gravity} min={0.5} max={1.6} onChange={(v) => set({ gravity: v })} />

              <div className="mt-5 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                trik
              </div>
              <Slider
                label="kecepatan salto"
                hint="tahan SPACE = backflip · tahan S = frontflip"
                value={l.flipSpeed}
                min={0.4}
                max={1.8}
                onChange={(v) => set({ flipSpeed: v })}
              />
              <Slider
                label="kecepatan spin"
                hint="A / D di udara"
                value={l.spin}
                min={0.4}
                max={1.8}
                onChange={(v) => set({ spin: v })}
              />
              <Slider
                label="air jump"
                hint="tekan SPACE lagi di udara (atau W / ↑)"
                value={l.airJumps}
                min={0}
                max={3}
                step={1}
                onChange={(v) => set({ airJumps: v })}
                fmt={(v) => (v === 0 ? 'mati' : `${v}×`)}
              />
              <Slider
                label="kekuatan air jump"
                value={l.airJumpPower}
                min={0.5}
                max={1.8}
                onChange={(v) => set({ airJumpPower: v })}
              />
              <Slider
                label="slow motion saat salto"
                value={l.slowmo}
                min={0}
                max={1}
                onChange={(v) => set({ slowmo: v })}
                fmt={(v) => (v < 0.05 ? 'mati' : `${Math.round(v * 100)}%`)}
              />

              <div className="mt-5 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                pendaratan
              </div>
              <Slider
                label="bantuan mendarat"
                hint="dekat tanah, badan otomatis diluruskan ke posisi tegak"
                value={l.landAssist}
                min={0}
                max={1}
                onChange={(v) => set({ landAssist: v })}
                fmt={(v) => (v < 0.05 ? 'mati (pro)' : v < 0.5 ? 'sedikit' : v < 0.85 ? 'sedang' : 'penuh')}
              />
              <Slider
                label="toleransi mendarat"
                hint="seberapa miring masih dianggap aman"
                value={l.landWindow}
                min={0.5}
                max={1.8}
                onChange={(v) => set({ landWindow: v })}
                fmt={(v) => `±${Math.round(v * 0.9 * 57)}°`}
              />
              <Slider
                label="bonus kecepatan perfect"
                value={l.perfectBoost}
                min={0}
                max={2}
                onChange={(v) => set({ perfectBoost: v })}
              />

              <div className="mt-5 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                auto freestyle & pendaratan cerdas
              </div>
              <Toggle
                label="pendaratan cerdas"
                on={l.smartLand}
                onChange={(v) => set({ smartLand: v })}
              />
              <div className="mt-1 text-[8px] leading-relaxed uppercase tracking-[0.14em] text-sand-200/40">
                memprediksi kapan mendarat, lalu mempercepat putaran agar selesai pas, atau kembali ke normal bila
                tidak sempat
              </div>
              <Toggle
                label="auto trick di setiap lompatan besar"
                on={l.autoTrick}
                onChange={(v) => set({ autoTrick: v })}
              />
              <Slider
                label="ambisi auto freestyle"
                hint="rendah = santai 1 putaran · tinggi = sebanyak mungkin putaran"
                value={l.styleAmbition}
                min={0}
                max={1}
                onChange={(v) => set({ styleAmbition: v })}
              />
              <Slider
                label="jeda aman sebelum mendarat"
                hint="putaran selesai sekian detik sebelum menyentuh tanah"
                value={l.landMargin}
                min={0.02}
                max={0.45}
                step={0.01}
                onChange={(v) => set({ landMargin: v })}
                fmt={(v) => `${v.toFixed(2)} s`}
              />
              <div className="mt-3 rounded-2xl border border-sand-200/20 bg-black/20 p-3 text-[10px] font-light leading-relaxed text-sand-100/75">
                <b className="font-semibold">S</b> auto frontflip · <b className="font-semibold">E</b> auto backflip ·{' '}
                <b className="font-semibold">F</b> auto combo. Bisa ditekan di tanah (langsung lompat) atau di udara.
              </div>
            </>
          )}

          {tab === 'book' && (
            <>
              <div className="mb-3 text-[8px] leading-relaxed uppercase tracking-[0.16em] text-sand-200/45">
                freestyle skate di atas pedang hover — tekan di tanah = langsung lompat. gabungkan flip pedang, grab,
                salto & spin dalam satu lompatan untuk bonus variasi.
              </div>

              <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                flip pedang (tekan)
              </div>
              <div className="space-y-[6px]">
                {BOARD_TRICKS.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-xl border border-sand-200/15 bg-black/15 px-3 py-2"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-sand-200/40 bg-black/30 text-[11px] font-semibold">
                      {t.keyLabel}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-[15px] leading-none">{t.name}</div>
                      <div className="mt-[3px] text-[8px] uppercase tracking-[0.1em] text-sand-200/50">{t.desc}</div>
                    </div>
                    <span className="tnum text-[9px] text-sand-200/60">{t.pts}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 mb-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                grab bergaya (tahan)
              </div>
              <div className="space-y-[6px]">
                {GRABS.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center gap-3 rounded-xl border border-sand-200/15 bg-black/15 px-3 py-2"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-cyan-100/40 bg-black/30 text-[11px] font-semibold text-cyan-50">
                      {g.keyLabel}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-[15px] leading-none">{g.name}</div>
                      <div className="mt-[3px] text-[8px] uppercase tracking-[0.1em] text-sand-200/50">{g.desc}</div>
                    </div>
                    <span className="tnum text-[9px] text-sand-200/60">{g.pts}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-sand-200/20 bg-black/20 p-3 text-[10px] font-light leading-relaxed text-sand-100/75">
                <b className="font-semibold">tips:</b> flip pedang lalu grab sebelum mendarat (misal{' '}
                <b className="font-semibold">L</b> lalu tahan <b className="font-semibold">X</b> = TRE FLIP + METHOD).
                Tekan flip kedua saat flip pertama hampir selesai untuk merantai. Pedang harus tertangkap sebelum
                menyentuh tanah, pendaratan cerdas otomatis mempercepat flip.
              </div>
            </>
          )}

          {tab === 'water' && (
            <>
              <div className="mb-3 text-[8px] leading-relaxed uppercase tracking-[0.16em] text-sand-200/45">
                sungai mengalir ke arah laju: lahir dari mata air, turun lewat air terjun di lembah & ngarai, berakhir
                di danau oasis. ikuti penunjuk arah di atas layar ke air terjun berikutnya.
              </div>
              {onTeleport && (
                <button
                  onClick={onTeleport}
                  className="mb-4 w-full rounded-xl border border-cyan-100/50 bg-cyan-200/15 py-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-50 transition hover:bg-cyan-200/25"
                >
                  🧭 teleport ke air terjun berikutnya
                </button>
              )}
              <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                warna air
              </div>
              <div className="grid grid-cols-5 gap-2">
                {WATER_PALETTES.map((w, i) => (
                  <button
                    key={w.name}
                    onClick={() => set({ waterPalette: i })}
                    className={`relative h-14 overflow-hidden rounded-xl border transition hover:scale-[1.04] ${
                      l.waterPalette === i ? 'border-white' : 'border-white/20'
                    }`}
                    style={{
                      background: `linear-gradient(to bottom, ${w.shallow} 0%, ${w.deep} 100%)`,
                      boxShadow: l.waterPalette === i ? `0 0 14px ${w.shallow}` : undefined,
                    }}
                  >
                    <span className="absolute inset-x-0 bottom-0 bg-black/40 py-[2px] text-[6.5px] uppercase tracking-[0.06em] text-white/95">
                      {w.name}
                    </span>
                  </button>
                ))}
              </div>
              <Slider
                label="kecepatan aliran"
                value={l.waterFlow}
                min={0.2}
                max={2.5}
                onChange={(v) => set({ waterFlow: v })}
              />
              <Slider
                label="kilau matahari di air"
                hint="ikut slider tingkat silau"
                value={l.waterGlint}
                min={0}
                max={2}
                onChange={(v) => set({ waterGlint: v })}
              />
              <Slider
                label="buih"
                hint="buih di tepi, garis arus & air putih di bawah air terjun"
                value={l.waterFoam}
                min={0}
                max={2}
                onChange={(v) => set({ waterFoam: v })}
              />
              <Slider
                label="kejernihan"
                hint="rendah = bening tembus pandang · tinggi = pekat"
                value={l.waterClarity}
                min={0}
                max={1}
                onChange={(v) => set({ waterClarity: v })}
              />
              <div className="mt-5 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                air terjun
              </div>
              <Slider
                label="kabut air terjun"
                value={l.waterMist}
                min={0}
                max={2}
                onChange={(v) => set({ waterMist: v })}
              />
              <Slider
                label="pelangi"
                hint="paling terang saat matahari di belakangmu"
                value={l.waterRainbow}
                min={0}
                max={2}
                onChange={(v) => set({ waterRainbow: v })}
              />
              <Slider
                label="kekuatan arus"
                hint="seberapa kuat sungai mendorongmu ke hilir"
                value={l.waterCurrent}
                min={0}
                max={2.5}
                onChange={(v) => set({ waterCurrent: v })}
              />
            </>
          )}

          {tab === 'fog' && (
            <>
              <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                preset kabut — sekali klik
              </div>
              <div className="grid grid-cols-3 gap-2">
                {FOG_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => set(p.values)}
                    className="rounded-xl border border-sand-200/25 bg-black/20 px-2 py-2 text-left transition hover:border-sand-100/70 hover:bg-white/10"
                  >
                    <div className="font-display text-[15px] leading-none">{p.name}</div>
                    <div className="mt-1 text-[6.5px] leading-tight uppercase tracking-[0.1em] text-sand-200/55">
                      {p.desc}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-5 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                kabut jarak jauh
              </div>
              <Slider
                label="kepekatan kabut"
                hint="0 = tanpa kabut sama sekali"
                value={l.haze}
                min={0}
                max={3}
                onChange={(v) => set({ haze: v })}
              />
              <Slider
                label="jarak mulai kabut"
                hint="udara bening di sekitarmu sebelum kabut dimulai"
                value={l.fogStart}
                min={0}
                max={200}
                step={1}
                onChange={(v) => set({ fogStart: v })}
                fmt={(v) => `${Math.round(v)} m`}
              />
              <Slider
                label="batas maksimum"
                hint="di bawah 100% bukit terjauh tidak pernah hilang total"
                value={l.fogMax}
                min={0.3}
                max={1}
                onChange={(v) => set({ fogMax: v })}
              />

              <div className="mt-5 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                kabut lembah
              </div>
              <Slider
                label="kabut di lembah"
                hint="kabut rendah yang mengisi cekungan di antara bukit"
                value={l.fogHeight}
                min={0}
                max={1}
                onChange={(v) => set({ fogHeight: v })}
              />
              <Slider
                label="tebal lapisan"
                hint="seberapa tinggi kabut lembah naik"
                value={l.fogLayer}
                min={3}
                max={60}
                step={1}
                onChange={(v) => set({ fogLayer: v })}
                fmt={(v) => `${Math.round(v)} m`}
              />

              <div className="mt-5 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                warna & cahaya kabut
              </div>
              <Slider
                label="cahaya matahari di kabut"
                hint="kabut berpendar hangat saat menghadap matahari"
                value={l.fogScatter}
                min={0}
                max={2.5}
                onChange={(v) => set({ fogScatter: v })}
              />
              <Slider
                label="kabut ikut warna matahari"
                value={l.fogTint}
                min={0}
                max={3}
                onChange={(v) => set({ fogTint: v })}
              />
              <Slider
                label="kabut di cakrawala"
                hint="kaki langit membaur ke kabut, batas bukit & langit menyatu"
                value={l.fogSky}
                min={0}
                max={1}
                onChange={(v) => set({ fogSky: v })}
              />
              <Toggle label="warna kabut sendiri" on={l.fogCustom} onChange={(v) => set({ fogCustom: v })} />
              <ColorPick
                label="warna kabut"
                value={l.fogC}
                disabled={!l.fogCustom}
                onChange={(v) => set({ fogC: v })}
              />
            </>
          )}

          {tab === 'bloom' && (
            <>
              <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                tingkat bloom — sekali klik
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {BLOOM_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => set(p.values)}
                    className={`rounded-xl border px-3 py-2 text-left transition hover:border-sand-100/70 hover:bg-white/10 ${
                      p.name === 'Data 1'
                        ? 'border-amber-300/50 bg-amber-400/10'
                        : 'border-sand-200/25 bg-black/20'
                    }`}
                  >
                    <div className="font-display text-[15px] leading-none text-sand-50">
                      {p.name === 'Data 1' ? '✨ Data 1' : p.name}
                    </div>
                    <div className="mt-1 text-[7px] leading-tight uppercase tracking-[0.08em] text-sand-200/55">
                      {p.desc}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-5 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                atur manual
              </div>
              <Slider
                label="tingkat silau (master)"
                hint="satu slider yang meredam SEMUA: bloom, matahari, objek bersinar, partikel"
                value={l.glare}
                min={0}
                max={1.5}
                onChange={(v) => set({ glare: v })}
                fmt={(v) => (v < 0.35 ? 'tanpa silau' : v < 0.7 ? 'rendah' : v < 1.05 ? 'normal' : 'tinggi')}
              />
              <Slider
                label="redam putih terang"
                hint="menekan area putih yang menyilaukan (highlight compression)"
                value={l.highlights}
                min={0}
                max={1}
                onChange={(v) => set({ highlights: v })}
              />
              <Slider
                label="bulatan matahari di langit"
                hint="sumber silau terbesar saat menghadap matahari"
                value={l.sunDisc}
                min={0}
                max={1.5}
                onChange={(v) => set({ sunDisc: v })}
              />
              <Slider
                label="objek bersinar"
                hint="kristal percikan, suar batu, pisau"
                value={l.emissive}
                min={0}
                max={1.5}
                onChange={(v) => set({ emissive: v })}
              />
              <Slider
                label="pencahayaan pedang skate"
                hint="kecerahan & pendar bilah pedang saat meluncur"
                value={l.swordGlow ?? 0.22}
                min={0}
                max={1.5}
                step={0.01}
                onChange={(v) => set({ swordGlow: v })}
                fmt={(v) => (v < 0.05 ? 'mati' : v < 0.25 ? 'kecil / sejuk' : v < 0.6 ? 'sedang' : 'terang')}
              />
              <Slider
                label="partikel melayang"
                value={l.motes}
                min={0}
                max={1.5}
                onChange={(v) => set({ motes: v })}
              />
              <Slider
                label="kekuatan bloom"
                hint="seberapa kuat pendar cahaya — 0 = mati total"
                value={l.bloom}
                min={0}
                max={2.2}
                onChange={(v) => set({ bloom: v })}
              />
              <Slider
                label="ambang / threshold"
                hint="naikkan agar HANYA benda sangat terang yang bersinar — kunci anti silau"
                value={l.bloomThreshold}
                min={-0.3}
                max={0.8}
                onChange={(v) => set({ bloomThreshold: v })}
                fmt={(v) => (v < 0 ? 'semua bersinar' : v < 0.2 ? 'normal' : v < 0.45 ? 'selektif' : 'hanya titik terang')}
              />
              <Slider
                label="sebaran / radius"
                hint="rendah = pendar rapat & tajam · tinggi = kabut cahaya lebar"
                value={l.bloomRadius}
                min={0}
                max={1.4}
                onChange={(v) => set({ bloomRadius: v })}
              />
              <Slider
                label="bloom saat aksi"
                hint="tambahan bloom saat ngebut, boost & melompat"
                value={l.bloomDynamic}
                min={0}
                max={1.5}
                onChange={(v) => set({ bloomDynamic: v })}
              />
              <Slider
                label="cahaya partikel & aura"
                hint="intensitas percikan, aura rider & trail cahaya"
                value={l.glowFx}
                min={0}
                max={1.5}
                onChange={(v) => set({ glowFx: v })}
              />
              <Slider
                label="exposure"
                value={l.exposure}
                min={0.6}
                max={1.6}
                onChange={(v) => set({ exposure: v })}
              />
            </>
          )}

          {tab === 'scarf' && (
            <>
              {/* ---------------- character body */}
              <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                tinggi karakter
              </div>
              <div className="grid grid-cols-3 gap-2">
                {BODY_PRESETS.map((p) => {
                  const on = Math.abs(l.bodyHeight - p.v.bodyHeight) < 0.02 && Math.abs(l.headSize - p.v.headSize) < 0.03;
                  return (
                    <button
                      key={p.name}
                      onClick={() => set(p.v)}
                      className={`rounded-xl border px-2 py-2 transition ${
                        on ? 'border-sand-100/90 bg-white/15' : 'border-sand-200/25 bg-black/20 hover:border-sand-100/70'
                      }`}
                    >
                      <div className="font-display text-[16px] leading-none">{p.name}</div>
                      <div className="mt-1 text-[7px] uppercase tracking-[0.1em] text-sand-200/55">{p.desc}</div>
                    </button>
                  );
                })}
              </div>
              <Slider
                label="tinggi badan"
                value={l.bodyHeight}
                min={0.42}
                max={1.12}
                onChange={(v) => set({ bodyHeight: v })}
                fmt={(v) => (v < 0.6 ? `cebol · ${Math.round(v * 100)}%` : v < 0.9 ? `pendek · ${Math.round(v * 100)}%` : `normal · ${Math.round(v * 100)}%`)}
              />
              <Slider
                label="ukuran kepala"
                value={l.headSize}
                min={0.7}
                max={2.2}
                onChange={(v) => set({ headSize: v })}
              />
              <Slider
                label="ukuran pedang"
                value={l.swordSize}
                min={0.4}
                max={1.2}
                onChange={(v) => set({ swordSize: v })}
                fmt={(v) => `${(3.7 * v).toFixed(1)} m`}
              />
              <Slider
                label="pencahayaan pedang skate"
                hint="kecerahan & pendar bilah pedang saat meluncur"
                value={l.swordGlow ?? 0.22}
                min={0}
                max={1.5}
                step={0.01}
                onChange={(v) => set({ swordGlow: v })}
                fmt={(v) => (v < 0.05 ? 'mati' : v < 0.25 ? 'kecil / sejuk' : v < 0.6 ? 'sedang' : 'terang')}
              />

              {/* ---------------- character colour */}
              <div className="mt-6 mb-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                warna kristal karakter
              </div>
              <div className="grid grid-cols-4 gap-2">
                {CRYSTAL_SKINS.map((s, i) => {
                  const on = !l.crystalCustom && l.crystalSkin === i;
                  const diamond = s.name === 'Diamond';
                  return (
                    <button
                      key={s.name}
                      onClick={() => set({ crystalSkin: i, crystalCustom: false })}
                      className={`relative h-14 overflow-hidden rounded-xl border transition hover:scale-[1.04] ${
                        on ? 'border-white' : 'border-white/20'
                      }`}
                      style={{
                        background: diamond
                          ? 'conic-gradient(from 200deg, #ffffff, #d9f2ff, #ffe3fb, #fffbd9, #dcffef, #ffffff)'
                          : `radial-gradient(circle at 32% 28%, ${s.rim} 0%, ${s.tint} 38%, ${s.deep} 100%)`,
                        boxShadow: on ? `0 0 16px ${s.emissive}` : undefined,
                      }}
                    >
                      {diamond && (
                        <span className="absolute top-1 right-1.5 text-[11px] text-white drop-shadow">✦</span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 bg-black/40 py-[2px] text-[7px] uppercase tracking-[0.06em] text-white/95">
                        {s.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              <Toggle
                label="warna kristal sendiri"
                on={l.crystalCustom}
                onChange={(v) => set({ crystalCustom: v })}
              />
              <ColorPick
                label="pilih warna"
                hint="kedalaman, tepi & cahaya dalam dibuat otomatis agar serasi"
                value={l.crystalC}
                disabled={!l.crystalCustom}
                onChange={(v) => set({ crystalC: v })}
              />
              <div className="mt-3 mb-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                aksen logam (mahkota, sabuk, gelang)
              </div>
              <div className="grid grid-cols-4 gap-2">
                {ACCENT_METALS.map((m, i) => (
                  <button
                    key={m.name}
                    onClick={() => set({ accentMetal: i })}
                    className={`rounded-xl border px-1 py-2 text-[9px] font-semibold uppercase tracking-[0.08em] transition ${
                      l.accentMetal === i ? 'border-white' : 'border-white/20 hover:border-white/50'
                    }`}
                    style={{
                      background: `linear-gradient(135deg, ${m.color}, ${m.emissive})`,
                      color: '#2a1a0c',
                    }}
                  >
                    {m.name}
                  </button>
                ))}
              </div>

              {/* ---------------- papan seluncur */}
              <div className="mt-6 mb-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                papan seluncur — gaya seluncur
              </div>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['Papan Silver Surfer', 'papan surf krom ikonik (default)', 0],
                  ['Pedang', 'pedang skate klasik — kalau bosan papan', 1],
                ] as [string, string, number][]).map(([name, desc, v]) => (
                  <button
                    key={name}
                    onClick={() => set({ boardType: v })}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      Math.round(l.boardType) % 2 === v
                        ? 'border-sand-100/90 bg-white/15'
                        : 'border-sand-200/25 bg-black/20 hover:border-sand-100/70'
                    }`}
                  >
                    <div
                      className="mb-1 h-3 w-full rounded-full"
                      style={{
                        background:
                          v === 0
                            ? 'linear-gradient(90deg,#f8fbff,#c9d8ec 30%,#ffffff 55%,#b8c9e0)'
                            : 'linear-gradient(90deg,#e8f0fb,#b9c9e0 55%,#efca85)',
                        boxShadow: 'inset 0 0 6px rgba(255,255,255,0.8)',
                      }}
                    />
                    <div className="font-display text-[14px] leading-none">{name}</div>
                    <div className="mt-1 text-[7px] leading-tight uppercase tracking-[0.1em] text-sand-200/55">
                      {desc}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-4 mb-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                skin logam (papan & pedang)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SWORD_SKINS.map((s, i) => (
                  <button
                    key={s.name}
                    onClick={() => set({ swordSkin: i })}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      Math.round(l.swordSkin ?? 0) === i
                        ? 'border-sand-100/90 bg-white/15'
                        : 'border-sand-200/25 bg-black/20 hover:border-sand-100/70'
                    }`}
                  >
                    <div className="font-display text-[14px] leading-none">{s.name}</div>
                    <div className="mt-1 text-[7px] leading-tight uppercase tracking-[0.1em] text-sand-200/55">
                      {s.desc}
                    </div>
                  </button>
                ))}
              </div>

              {/* ---------------- scarf skin */}
              <div className="mt-6 mb-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                skin slayer
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Kain', 0, 'selendang kain klasik'],
                  ['Ethereal', 1, 'selendang cahaya tembus pandang'],
                ].map(([name, v, desc]) => (
                  <button
                    key={name as string}
                    onClick={() => set({ scarfSkin: v as number })}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      l.scarfSkin === v
                        ? 'border-sand-100/90 bg-white/15'
                        : 'border-sand-200/25 bg-black/20 hover:border-sand-100/70'
                    }`}
                  >
                    <div className="font-display text-[16px] leading-none">{name as string}</div>
                    <div className="mt-1 text-[7px] uppercase tracking-[0.1em] text-sand-200/55">{desc as string}</div>
                  </button>
                ))}
              </div>

              {l.scarfSkin === 1 ? (
                <>
                  <div className="mt-4 mb-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                    warna ethereal
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {ETHEREAL_SKINS.map((s, i) => (
                      <button
                        key={s.name}
                        onClick={() => set({ scarfEthereal: i })}
                        className={`relative h-14 overflow-hidden rounded-xl border transition hover:scale-[1.04] ${
                          l.scarfEthereal === i ? 'border-white' : 'border-white/20'
                        }`}
                        style={{
                          background: `linear-gradient(135deg, ${s.core} 0%, ${s.edge} 60%, ${s.hi} 100%)`,
                          boxShadow: l.scarfEthereal === i ? `0 0 18px ${s.core}` : undefined,
                        }}
                      >
                        <span className="absolute inset-x-0 bottom-0 bg-black/40 py-[2px] text-[7px] uppercase tracking-[0.08em] text-white/95">
                          {s.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-4 mb-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                    warna kain
                  </div>
                  <div className="grid grid-cols-8 gap-2">
                    {SCARF_COLORS.map((c, i) => (
                      <button
                        key={c.name}
                        title={c.name}
                        onClick={() => set({ scarfColor: i })}
                        className={`aspect-square rounded-full border-2 transition hover:scale-110 ${
                          l.scarfColor === i ? 'border-white scale-110' : 'border-white/20'
                        }`}
                        style={{ background: c.hex, boxShadow: l.scarfColor === i ? `0 0 14px ${c.hex}` : undefined }}
                      />
                    ))}
                  </div>
                </>
              )}
              <div className="mt-4">
                <Slider
                  label="panjang slayer"
                  hint="dari syal pendek sampai pita super panjang"
                  value={l.scarfLength}
                  min={0.5}
                  max={10}
                  step={0.1}
                  onChange={(v) => set({ scarfLength: v })}
                  fmt={(v) => `${v.toFixed(1)} m`}
                />
                <Slider
                  label="lebar"
                  value={l.scarfWidth}
                  min={0.08}
                  max={0.7}
                  onChange={(v) => set({ scarfWidth: v })}
                  fmt={(v) => v.toFixed(2)}
                />
                <Slider
                  label="kibaran"
                  hint="seberapa kuat slayer berkibar ditiup angin"
                  value={l.scarfFlutter}
                  min={0}
                  max={2.2}
                  onChange={(v) => set({ scarfFlutter: v })}
                />
              </div>
              <Toggle label="dua ujung (twin tail)" on={l.scarfTwin} onChange={(v) => set({ scarfTwin: v })} />
              <Toggle label="jejak cahaya dari leher" on={l.scarfGlow} onChange={(v) => set({ scarfGlow: v })} />
              <Toggle
                label="sulaman emas ala journey ✦"
                on={l.scarfEmbroidery}
                onChange={(v) => set({ scarfEmbroidery: v })}
              />
              <Slider
                label="pendar sulaman emas"
                hint="simbol emas di slayer menyala mengikuti energi flow"
                value={l.scarfEmbroideryGlow}
                min={0}
                max={2}
                onChange={(v) => set({ scarfEmbroideryGlow: v })}
              />
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  ['Syal Pendek', { scarfLength: 1.4, scarfWidth: 0.24, scarfFlutter: 0.8 }],
                  ['Klasik', { scarfLength: 3.4, scarfWidth: 0.26, scarfFlutter: 1 }],
                  ['Pita Epik', { scarfLength: 9, scarfWidth: 0.34, scarfFlutter: 1.35 }],
                ].map(([name, v]) => (
                  <button
                    key={name as string}
                    onClick={() => set(v as Partial<Tune>)}
                    className="rounded-xl border border-sand-200/25 bg-black/20 py-2 font-display text-[14px] transition hover:border-sand-100/70"
                  >
                    {name as string}
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === 'grade' && (
            <>
              <div className="mb-3 text-[8px] leading-relaxed uppercase tracking-[0.16em] text-sand-200/40">
                color grading akhir — seperti editor foto
              </div>
              <Slider
                label="kontras"
                hint="jarak gelap & terang"
                value={l.contrast}
                min={0.6}
                max={1.8}
                onChange={(v) => set({ contrast: v })}
              />
              <Slider
                label="saturasi"
                value={l.saturation}
                min={0}
                max={2}
                onChange={(v) => set({ saturation: v })}
              />
              <Slider
                label="warmth / suhu"
                hint="kiri dingin biru · kanan hangat amber"
                value={l.warmth}
                min={-1}
                max={1}
                onChange={(v) => set({ warmth: v })}
                fmt={(v) => (v < -0.02 ? 'dingin' : v > 0.02 ? 'hangat' : 'netral')}
              />
              <Slider
                label="tint"
                hint="hijau ↔ magenta"
                value={l.tint}
                min={-1}
                max={1}
                onChange={(v) => set({ tint: v })}
                fmt={(v) => (v < -0.02 ? 'hijau' : v > 0.02 ? 'magenta' : 'netral')}
              />
              <Slider
                label="lift (titik hitam)"
                hint="naikkan = hitam jadi pudar / film look"
                value={l.lift}
                min={-0.12}
                max={0.2}
                step={0.005}
                onChange={(v) => set({ lift: v })}
                fmt={(v) => v.toFixed(3)}
              />
              <Slider
                label="gain (titik putih)"
                value={l.gain}
                min={0.7}
                max={1.4}
                onChange={(v) => set({ gain: v })}
              />
              <Slider label="vignette" value={l.vignette} min={0} max={1} onChange={(v) => set({ vignette: v })} />
              <Slider label="grain film" value={l.grain} min={0} max={0.14} step={0.002} onChange={(v) => set({ grain: v })} fmt={(v) => v.toFixed(3)} />
            </>
          )}

          {tab === 'world' && (
            <>
              <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                mode dunia — medan langsung terbangun ulang
              </div>
              <div className="grid grid-cols-2 gap-2">
                {WORLD_PRESETS.map((p) => {
                  const active = Math.round(l.worldMode) === Math.round(p.values.worldMode ?? 0);
                  return (
                    <button
                      key={p.name}
                      onClick={() => set(p.values)}
                      className={`rounded-xl border px-2 py-2 text-left transition ${
                        active
                          ? 'border-sand-100/80 bg-white/15'
                          : 'border-sand-200/25 bg-black/20 hover:border-sand-100/70 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-display text-[15px] leading-none">{p.name}</div>
                      <div className="mt-1 text-[7px] leading-tight uppercase tracking-[0.1em] text-sand-200/55">
                        {p.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 rounded-xl border border-sand-200/20 bg-black/25 px-3 py-2 text-[9px] leading-relaxed text-sand-200/65">
                Dunia dibangkitkan murni dari fungsi matematika (simplex noise + ridged,
                seed tetap) — bantalan medan tidak pernah disimpan, jadi ngarai, sungai
                & jurang selalu sama di titik yang sama. Transisi antar biome memakai
                noise 1D lambat dan selalu mulus tanpa garis batas.
              </div>
            </>
          )}

          {tab === 'cam' && (
            <>
              <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/60">
                mode kamera — sekali klik (atau tekan 1 – 4)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {CAM_PRESETS.map((p) => {
                  const active = Math.round(l.camStyle) === Math.round(p.values.camStyle ?? 0);
                  return (
                    <button
                      key={p.name}
                      onClick={() => set(p.values)}
                      className={`rounded-xl border px-2 py-2 text-left transition ${
                        active
                          ? 'border-sand-100/80 bg-white/15'
                          : 'border-sand-200/25 bg-black/20 hover:border-sand-100/70 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-display text-[15px] leading-none">{p.name}</div>
                      <div className="mt-1 text-[7px] leading-tight uppercase tracking-[0.1em] text-sand-200/55">
                        {p.desc}
                      </div>
                    </button>
                  );
                })}
              </div>

              {(() => {
                const m = Math.round(l.camStyle);
                const cfg: {
                  name: string;
                  dist: 'cam0Dist' | 'cam1Dist' | 'cam2Dist' | 'cam3Dist';
                  pitch: 'cam0Pitch' | 'cam1Pitch' | 'cam2Pitch' | 'cam3Pitch';
                  yaw: 'cam0Yaw' | 'cam1Yaw' | 'cam2Yaw' | 'cam3Yaw';
                  height: 'cam0Height' | 'cam1Height' | 'cam2Height' | 'cam3Height';
                  pMin: number;
                  pMax: number;
                  yMin: number;
                  yMax: number;
                  pitchHint: string;
                }[] = [
                  {
                    name: 'KLASIK',
                    dist: 'cam0Dist',
                    pitch: 'cam0Pitch',
                    yaw: 'cam0Yaw',
                    height: 'cam0Height',
                    pMin: -5,
                    pMax: 45,
                    yMin: -75,
                    yMax: 75,
                    pitchHint: 'tinggi mata kamera (0° = sejajar rider)',
                  },
                  {
                    name: 'SEKIRO',
                    dist: 'cam1Dist',
                    pitch: 'cam1Pitch',
                    yaw: 'cam1Yaw',
                    height: 'cam1Height',
                    pMin: -20,
                    pMax: 35,
                    yMin: -60,
                    yMax: 60,
                    pitchHint: 'default 2° = third-person level (bukan top-down)',
                  },
                  {
                    name: 'SWORD OF THE SEA',
                    dist: 'cam2Dist',
                    pitch: 'cam2Pitch',
                    yaw: 'cam2Yaw',
                    height: 'cam2Height',
                    pMin: -5,
                    pMax: 35,
                    yMin: -90,
                    yMax: 90,
                    pitchHint: 'tinggi drone sinematik',
                  },
                  {
                    name: 'BODYCAM',
                    dist: 'cam3Dist',
                    pitch: 'cam3Pitch',
                    yaw: 'cam3Yaw',
                    height: 'cam3Height',
                    pMin: -30,
                    pMax: 90,
                    yMin: -45,
                    yMax: 45,
                    pitchHint: 'default 15° ala head-cam · 90° = menunduk penuh ke lintasan',
                  },
                ];
                const c = cfg[m] ?? cfg[0];
                return (
                  <div className="mt-4 rounded-2xl border border-sand-200/20 bg-black/25 px-3 py-3">
                    <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/70">
                      penyetelan mode aktif — {c.name}
                    </div>
                    <Slider
                      label="jarak mode ini"
                      hint="mengalikan jarak khusus mode ini (bodycam default ×2.0, max ×50)"
                      value={l[c.dist]}
                      min={0.5}
                      max={50}
                      onChange={(v) => set({ [c.dist]: v } as Partial<Tune>)}
                      fmt={(v) => `×${v.toFixed(2)}`}
                    />
                    <Slider
                      label="tinggi kamera (mode ini)"
                      hint="letak kamera: naikkan = lebih tinggi di atas rider, turunkan = lebih rendah"
                      value={l[c.height]}
                      min={-2}
                      max={14}
                      step={0.1}
                      onChange={(v) => set({ [c.height]: v } as Partial<Tune>)}
                      fmt={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} m`}
                    />
                    <Slider
                      label="sudut vertikal"
                      hint={c.pitchHint}
                      value={l[c.pitch]}
                      min={c.pMin}
                      max={c.pMax}
                      step={1}
                      onChange={(v) => set({ [c.pitch]: v } as Partial<Tune>)}
                      fmt={(v) => `${Math.round(v)}°`}
                    />
                    <Slider
                      label="sudut horizontal"
                      hint="0° = tepat di belakang · makin besar makin serong"
                      value={l[c.yaw]}
                      min={c.yMin}
                      max={c.yMax}
                      step={1}
                      onChange={(v) => set({ [c.yaw]: v } as Partial<Tune>)}
                      fmt={(v) => `${Math.round(v)}°`}
                    />
                    <div className="mt-1 text-[8px] leading-relaxed uppercase tracking-[0.14em] text-sand-200/40">
                      di dalam game: scroll = zoom instan · drag = sudut · diamkan → kembali
                      ke penyetelan ini
                    </div>
                  </div>
                );
              })()}

              <Slider
                label="jarak kamera (semua mode)"
                hint="mengalikan semua gaya kamera"
                value={l.camDist}
                min={0.6}
                max={1.7}
                onChange={(v) => set({ camDist: v })}
              />
              <Slider
                label="kelembutan kamera"
                hint="rendah = kamera drone yang mengambang"
                value={l.camLag}
                min={0.3}
                max={2}
                onChange={(v) => set({ camLag: v })}
                fmt={(v) => (v < 0.8 ? 'drone' : v < 1.3 ? 'natural' : 'ketat')}
              />
              <Slider label="fov boost" hint="lebar layar saat ngebut" value={l.fov} min={0} max={1.6} onChange={(v) => set({ fov: v })} />
              <Slider label="guncangan" value={l.shake} min={0} max={2} onChange={(v) => set({ shake: v })} />
            </>
          )}

          {tab === 'fx' && (
            <>
              <Slider
                label="partikel pasir"
                value={l.particles}
                min={0}
                max={1.8}
                onChange={(v) => set({ particles: v })}
              />
              <Slider label="panjang trail" value={l.trails} min={0} max={1.8} onChange={(v) => set({ trails: v })} />
              <div className="mt-5 rounded-2xl border border-sand-200/20 bg-black/20 p-4">
                <div className="text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-200/70">
                  freestyle di udara
                </div>
                <ul className="mt-2 space-y-[6px] text-[10px] font-light text-sand-100/75">
                  <li>
                    <b className="font-semibold">A / D ditahan</b> — spin 360°, 720°, 1080°
                  </li>
                  <li>
                    <b className="font-semibold">SPACE</b> — backflip, tekan lagi sampai 3×
                  </li>
                  <li>
                    <b className="font-semibold">S + SPACE</b> — frontflip
                  </li>
                  <li>
                    <b className="font-semibold">tahan SPACE</b> — hang time / melayang
                  </li>
                  <li>mendarat rata = bonus ✦ perfect 1.5×</li>
                </ul>
              </div>
              <button
                onClick={() => set({ ...DEFAULT_TUNE, palette: l.palette, cycle: l.cycle })}
                className="mt-4 w-full rounded-xl border border-sand-200/25 py-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-sand-100/80 transition hover:bg-white/10"
              >
                reset semua pengaturan
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
