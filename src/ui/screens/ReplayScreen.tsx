import { useEffect, useMemo, useRef, useState } from 'react'
import type { GameEvent, LocalizedText } from '../../engine/types'
import { CARDS_BY_ID } from '../../content/cards'
import {
  deleteReplay,
  listReplays,
  type SavedReplay,
} from '../../app/replayStore'
import { usePickCompact, useT } from '../i18n'
import { HeroPlate } from '../components/HeroPlate'
import { GeneralToken } from '../components/GeneralToken'
import { HandFan } from '../components/HandFan'
import { BattleLog } from '../components/BattleLog'
import { CardInspect } from '../components/CardInspect'
import { cardName, formatEvent, heroName } from '../components/eventText'
import { useEventAnimations } from '../useEventAnimations'
import { playSfx } from '../sound'
import type { CardDef } from '../../engine/types'
import styles from './ReplayScreen.module.css'

const EMPTY_SET: ReadonlySet<number> = new Set()

interface ReplayScreenProps {
  onBack: () => void
}

// 战报回放:选一份存档 → 按帧播放事件流(动画/音效走对战同一条时间轴)。
export function ReplayScreen({ onBack }: ReplayScreenProps) {
  const t = useT()
  const pickCompact = usePickCompact()
  const [replays, setReplays] = useState<SavedReplay[]>(() => listReplays())
  const [active, setActive] = useState<SavedReplay | null>(null)

  if (!active) {
    return (
      <div className={styles.screen}>
        <div className={styles.listPanel}>
          <h1 className={styles.title}>{t('战报回放', 'Battle Replays')}</h1>
          {replays.length === 0 && (
            <p className={styles.empty}>
              {t('还没有战报——打完一局便会自动留档(最近 5 场)', 'No replays yet — finish a match and it will be recorded (last 5).')}
            </p>
          )}
          {replays.map((r) => {
            const my = pickCompact(heroName(r.heroIds[0]))
            const foe = pickCompact(heroName(r.heroIds[1]))
            const verdict = pickCompact(
              r.winner === 0
                ? { zh: '胜', en: 'WIN' }
                : r.winner === 1
                  ? { zh: '负', en: 'LOSS' }
                  : { zh: '平', en: 'DRAW' },
            )
            return (
              <div key={r.id} className={styles.row}>
                <span className={r.winner === 0 ? styles.win : styles.lose}>{verdict}</span>
                <span className={styles.rowMain}>
                  {my} vs{' '}
                  {r.mode === 'remote' && r.opponentName ? `${r.opponentName} (${foe})` : foe}
                </span>
                <span className={styles.rowMeta}>
                  {r.mode === 'remote' ? t('联机', 'online') : t('单机', 'solo')} ·{' '}
                  {new Date(r.date).toLocaleString()}
                </span>
                <button
                  className={styles.goldBtn}
                  onClick={() => {
                    playSfx('buttonTap')
                    setActive(r)
                  }}
                >
                  {t('观看', 'Watch')}
                </button>
                <button
                  className={styles.plainBtn}
                  onClick={() => {
                    playSfx('buttonTap')
                    deleteReplay(r.id)
                    setReplays(listReplays())
                  }}
                >
                  ✕
                </button>
              </div>
            )
          })}
          <button className={styles.backBtn} onClick={onBack}>
            {t('返回标题', 'Back to Title')}
          </button>
        </div>
      </div>
    )
  }

  return <ReplayPlayer replay={active} onExit={() => setActive(null)} />
}

