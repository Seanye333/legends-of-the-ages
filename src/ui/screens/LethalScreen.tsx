import { LETHAL_PUZZLES, type LethalPuzzle } from '../../content/lethalPuzzles'
import { dailyPuzzleFor, dailyPuzzleSetFor, dayKey, SLOT_NAME } from '../../content/dailyPuzzle'
import { useState } from 'react'
import { createGame } from '../../engine/init'
import { CARDS_BY_ID } from '../../content/cards'
import { solveLethal, trivialFaceLethal } from '../../ai/lethalSolver'
import {
  decodePuzzle,
  encodePuzzle,
  puzzleFromCode,
  sharedPuzzleConfig,
} from '../../content/puzzleCode'
import { HEROES_BY_ID } from '../../content/overrides/heroes'
import { useLethal } from '../../app/lethalStore'
import { launchMatch } from '../matchSetup'
import { Portrait } from '../components/Portrait'
import { usePickText, useT } from '../i18n'
import { playSfx } from '../sound'
import { haptic } from '../haptics'
import styles from './LethalScreen.module.css'

interface LethalScreenProps {
  onBack: () => void
  onEnterMatch: () => void
}

// 斩杀谜题:选一道残局,在一个回合内找出 lethal 击杀对手。
// 用自己的收藏无关 —— 残局由内容层给定,进 match 走 puzzle 通道(见 matchStore)。
export function LethalScreen({ onBack, onEnterMatch }: LethalScreenProps) {
  const t = useT()
  const pick = usePickText()
  const solved = useLethal((s) => s.solved)
  const solvedSlots = useLethal((s) => s.solvedSlots)
  const streakAsOf = useLethal((s) => s.streakAsOf)
  const solvedSet = new Set(solved)
  const [codeInput, setCodeInput] = useState('')
  const [codeMsg, setCodeMsg] = useState<string | null>(null)

  const today = dayKey()
  // 分享码仍然只给**第一阵** —— 「今天大家都在打的那一道」得是同一道,
  // 三道都能分享的话「今日残局码」这句话就不成立了。
  const daily = dailyPuzzleFor(today)
  const dailySet = dailyPuzzleSetFor(today)
  const doneSlots = solvedSlots(today)
  const streak = streakAsOf(today)

  const launch = (
    p: LethalPuzzle,
    extra?: { daily: boolean; dailyDate: string; dailySlot: number },
  ) => {
    playSfx('duel')
    haptic('impact')
    launchMatch({
      heroIds: p.heroes,
      deckIds: [[], []],
      heroPowersOverride: [HEROES_BY_ID[p.heroes[0]]?.power, HEROES_BY_ID[p.heroes[1]]?.power],
      scenario: p.scenario,
      puzzle: true,
      puzzleId: p.id,
      daily: extra?.daily,
      dailyDate: extra?.dailyDate,
      dailySlot: extra?.dailySlot,
    })
    onEnterMatch()
  }

  const start = (p: LethalPuzzle) => launch(p)

  // 分享:把一道题编成码。放在每张题卡上会太吵,所以只给「当日题」一个入口 ——
  // 那是所有人今天都在打的同一道,最值得被聊起来。
  const shareDaily = () => {
    if (!daily) return
    playSfx('buttonTap')
    const code = encodePuzzle(daily.heroes, daily.scenario)
    void navigator.clipboard?.writeText(code)
    setCodeMsg(t('每日残局码已复制', 'Daily puzzle code copied'))
  }

  const total = LETHAL_PUZZLES.length
  const done = LETHAL_PUZZLES.filter((p) => solvedSet.has(p.id)).length

  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        <button
          className={styles.backBtn}
          onClick={() => {
            playSfx('buttonTap')
            onBack()
          }}
        >
          {t('← 返回', '← Back')}
        </button>
        <h2 className={styles.title}>{t('斩杀谜题 · 一击定音', 'Lethal Puzzles')}</h2>
        <div className={styles.progress}>
          {t(`已解 ${done} / ${total}`, `${done} / ${total} solved`)}
        </div>
      </header>

      <p className={styles.intro}>
        {t(
          '给定残局,在这一个回合之内算出一条必杀线 —— 出牌、主公技、攻击次序,一步都不能错。',
          'A fixed board. Find a line that ends it this very turn — cards, hero power, attack order, all of it.',
        )}
      </p>

      {/* 残局分享:UGC 最难的一环从来不是编辑器,是**审核** ——
          谁来保证这道题真的有解?而这里有 solveLethal,导入时当场跑一遍,
          无解的、或者「全体打脸就赢」的平凡题直接拒收。别家要请人审,这里是一行断言。 */}
      <div className={styles.shareRow}>
        <input
          className={styles.shareInput}
          placeholder={t('粘贴残局码…', 'Paste a puzzle code…')}
          aria-label={t('粘贴残局码', 'Paste a puzzle code')}
          value={codeInput}
          onChange={(e) => {
            setCodeInput(e.target.value)
            setCodeMsg(null)
          }}
        />
        <button className={styles.shareBtn} disabled={!daily} onClick={shareDaily}>
          {t('复制今日残局码', 'Copy daily code')}
        </button>
        <button
          className={styles.shareBtn}
          disabled={!codeInput.trim()}
          onClick={() => {
            playSfx('buttonTap')
            const decoded = decodePuzzle(codeInput)
            if (!decoded.ok) {
              setCodeMsg(
                t(
                  { 'bad-prefix': '这不像一个残局码', 'bad-payload': '残局码已损坏',
                    'unknown-card': '里面有本作没有的卡', 'unknown-hero': '里面有本作没有的主公',
                    'empty-board': '这个残局是空的' }[decoded.error],
                  'That code could not be read.',
                ),
              )
              return
            }
            // 导入即验:无解或平凡解一律拒收
            const state = createGame(sharedPuzzleConfig(decoded.heroes, decoded.scenario), CARDS_BY_ID)
            if (trivialFaceLethal(state, 0)) {
              setCodeMsg(t('这题全体打脸就能赢 —— 不算谜题', 'Everything just hits the face — not a puzzle'))
              return
            }
            if (!solveLethal(state, 0, CARDS_BY_ID)) {
              setCodeMsg(t('这题无解 —— 拒收', 'No lethal exists in that position — rejected'))
              return
            }
            launch(puzzleFromCode(decoded.heroes, decoded.scenario))
          }}
        >
          {t('导入残局', 'Import')}
        </button>
      </div>
      {codeMsg && <p className={styles.shareMsg}>{codeMsg}</p>}

      {/* 每日三题。一天一题的问题是它只有两个状态:没做 / 做完了 ——
          做完之后这一屏当天就死了,而每日内容的价值恰恰是「今天还有事可做」。
          三阵按残局复杂度由简到繁排,连击仍然按**天**算(解开第一阵就续上):
          三阵全解才续连击的话,断连的门槛会从「今天没空」变成「今天没空全打完」,
          那正好是连击最不该惩罚的那种人。 */}
      {dailySet.length > 0 && (
        <div className={styles.dailySet}>
          <div className={styles.dailySetHead}>
            <span className={styles.dailyBadge}>{t('每日三題', 'Daily Three')}</span>
            <span className={styles.dailySetDate}>{today}</span>
            {streak > 0 && (
              <span className={styles.streak}>{t(`连续 ${streak} 天`, `${streak}-day streak`)}</span>
            )}
            <span className={styles.dailySetCount}>
              {doneSlots.length} / {dailySet.length}
            </span>
          </div>
          {dailySet.map((p, slot) => {
            const slotDone = doneSlots.includes(slot)
            return (
              <button
                key={p.id}
                className={`${styles.daily} ${slotDone ? styles.solved : ''}`}
                onClick={() => launch(p, { daily: true, dailyDate: today, dailySlot: slot })}
              >
                <div className={styles.portrait}>
                  <Portrait
                    id={p.heroes[0]}
                    nameZh={HEROES_BY_ID[p.heroes[0]]?.name.zh ?? p.heroes[0]}
                    doctrine={HEROES_BY_ID[p.heroes[0]]?.doctrine ?? 'neutral'}
                  />
                  {slotDone && <span className={styles.check}>✓</span>}
                </div>
                <div className={styles.body}>
                  <div className={styles.row}>
                    <span className={styles.name}>{pick(p.title)}</span>
                    <span className={styles.date}>{pick(SLOT_NAME[slot] ?? SLOT_NAME[0])}</span>
                  </div>
                  <div className={styles.situation}>{pick(p.situation)}</div>
                </div>
                <div className={styles.go}>
                  {slotDone ? t('已解 · 再战 ›', 'Solved · Replay ›') : t('挑战 ›', 'Solve ›')}
                </div>
              </button>
            )
          })}
        </div>
      )}

      <div className={styles.list}>
        {LETHAL_PUZZLES.map((p) => {
          const hero = HEROES_BY_ID[p.heroes[0]]
          const isSolved = solvedSet.has(p.id)
          return (
            <button
              key={p.id}
              className={`${styles.card} ${isSolved ? styles.solved : ''}`}
              onClick={() => start(p)}
            >
              <div className={styles.portrait}>
                <Portrait
                  id={p.heroes[0]}
                  nameZh={hero?.name.zh ?? p.heroes[0]}
                  doctrine={hero?.doctrine ?? 'neutral'}
                />
                {isSolved && <span className={styles.check}>✓</span>}
              </div>
              <div className={styles.body}>
                <div className={styles.row}>
                  <span className={styles.name}>{pick(p.title)}</span>
                  <span className={styles.stars} aria-label={`difficulty ${p.difficulty}`}>
                    {'★'.repeat(p.difficulty)}
                    <span className={styles.starDim}>{'★'.repeat(3 - p.difficulty)}</span>
                  </span>
                </div>
                <div className={styles.situation}>{pick(p.situation)}</div>
              </div>
              <div className={styles.go}>{isSolved ? t('再战 ›', 'Replay ›') : t('挑战 ›', 'Solve ›')}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
