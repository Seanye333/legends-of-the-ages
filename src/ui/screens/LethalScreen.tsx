import { LETHAL_PUZZLES, type LethalPuzzle } from '../../content/lethalPuzzles'
import { dailyPuzzleFor, dayKey } from '../../content/dailyPuzzle'
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
  const dailySolvedDate = useLethal((s) => s.dailySolvedDate)
  const streakAsOf = useLethal((s) => s.streakAsOf)
  const solvedSet = new Set(solved)
  const [codeInput, setCodeInput] = useState('')
  const [codeMsg, setCodeMsg] = useState<string | null>(null)

  const today = dayKey()
  const daily = dailyPuzzleFor(today)
  const dailyDone = dailySolvedDate === today
  const streak = streakAsOf(today)

  const launch = (p: LethalPuzzle, extra?: { daily: boolean; dailyDate: string }) => {
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

      {daily && (
        <button
          className={`${styles.daily} ${dailyDone ? styles.solved : ''}`}
          onClick={() => launch(daily, { daily: true, dailyDate: today })}
        >
          <div className={styles.dailyBadge}>{t('每日谜题', 'Daily')}</div>
          {streak > 0 && (
            <div className={styles.streak}>{t(`连续 ${streak} 天`, `${streak}-day streak`)}</div>
          )}
          <div className={styles.portrait}>
            <Portrait
              id={daily.heroes[0]}
              nameZh={HEROES_BY_ID[daily.heroes[0]]?.name.zh ?? daily.heroes[0]}
              doctrine={HEROES_BY_ID[daily.heroes[0]]?.doctrine ?? 'neutral'}
            />
            {dailyDone && <span className={styles.check}>✓</span>}
          </div>
          <div className={styles.body}>
            <div className={styles.row}>
              <span className={styles.name}>{pick(daily.title)}</span>
              <span className={styles.date}>{today}</span>
            </div>
            <div className={styles.situation}>{pick(daily.situation)}</div>
          </div>
          <div className={styles.go}>
            {dailyDone ? t('已解 · 再战 ›', 'Solved · Replay ›') : t('挑战 ›', 'Solve ›')}
          </div>
        </button>
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
