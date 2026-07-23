import { LETHAL_PUZZLES, type LethalPuzzle } from '../../content/lethalPuzzles'
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
  const solvedSet = new Set(solved)

  const start = (p: LethalPuzzle) => {
    playSfx('duel')
    haptic('impact')
    launchMatch({
      heroIds: p.heroes,
      deckIds: [[], []],
      heroPowersOverride: [HEROES_BY_ID[p.heroes[0]]?.power, HEROES_BY_ID[p.heroes[1]]?.power],
      scenario: p.scenario,
      puzzle: true,
      puzzleId: p.id,
    })
    onEnterMatch()
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
