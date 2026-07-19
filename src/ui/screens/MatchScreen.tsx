import { useEffect, useMemo, useRef, useState } from 'react'
import type { Command, GameEvent, TargetRef } from '../../engine/types'
import { legalCommands } from '../../engine/legal'
import { CARDS_BY_ID } from '../../content/cards'
import { HEROES_BY_ID } from '../../content/overrides/heroes'
import { useMatch } from '../../app/matchStore'
import { useT } from '../i18n'
import { rematch } from '../matchSetup'
import { HeroPlate } from '../components/HeroPlate'
import { GeneralToken } from '../components/GeneralToken'
import { HandFan } from '../components/HandFan'
import { MulliganOverlay } from '../components/MulliganOverlay'
import { ResultOverlay } from '../components/ResultOverlay'
import { BattleLog } from '../components/BattleLog'
import { formatEvent } from '../components/eventText'
import { targetFloatKey } from '../components/floats'
import { Portrait } from '../components/Portrait'
import { CardInspect } from '../components/CardInspect'
import type { CardDef } from '../../engine/types'
import { useEventAnimations } from '../useEventAnimations'
import { initSound, playSfx } from '../sound'
import { useSettings } from '../../app/settingsStore'
import styles from './MatchScreen.module.css'

type PlayCmd = Extract<Command, { type: 'PlayCard' }>
type AttackCmd = Extract<Command, { type: 'Attack' }>

type Selection = { kind: 'hand'; iid: number } | { kind: 'attacker'; iid: number } | null

interface MatchScreenProps {
  onExit: () => void
}

// 对战主画面:横屏炉石式布局。人类恒为 0 号玩家。
export function MatchScreen({ onExit }: MatchScreenProps) {
  const t = useT()
  const { state, lastEvents, error, send, reset, mode } = useMatch()
  const { soundEnabled, setSoundEnabled } = useSettings()
  const [selection, setSelection] = useState<Selection>(null)
  const [log, setLog] = useState<string[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [inspect, setInspect] = useState<CardDef | null>(null)

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

  // 当前选择模式下:目标键 → 待发送命令
  const activeTargets = useMemo(() => {
    const m = new Map<string, Command>()
    if (!selection) return m
    if (selection.kind === 'hand') {
      for (const c of playCmds) {
        if (c.iid === selection.iid && c.target) m.set(targetFloatKey(c.target), c)
      }
    } else {
      for (const c of attackCmds) {
        if (c.attackerIid === selection.iid) m.set(targetFloatKey(c.target), c)
      }
    }
    return m
  }, [selection, playCmds, attackCmds])

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
    const ctx = {
      name: (iid: number) => {
        const defId = names.get(iid)
        // 联机时对手抽牌 defId 被裁剪为空:显示「一张牌」
        return defId ? (CARDS_BY_ID[defId]?.name.zh ?? defId) : '一张牌'
      },
      defName: (defId: string) => (defId ? (CARDS_BY_ID[defId]?.name.zh ?? defId) : '一张牌'),
      heroName: (p: 0 | 1) =>
        HEROES_BY_ID[state.players[p].heroId]?.name.zh ?? state.players[p].heroId,
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

  const onConcede = () => {
    if (window.confirm(t('确定认输?', 'Concede this match?'))) send({ type: 'Concede' })
  }

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
            {selection.kind === 'hand'
              ? t('选择目标', 'Choose a target')
              : t('选择攻击目标', 'Choose attack target')}
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

      {inspect && <CardInspect def={inspect} onClose={() => setInspect(null)} />}

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
            <div className={styles.castName}>{castDef.name.zh}</div>
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
          onRematch={handleRematch}
          onExit={handleExit}
        />
      )}
    </div>
  )
}