function ReplayPlayer({ replay, onExit }: { replay: SavedReplay; onExit: () => void }) {
  const t = useT()
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [log, setLog] = useState<LocalizedText[]>([])
  const [inspect, setInspect] = useState<CardDef | null>(null)
  const namesRef = useRef(new Map<number, string>())
  const doneRef = useRef<GameEvent[] | null>(null)

  const frame = replay.frames[Math.min(idx, replay.frames.length - 1)]
  const state = frame.state
  const anim = useEventAnimations(state, frame.events)

  // 自动步进:每帧按其事件量给节拍
  useEffect(() => {
    if (!playing) return
    if (idx >= replay.frames.length - 1) {
      setPlaying(false)
      return
    }
    const events = replay.frames[idx].events
    const beat = Math.min(4200, Math.max(900, 260 * events.length)) / speed
    const timer = window.setTimeout(() => setIdx((i) => i + 1), beat)
    return () => window.clearTimeout(timer)
  }, [playing, idx, speed, replay])

  // 战报文本(与对战画面同一套格式化)
  useEffect(() => {
    if (frame.events === doneRef.current) return
    doneRef.current = frame.events
    const names = namesRef.current
    for (const ev of frame.events) {
      if (
        ev.type === 'CardDrawn' ||
        ev.type === 'CardPlayed' ||
        ev.type === 'GeneralSummoned' ||
        ev.type === 'GeneralDied'
      ) {
        names.set(ev.iid, ev.defId)
      }
    }
    for (const p of state.players) {
      for (const zone of [p.deck, p.hand, p.board]) {
        for (const c of zone) names.set(c.iid, c.defId)
      }
    }
    const ctx = {
      name: (iid: number) => cardName(names.get(iid)),
      defName: (defId: string) => cardName(defId),
      heroName: (p: 0 | 1) => heroName(state.players[p].heroId),
    }
    const entries = frame.events.map((ev) => formatEvent(ev, ctx))
    if (entries.length > 0) setLog((prev) => [...prev, ...entries].slice(-300))
  }, [frame, state])

  const restart = () => {
    namesRef.current.clear()
    doneRef.current = null
    setLog([])
    setIdx(0)
    setPlaying(true)
  }

  const me = state.players[0]
  const foe = state.players[1]
  const floatsFor = (key: string) => anim.floats.filter((f) => f.targetKey === key)
  const fxFor = (key: string) => anim.fx.get(key)
  const progress = useMemo(
    () => `${Math.min(idx + 1, replay.frames.length)} / ${replay.frames.length}`,
    [idx, replay],
  )

  return (
    <div className={styles.screen}>
      <div className={styles.replayBadge}>{t('回放', 'REPLAY')}</div>
      <div className={styles.top}>
        <HeroPlate ps={foe} enemy floats={floatsFor('hero-1')} fx={fxFor('hero-1')} />
      </div>
      <div className={styles.battlefield}>
        <div className={styles.rowBoard}>
          {foe.board.map((c) => (
            <GeneralToken
              key={c.iid}
              inst={c}
              floats={floatsFor(`gen-${c.iid}`)}
              fx={fxFor(`gen-${c.iid}`)}
              onInspect={() => setInspect(CARDS_BY_ID[c.defId] ?? null)}
            />
          ))}
        </div>
        <div className={styles.divider} />
        <div className={styles.rowBoard}>
          {me.board.map((c) => (
            <GeneralToken
              key={c.iid}
              inst={c}
              floats={floatsFor(`gen-${c.iid}`)}
              fx={fxFor(`gen-${c.iid}`)}
              onInspect={() => setInspect(CARDS_BY_ID[c.defId] ?? null)}
            />
          ))}
        </div>
      </div>
      <div className={styles.bottom}>
        <HeroPlate ps={me} floats={floatsFor('hero-0')} fx={fxFor('hero-0')} />
        <div className={styles.handArea}>
          <HandFan
            hand={me.hand}
            playableIids={EMPTY_SET}
            selectedIid={null}
            onCardClick={() => undefined}
            onInspectCard={(defId) => setInspect(CARDS_BY_ID[defId] ?? null)}
          />
        </div>
      </div>

      <div className={styles.controls} onClick={(e) => e.stopPropagation()}>
        <span className={styles.turnNo}>
          {t(`第 ${state.turn} 回合`, `Turn ${state.turn}`)} · {progress}
        </span>
        <button className={styles.ctrlBtn} onClick={restart} title={t('重播', 'Restart')}>
          ⏮
        </button>
        <button
          className={styles.ctrlBtn}
          onClick={() => {
            playSfx('buttonTap')
            setPlaying((p) => !p)
          }}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <button
          className={styles.ctrlBtn}
          disabled={idx >= replay.frames.length - 1}
          onClick={() => setIdx((i) => Math.min(i + 1, replay.frames.length - 1))}
          title={t('下一手', 'Next')}
        >
          ⏭
        </button>
        <button
          className={speed === 2 ? styles.ctrlActive : styles.ctrlBtn}
          onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}
        >
          2x
        </button>
        <button className={styles.plainBtn} onClick={onExit}>
          {t('退出回放', 'Exit')}
        </button>
      </div>

      <BattleLog entries={log} />
      {inspect && <CardInspect def={inspect} onClose={() => setInspect(null)} />}
      {anim.lethalFlash && <div className={styles.lethalFlash} />}
    </div>
  )
}
