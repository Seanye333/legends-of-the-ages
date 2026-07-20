// 全合成音效引擎:Web Audio 即时合成,零音频资源文件。
// - 惰性创建 AudioContext,首次用户手势时解锁(iOS Safari 要求)
// - 实时读取 settingsStore.soundEnabled,关闭立即静音后续音效
// - 所有音色由振荡器 + 滤波噪声分层合成,短促克制,厚重不刺耳

import { useSettings } from '../app/settingsStore'

export type SfxName =
  | 'buttonTap' // UI 轻击
  | 'cardPlay' // 出牌落子:木质闷响
  | 'stratagemCast' // 锦囊施放:气声呼啸 + 铃音
  | 'attack' // 攻击:金铁交鸣
  | 'hit' // 受击:低沉闷响
  | 'duel' // 单挑:两音戏剧性重锤
  | 'death' // 阵亡:蒙皮闷鼓
  | 'heal' // 治疗:温润上行编钟
  | 'turnStart' // 回合开始:轻锣
  | 'lethal' // 主帅陨落:轰鸣 + 余晖
  | 'victory' // 胜利:宫商角徵羽短号
  | 'defeat' // 失败:低音渐弱长吟

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noiseBuf: AudioBuffer | null = null
let unlockHooked = false
// 母线音量。设置页的滑块改这里;context 还没建时先记下来,建的时候直接用。
let masterVolume = 0.85

export function setMasterVolume(v: number): void {
  masterVolume = Math.max(0, Math.min(1, v))
  if (master) master.gain.value = masterVolume
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (ctx) return ctx
  try {
    const Ctor =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
    // 母线:总增益 → 轻压限(防多层叠加破音)→ 输出
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.knee.value = 22
    comp.ratio.value = 5
    comp.attack.value = 0.002
    comp.release.value = 0.12
    comp.connect(ctx.destination)
    master = ctx.createGain()
    master.gain.value = masterVolume
    master.connect(comp)
  } catch {
    ctx = null
    master = null
  }
  return ctx
}

// 挂常驻手势监听:iOS Safari 必须在用户交互内 resume;
// 切后台再回来 context 可能再次 suspended,常驻监听可反复恢复。
export function initSound(): void {
  if (unlockHooked || typeof window === 'undefined') return
  unlockHooked = true
  const resume = () => {
    if (!useSettings.getState().soundEnabled) return
    const c = getCtx()
    if (c && c.state === 'suspended') c.resume().catch(() => undefined)
  }
  window.addEventListener('pointerdown', resume, { passive: true })
  window.addEventListener('touchstart', resume, { passive: true })
}

// ---------- 合成积木 ----------

interface ToneSpec {
  at?: number // 相对触发时刻的偏移(秒)
  freq: number
  to?: number // 结束频率(滑音)
  dur: number
  type?: OscillatorType
  gain?: number
  attack?: number
  detune?: number
}

function tone(c: AudioContext, when: number, s: ToneSpec): void {
  if (!master) return
  const t0 = when + (s.at ?? 0)
  const osc = c.createOscillator()
  osc.type = s.type ?? 'sine'
  osc.frequency.setValueAtTime(s.freq, t0)
  if (s.to !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, s.to), t0 + s.dur)
  }
  if (s.detune) osc.detune.setValueAtTime(s.detune, t0)
  const g = c.createGain()
  const peak = s.gain ?? 0.1
  const attack = s.attack ?? 0.005
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + s.dur)
  osc.connect(g)
  g.connect(master)
  osc.start(t0)
  osc.stop(t0 + s.dur + 0.05)
}

interface NoiseSpec {
  at?: number
  dur: number
  gain?: number
  filter?: BiquadFilterType
  freq?: number
  to?: number // 滤波中心频率扫频终点
  q?: number
  attack?: number
}

