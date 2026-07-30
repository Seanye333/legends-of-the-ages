import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type {
  ChooseMode,
  Command,
  GameEvent,
  GameState,
  TargetRef,
} from '../../engine/types'
import { legalCommands } from '../../engine/legal'
import { skyOf } from '../../engine/resolve'
import { useFlip } from '../useFlip'
import { SKY_SPAN } from '../../engine/types'
import { SKY_COLOR, SKY_GLYPH, SKY_NAME } from '../doctrineColors'

// 战场环境 → 牌桌底色。按规则 id 查,认不出的用一层中性土色 ——
// 内容层随时会加新环境,而「加了一片新战场,牌桌就不染色了」是最难查的那种缺失。
const FIELD_TINT: Record<string, string> = {
  'field-chibi': 'rgba(224, 96, 40, 0.20)', // 赤壁在烧
  'field-snow': 'rgba(150, 190, 230, 0.16)', // 大雪封山
  'field-steppe': 'rgba(200, 176, 110, 0.16)', // 平原走马
  'field-river': 'rgba(80, 150, 190, 0.18)', // 江河天险
}
import { CARDS_BY_ID } from '../../content/cards'
import { useMatch } from '../../app/matchStore'
import { usePickCompact, usePickText, useT } from '../i18n'
import { rematch } from '../matchSetup'
import { HeroPlate } from '../components/HeroPlate'
import { GeneralToken } from '../components/GeneralToken'
import { HandFan } from '../components/HandFan'
import { MulliganOverlay } from '../components/MulliganOverlay'
import { DiscoverOverlay } from '../components/DiscoverOverlay'
import { ResultOverlay } from '../components/ResultOverlay'
import { PuzzleResultOverlay } from '../components/PuzzleResultOverlay'
import { puzzleDefById } from '../../content/dailyPuzzle'
import { solveLethal } from '../../ai/lethalSolver'
import { describeSolution } from '../puzzleSolution'
import { retryLast } from '../matchSetup'
import { BattleLog } from '../components/BattleLog'
import { cardName, eventKind, formatEvent, heroName } from '../components/eventText'
import type { LogLine } from '../components/BattleLog'
import { targetFloatKey } from '../components/floats'
import { matchErrorText } from '../components/errorText'
import { Portrait } from '../components/Portrait'
import { CardInspect } from '../components/CardInspect'
import { TutorialCoach } from '../components/TutorialCoach'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { TurnRope } from '../components/TurnRope'
import { BossVoice } from '../components/BossVoice'
import { GeneralVoice } from '../components/GeneralVoice'
import { TargetArrow } from '../components/TargetArrow'
import { GraveyardPanel } from '../components/GraveyardPanel'
import { EmoteWheel } from '../components/EmoteWheel'
import type { CardDef } from '../../engine/types'
import { useEventAnimations } from '../useEventAnimations'
import { initSound, playSfx, setMusicEra, setMusicTension, startMusic, stopMusic } from '../sound'
import { haptic } from '../haptics'
import { whyNotPlayable } from '../whyNotPlayable'
import { exportRecapImage } from '../recapExport'
import { HEROES_BY_ID } from '../../content/overrides/heroes'
import { ERA_OF, type Era } from '../../content/eras'

// 六个时代块各一套色温。三国是默认(底图本来就是那个调子),所以它不变。
const ERA_TINT: Record<Era, string> = {
  'pre-qin': 'hue-rotate(-18deg) saturate(0.85) brightness(0.96)',
  'qin-han': 'hue-rotate(-8deg) saturate(1.08)',
  'three-kingdoms': 'none',
  'sui-tang': 'hue-rotate(8deg) saturate(1.12) brightness(1.04)',
  'song-yuan': 'hue-rotate(150deg) saturate(0.6) brightness(0.94)',
  'ming-qing': 'hue-rotate(-24deg) saturate(1.1) brightness(0.92)',
}
import { useSettings } from '../../app/settingsStore'
import styles from './MatchScreen.module.css'

// 视角座位:非热座恒为 0;热座时谁该动谁就在下面(调度阶段看谁还没调度完)。
// 抽成纯函数是因为 useMemo 的依赖里也要用它,而那时组件内的 viewer 还没算出来。
function viewerSeat(state: GameState, hotSeat: boolean): 0 | 1 {
  if (!hotSeat) return 0
  if (state.phase === 'mulligan') return state.players[0].mulliganDone ? 1 : 0
  return state.activePlayer as 0 | 1
}

type PlayCmd = Extract<Command, { type: 'PlayCard' }>
type AttackCmd = Extract<Command, { type: 'Attack' }>
type PowerCmd = Extract<Command, { type: 'UseHeroPower' }>

type Selection =
  // mode:抉择卡选定的模式(非抉择卡为 undefined);目标筛选按它过滤 playCmds
  | { kind: 'hand'; iid: number; mode?: number }
  | { kind: 'attacker'; iid: number }
  // vice:双将时指的是副将技。**必须带上** —— 主将技与副将技的目标池可能不同,
  // 不区分的话选中副将技会去高亮主将技的目标,点下去必然被引擎拒。
  | { kind: 'heroPower'; vice: boolean }
  | null

interface MatchScreenProps {
  onExit: () => void
}

