import { useEffect, useMemo, useRef, useState } from 'react'
import type { Command, GameEvent, LocalizedText, TargetRef } from '../../engine/types'
import { legalCommands } from '../../engine/legal'
import { CARDS_BY_ID } from '../../content/cards'
import { useMatch } from '../../app/matchStore'
import { usePickCompact, useT } from '../i18n'
import { rematch } from '../matchSetup'
import { HeroPlate } from '../components/HeroPlate'
import { GeneralToken } from '../components/GeneralToken'
import { HandFan } from '../components/HandFan'
import { MulliganOverlay } from '../components/MulliganOverlay'
import { ResultOverlay } from '../components/ResultOverlay'
import { BattleLog } from '../components/BattleLog'
import { cardName, formatEvent, heroName } from '../components/eventText'
import { targetFloatKey } from '../components/floats'
import { Portrait } from '../components/Portrait'
import { CardInspect } from '../components/CardInspect'
import { TutorialCoach } from '../components/TutorialCoach'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { CardDef } from '../../engine/types'
import { useEventAnimations } from '../useEventAnimations'
import { initSound, playSfx } from '../sound'
import { useSettings } from '../../app/settingsStore'
import styles from './MatchScreen.module.css'

type PlayCmd = Extract<Command, { type: 'PlayCard' }>
type AttackCmd = Extract<Command, { type: 'Attack' }>
type PowerCmd = Extract<Command, { type: 'UseHeroPower' }>

type Selection =
  | { kind: 'hand'; iid: number }
  | { kind: 'attacker'; iid: number }
  | { kind: 'heroPower' }
  | null

interface MatchScreenProps {
  onExit: () => void
}

