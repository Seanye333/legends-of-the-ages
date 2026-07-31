import { useEffect, useMemo, useState } from 'react'
import {
  QUIZ_LENGTH,
  QUIZ_MERIT_PER_CORRECT,
  makeQuestion,
  personLabel,
  type QuizQuestion,
} from '../../content/quiz'
import { dayKey } from '../../content/dayKey'
import { QUIZ_DAILY_CAP, useQuiz } from '../../app/quizStore'
import { dynastyName } from '../doctrineColors'
import { CARDS_BY_ID } from '../../content/cards'
import { loadLore, loreNow } from '../../content/loreLazy'
import { Portrait } from '../components/Portrait'
import { usePickText, useT } from '../i18n'
import { playSfx } from '../sound'
import { haptic } from '../haptics'
import styles from './QuizScreen.module.css'

interface Props {
  onBack: () => void
}

// 稽古:五题一轮的历史小测。题目由列传数据生成,题库随卡池自动生长。
export function QuizScreen({ onBack }: Props) {
  const t = useT()
  const pick = usePickText()
  const award = useQuiz((s) => s.award)
  const noteStreak = useQuiz((s) => s.noteStreak)
  const bestStreak = useQuiz((s) => s.bestStreak)
  const earnedToday = useQuiz((s) => s.earnedToday)
  const quizDay = useQuiz((s) => s.day)
  const today = dayKey()
  const roomLeft = quizDay === today ? Math.max(0, QUIZ_DAILY_CAP - earnedToday) : QUIZ_DAILY_CAP

  const [round, setRound] = useState(0) // 轮次种子基数
  const [idx, setIdx] = useState(0)
  const [chosen, setChosen] = useState<string | null>(null)
  const [correct, setCorrect] = useState(0)
  const [done, setDone] = useState(false)
  const [earned, setEarned] = useState(0)

  const questions = useMemo(() => {
    const out: QuizQuestion[] = []
    for (let i = 0; i < QUIZ_LENGTH; i++) {
      const q = makeQuestion(round * 7919 + i * 131 + 1)
      if (q) out.push(q)
    }
    return out
  }, [round])

  const q = questions[idx]
  // 题目主角。列传是懒加载的 144KB(见 loreLazy)—— 进这一屏就预热,
  // 答题那几秒足够它到位;没到位就只显示立绘与名字,不显示名言。
  const subject = q ? CARDS_BY_ID[q.subjectId] : undefined
  const [loreReady, setLoreReady] = useState(false)
  useEffect(() => {
    let alive = true
    void loadLore().then(() => alive && setLoreReady(true))
    return () => {
      alive = false
    }
  }, [])
  const subjectLore = loreReady && q ? loreNow()[q.subjectId] : undefined

  const answer = (opt: string) => {
    if (chosen) return
    setChosen(opt)
    const ok = opt === q.answer
    if (ok) setCorrect((c) => c + 1)
    playSfx(ok ? 'victory' : 'buttonTap')
    haptic('impact')
  }

  const next = () => {
    setChosen(null)
    if (idx + 1 < questions.length) {
      setIdx(idx + 1)
      return
    }
    const got = award(today, correct * QUIZ_MERIT_PER_CORRECT)
    noteStreak(correct)
    setEarned(got)
    setDone(true)
  }

  const restart = () => {
    setRound((r) => r + 1)
    setIdx(0)
    setChosen(null)
    setCorrect(0)
    setEarned(0)
    setDone(false)
  }

  // 朝代题的选项是 dynasty tag,其余两类都是人名 id
  const label = (value: string) =>
    q.kind === 'whichDynasty' ? pick(dynastyName(value)) : pick(personLabel(value))

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
        <h2 className={styles.title}>{t('稽古', 'Test of History')}</h2>
        <span className={styles.progress}>
          {done ? t('已毕', 'Done') : `${idx + 1} / ${questions.length}`}
        </span>
      </header>

      {!done && q && (
        <>
          <div className={styles.kind}>
            {q.kind === 'whoIsIt'
              ? t('列传所载,此人是谁?', 'Whose chronicle is this?')
              : q.kind === 'whichDynasty'
                ? t('此人属哪一朝代阵营?', 'Which dynasty did they serve?')
                : t('此人的宿敵是誰?', 'Who was their sworn rival?')}
          </div>
          <p className={styles.prompt}>{pick(q.prompt)}</p>
          <div className={styles.options}>
            {q.options.map((opt) => {
              const isAnswer = opt === q.answer
              const cls = !chosen
                ? styles.opt
                : isAnswer
                  ? styles.optRight
                  : opt === chosen
                    ? styles.optWrong
                    : styles.optDim
              return (
                <button key={opt} className={cls} onClick={() => answer(opt)} disabled={!!chosen}>
                  {label(opt)}
                </button>
              )
            })}
          </div>
          {/* 答完之后**揭晓这是谁**。
              稽古此前是「答对了 / 答错了」然后下一题 —— 一轮五题打完,
              玩家一个人都没记住。而 subjectId 现成就在题目里,立绘、称号、
              生平全在列传数据里躺着(名将列传那一屏用的就是它)。
              一道题的价值从「猜中没有」变成「原来他是这么个人」。 */}
          {chosen && subject && (
            <div className={`${styles.reveal} ${chosen === q.answer ? styles.revealRight : styles.revealWrong}`}>
              <span className={styles.revealPortrait}>
                <Portrait
                  id={subject.id}
                  nameZh={subject.name.zh}
                  doctrine={subject.doctrine}
                />
              </span>
              <div className={styles.revealBody}>
                <div className={styles.revealName}>
                  {pick(subject.name)}
                  {subjectLore?.era && <span className={styles.revealEra}>{pick(subjectLore.era)}</span>}
                </div>
                {subjectLore?.quote && (
                  <p className={styles.revealQuote}>「{pick(subjectLore.quote)}」</p>
                )}
              </div>
            </div>
          )}
          {chosen && (
            <button className={styles.nextBtn} onClick={next}>
              {idx + 1 < questions.length ? t('下一题 ›', 'Next ›') : t('看结果 ›', 'Results ›')}
            </button>
          )}
        </>
      )}

      {done && (
        <div className={styles.result}>
          {/* 满分才有仪式。全对与四对一错在画面上此前是同一个样子 ——
              而「全对」正是这个模式唯一值得追的东西。 */}
          <div
            className={`${styles.score} ${correct === questions.length ? styles.scorePerfect : ''}`}
          >
            {correct} / {questions.length}
          </div>
          {correct === questions.length && (
            <div className={styles.gradeSeal}>{t('甲等', 'Top marks')}</div>
          )}
          <p className={styles.resultText}>
            {earned > 0
              ? t(`稽古有成,得功勋 +${earned}`, `Well studied — +${earned} merit`)
              : t('今日功勋已满,权当温故。', 'Daily merit is capped — study for its own sake.')}
          </p>
          <p className={styles.meta}>
            {t(
              `今日已得 ${Math.min(QUIZ_DAILY_CAP, QUIZ_DAILY_CAP - roomLeft + earned)}/${QUIZ_DAILY_CAP} · 最佳 ${bestStreak}/${QUIZ_LENGTH}`,
              `Today ${Math.min(QUIZ_DAILY_CAP, QUIZ_DAILY_CAP - roomLeft + earned)}/${QUIZ_DAILY_CAP} · best ${bestStreak}/${QUIZ_LENGTH}`,
            )}
          </p>
          <button className={styles.nextBtn} onClick={restart}>
            {t('再考一轮', 'Another round')}
          </button>
        </div>
      )}
    </div>
  )
}
