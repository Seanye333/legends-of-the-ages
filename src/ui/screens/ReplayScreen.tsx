import { useEffect, useMemo, useRef, useState } from 'react'
import type { GameEvent, LocalizedText } from '../../engine/types'
import { CARDS_BY_ID } from '../../content/cards'
import {
  deleteReplay,
  listReplays,
  type SavedReplay,
} from '../../app/replayStore'
import { usePickCompact, usePickText, useT } from '../i18n'
import { HeroPlate } from '../components/HeroPlate'
import { GeneralToken } from '../components/GeneralToken'
import { HandFan } from '../components/HandFan'
import { BattleLog } from '../components/BattleLog'
import { CardInspect } from '../components/CardInspect'
import { cardName, formatEvent, heroName } from '../components/eventText'
import { useEventAnimations } from '../useEventAnimations'
import { playSfx } from '../sound'
import type { CardDef } from '../../engine/types'
import { scanReplayAsync, type MissedLethal } from '../../app/coach'
import { describeSolution } from '../puzzleSolution'
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
  const pickText = usePickText()
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [log, setLog] = useState<LocalizedText[]>([])
  const [inspect, setInspect] = useState<CardDef | null>(null)
  const namesRef = useRef(new Map<number, string>())
  const doneRef = useRef<GameEvent[] | null>(null)
  // 军师复盘:扫全场「我方回合开始」帧,找出你当时能赢却没赢的那几个回合
  const [coach, setCoach] = useState<MissedLethal[] | null>(null)
  const [coachBusy, setCoachBusy] = useState<number | null>(null)
  const [coachDetail, setCoachDetail] = useState<{ turn: number; steps: string[] } | null>(null)

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
          disabled={idx <= 0}
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          title={t('上一手', 'Previous')}
        >
          ⏪
        </button>
        <button
          className={styles.ctrlBtn}
          disabled={idx >= replay.frames.length - 1}
          onClick={() => setIdx((i) => Math.min(i + 1, replay.frames.length - 1))}
          title={t('下一手', 'Next')}
        >
          ⏭
        </button>
        {/* 倍速 1→2→4:一局三十回合的战报,只有 2x 时想快进到某一手仍然要等 */}
        <button
          className={speed > 1 ? styles.ctrlActive : styles.ctrlBtn}
          onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}
        >
          {speed}x
        </button>
        {/* 进度条:此前只能从头顺着播,想回看某一手只能重播一遍 */}
        <input
          className={styles.scrubber}
          type="range"
          min={0}
          max={Math.max(0, replay.frames.length - 1)}
          value={Math.min(idx, replay.frames.length - 1)}
          aria-label={t('回放进度', 'Replay position')}
          onChange={(e) => {
            setPlaying(false)
            setIdx(Number(e.target.value))
          }}
        />
        <button
          className={styles.plainBtn}
          disabled={coachBusy !== null}
          onClick={async () => {
            playSfx('buttonTap')
            setPlaying(false)
            setCoachBusy(0)
            const found = await scanReplayAsync(replay, {
              onProgress: (done, total) => setCoachBusy(total ? Math.round((100 * done) / total) : 100),
            })
            setCoachBusy(null)
            setCoach(found)
          }}
          title={t('扫描全场,找出你当时能赢却没赢的回合', 'Scan for turns where you had lethal')}
        >
          {coachBusy !== null ? `${coachBusy}%` : t('军师复盘', 'Review')}
        </button>
        <button className={styles.plainBtn} onClick={onExit}>
          {t('退出回放', 'Exit')}
        </button>
      </div>

      {/* 复盘结果:点一条跳到那一帧,并列出当时那条斩杀线的每一步 */}
      {coach && (
        <div className={styles.coachPanel} onClick={() => setCoach(null)}>
          <div className={styles.coachCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.coachTitle}>{t('军师复盘', 'Advisor Review')}</div>
            {coach.length === 0 ? (
              <p className={styles.coachEmpty}>
                {t(
                  '这一局没有错过的斩杀 —— 每个回合的最优解你都走到了。',
                  'No missed lethal this game — you took every winning line that existed.',
                )}
              </p>
            ) : (
              <ol className={styles.coachList}>
                {coach.map((m) => (
                  <li key={m.frameIndex}>
                    <button
                      className={styles.coachItem}
                      onClick={() => {
                        setIdx(m.frameIndex)
                        setCoachDetail({
                          turn: m.turn,
                          steps: describeSolution(
                            replay.frames[m.frameIndex].state,
                            0,
                            m.line,
                            CARDS_BY_ID,
                            pickText,
                            t,
                          ),
                        })
                        setCoach(null)
                      }}
                    >
                      {t(
                        `第 ${m.turn} 回合 —— ${m.steps} 步可斩杀`,
                        `Turn ${m.turn} — lethal in ${m.steps}`,
                      )}
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <button className={styles.plainBtn} onClick={() => setCoach(null)}>
              {t('关闭', 'Close')}
            </button>
          </div>
        </div>
      )}

      {coachDetail && (
        <div className={styles.coachPanel} onClick={() => setCoachDetail(null)}>
          <div className={styles.coachCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.coachTitle}>
              {t(`第 ${coachDetail.turn} 回合的斩杀线`, `Lethal line on turn ${coachDetail.turn}`)}
            </div>
            <ol className={styles.coachSteps}>
              {coachDetail.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <button className={styles.plainBtn} onClick={() => setCoachDetail(null)}>
              {t('关闭', 'Close')}
            </button>
          </div>
        </div>
      )}

      <BattleLog entries={log} />
      {inspect && <CardInspect def={inspect} onClose={() => setInspect(null)} />}
      {anim.lethalFlash && <div className={styles.lethalFlash} />}
    </div>
  )
}