// 对战主画面:横屏炉石式布局。人类恒为 0 号玩家。
export function MatchScreen({ onExit }: MatchScreenProps) {
  const t = useT()
  const pickCompact = usePickCompact()
  const pickText = usePickText()
  const {
    state,
    lastEvents,
    error,
    send,
    reset,
    mode,
    tutorial,
    remoteStatus,
    ratingResult,
    turnDeadline,
    incomingEmote,
    sendEmote,
    rematchState,
    requestRematch,
    retryConnection,
    stats,
    spectating,
    puzzle,
    puzzleId,
    puzzleResult,
    puzzleReward,
    puzzleHistory,
    puzzlePeeked,
    undoPuzzle,
    markPuzzlePeeked,
    practice,
    bossId,
    hotSeat,
  } = useMatch()
  const puzzleDef = puzzleId ? puzzleDefById(puzzleId) : undefined
  const [showHint, setShowHint] = useState(false)
  const [solution, setSolution] = useState<string[] | null>(null)
  const { soundEnabled, setSoundEnabled, language: lang } = useSettings()
  const [selection, setSelection] = useState<Selection>(null)
  // 战线合拢:一个单位被移出数组后,右边所有人的位置在同一帧内就变了 ——
  // 没有中间态可以过渡,于是场面每死一个人就闪一下。FLIP 把它翻过来(见 useFlip)。
  const foeRowRef = useRef<HTMLDivElement>(null)
  const myRowRef = useRef<HTMLDivElement>(null)
  // 抉择卡的模式选择器(非空 = 正在选模式)
  const [modeChoice, setModeChoice] = useState<{ iid: number; modes: ChooseMode[] } | null>(null)
  // 「这张牌为什么打不出」的即时提示。自动消失,不需要玩家关 ——
  // 它是对刚才那一次点击的回答,不是一个待办。
  const [whyToast, setWhyToast] = useState<string | null>(null)
  useEffect(() => {
    if (!whyToast) return
    const timer = window.setTimeout(() => setWhyToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [whyToast])
  const [log, setLog] = useState<LogLine[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [inspect, setInspect] = useState<CardDef | null>(null)
  // 认输确认原来用的是 window.confirm —— 在一个全自绘的界面里弹系统框太出戏,
  // 而且 iOS 上的样式完全不受控。
  const [confirmConcede, setConfirmConcede] = useState(false)
  const [graveOpen, setGraveOpen] = useState(false)
  // 「轮到你了」横幅:此前只有主帅面板的一次金光脉动,很容易错过 ——
  // 尤其是联机局隔了对手一整个回合之后。
  const [turnBanner, setTurnBanner] = useState(0)
  // 热座:已经接手的那个座位。与当前视角座位不一致时落帘。
  const [curtainSeat, setCurtainSeat] = useState<0 | 1 | null>(0)
  const setCurtainFor = (seat: 0 | 1) => setCurtainSeat(seat)

  // 战场色温:同一张底图,按对手的时代块换色 —— 六张 4K 底图是几十 MB,
  // 而包体红线 150MB 里立绘已经占了 65MB。filter 一行解决。
  const eraOfMatch = useMemo(() => {
    const foeCard = CARDS_BY_ID[state?.players[1].heroId ?? '']
    return foeCard ? ERA_OF[foeCard.dynasty] : 'three-kingdoms'
  }, [state])

  // 事件时间轴:动效 + 音效 + 飘字都由它按节拍产出
  const anim = useEventAnimations(state, lastEvents)

  const namesRef = useRef(new Map<number, string>())
  const processedRef = useRef<GameEvent[] | null>(null)

  useEffect(() => {
    initSound()
    // 按对手的时代块转调:先秦宫、秦汉商、三国角、隋唐徵、宋元明清羽。
    // 一局四十分钟,同一个色彩从头听到尾会非常明显 —— 而转调不用写一个音符。
    const foeCard = CARDS_BY_ID[state?.players[1].heroId ?? '']
    setMusicEra(foeCard ? ERA_OF[foeCard.dynasty] : undefined)
    startMusic('match')
    return () => stopMusic()
    // 只在进入对局时定调 —— 对手不会中途换人
  }, [])

  // 唯一规则来源:legalCommands。UI 只做筛选,不重演规则。
  const legal = useMemo(
    () => (state ? legalCommands(state, viewerSeat(state, hotSeat), CARDS_BY_ID) : []),
    [state],
  )
  const playCmds = useMemo(
    () => legal.filter((c): c is PlayCmd => c.type === 'PlayCard'),
    [legal],
  )
  const attackCmds = useMemo(
    () => legal.filter((c): c is AttackCmd => c.type === 'Attack'),
    [legal],
  )
  const playableIids = useMemo(() => new Set(playCmds.map((c) => c.iid)), [playCmds])
  const readyIids = useMemo(() => new Set(attackCmds.map((c) => c.attackerIid)), [attackCmds])
  const powerCmds = useMemo(
    () => legal.filter((c): c is PowerCmd => c.type === 'UseHeroPower'),
    [legal],
  )

  // 当前选择模式下:目标键 → 待发送命令
  const activeTargets = useMemo(() => {
    const m = new Map<string, Command>()
    if (!selection) return m
    if (selection.kind === 'hand') {
      for (const c of playCmds) {
        // 抉择卡:只认选定模式的目标(不同模式的目标可能撞同一角色)
        if (selection.mode !== undefined && c.mode !== selection.mode) continue
        if (c.iid === selection.iid && c.target) m.set(targetFloatKey(c.target), c)
      }
    } else if (selection.kind === 'heroPower') {
      for (const c of powerCmds) {
        if ((c.vice ?? false) !== selection.vice) continue
        if (c.target) m.set(targetFloatKey(c.target), c)
      }
    } else {
      for (const c of attackCmds) {
        if (c.attackerIid === selection.iid) m.set(targetFloatKey(c.target), c)
      }
    }
    return m
  }, [selection, playCmds, attackCmds, powerCmds])

  const directPlay = useMemo(
    () =>
      selection?.kind === 'hand'
        ? playCmds.find(
            (c) =>
              c.iid === selection.iid &&
              !c.target &&
              (selection.mode === undefined || c.mode === selection.mode),
          )
        : undefined,
    [selection, playCmds],
  )

  // 状态更新:合并 iid→defId 名录、生成战报、生成飘字
  useEffect(() => {
    if (!state || lastEvents === processedRef.current) return
    processedRef.current = lastEvents
    const names = namesRef.current
    for (const ev of lastEvents) {
      switch (ev.type) {
        case 'CardDrawn':
        case 'CardPlayed':
        case 'GeneralSummoned':
        case 'GeneralDied':
          names.set(ev.iid, ev.defId)
          break
        default:
          break
      }
    }
    for (const p of state.players) {
      for (const zone of [p.deck, p.hand, p.board]) {
        for (const c of zone) names.set(c.iid, c.defId)
      }
    }
    // 卡名/主帅名照双语存档,渲染时再按当前语言取,切语言旧战报也跟着变
    const ctx = {
      name: (iid: number) => cardName(names.get(iid)),
      defName: (defId: string) => cardName(defId),
      heroName: (p: 0 | 1) => heroName(state.players[p].heroId),
    }
    const entries = lastEvents.map((ev) => ({ ...formatEvent(ev, ctx), kind: eventKind(ev) }))
    if (entries.length > 0) setLog((prev) => [...prev, ...entries].slice(-300))
  }, [state, lastEvents])

  // 状态一变,清空选择(出牌/攻击/对手行动后都不残留)
  useEffect(() => setSelection(null), [state])

  // 轮到我方 → 横幅闪一下。用回合号做依赖,同一回合内的多次状态更新不会重复触发。
  const myTurnNo = state?.phase === 'main' && state.activePlayer === 0 ? state.turn : null
  useEffect(() => {
    if (myTurnNo === null) return
    setTurnBanner((n) => n + 1)
    const timer = window.setTimeout(() => setTurnBanner(0), 1400)
    return () => window.clearTimeout(timer)
  }, [myTurnNo])

  // Esc 取消选择
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelection(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 错误 → 短暂 toast。错误码要翻成人话:
  // 从前 `connect-failed` / `match-abandoned` 这种内部码是直接怼给玩家看的。
  useEffect(() => {
    if (!error) return
    setToast(pickText(matchErrorText(error)))
    const timer = window.setTimeout(() => setToast(null), 2500)
    return () => window.clearTimeout(timer)
  }, [error, pickText])

  // 对手回归 → 短暂 toast
  useEffect(() => {
    if (remoteStatus !== 'opponent-back') return
    setToast(t('对手已回到对局', 'Opponent reconnected'))
    const timer = window.setTimeout(() => setToast(null), 2500)
    return () => window.clearTimeout(timer)
  }, [remoteStatus, t])

  if (!state) {
    return (
      <div
      style={{ '--era-tint': ERA_TINT[eraOfMatch] ?? 'none' } as CSSProperties}
      className={styles.screen}>
        <div className={styles.noMatch}>
          <p>{t('没有进行中的对局', 'No match in progress')}</p>
          <button className={styles.plainBtn} onClick={onExit}>
            {t('返回标题', 'Back to Title')}
          </button>
        </div>
      </div>
    )
  }

  // 视角座位。**非热座时恒为 0** —— 与从前逐字等价,普通对局一点没变。
  // 热座(双人同机)时跟着 activePlayer 翻:谁该出牌,谁就在下面。
  // 调度阶段两人各调度一次,所以那一阶段看谁还没调度完。
  const viewer: 0 | 1 = !hotSeat
    ? 0
    : state.phase === 'mulligan'
      ? state.players[0].mulliganDone
        ? 1
        : 0
      : (state.activePlayer as 0 | 1)
  const foeSeat: 0 | 1 = viewer === 0 ? 1 : 0
  const me = state.players[viewer]
  const foe = state.players[foeSeat]

  // 战线合拢。依赖是**这一行的 iid 串** —— 只有真的有人进出才重排,
  // 而攻血变化(每回合都在发生)不该触发一次 FLIP。
  const reduceFx = useSettings((s) => s.reducedMotion)
  useFlip(foeRowRef, [foe.board.map((c) => c.iid).join(','), reduceFx], !reduceFx)
  useFlip(myRowRef, [me.board.map((c) => c.iid).join(','), reduceFx], !reduceFx)
  // 观战席没有「我方回合」可言:一切操作入口都要关掉,
  // 否则会出现「点了没反应」的迷惑体验(服务器本来就会丢弃观战席的指令)
  const myTurn = !spectating && state.phase === 'main' && state.activePlayer === viewer
  const canEndTurn = !spectating && legal.some((c) => c.type === 'EndTurn')

  // 音乐紧张度:把局面折成一个 0-1 的数喂给合成器(见 sound.ts 的 setMusicTension)。
  //
  // 三个来源,取最大值而不是加权和 —— 「我快死了」和「他快死了」都足以让人心跳加快,
  // 平均起来反而会互相抵消成「一切正常」,而那正是最不正常的时候。
  //   · 我的血:30 → 0 紧张,10 以下开始明显,5 以下拉满
  //   · 他的血:同上(斩杀线在望也是紧张,只是另一种)
  //   · 场面差:一边被压着打的时候,血量还没变但气氛已经变了
  const tension = useMemo(() => {
    const hpPart = (hp: number, armor: number) => {
      const eff = hp + armor
      return eff >= 20 ? 0 : eff <= 5 ? 1 : (20 - eff) / 15
    }
    const boardGap = Math.abs(me.board.length - foe.board.length) / 7
    return Math.min(1, Math.max(hpPart(me.heroHp, me.armor), hpPart(foe.heroHp, foe.armor), boardGap))
  }, [me.heroHp, me.armor, foe.heroHp, foe.armor, me.board.length, foe.board.length])
  useEffect(() => setMusicTension(tension), [tension])

  // 视角一换就落帘(热座)。非热座时 viewer 恒为 0,这段永远不触发。
  const curtain = hotSeat && curtainSeat !== viewer
  const sendAndClear = (cmd: Command) => {
    send(cmd)
    setSelection(null)
  }

  // 抉择卡:点击后先弹模式选择器。选定模式再走「直接打出 / 进入选目标」。
  const onPickMode = (iid: number, mode: number) => {
    setModeChoice(null)
    const variants = playCmds.filter((c) => c.iid === iid && c.mode === mode)
    if (variants.length === 0) return
    const targeted = variants.filter((c) => c.target)
    if (targeted.length === 0) {
      sendAndClear(variants.find((c) => !c.target) ?? variants[0])
    } else {
      setSelection({ kind: 'hand', iid, mode })
    }
  }

  const onHandClick = (iid: number) => {
    if (selection?.kind === 'hand' && selection.iid === iid) {
      setSelection(null)
      return
    }
    const variants = playCmds.filter((c) => c.iid === iid)
    // 打不出的牌:不再「点了没反应」,而是当场说清为什么(见 ui/whyNotPlayable.ts)。
    // 灰色只说了「不行」,而「不行」在这游戏里有六七种原因,
    // 其中至少三种新手根本想不到(场上满了 / 锦囊没有合法目标 / 还没轮到你)。
    if (variants.length === 0 || !myTurn) {
      const inst = state?.players[viewer].hand.find((c) => c.iid === iid)
      if (!inst) return
      const why = whyNotPlayable(state, viewer, inst, CARDS_BY_ID[inst.defId], playableIids)
      if (why) {
        setWhyToast(pickText(why.text))
        haptic('warn')
      }
      return
    }
    // 抉择卡:legalCommands 会给每个模式各出命令(带 mode)。先让玩家选模式。
    const inst = state?.players[viewerSeat(state, hotSeat)].hand.find((c) => c.iid === iid)
    const def = inst ? CARDS_BY_ID[inst.defId] : undefined
    if (def?.choose) {
      setSelection(null)
      setModeChoice({ iid, modes: def.choose.modes })
      return
    }
    const targeted = variants.filter((c) => c.target)
    if (targeted.length === 0) {
      sendAndClear(variants[0])
    } else {
      setSelection({ kind: 'hand', iid })
    }
  }

  const onEntityClick = (ref: TargetRef) => {
    const cmd = activeTargets.get(targetFloatKey(ref))
    if (cmd) {
      sendAndClear(cmd)
      return
    }
    if (ref.kind === 'general' && readyIids.has(ref.iid)) {
      setSelection((prev) =>
        prev?.kind === 'attacker' && prev.iid === ref.iid
          ? null
          : { kind: 'attacker', iid: ref.iid },
      )
      return
    }
    setSelection(null)
  }

  // 主公技:无目标的直接发动;需要目标的进入选目标模式(与出牌同一套交互)
  const onUseHeroPower = (vice = false) => {
    const mine = powerCmds.filter((c) => (c.vice ?? false) === vice)
    if (!myTurn || mine.length === 0) return
    // 再点一次同一颗按钮 = 取消;点另一颗 = 换选(而不是取消后什么都没选中)
    if (selection?.kind === 'heroPower' && selection.vice === vice) {
      setSelection(null)
      return
    }
    const untargeted = mine.find((c) => !c.target)
    if (untargeted) {
      playSfx('stratagemCast')
      sendAndClear(untargeted)
      return
    }
    setSelection({ kind: 'heroPower', vice })
  }

  const onConcede = () => setConfirmConcede(true)

  const handleRematch = () => {
    playSfx('buttonTap')
    setLog([])
    namesRef.current.clear()
    rematch()
  }

  const handleExit = () => {
    reset()
    onExit()
  }

  // 谜题重试:原样重开同一残局(retryLast 保留 scenario;startMatch 内部会先 reset)
  const handlePuzzleRetry = () => {
    playSfx('buttonTap')
    setLog([])
    setShowHint(false)
    setSolution(null)
    retryLast()
  }

  const handlePuzzleUndo = () => {
    playSfx('buttonTap')
    setSolution(null)
    setShowHint(false)
    undoPuzzle()
  }

  // 展示解法:对当前局面跑求解器,列出必杀线的步骤;看过就不发奖(markPuzzlePeeked)
  const handleShowSolution = () => {
    playSfx('buttonTap')
    if (!state) return
    const res = solveLethal(state, 0, CARDS_BY_ID)
    if (res && res.line.length > 0) {
      setSolution(describeSolution(state, 0, res.line, CARDS_BY_ID, pickText, t))
      markPuzzlePeeked()
    } else {
      setSolution([t('此局面已经无法斩杀了 —— 撤销一步或重来。', 'No lethal from here — undo a step or retry.')])
    }
  }

  // 军师(演武场):对**当前**局面跑同一个求解器,回答「这回合有没有斩杀线」。
  //
  // 求解器写好很久了,却只服务谜题验证与「展示解法」。它回答的恰恰是贪心玩家
  // 最常错过的那个问题 —— 场面看着不占优,其实这一回合就能带走。
  // 只开在演武场:那是练习模式,不记战绩/军令/成就,给答案不影响任何东西。
  const handleAdvise = () => {
    playSfx('buttonTap')
    if (!state) return
    const res = solveLethal(state, 0, CARDS_BY_ID)
    if (res && res.line.length > 0) {
      setSolution([
        t('本回合有斩杀线:', 'There is lethal this turn:'),
        ...describeSolution(state, 0, res.line, CARDS_BY_ID, pickText, t),
      ])
    } else {
      setSolution([
        t(
          '本回合没有斩杀线 —— 按场面价值走,别硬开。',
          'No lethal this turn — play for board value instead.',
        ),
      ])
    }
  }

  const floatsFor = (key: string) => anim.floats.filter((f) => f.targetKey === key)
  const fxFor = (key: string) => anim.fx.get(key)
  const targeting = activeTargets.size > 0 || directPlay !== undefined
  const castDef = anim.cast ? CARDS_BY_ID[anim.cast.defId] : null

  return (
    <div
      className={`${styles.screen} ${anim.lethalFlash ? styles.slowmo : ''}`}
      onClick={() => setSelection(null)}
    >
      {/* 战场的光。
          底图(中国舆图)本来是**均匀打光**的,于是整屏没有明暗对比,
          眼睛不知道该落在哪 —— 而牌桌上真正要看的东西全在正中那两排。
          两层叠加:一层暗角把四周压下去,一层中心柔光把战场托起来。
          纯 CSS、不拦点击、不参与布局。 */}
      <div className={styles.vignette} aria-hidden="true" />

      {/* 顶部:敌方主帅(居中) */}
      <div className={styles.top}>
        <HeroPlate
          ps={foe}
          enemy
          acting={state.phase === 'main' && !myTurn}
          targetable={activeTargets.has(`hero-${foeSeat}`)}
          floats={floatsFor(`hero-${foeSeat}`)}
          fx={fxFor(`hero-${foeSeat}`)}
          onClick={(e) => {
            e.stopPropagation()
            onEntityClick({ kind: 'hero', player: foeSeat })
          }}
        />
        {/* 工具条绝对定位到右上角 —— 它**不能参与顶部这一行的布局**,
            否则主帅会被按钮的宽度推离中轴(而按钮宽度随语言变)。 */}
        <div className={styles.topRight}>
          <button
            className={styles.plainBtn}
            onClick={(e) => {
              e.stopPropagation()
              playSfx('buttonTap')
              setSoundEnabled(!soundEnabled)
            }}
            title={t('音效开关', 'Sound on/off')}
          >
            {soundEnabled ? t('音', 'SFX') : t('静', 'Mute')}
          </button>
          <button
            className={styles.plainBtn}
            onClick={(e) => {
              e.stopPropagation()
              playSfx('buttonTap')
              setGraveOpen(true)
            }}
            title={t('查看双方墓地', 'View both graveyards')}
          >
            {t('墓地', 'Graves')}
          </button>
          <button
            className={styles.plainBtn}
            onClick={(e) => {
              e.stopPropagation()
              onConcede()
            }}
          >
            {t('认输', 'Concede')}
          </button>
        </div>
      </div>

      {/* 中部:两行战场 */}
      <div
        className={styles.battlefield}
        style={
          {
            // 天时与战场环境**染牌桌**,不只是角落两条横幅。
            // 极淡:它们是底色不是滤镜,浓到能认出颜色的话卡面主义色就失真了。
            '--sky-tint': SKY_COLOR[skyOf(state.turn)],
            '--field-tint': state.field ? FIELD_TINT[state.field.rule.id] ?? 'rgba(140,120,90,0.10)' : 'transparent',
          } as CSSProperties
        }
      >
        <div className={styles.row} ref={foeRowRef}>
          {foe.board.map((c) => (
            <GeneralToken
              key={c.iid}
              inst={c}
              targetable={activeTargets.has(`gen-${c.iid}`)}
              floats={floatsFor(`gen-${c.iid}`)}
              fx={fxFor(`gen-${c.iid}`)}
              onInspect={() => setInspect(CARDS_BY_ID[c.defId] ?? null)}
              onClick={(e) => {
                e.stopPropagation()
                onEntityClick({ kind: 'general', iid: c.iid })
              }}
            />
          ))}
        </div>
        <div className={styles.divider} />
        <div className={styles.row} ref={myRowRef}>
          {me.board.map((c) => (
            <GeneralToken
              key={c.iid}
              inst={c}
              ready={myTurn && readyIids.has(c.iid)}
              selected={selection?.kind === 'attacker' && selection.iid === c.iid}
              targetable={activeTargets.has(`gen-${c.iid}`)}
              floats={floatsFor(`gen-${c.iid}`)}
              fx={fxFor(`gen-${c.iid}`)}
              onInspect={() => setInspect(CARDS_BY_ID[c.defId] ?? null)}
              onClick={(e) => {
                e.stopPropagation()
                onEntityClick({ kind: 'general', iid: c.iid })
              }}
            />
          ))}
        </div>

        {/* 选目标提示条。**必须挂在战场里**,不能挂在 .screen 上 ——
            挂在 .screen 上时它是按 `bottom: 26vh` 定位的,而中轴改版把我方主帅
            移到了那个高度,于是提示条正好盖住法力水晶。
            放进战场并贴着它的下沿,无论主帅面板多高都不会撞上。 */}
        {selection && targeting && (
          <div className={styles.targetBar} onClick={(e) => e.stopPropagation()}>
            <span className={styles.targetHint}>
              {selection.kind === 'attacker'
                ? t('选择攻击目标', 'Choose attack target')
                : selection.kind === 'heroPower'
                  ? t('主公技:选择目标', 'Hero Power — choose a target')
                  : t('选择目标', 'Choose a target')}
            </span>
            {directPlay && (
              <button className={styles.goldBtn} onClick={() => sendAndClear(directPlay)}>
                {t('直接上场', 'Play without target')}
              </button>
            )}
            <button className={styles.plainBtn} onClick={() => setSelection(null)}>
              {t('取消', 'Cancel')}
            </button>
          </div>
        )}
      </div>

      {/* 底部:我方主帅(居中一行)+ 手牌(居中一行) */}
      <div className={styles.bottom}>
        <div className={styles.heroRow}>
        <HeroPlate
          ps={me}
          targetable={activeTargets.has(`hero-${viewer}`)}
          floats={floatsFor(`hero-${viewer}`)}
          fx={fxFor(`hero-${viewer}`)}
          pulse={anim.myTurnPulse}
          acting={state.phase === 'main' && myTurn}
          powerUsable={myTurn && powerCmds.length > 0}
          powerSelected={selection?.kind === 'heroPower' && !selection.vice}
          onUsePower={(e) => {
            e.stopPropagation()
            onUseHeroPower(false)
          }}
          vicePowerSelected={selection?.kind === 'heroPower' && selection.vice}
          onUseVicePower={(e) => {
            e.stopPropagation()
            onUseHeroPower(true)
          }}
          onUpgradePower={
            myTurn
              ? (e) => {
                  e.stopPropagation()
                  playSfx('stratagemCast')
                  send({ type: 'UpgradeHeroPower' })
                }
              : undefined
          }
          onClick={(e) => {
            e.stopPropagation()
            onEntityClick({ kind: 'hero', player: viewer })
          }}
        />
        </div>
        {/* 手牌单独占一行并整体居中。
            从前主帅与手牌并排在同一行、一起 justify-content: center ——
            于是主帅的宽度把手牌整体推到了偏右的位置,而**手牌是全屏唯一
            持续操作的东西**,它偏出中轴的代价比主帅偏出去大得多。 */}
        <div className={styles.handArea}>
          <HandFan
            onInspectCard={(defId) => setInspect(CARDS_BY_ID[defId] ?? null)}
            hand={me.hand}
            playableIids={myTurn ? playableIids : new Set()}
            selectedIid={selection?.kind === 'hand' ? selection.iid : null}
            onCardClick={onHandClick}
          />
        </div>
      </div>

      {/* 右缘:回合数 + 结束回合 */}
      <div className={styles.endTurnBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.turnNo}>{t(`第 ${state.turn} 回合`, `Turn ${state.turn}`)}</div>
        {state.objective?.kind === 'survive' && (
          <div className={styles.objective}>
            {t(
              `守成 ${Math.min(state.turn, state.objective.turns)}/${state.objective.turns}`,
              `Hold ${Math.min(state.turn, state.objective.turns)}/${state.objective.turns}`,
            )}
          </div>
        )}
        {state.objective?.kind === 'assassinate' && (
          <div className={styles.objective}>
            {t(`斩 ${pickText(state.objective.targetName)}`, `Slay ${pickText(state.objective.targetName)}`)}
          </div>
        )}
        {state.objective?.kind === 'protect' && (
          <div className={styles.objective}>
            {t(`护 ${pickText(state.objective.targetName)}`, `Protect ${pickText(state.objective.targetName)}`)}
          </div>
        )}
        <button
          className={styles.endTurn}
          disabled={!canEndTurn}
          onClick={() => {
            playSfx('buttonTap')
            sendAndClear({ type: 'EndTurn' })
          }}
        >
          {t('结束回合', 'End Turn')}
        </button>
      </div>

      {/* 对方回合遮罩(本地 AI 即时,一般一闪而过) */}
      {state.phase === 'main' && state.activePlayer === 1 && (
        <div className={styles.enemyTurn} role="status" aria-live="polite">
          {t('对方回合', "Opponent's Turn")}
        </div>
      )}

      {/* 换手转场:一道横扫过牌桌的光。
          横幅本身只是「一块字出现又消失」—— 它告诉你轮到谁了,但**没有把回合
          切换这件事变成一个动作**。一道从左到右扫过的光是最省的一个转场:
          它不遮挡任何东西,持续 0.5s,而且天然带方向(交接的方向)。 */}
      {turnBanner > 0 && myTurn && (
        <div key={`sweep-${turnBanner}`} className={styles.turnSweep} aria-hidden="true" />
      )}
      {turnBanner > 0 && myTurn && (
        <div key={turnBanner} className={styles.turnBanner} role="status" aria-live="polite">
          {t('轮到你了', 'Your Turn')}
        </div>
      )}

      {/* 热座的传递帘:同一台设备上换人时,**必须先把上一个人的手牌盖住**。
          没有这一层的话,「双人同机」等于两个人一起看两副手牌,游戏就不成立了。
          帘子由玩家自己点开 —— 用定时器自动收会赶不上真人递手机的速度。 */}
      {hotSeat && curtain && (
        <div className={styles.curtain}>
          <div className={styles.curtainInner}>
            <div className={styles.curtainTitle}>
              {t(`請交予 ${viewer === 0 ? '先手' : '後手'}`, `Pass to player ${viewer + 1}`)}
            </div>
            <p className={styles.curtainText}>
              {t('接手之后再点开 —— 帘后是对方的手牌。', 'Tap only after you have the device.')}
            </p>
            <button className={styles.curtainBtn} onClick={() => setCurtainFor(viewer)}>
              {t('我已接手', 'I have it')}
            </button>
          </div>
        </div>
      )}

      {/* 天时:整局都在走的钟。**没有任何状态**(由回合数推出),但必须一直可见 ——
          玩家要能提前排「等到夜半再劫营」,看不见就只能靠背回合数。
          下一段也写出来:天时的全部价值就在于它可以被预判。 */}
      {state.phase === 'main' && (
        <div
          className={styles.skyBanner}
          style={{ '--sky': SKY_COLOR[skyOf(state.turn)] } as CSSProperties}
          title={t(
            `天时:${SKY_NAME[skyOf(state.turn)].zh},下一段:${SKY_NAME[skyOf(state.turn + SKY_SPAN)].zh}`,
            `Sky: ${SKY_NAME[skyOf(state.turn)].en} — next: ${SKY_NAME[skyOf(state.turn + SKY_SPAN)].en}`,
          )}
        >
          <span className={styles.skyGlyph} aria-hidden="true">
            {SKY_GLYPH[skyOf(state.turn)]}
          </span>
          <span className={styles.skyName}>{pickText(SKY_NAME[skyOf(state.turn)])}</span>
          <span className={styles.skyNext}>
            → {pickText(SKY_NAME[skyOf(state.turn + SKY_SPAN)])}
          </span>
        </div>
      )}

      {/* 战场环境:挂在牌桌上而不是某个角色上的规则,双方同吃 —— 必须一直可见 */}
      {state.field && (
        <div className={styles.fieldBanner} title={pickText(state.field.rule.text)}>
          <span className={styles.fieldName}>{pickText(state.field.rule.name)}</span>
          {state.field.turnsLeft !== undefined && (
            <span className={styles.fieldTurns}>
              {t(`剩 ${state.field.turnsLeft} 回合`, `${state.field.turnsLeft} turns left`)}
            </span>
          )}
        </div>
      )}

      {/* 关底 Boss 的战场台词 —— 十六个历史人物打起来之后不该再是同一个沉默的机器 */}
      <BossVoice bossId={bossId} state={state} events={lastEvents} />

      {/* 名将出阵台词。59 位名将的单挑台词从导入那天起就躺在 lore.gen.ts 里,
          却只有翻「名将列传」才看得到 —— 真打起来时关羽和一个 7/7 白板没区别。 */}
      <GeneralVoice events={lastEvents} />

      {/* 竖屏提示:牌桌是按横屏设计的,窄屏竖着会被压扁(纯 CSS 控制显隐) */}
      <div className={styles.rotateHint}>
        <span className={styles.rotateGlyph} aria-hidden="true">
          ▭
        </span>
        <span className={styles.rotateTitle}>{t('请横持设备', 'Please rotate your device')}</span>
        <span className={styles.rotateBody}>
          {t(
            '战场按横屏排布 —— 转成横屏才看得全两方阵列与手牌。',
            'The battlefield is laid out for landscape — rotate to see both boards and your hand.',
          )}
        </span>
      </div>

      {/* 回合绳:只有联机局有服务器时限,本地局 turnDeadline 恒为 null */}
      <TurnRope deadline={turnDeadline} myTurn={myTurn} />

      {/* 表情轮盘:只有联机局有对手可言;观战席不参与社交 */}
      {mode === 'remote' && !spectating && state.phase !== 'ended' && (
        <EmoteWheel onSend={sendEmote} incoming={incomingEmote} />
      )}

      <BattleLog entries={log} />

      {/* 联机连接横幅:自己重连中 / 对手掉线等待 */}
      {mode === 'remote' && remoteStatus === 'reconnecting' && (
        <div className={styles.linkBanner} role="status" aria-live="polite">{t('连接中断,重连中…', 'Connection lost, reconnecting…')}</div>
      )}
      {mode === 'remote' && remoteStatus === 'opponent-left' && state.phase !== 'ended' && (
        <div className={styles.linkBanner}>{t('对手掉线,等待重连…', 'Opponent disconnected, waiting…')}</div>
      )}
      {/* 自动重连放弃后不该只剩一句「已断开」—— 对局在服务器上可能还活着 */}
      {mode === 'remote' && remoteStatus === 'closed' && state.phase !== 'ended' && (
        <div className={styles.linkBanner} role="status" aria-live="assertive">
          {t('连接已断开', 'Disconnected')}
          <button
            className={styles.bannerBtn}
            onClick={(e) => {
              e.stopPropagation()
              playSfx('buttonTap')
              retryConnection()
            }}
          >
            {t('重新连接', 'Reconnect')}
          </button>
          <button
            className={styles.bannerBtn}
            onClick={(e) => {
              e.stopPropagation()
              handleExit()
            }}
          >
            {t('回标题页', 'Back to title')}
          </button>
        </div>
      )}

      {tutorial && <TutorialCoach state={state} events={lastEvents} onQuit={handleExit} />}

      {inspect && <CardInspect def={inspect} onClose={() => setInspect(null)} />}

      {graveOpen && (
        <GraveyardPanel
          mine={me.graveyard}
          theirs={foe.graveyard}
          onInspect={(def) => setInspect(def)}
          onClose={() => setGraveOpen(false)}
        />
      )}

      {confirmConcede && (
        <ConfirmDialog
          title={t('确定认输?', 'Concede this match?')}
          body={t(
            '认输将立即判负,本局不会计入战利。',
            'Conceding counts as an immediate loss. No spoils for this match.',
          )}
          confirmLabel={t('认输', 'Concede')}
          cancelLabel={t('继续对局', 'Keep playing')}
          onConfirm={() => {
            setConfirmConcede(false)
            send({ type: 'Concede' })
          }}
          onCancel={() => setConfirmConcede(false)}
        />
      )}

      {/* 读屏器此前完全收不到 toast 与横幅 —— 补 aria-live */}
      {toast && (
        <div className={styles.toast} role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {/* 阵亡残影:从原位放大消散 */}
      {anim.ghosts.map((g) => {
        const def = CARDS_BY_ID[g.defId]
        return (
          <div
            key={g.id}
            className={styles.ghost}
            style={{ left: g.left, top: g.top, width: g.width, height: g.height }}
          >
            <Portrait
              id={g.defId}
              nameZh={def?.name.zh ?? g.defId}
              doctrine={def?.doctrine ?? 'neutral'}
            />
          </div>
        )
      })}

      {/* 锦囊施放:卡面聚焦闪现 */}
      {anim.cast && castDef && (
        <div key={anim.cast.id} className={styles.castLayer}>
          <div className={styles.castCard}>
            <div className={styles.castPortrait}>
              <Portrait id={castDef.id} nameZh={castDef.name.zh} doctrine={castDef.doctrine} />
            </div>
            <div className={styles.castName}>{pickCompact(castDef.name)}</div>
          </div>
        </div>
      )}

      {/* 致命一击:全屏白金闪光 */}
      {anim.lethalFlash && <div className={styles.lethalFlash} />}

      {state.phase === 'mulligan' && (
        <MulliganOverlay
          heroIds={[me.heroId, foe.heroId]}
          hand={me.hand}
          waiting={me.mulliganDone}
          onConfirm={(keepIids) => {
            playSfx('buttonTap')
            send({ type: 'Mulligan', keepIids })
          }}
        />
      )}

      {/* 发现:任一方在挑牌时都挂浮层(我方可点、对手方只显示牌背)。
          观战席不该能替谁点,所以 spectating 时不给发现浮层。 */}
      {state.pendingChoice && !spectating && (
        <DiscoverOverlay
          choice={state.pendingChoice}
          mySeat={0}
          onPick={(index) => send({ type: 'ResolveChoice', index })}
        />
      )}

      {/* 抉择模式选择器:点空白处取消 */}
      {modeChoice && (
        <div className={styles.modeScrim} onClick={() => setModeChoice(null)}>
          <div className={styles.modeCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modeTitle}>{t('抉择', 'Choose One')}</div>
            {modeChoice.modes.map((m, i) => (
              <button
                key={i}
                className={styles.modeBtn}
                onClick={() => {
                  playSfx('buttonTap')
                  onPickMode(modeChoice.iid, i)
                }}
              >
                {pickText(m.label)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 斩杀谜题:对局中的工具条(提示 / 展示解法 / 撤销 / 重来) */}
      {puzzle && !puzzleResult && state.phase !== 'ended' && (
        <div className={styles.puzzleBar}>
          <button className={styles.puzzleBtn} onClick={() => { playSfx('buttonTap'); setShowHint((v) => !v) }}>
            {t('提示', 'Hint')}
          </button>
          <button className={styles.puzzleBtn} onClick={handleShowSolution}>
            {t('展示解法', 'Solution')}
          </button>
          <button
            className={styles.puzzleBtn}
            onClick={handlePuzzleUndo}
            disabled={puzzleHistory.length === 0}
          >
            {t('撤销', 'Undo')}
          </button>
          <button className={styles.puzzleBtn} onClick={handlePuzzleRetry}>
            {t('重来', 'Restart')}
          </button>
        </div>
      )}

      {puzzle && showHint && puzzleDef && (
        <div className={styles.puzzlePanel} onClick={() => setShowHint(false)}>
          <div className={styles.panelCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.panelTitle}>{t('提示', 'Hint')}</div>
            <p className={styles.panelHint}>{pickText(puzzleDef.hint)}</p>
            <button className={styles.panelClose} onClick={() => setShowHint(false)}>
              {t('知道了', 'Got it')}
            </button>
          </div>
        </div>
      )}

      {/* 演武场:军师 —— 问一句「这回合有没有斩杀」 */}
      {practice && state.phase === 'main' && state.activePlayer === 0 && (
        <div className={styles.puzzleBar}>
          <button className={styles.puzzleBtn} onClick={handleAdvise}>
            {t('军师', 'Advisor')}
          </button>
        </div>
      )}

      {solution && (
        <div className={styles.puzzlePanel} onClick={() => setSolution(null)}>
          <div className={styles.panelCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.panelTitle}>{puzzle ? t('解法', 'Solution') : t('军师', 'Advisor')}</div>
            <ol className={styles.panelSteps}>
              {solution.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <button className={styles.panelClose} onClick={() => setSolution(null)}>
              {t('关闭', 'Close')}
            </button>
          </div>
        </div>
      )}

      {/* 指向箭:选中攻击者 / 主公技待指定目标时,从来源拉一条弧线到指针。
          手牌待选目标时不画 —— 那时来源是手上的一张牌,它自己已经飞起来高亮了,
          再拉一条线反而和「拖拽出牌」的语汇冲突。 */}
      <TargetArrow
        fromKey={
          selection?.kind === 'attacker'
            ? `gen-${selection.iid}`
            : selection?.kind === 'heroPower'
              ? `hero-${viewer}`
              : null
        }
      />

      {/* 「这张牌为什么打不出」——点了灰牌之后的即时回答,2.6 秒后自己消失。
          位置放在手牌正上方:视线刚从被点的那张牌抬起来就看得到。 */}
      {whyToast && (
        <div className={styles.whyToast} role="status">
          {whyToast}
        </div>
      )}

      {/* 斩杀谜题:胜(对局结束)或负(本回合结束未斩杀)走专用面板 */}
      {puzzle && puzzleResult && (puzzleResult === 'lost' || !anim.holdResult) && puzzleDef && (
        <PuzzleResultOverlay
          result={puzzleResult}
          reward={puzzleReward}
          peeked={puzzlePeeked}
          title={puzzleDef.title}
          hint={puzzleDef.hint}
          onRetry={handlePuzzleRetry}
          onExit={handleExit}
        />
      )}

      {!puzzle && state.phase === 'ended' && !anim.holdResult && (
        <ResultOverlay
          winner={state.winner}
          canRematch={mode === 'local'}
          remoteRematch={mode === 'remote' && !spectating ? rematchState : null}
          onRemoteRematch={() => {
            playSfx('buttonTap')
            setLog([])
            namesRef.current.clear()
            requestRematch()
          }}
          ratingResult={mode === 'remote' ? ratingResult : null}
          stats={stats}
          onShare={() => {
            playSfx('buttonTap')
            void exportRecapImage(
              HEROES_BY_ID[me.heroId],
              pickCompact(heroName(foe.heroId)),
              state.winner,
              stats,
              lang !== 'en',
            )
          }}
          onRematch={handleRematch}
          onExit={handleExit}
        />
      )}
    </div>
  )
}
