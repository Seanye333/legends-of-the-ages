import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Language } from '../ui/i18n'

// 单机 AI 难度。名字取自兵法典故,对应 greedy.ts 的失误概率。
// 四档:新兵 / 宿将 / 名将 / 军神。
// 军神在名将之上多一层**整回合规划**(ai/planner.ts)——
// 实测 120 局对打 71.7% 胜率,不是换皮。
// 玩家可选的敌手档位。
//
// **'oracle'(天機)已下架,但类型里留着** —— 老存档里存的就是这个值,
// 删掉类型会让那些存档在 TS 层面变成非法值。读取时统一折算成 'marshal'
// (见下面的 normalizeDifficulty)。
//
// 下架理由:三次实测(各 144 局)天機对军神都是 52-53%,z<1,统计上
// 分不出强弱,而它慢 3 倍。让玩家多等两倍时间去换一个测不出来的差别,
// 是这个难度选择器在骗人。详细数据记在 ai/greedy.ts 的 AI_LEVELS.oracle 上。
export type Difficulty = 'recruit' | 'veteran' | 'general' | 'marshal' | 'oracle'

// 玩家真正能选的那几档(界面渲染用这个,不要用 Difficulty 全集)
export const SELECTABLE_DIFFICULTIES = ['recruit', 'veteran', 'general', 'marshal'] as const

// 老存档里的 'oracle' 折算成 'marshal':两者实测没有显著差别,
// 而 marshal 快 3 倍 —— 对那些玩家是纯赚。
export function normalizeDifficulty(d: Difficulty): Exclude<Difficulty, 'oracle'> {
  return d === 'oracle' ? 'marshal' : d
}

interface SettingsState {
  language: Language
  soundEnabled: boolean
  // 音量原来只有开/关。合成音效的响度差别很大(斩杀的轰鸣 vs 出牌的木响),
  // 没有滑块就只能整体关掉。0~1,喂给 sound.ts 的 master gain。
  volume: number
  // 音乐与音效分开:很多人愿意留着出牌反馈但不想要背景乐
  musicEnabled: boolean
  musicVolume: number
  difficulty: Difficulty
  // 减少动效:跟随系统 prefers-reduced-motion,但允许手动覆盖 ——
  // 战斗特效是全站动效最猛的地方,晕动敏感的人需要一个明确的开关。
  reducedMotion: boolean
  // 卡背:唯一一样**对手也看得见**的成就展示(见 content/cardBacks.ts)
  cardBack: string
  // 色觉辅助:凡是**只靠颜色**传达的信息,补一层形状/文字。
  // 主义符号(DOCTRINE_GLYPH)是一直开着的,这个开关管的是剩下那几处:
  // 稀有度玉印(四种颜色、同一个形状)、场上单位的「可攻击 / 可被指定」两圈光。
  colorBlind: boolean
  // 界面缩放。**不是只改字号** —— 见 main.tsx 那段说明:全站字号几乎都写成
  // clamp(px, vh, px),单改根字号对它们一点作用都没有。
  uiScale: number
  // 字形:卡池文案是繁體(从姊妹仓库导入),界面文案是手写的简体。
  // 这个开关把**卡池那一半**转成简体。
  //
  // 默认仍是 'trad'(即原样)。
  //
  // **试过翻成 'simp',退回来了** —— 记在这里免得下次再试一遍:
  // 动机是对的(默认体验确实是混排的:「連日到營」挨着「全卡池 2392 张」,
  // 军衔那行「距**什長**还差 20」前两字繁体后两字简体),而且 'trad' 永远
  // 不可能一致,除非把界面几百处 t() 全改写成繁體。
  // 但实测翻默认会让 **27 个端到端用例**同时红:整套 e2e 是按卡池的原文
  // (繁體卡名、羁绊名、Boss 台词)找元素的。那不是几个断言的事,
  // 是「这个游戏的正字法是哪一种」——属于产品决定,不该由一次重构顺手改掉。
  //
  // 这一轮做的是另一半:把转换表补厚(東吳連興愛內運寬 这些极常用字
  // 此前根本不在表里,开了开关也不转)。现在开关是真的可用了。
  zhVariant: 'trad' | 'simp'
  // 卡面画风。'art' = 立绘;'ink' = **书法拓印**:不加载任何图片,
  // 全部走那层本来只作兜底的拓印风(主义色晕染 + 印环 + 姓氏书法大字)。
  // 它不只是「省流量」—— 2,375 张卡里只有签名卡有真立绘,其余本来就是拓印,
  // 混排时那种参差感在图鉴里最明显。全站统一成拓印之后,它是一套自洽的画风。
  portraitStyle: 'art' | 'ink'
  // 觀星:今夜的天象是否真的作用到对局上(标题页的天象**始终**显示,
  // 这个开关只管修正)。默认开 —— 天象双方同吃、量级压在「开局多两点护甲」,
  // 而且**调过曲线的模式一律不吃**(见 matchStore.applyOmen)。
  stargazing: boolean
  // 牌桌样式。舆图(默认,复用战场底图)/ 木案 / 绢帛。
  // **全部程序生成,零新素材** —— 木案是两层渐变加纹理,绢帛是经纬两向的细纹。
  // 包体红线 150MB 里立绘已经占了 59.6MB,三张牌桌图是加不起的。
  tableStyle: 'map' | 'wood' | 'silk'
  setLanguage: (lang: Language) => void
  setSoundEnabled: (on: boolean) => void
  setVolume: (v: number) => void
  setMusicEnabled: (on: boolean) => void
  setMusicVolume: (v: number) => void
  setDifficulty: (d: Difficulty) => void
  setReducedMotion: (on: boolean) => void
  setCardBack: (id: string) => void
  setColorBlind: (on: boolean) => void
  setUiScale: (v: number) => void
  setZhVariant: (v: 'trad' | 'simp') => void
  setPortraitStyle: (v: 'art' | 'ink') => void
  setStargazing: (on: boolean) => void
  setTableStyle: (v: 'map' | 'wood' | 'silk') => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'zh',
      soundEnabled: true,
      volume: 0.85,
      musicEnabled: true,
      musicVolume: 0.6,
      difficulty: 'veteran',
      reducedMotion: false,
      cardBack: 'back-default',
      colorBlind: false,
      uiScale: 1,
      zhVariant: 'trad',
      portraitStyle: 'art',
      stargazing: true,
      tableStyle: 'map',
      setLanguage: (language) => set({ language }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      setMusicEnabled: (musicEnabled) => set({ musicEnabled }),
      setMusicVolume: (musicVolume) => set({ musicVolume: Math.max(0, Math.min(1, musicVolume)) }),
      setDifficulty: (difficulty) => set({ difficulty }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setCardBack: (cardBack) => set({ cardBack }),
      setColorBlind: (colorBlind) => set({ colorBlind }),
      // 夹在 0.8~1.5:再小手指点不准,再大横屏牌桌会塞不下一手牌
      setUiScale: (uiScale) => set({ uiScale: Math.max(0.8, Math.min(1.5, uiScale)) }),
      setZhVariant: (zhVariant) => set({ zhVariant }),
      setPortraitStyle: (portraitStyle) => set({ portraitStyle }),
      setStargazing: (stargazing) => set({ stargazing }),
      setTableStyle: (tableStyle) => set({ tableStyle }),
    }),
    { name: 'qiangu-settings' },
  ),
)
