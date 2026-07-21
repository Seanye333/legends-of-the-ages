import { useMemo, useState } from 'react'
import type { CardDef } from '../../engine/types'
import { CODEX, exampleFor, type CodexEntry } from '../codex'
import { CardFace } from '../components/CardFace'
import { CardInspect } from '../components/CardInspect'
import { fakeInstance } from './CollectionScreen'
import { usePickText, useT } from '../i18n'
import { playSfx } from '../sound'
import styles from './CodexScreen.module.css'

interface CodexScreenProps {
  onBack: () => void
}

// 兵法讲堂:关键词 / 机制 / 对局规则 / 敌手档位的可查手册。
//
// 教程只讲了「出牌—攻击—结束回合」。守护到底强制什么、铁壁挡的是一次还是一点、
// 连击和連擊(风怒)是不是一回事 —— 这些以前没有任何地方能查。
export function CodexScreen({ onBack }: CodexScreenProps) {
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
                    <span className={styles.rule}>{pick(entry.rule)}</span>
                    {(entry.note || ex) && (
                      <span className={styles.chevron} aria-hidden="true">
                        {open ? '▾' : '▸'}
                      </span>
                    )}
                  </button>
                  {open && (
                    <div className={styles.detail}>
                      {entry.note && <p className={styles.note}>{pick(entry.note)}</p>}
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

      {sections.length === 0 && <p className={styles.empty}>{t('没有匹配的条目', 'No matching entries')}</p>}
      {inspect && <CardInspect def={inspect} onClose={() => setInspect(null)} />}
    </div>
  )
}
