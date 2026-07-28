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
  | 'draw' // 抽牌:纸帛抽出的摩擦
  | 'mana' // 法力水晶点亮:清脆玉磬
  | 'bond' // 羁绊/宿敌触发:双音共鸣
  | 'armorBreak' // 护甲破碎:甲片崩裂
  | 'discover' // 发现三选一:翻开的气声

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

  // 抽牌:纸帛从牌堆里抽出来的那一下摩擦。
  // 刻意做得**很轻**(gain 0.03 量级)——抽牌一回合响好几次,
  // 稍微重一点就变成噪音;它的作用只是让「牌确实进手了」有个确认,不是演出。
  draw(c, t) {
    noise(c, t, { dur: 0.09, filter: 'bandpass', freq: 1800, to: 3400, q: 0.9, gain: 0.032 })
    tone(c, t, { at: 0.02, freq: 640, to: 880, dur: 0.06, type: 'sine', gain: 0.022 })
  },

  // 法力水晶点亮:清脆玉磬。逐颗点亮时会连响几声,
  // 所以做成极短的高频粒 —— 连响时听起来是一串,不是一堆。
  mana(c, t) {
    tone(c, t, { freq: 1318.5, dur: 0.11, type: 'sine', gain: 0.05 })
    tone(c, t, { at: 0.005, freq: 1975.5, dur: 0.07, type: 'sine', gain: 0.022, detune: 5 })
  },

  // 羁绊/宿敌触发:两个音同时响的共鸣 —— 「两个人凑在一起」的声音直译。
  // 用纯五度(C-G),五声音阶里最稳的那个音程。
  bond(c, t) {
    tone(c, t, { freq: 523.25, dur: 0.6, type: 'triangle', gain: 0.075 })
    tone(c, t, { freq: 783.99, dur: 0.6, type: 'triangle', gain: 0.065, detune: -4 })
    tone(c, t, { at: 0.1, freq: 1046.5, dur: 0.5, type: 'sine', gain: 0.03 })
    noise(c, t, { dur: 0.2, filter: 'highpass', freq: 4200, gain: 0.012, attack: 0.06 })
  },

  // 护甲破碎:甲片崩裂。和「受击」要能一耳朵分开 ——
  // 受击是闷的(肉),这个是脆的(金属),所以走高频噪声 + 短促非谐音。
  armorBreak(c, t) {
    noise(c, t, { dur: 0.14, filter: 'highpass', freq: 3000, gain: 0.1 })
    tone(c, t, { freq: 880, to: 300, dur: 0.1, type: 'square', gain: 0.05 })
    tone(c, t, { at: 0.03, freq: 1400, to: 620, dur: 0.09, type: 'square', gain: 0.03, detune: 14 })
    tone(c, t, { at: 0.02, freq: 160, to: 70, dur: 0.14, type: 'sine', gain: 0.12 })
  },

  // 发现(三选一):翻开的气声,尾巴上一个上扬 —— 「请你挑」的语气。
  discover(c, t) {
    noise(c, t, { dur: 0.26, filter: 'bandpass', freq: 900, to: 2200, q: 1.1, gain: 0.05, attack: 0.04 })
    tone(c, t, { at: 0.12, freq: 659.25, to: 987.77, dur: 0.26, type: 'triangle', gain: 0.06 })
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

// ============================================================
// 背景音乐
// ============================================================
//
// 此前全作**没有任何音乐** —— 只有 12 个音效。
// 这里同样是纯合成、零音频文件,与音效共用同一个 AudioContext:
// 打包体积不增加一个字节,也不用管音频资源的加载与缓存。
//
// 音乐性上的三个决定:
// 1. **五声音阶(宫商角徵羽 = C D E G A)**,不用半音 —— 五声里任意两个音同时响
//    都不会难听,所以随机化的旋律永远不会跑出调外,不需要写和声规则。
// 2. **不循环固定旋律。** 每小节现掷骰子选音,只约束「大跳之后回落」。
//    固定循环听二十分钟会烦,而随机游走不会 —— 玩家记不住它,也就不会腻。
// 3. **音色是拨弦(古琴/筝)**:极短的起音 + 长指数衰减 + 轻微失谐的两层叠加。
//    战斗场景另加一条低音持续音(弓弦),把节奏感压住。
//
// 调度用「预排」而不是 setTimeout 直接发声:每 250ms 醒一次,把未来 1 秒内的音符
// 按 AudioContext 的时间轴排好。setTimeout 的抖动在音乐上是能听出来的,
// 而 AudioContext 的时钟是采样精确的。

export type MusicScene = 'title' | 'match'

// 换一个调式。传时代块 key(见 content/eras.ts)或直接传调式名;认不出就回宫调。
export function setMusicEra(era: string | undefined): void {
  const mode = (era && ERA_MODE[era]) ?? 'gong'
  PENTATONIC = MODES[mode] ?? MODES.gong
}

let musicGain: GainNode | null = null
let musicTimer: number | null = null
let musicScene: MusicScene | null = null
let nextNoteAt = 0
let step = 0
let lastDegree = 0

// 五声音阶的五个**调式**(宫/商/角/徵/羽为主音各转一次)。
// 之前全游戏只有一个「宫调」,于是从标题到第十六关、从先秦到明清,
// 听到的是同一段旋律的同一个色彩 —— 一局四十分钟里它会变得非常明显。
//
// 转调是这里最便宜的一笔:音阶本身不变,只换从哪一级起算,
// 于是每个时代块有自己的色彩,而**一个音符都不用写**。
//   宫 明亮端正(先秦)· 商 肃杀(秦汉)· 角 柔和(三国)
//   徵 开阔(隋唐)· 羽 幽暗(宋元、明清火器与边塞)
const MODES: Record<string, number[]> = {
  gong: [0, 2, 4, 7, 9],
  shang: [0, 2, 5, 7, 10],
  jue: [0, 3, 5, 8, 10],
  zhi: [0, 2, 5, 7, 9],
  yu: [0, 3, 5, 7, 10],
}

// 时代块 → 调式。用 content/eras.ts 那张表的 key,免得两处各排一套时代。
const ERA_MODE: Record<string, keyof typeof MODES> = {
  'pre-qin': 'gong',
  'qin-han': 'shang',
  'three-kingdoms': 'jue',
  'sui-tang': 'zhi',
  'song-yuan': 'yu',
  'ming-qing': 'yu',
}

let PENTATONIC = MODES.gong // 宫商角徵羽(半音数);随场景转调
const SCHEDULE_AHEAD = 1.0 // 排到未来多少秒
const TICK_MS = 250

// ---------- 紧张度 ----------
//
// 局势紧不紧张,音乐得知道。0 = 开局风平浪静,1 = 下一回合就要分生死。
//
// 【为什么值得做】
// 一局四十分钟,从开局到斩杀线用的是同一段随机游走 —— 而玩家的心率完全不同。
// 音乐是唯一能**在玩家意识到之前**告诉他「情况不对了」的通道:
// 血量掉到十几时底鼓变密,他会先觉得慌,再回头看血条。
//
// 【为什么不做成「战斗/平静」两段式】
// 两段式要在切换点做交叉淡化,而这里的旋律是现场生成的、没有段落边界。
// 连续量反而更简单:紧张度只改三个旋钮(拍速、低音密度、留白概率),
// 一个音符都不用重写,而且中间态天然平滑。
let tension = 0

export function setMusicTension(v: number): void {
  const next = Math.max(0, Math.min(1, v))
  // 只在变化明显时才更新,避免每帧调用引起的抖动
  if (Math.abs(next - tension) > 0.02) tension = next
}

function midiToFreq(semitonesFromC4: number): number {
  return 261.63 * Math.pow(2, semitonesFromC4 / 12)
}

// 五声音阶上的随机游走:多数时候走相邻音,偶尔跳,大跳之后必回落。
function nextDegree(): number {
  const jump = Math.random()
  let d = lastDegree
  if (jump < 0.55) d += Math.random() < 0.5 ? 1 : -1
  else if (jump < 0.8) d += Math.random() < 0.5 ? 2 : -2
  else if (jump < 0.92) d += Math.random() < 0.5 ? 4 : -4
  // 大跳之后往中心收，避免旋律一路飘走
  if (Math.abs(d) > 7) d = Math.round(d / 2)
  lastDegree = d
  return d
}

function degreeToFreq(d: number): number {
  const octave = Math.floor(d / PENTATONIC.length)
  const idx = ((d % PENTATONIC.length) + PENTATONIC.length) % PENTATONIC.length
  return midiToFreq(PENTATONIC[idx] + octave * 12)
}

// 拨弦:两层轻微失谐的正弦 + 极短起音 + 长指数衰减
function pluck(c: AudioContext, at: number, freq: number, gain: number, dur: number): void {
  if (!musicGain) return
  for (const [mult, g, detune] of [
    [1, gain, 0],
    [2.01, gain * 0.28, 6],
  ] as const) {
    const osc = c.createOscillator()
    const env = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq * mult
    osc.detune.value = detune
    env.gain.setValueAtTime(0, at)
    env.gain.linearRampToValueAtTime(g, at + 0.012)
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    osc.connect(env)
    env.connect(musicGain)
    osc.start(at)
    osc.stop(at + dur + 0.05)
  }
}

// 低音持续音:战斗场景用,把节奏压住
function drone(c: AudioContext, at: number, freq: number, dur: number): void {
  if (!musicGain) return
  const osc = c.createOscillator()
  const env = c.createGain()
  const lp = c.createBiquadFilter()
  osc.type = 'sawtooth'
  osc.frequency.value = freq
  lp.type = 'lowpass'
  lp.frequency.value = 320
  env.gain.setValueAtTime(0, at)
  env.gain.linearRampToValueAtTime(0.05, at + dur * 0.35)
  env.gain.linearRampToValueAtTime(0, at + dur)
  osc.connect(lp)
  lp.connect(env)
  env.connect(musicGain)
  osc.start(at)
  osc.stop(at + dur + 0.05)
}

function scheduleMusic(): void {
  const c = getCtx()
  if (!c || !musicGain || !musicScene) return
  // 标题页疏朗、对战页略密;紧张度再往上压最多四分之一拍长(越紧张越急)
  const base = musicScene === 'title' ? 1.1 : 0.85
  const t = musicScene === 'match' ? tension : 0
  const beat = base * (1 - 0.25 * t)
  // 低音间隔:平时 8 拍一次,危急时 4 拍一次 —— 底鼓变密是「心跳加快」的直译
  const bassEvery = t > 0.6 ? 4 : 8
  // 留白概率随紧张度收紧:平静时三成留白(呼吸),危急时几乎不留
  const restChance = 0.28 * (1 - 0.7 * t)
  while (nextNoteAt < c.currentTime + SCHEDULE_AHEAD) {
    const at = Math.max(nextNoteAt, c.currentTime + 0.02)
    // 每 N 拍一个低音;其余为拨弦,偶尔留白(留白比音符更重要)
    if (step % bassEvery === 0) {
      if (musicScene === 'match') drone(c, at, degreeToFreq(lastDegree) / 4, beat * bassEvery)
      pluck(c, at, degreeToFreq(0) / 2, 0.1, 3.2)
    } else if (Math.random() > restChance) {
      const d = nextDegree()
      pluck(c, at, degreeToFreq(d), 0.075, 2.4)
      // 偶尔叠一个五度,像古琴的按音
      if (Math.random() < 0.18) pluck(c, at + 0.06, degreeToFreq(d + 3), 0.04, 1.8)
      // 危急时给高音区加一层短促的泛音,像弦被绷紧
      if (t > 0.75 && Math.random() < 0.3) pluck(c, at + 0.04, degreeToFreq(d + 5), 0.03, 0.9)
    }
    nextNoteAt = at + beat
    step++
  }
}

export function startMusic(scene: MusicScene): void {
  const s = useSettings.getState()
  if (!s.musicEnabled || !s.soundEnabled) return
  if (musicScene === scene && musicTimer !== null) return
  stopMusic()
  const c = getCtx()
  if (!c || !master) return
  if (c.state === 'suspended') c.resume().catch(() => undefined)
  musicGain = c.createGain()
  // 音乐比音效低得多:它是背景,不该盖住出牌与攻击
  musicGain.gain.value = s.musicVolume * 0.5
  musicGain.connect(master)
  musicScene = scene
  nextNoteAt = c.currentTime + 0.1
  step = 0
  lastDegree = 0
  scheduleMusic()
  musicTimer = window.setInterval(scheduleMusic, TICK_MS)
}

export function stopMusic(): void {
  if (musicTimer !== null) {
    window.clearInterval(musicTimer)
    musicTimer = null
  }
  musicScene = null
  if (musicGain && ctx) {
    // 淡出而不是硬切,否则会有「啪」的一声
    const g = musicGain
    try {
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.25)
      window.setTimeout(() => g.disconnect(), 1200)
    } catch {
      g.disconnect()
    }
  }
  musicGain = null
}

export function setMusicVolume(v: number): void {
  if (musicGain) musicGain.gain.value = Math.max(0, Math.min(1, v)) * 0.5
}