// 对战主画面:横屏炉石式布局。人类恒为 0 号玩家。
export function MatchScreen({ onExit }: MatchScreenProps) {
  const t = useT()
  const pickCompact = usePickCompact()
  const { state, lastEvents, error, send, reset, mode, tutorial, remoteStatus, ratingResult } =
    useMatch()
  const { soundEnabled, setSoundEnabled } = useSettings()
  const [selection, setSelection] = useState<Selection>(null)
  const [log, setLog] = useState<LocalizedText[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [inspect, setInspect] = useState<CardDef | null>(null)
  // 认输确认原来用的是 window.confirm —— 在一个全自绘的界面里弹系统框太出戏,
  // 而且 iOS 上的样式完全不受控。
  const [confirmConcede, setConfirmConcede] = useState(false)

  // 事件时间轴:动效 + 音效 + 飘字都由它按节拍产出
  const anim = useEventAnimations(state, lastEvents)

  const namesRef = useRef(new Map<number, string>())
  const processedRef = useRef<GameEvent[] | null>(null)

  useEffect(() => initSound(), [])

  // 唯一规则来源:legalCommands。UI 只做筛选,不重演规则。
  const legal = useMemo(
    () => (state ? legalCommands(state, 0, CARDS_BY_ID) : []),
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
        if (c.iid === selection.iid && c.target) m.set(targetFloatKey(c.target), c)
      }
    } else if (selection.kind === 'heroPower') {
      for (const c of powerCmds) {
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
        ? playCmds.find((c) => c.iid === selection.iid && !c.target)
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
    const entries = lastEvents.map((ev) => formatEvent(ev, ctx))
    if (entries.length > 0) setLog((prev) => [...prev, ...entries].slice(-300))
  }, [state, lastEvents])

  // 状态一变,清空选择(出牌/攻击/对手行动后都不残留)
  useEffect(() => setSelection(null), [state])

  // Esc 取消选择
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelection(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 错误 → 短暂 toast
  useEffect(() => {
    if (!error) return
    setToast(error)
    const timer = window.setTimeout(() => setToast(null), 2500)
    return () => window.clearTimeout(timer)
  }, [error])

  // 对手回归 → 短暂 toast
  useEffect(() => {
    if (remoteStatus !== 'opponent-back') return
    setToast(t('对手已回到对局', 'Opponent reconnected'))
    const timer = window.setTimeout(() => setToast(null), 2500)
    return () => window.clearTimeout(timer)
  }, [remoteStatus, t])

  if (!state) {
    return (
      <div className={styles.screen}>
        <div className={styles.noMatch}>
          <p>{t('没有进行中的对局', 'No match in progress')}</p>
          <button className={styles.plainBtn} onClick={onExit}>
            {t('返回标题', 'Back to Title')}
          </button>
        </div>
      </div>
    )
  }

  const me = state.players[0]
  const foe = state.players[1]
  const myTurn = state.phase === 'main' && state.activePlayer === 0
  const canEndTurn = legal.some((c) => c.type === 'EndTurn')

  const sendAndClear = (cmd: Command) => {
    send(cmd)
    setSelection(null)
  }

  const onHandClick = (iid: number) => {
    if (!myTurn) return
    if (selection?.kind === 'hand' && selection.iid === iid) {
      setSelection(null)
      return
    }
    const variants = playCmds.filter((c) => c.iid === iid)
    if (variants.length === 0) return
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
  const onUseHeroPower = () => {
    if (!myTurn || powerCmds.length === 0) return
    if (selection?.kind === 'heroPower') {
      setSelection(null)
      return
    }
    const untargeted = powerCmds.find((c) => !c.target)
    if (untargeted) {
      playSfx('stratagemCast')
      sendAndClear(untargeted)
      return
    }
    setSelection({ kind: 'heroPower' })
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

  const floatsFor = (key: string) => anim.floats.filter((f) => f.targetKey === key)
  const fxFor = (key: string) => anim.fx.get(key)
  const targeting = activeTargets.size > 0 || directPlay !== undefined
  const castDef = anim.cast ? CARDS_BY_ID[anim.cast.defId] : null

  return (
    <div className={styles.screen} onClick={() => setSelection(null)}>
      {/* 顶部:敌方主帅 */}
      <div className={styles.top}>
        <HeroPlate
          ps={foe}
          enemy
          targetable={activeTargets.has('hero-1')}
          floats={floatsFor('hero-1')}
          fx={fxFor('hero-1')}
          onClick={(e) => {
            e.stopPropagation()
            onEntityClick({ kind: 'hero', player: 1 })
          }}
        />
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
              onConcede()
            }}
          >
            {t('认输', 'Concede')}
          </button>
        </div>
      </div>

      {/* 中部:两行战场 */}
      <div className={styles.battlefield}>
        <div className={styles.row}>
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
        <div className={styles.row}>
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
      </div>

      {/* 底部:我方主帅 + 手牌 */}
      <div className={styles.bottom}>
        <HeroPlate
          ps={me}
          targetable={activeTargets.has('hero-0')}
          floats={floatsFor('hero-0')}
          fx={fxFor('hero-0')}
          pulse={anim.myTurnPulse}
          powerUsable={myTurn && powerCmds.length > 0}
          powerSelected={selection?.kind === 'heroPower'}
          onUsePower={(e) => {
            e.stopPropagation()
            onUseHeroPower()
          }}
          onClick={(e) => {
            e.stopPropagation()
            onEntityClick({ kind: 'hero', player: 0 })
          }}
        />
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

      {/* 选目标提示条 */}
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

      {/* 对方回合遮罩(本地 AI 即时,一般一闪而过) */}
      {state.phase === 'main' && state.activePlayer === 1 && (
        <div className={styles.enemyTurn}>{t('对方回合', "Opponent's Turn")}</div>
      )}

      <BattleLog entries={log} />

      {/* 联机连接横幅:自己重连中 / 对手掉线等待 */}
      {mode === 'remote' && remoteStatus === 'reconnecting' && (
        <div className={styles.linkBanner}>{t('连接中断,重连中…', 'Connection lost, reconnecting…')}</div>
      )}
      {mode === 'remote' && remoteStatus === 'opponent-left' && state.phase !== 'ended' && (
        <div className={styles.linkBanner}>{t('对手掉线,等待重连…', 'Opponent disconnected, waiting…')}</div>
      )}
      {mode === 'remote' && remoteStatus === 'closed' && state.phase !== 'ended' && (
        <div className={styles.linkBanner}>{t('连接已断开,可回标题页稍后续局', 'Disconnected — rejoin later from title')}</div>
      )}

      {tutorial && <TutorialCoach state={state} events={lastEvents} onQuit={handleExit} />}

      {inspect && <CardInspect def={inspect} onClose={() => setInspect(null)} />}

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

      {toast && <div className={styles.toast}>{toast}</div>}

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
          hand={me.hand}
          waiting={me.mulliganDone}
          onConfirm={(keepIids) => {
            playSfx('buttonTap')
            send({ type: 'Mulligan', keepIids })
          }}
        />
      )}

      {state.phase === 'ended' && !anim.holdResult && (
        <ResultOverlay
          winner={state.winner}
          canRematch={mode === 'local'}
          ratingResult={mode === 'remote' ? ratingResult : null}
          onRematch={handleRematch}
          onExit={handleExit}
        />
      )}
    </div>
  )
}
