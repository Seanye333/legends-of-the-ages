import { useMemo, useState } from 'react'
import type { CardDef } from '../../engine/types'
import { CODEX, exampleFor, type CodexEntry } from '../codex'
import { CardFace } from '../components/CardFace'
import { CardInspect } from '../components/CardInspect'
import { fakeInstance } from './CollectionScreen'
import { usePickText, useT } from '../i18n'
import { lessonForMechanic } from '../../content/lessons'
import { playSfx } from '../sound'
import { emphasize } from '../components/Emphasis'
import styles from './CodexScreen.module.css'
import { EmptyState } from '../components/EmptyState'

interface CodexScreenProps {
  onBack: () => void
  // 开一局实练(走谜题通道)。不传则讲堂仍是纯手册。
  onStartLesson?: (lessonId: string) => void
}

// 兵法讲堂:关键词 / 机制 / 对局规则 / 敌手档位的可查手册。
//
// 教程只讲了「出牌—攻击—结束回合」。守护到底强制什么、铁壁挡的是一次还是一点、
// 连击和連擊(风怒)是不是一回事 —— 这些以前没有任何地方能查。
export function CodexScreen({ onBack, onStartLesson }: CodexScreenProps) {
  const t = useT()
  const pick = usePickText()
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [inspect, setInspect] = useState<CardDef | null>(null)

  // 例卡查一次就够 —— 它只跟卡池有关,和筛选无关
  const examples = useMemo(() => {
    const m = new Map<string, CardDef | undefined>()
    for (const s of CODEX) for (const e of s.entries) m.set(e.id, exampleFor(e))
    return m
  }, [])

  const q = query.trim().toLowerCase()
  const matches = (e: CodexEntry) =>
    !q ||
    e.term.zh.toLowerCase().includes(q) ||
    e.term.en.toLowerCase().includes(q) ||
    e.rule.zh.includes(query.trim()) ||
    e.rule.en.toLowerCase().includes(q)

  const sections = CODEX.map((s) => ({ ...s, entries: s.entries.filter(matches) })).filter(
    (s) => s.entries.length > 0,
  )

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
        <h2 className={styles.title}>{t('兵法讲堂', 'Codex')}</h2>
        <input
          className={styles.search}
          placeholder={t('搜索规则…', 'Search rules…')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </header>

      {sections.map((section) => (
        <section key={section.id} className={styles.section}>
          <h3 className={styles.sectionTitle}>{pick(section.title)}</h3>
          <div className={styles.list}>
            {section.entries.map((entry) => {
              const open = openId === entry.id
              const ex = examples.get(entry.id)
              return (
                <div key={entry.id} className={`${styles.entry} ${open ? styles.entryOpen : ''}`}>
                  <button
                    className={styles.entryHead}
                    aria-expanded={open}
                    onClick={() => {
                      playSfx('buttonTap')
                      setOpenId(open ? null : entry.id)
                    }}
                  >
                    <span className={styles.term}>{pick(entry.term)}</span>
                    {/* 讲堂的说明文字里有 16 处 `**着重**`。它们是纯文本塞进
                        <span> 的,星号此前原样露在界面上 —— 写文案的人在源码里
                        读它,那里星号是对的,所以谁都没发现。 */}
                    <span className={styles.rule}>{emphasize(pick(entry.rule))}</span>
                    {(entry.note || ex) && (
                      <span className={styles.chevron} aria-hidden="true">
                        {open ? '▾' : '▸'}
                      </span>
                    )}
                  </button>
                  {open && (
                    <div className={styles.detail}>
                      {entry.note && <p className={styles.note}>{pick(entry.note)}</p>}
                      {/* 实练:讲堂此前是一本**只能读的手册**。
                          兵种/阵型/战场这几条新轴比关键词难懂一档,读完仍然不会用 ——
                          借斩杀谜题那整条管线(残局 + 求解器验证 + 谜题对局通道)给一道题。 */}
                      {lessonForMechanic(entry.id) && onStartLesson && (
                        <button
                          className={styles.lessonBtn}
                          onClick={() => {
                            const lesson = lessonForMechanic(entry.id)!
                            playSfx('duel')
                            onStartLesson(lesson.id)
                          }}
                        >
                          {t('上手试一试 ›', 'Try it ›')}
                        </button>
                      )}
                      {ex && (
                        <div className={styles.exampleWrap}>
                          <span className={styles.exampleLabel}>{t('例', 'e.g.')}</span>
                          <div className={styles.exampleCard}>
                            <CardFace inst={fakeInstance(ex)} onClick={() => setInspect(ex)} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {sections.length === 0 && (
        <EmptyState
          glyph="索"
          title={t('没有匹配的条目', 'No matching entries')}
          hint={t('换个关键词试试 —— 每条机制都配了一张真卡当例子。', 'Try another keyword — every mechanic has a real card as its example.')}
        />
      )}
      {inspect && <CardInspect def={inspect} onClose={() => setInspect(null)} />}
    </div>
  )
}
