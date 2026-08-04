import { useMemo, useState } from 'react'
import { CARDS_BY_ID, COLLECTIBLE_CARDS } from '../../content/cards'
import { battlesNow, loreNow, relationPath } from '../../content/loreLazy'
import { usePickCompact, useT } from '../i18n'
import { REL_KIND } from '../relationLabels'
import { playSfx } from '../sound'
import styles from './LoreIndex.module.css'

// 名将索引:列传原本只能顺着**人**翻(关系 / 家族 / 同乡),翻不动**事**。
// 赤壁牵涉十几个人,而玩家得一个一个点进去才拼得出来。
//
// 三种归类,回答三个不同的问题:
//   战役 —— 这一仗都有谁?(索引从生平原文反查,见生成脚本的 BATTLES)
//   郡望 —— 这个地方出过哪些人?(籍贯取前两字归郡:潁川人 / 潁川潁陰人 / 潁川陽翟人 是一处)
//   家族 —— 这一族都有谁?(族谱本来就在卡面上,这里是**通览**那一份)
//
// 只列人数够的组:两个人的「同乡」不是同乡,是巧合。
type Group = { key: string; label: string; ids: string[] }

export function LoreIndex({ onPick }: { onPick: (id: string) => void }) {
  const t = useT()
  const pickCompact = usePickCompact()
  const [kind, setKind] = useState<'battle' | 'home' | 'clan' | 'fate' | 'path'>('battle')
  const [open, setOpen] = useState<string | null>(null)

  const groups = useMemo((): Group[] => {
    if (kind === 'battle') {
      return battlesNow().map((b) => ({ key: b.name.zh, label: pickCompact(b.name), ids: b.ids }))
    }
    if (kind === 'fate') {
      // 按结局归类。用的是**类别**不是原文那个词 —— 「中流矢」「陣亡」「力戰而死」
      // 是同一件事,分开列就成了三堆各两个人的碎屑。
      const LORE = loreNow()
      const KINDS: [string, RegExp][] = [
        ['自刎', /自刎|自剄|伏劍|自縊|飲鴆|自殺|投水而死|投江/],
        ['戰死', /戰死|陣亡|中流矢|中箭|力戰而死|沒於陣|死於陣|歿於軍/],
        ['被誅', /夷三族|夷滅|伏誅|賜死|被殺|被害|遇害|見殺|所殺|所害|誅死|坐誅/],
        ['善終', /病卒|病死|疾卒|以疾卒|病篤而卒|善終|壽終/],
      ]
      return KINDS.map(([label, re]) => ({
        key: label,
        label,
        ids: COLLECTIBLE_CARDS.filter((c) => {
          const f = LORE[c.id]?.fate?.zh
          return Boolean(f && re.test(f))
        }).map((c) => c.id),
      })).filter((g) => g.ids.length >= 3)
    }
    if (kind === 'home') {
      const LORE = loreNow()
      const by = new Map<string, string[]>()
      for (const c of COLLECTIBLE_CARDS) {
        const home = LORE[c.id]?.home?.zh
        if (!home) continue
        // 「潁川人」「潁川潁陰人」「潁川陽翟人」是同一个郡 —— 取前两字归堆。
        // 三字以下的原样用(「趙人」「楚國人」这种本来就是整体)。
        const jun = home.length > 3 ? home.slice(0, 2) : home.replace(/人$/, '')
        by.set(jun, [...(by.get(jun) ?? []), c.id])
      }
      return [...by.entries()]
        .filter(([, ids]) => ids.length >= 3)
        .map(([k, ids]) => ({ key: k, label: k, ids }))
        .sort((a, b) => b.ids.length - a.ids.length || a.key.localeCompare(b.key))
    }
    const by = new Map<string, { label: string; ids: string[] }>()
    for (const c of COLLECTIBLE_CARDS) {
      if (!c.clan) continue
      const row = by.get(c.clan.id)
      if (row) row.ids.push(c.id)
      else by.set(c.clan.id, { label: pickCompact(c.clan.name), ids: [c.id] })
    }
    return [...by.entries()]
      .filter(([, v]) => v.ids.length >= 3)
      .map(([k, v]) => ({ key: k, label: v.label, ids: v.ids }))
      .sort((a, b) => b.ids.length - a.ids.length || a.key.localeCompare(b.key))
  }, [kind, pickCompact])

  return (
    <div className={styles.wrap}>
      <div className={styles.kinds}>
        {(
          [
            ['battle', t('戰役', 'Battles')],
            ['home', t('郡望', 'Origins')],
            ['clan', t('家族', 'Houses')],
            ['fate', t('結局', 'Ends')],
            ['path', t('牽連', 'Six Degrees')],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            className={kind === k ? styles.kindActive : styles.kindBtn}
            onClick={() => {
              playSfx('buttonTap')
              setKind(k)
              setOpen(null)
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {kind === 'path' && <PathFinder onPick={onPick} />}
      {kind !== 'path' && (
      <p className={styles.lede}>
        {kind === 'battle'
          ? t('生平里点到这一仗的人。索引从原文反查,不是我们编的名单。', 'Everyone whose chronicle names this battle — read out of the sources, not assembled by us.')
          : kind === 'home'
            ? t('同郡出身的人。籍贯取自生平原文,按郡归堆。', 'Men of the same commandery, grouped from the birthplaces named in their chronicles.')
            : kind === 'fate'
              ? t('怎么收场的。只取传的末尾两句 —— 别人的死不算他的。', 'How each life ended, read only from the closing lines of the chronicle — another man\u2019s death is not his.')
              : t('同族的人。族谱从生平里的亲属关系抠出来。', 'Kinsmen, read out of the family ties named in their chronicles.')}
      </p>
      )}
      {kind !== 'path' && (
      <div className={styles.list}>
        {groups.map((g) => (
          <div key={g.key} className={styles.group}>
            <button
              className={styles.groupHead}
              onClick={() => {
                playSfx('buttonTap')
                setOpen((v) => (v === g.key ? null : g.key))
              }}
              aria-expanded={open === g.key}
            >
              <span className={styles.groupLabel}>{g.label}</span>
              <span className={styles.groupCount}>{g.ids.length}</span>
            </button>
            {open === g.key && (
              <div className={styles.members}>
                {g.ids.map((id) => (
                  <button key={id} className={styles.member} onClick={() => onPick(id)}>
                    {pickCompact(CARDS_BY_ID[id]?.name ?? { zh: id, en: id })}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      )}
    </div>
  )
}

// 「這兩個人有關係嗎」—— 从关系网里找最短的一条链,每一跳都摆出处原文。
//
// 这个功能只有这个题材做得出来:链子不是「系统认为他们有关系」,
// 是「这句史料里他点了他的名」。所以每一跳都必须把那句话摆出来,
// 摆不出来的那一跳就不该存在。
function PathFinder({ onPick }: { onPick: (id: string) => void }) {
  const t = useT()
  const pickCompact = usePickCompact()
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const byName = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of COLLECTIBLE_CARDS) if (c.type === 'general' && !m.has(c.name.zh)) m.set(c.name.zh, c.id)
    return m
  }, [])
  const idA = byName.get(a.trim())
  const idB = byName.get(b.trim())
  const path = idA && idB ? relationPath(idA, idB) : undefined

  return (
    <div className={styles.path}>
      <p className={styles.lede}>
        {t(
          '输入两位武将的名字,看史料里他们隔了几层。每一跳都附出处原文。',
          'Name two generals and see how many links of recorded history stand between them. Every hop cites its source.',
        )}
      </p>
      <div className={styles.pathInputs}>
        <input className={styles.pathInput} value={a} onChange={(e) => setA(e.target.value)} placeholder={t('如 關羽', 'e.g. Guan Yu')} />
        <span className={styles.pathArrow}>→</span>
        <input className={styles.pathInput} value={b} onChange={(e) => setB(e.target.value)} placeholder={t('如 岳飛', 'e.g. Yue Fei')} />
      </div>
      {a.trim() && !idA && <p className={styles.pathNote}>{t(`查无此人:${a}`, `No such general: ${a}`)}</p>}
      {b.trim() && !idB && <p className={styles.pathNote}>{t(`查无此人:${b}`, `No such general: ${b}`)}</p>}
      {path === null && (
        <p className={styles.pathNote}>
          {t('六层之内查不到牵连 —— 史料里他们没有交集。', 'No link within six hops — the sources never bring them together.')}
        </p>
      )}
      {path && path.length === 0 && <p className={styles.pathNote}>{t('是同一个人。', 'Same person.')}</p>}
      {path && path.length > 0 && (
        <ol className={styles.pathList}>
          {path.map((e, i) => (
            <li key={`${e.a}-${e.b}-${i}`}>
              <span className={styles.pathHop}>
                <button className={styles.member} onClick={() => onPick(e.a)}>
                  {pickCompact(CARDS_BY_ID[e.a]?.name ?? { zh: e.a, en: e.a })}
                </button>
                <span className={styles.pathKind}>{pickCompact(REL_KIND[e.kind])}</span>
                <button className={styles.member} onClick={() => onPick(e.b)}>
                  {pickCompact(CARDS_BY_ID[e.b]?.name ?? { zh: e.b, en: e.b })}
                </button>
              </span>
              <span className={styles.pathQuote}>{e.quote}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