function noise(c: AudioContext, when: number, s: NoiseSpec): void {
  if (!master) return
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate)
    const data = noiseBuf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  const t0 = when + (s.at ?? 0)
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true
  const f = c.createBiquadFilter()
  f.type = s.filter ?? 'bandpass'
  f.frequency.setValueAtTime(s.freq ?? 1000, t0)
  if (s.to !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(40, s.to), t0 + s.dur)
  f.Q.value = s.q ?? 0.9
  const g = c.createGain()
  const peak = s.gain ?? 0.08
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + (s.attack ?? 0.008))
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + s.dur)
  src.connect(f)
  f.connect(g)
  g.connect(master)
  src.start(t0)
  src.stop(t0 + s.dur + 0.05)
}

// 一记战鼓:下坠正弦重击
function drum(c: AudioContext, when: number, at: number, freq = 96, gain = 0.24, dur = 0.24): void {
  tone(c, when, { at, freq, to: freq * 0.42, dur, type: 'sine', gain, attack: 0.006 })
  noise(c, when, { at, dur: dur * 0.5, filter: 'lowpass', freq: 260, gain: gain * 0.4 })
}

// ---------- 音色定义 ----------

const SFX: Record<SfxName, (c: AudioContext, t: number) => void> = {
  // UI 轻击:短促木鱼粒
  buttonTap(c, t) {
    tone(c, t, { freq: 920, to: 480, dur: 0.045, type: 'sine', gain: 0.07 })
    noise(c, t, { dur: 0.03, filter: 'bandpass', freq: 2400, q: 2, gain: 0.025 })
  },

  // 出牌:木质闷响落子
  cardPlay(c, t) {
    tone(c, t, { freq: 210, to: 96, dur: 0.09, type: 'sine', gain: 0.22 })
    tone(c, t, { at: 0.008, freq: 88, dur: 0.12, type: 'triangle', gain: 0.12 })
    noise(c, t, { dur: 0.045, filter: 'bandpass', freq: 1100, q: 1.4, gain: 0.07 })
  },

  // 锦囊施放:气声呼啸扫升 + 双音铃
  stratagemCast(c, t) {
    noise(c, t, { dur: 0.38, filter: 'bandpass', freq: 480, to: 2600, q: 1.2, gain: 0.09, attack: 0.05 })
    tone(c, t, { at: 0.18, freq: 1046.5, dur: 0.5, type: 'sine', gain: 0.11 })
    tone(c, t, { at: 0.18, freq: 1568, dur: 0.34, type: 'sine', gain: 0.045, detune: 8 })
    tone(c, t, { at: 0.26, freq: 523.25, dur: 0.4, type: 'triangle', gain: 0.05 })
  },

  // 攻击:金铁交鸣(高频噪声劈啸 + 非谐泛音 + 低频冲力)
  attack(c, t) {
    noise(c, t, { dur: 0.09, filter: 'highpass', freq: 2600, gain: 0.14 })
    tone(c, t, { freq: 1244, dur: 0.16, type: 'triangle', gain: 0.06 })
    tone(c, t, { at: 0.004, freq: 1867, dur: 0.1, type: 'triangle', gain: 0.04, detune: -12 })
    tone(c, t, { freq: 240, to: 100, dur: 0.09, type: 'sawtooth', gain: 0.1 })
  },

  // 受击:低沉闷响
  hit(c, t) {
    tone(c, t, { freq: 130, to: 50, dur: 0.16, type: 'sine', gain: 0.26 })
    noise(c, t, { dur: 0.1, filter: 'lowpass', freq: 320, gain: 0.11 })
  },

  // 单挑:两音戏剧性重锤(战鼓垫底)
  duel(c, t) {
    drum(c, t, 0, 88, 0.26)
    tone(c, t, { freq: 220, dur: 0.16, type: 'sawtooth', gain: 0.08 })
    tone(c, t, { freq: 220, dur: 0.18, type: 'triangle', gain: 0.1 })
    drum(c, t, 0.2, 104, 0.28)
    tone(c, t, { at: 0.2, freq: 330, dur: 0.26, type: 'sawtooth', gain: 0.09 })
    tone(c, t, { at: 0.2, freq: 330, dur: 0.3, type: 'triangle', gain: 0.11 })
  },

  // 阵亡:蒙皮闷鼓,一记入土
  death(c, t) {
    tone(c, t, { freq: 92, to: 34, dur: 0.36, type: 'sine', gain: 0.28 })
    noise(c, t, { dur: 0.22, filter: 'lowpass', freq: 210, gain: 0.1 })
    tone(c, t, { at: 0.05, freq: 55, dur: 0.4, type: 'triangle', gain: 0.08 })
  },

  // 治疗:温润上行编钟
  heal(c, t) {
    tone(c, t, { freq: 523.25, dur: 0.3, type: 'triangle', gain: 0.08 })
    tone(c, t, { at: 0.09, freq: 659.25, dur: 0.3, type: 'triangle', gain: 0.075 })
    tone(c, t, { at: 0.18, freq: 783.99, dur: 0.42, type: 'triangle', gain: 0.07 })
    tone(c, t, { at: 0.18, freq: 1567.98, dur: 0.3, type: 'sine', gain: 0.02 })
  },

  // 回合开始:轻锣一声,水晶回满
  turnStart(c, t) {
    tone(c, t, { freq: 196, to: 186, dur: 0.85, type: 'sine', gain: 0.15 })
    tone(c, t, { freq: 294, dur: 0.6, type: 'sine', gain: 0.07, detune: 6 })
    noise(c, t, { dur: 0.16, filter: 'highpass', freq: 3200, gain: 0.018, attack: 0.03 })
  },

  // 主帅陨落:轰鸣 + 金色余晖
  lethal(c, t) {
    tone(c, t, { freq: 110, to: 30, dur: 0.42, type: 'sine', gain: 0.3 })
    noise(c, t, { dur: 0.3, filter: 'bandpass', freq: 500, to: 120, q: 0.8, gain: 0.14 })
    tone(c, t, { at: 0.06, freq: 130.8, to: 122, dur: 0.9, type: 'sine', gain: 0.12 })
    tone(c, t, { at: 0.06, freq: 196, dur: 0.7, type: 'sine', gain: 0.06, detune: -8 })
  },

  // 胜利:宫商角徵羽五声短号(C D E G A → C)
  victory(c, t) {
    const notes = [523.25, 587.33, 659.25, 783.99, 880]
    notes.forEach((f, i) => {
      tone(c, t, { at: i * 0.11, freq: f, dur: 0.22, type: 'triangle', gain: 0.12 })
      tone(c, t, { at: i * 0.11, freq: f, dur: 0.18, type: 'sawtooth', gain: 0.028 })
    })
    tone(c, t, { at: 0.56, freq: 1046.5, dur: 0.55, type: 'triangle', gain: 0.13 })
    tone(c, t, { at: 0.56, freq: 523.25, dur: 0.55, type: 'sine', gain: 0.07 })
    drum(c, t, 0, 98, 0.22)
    drum(c, t, 0.56, 120, 0.26)
  },

  // 失败:低音渐弱长吟
  defeat(c, t) {
    tone(c, t, { freq: 110, to: 92, dur: 1.5, type: 'sawtooth', gain: 0.07 })
    tone(c, t, { freq: 82.4, to: 70, dur: 1.6, type: 'sawtooth', gain: 0.06, detune: 10 })
    tone(c, t, { freq: 55, dur: 1.4, type: 'sine', gain: 0.14 })
    tone(c, t, { at: 0.25, freq: 233, to: 210, dur: 0.9, type: 'sine', gain: 0.05 })
  },
}

// ---------- 播放入口 ----------

export function playSfx(name: SfxName): void {
  if (!useSettings.getState().soundEnabled) return
  const c = getCtx()
  if (!c || !master) return
  if (c.state === 'suspended') c.resume().catch(() => undefined)
  try {
    SFX[name](c, c.currentTime + 0.002)
  } catch {
    // 合成失败静默忽略,绝不影响游戏
  }
}
