import type { CardDef } from '../../engine/types'
import { DOCTRINE_COLORS, DOCTRINE_ZH, KEYWORD_ZH } from '../doctrineColors'
import { Portrait } from './Portrait'
import { usePickText } from '../i18n'
import styles from './CardInspect.module.css'

// 关键词规则图例
const KEYWORD_RULES: Record<string, string> = {
  charge: '上场当回合即可攻击任意目标',
  rush: '上场当回合即可攻击武将(不能打主公)',
  guard: '敌方必须先攻击带守护的武将',
  windfury: '每回合可攻击两次',
  duel: '上场时可指定一名敌将单挑:双方互击,攻高者先手,先手击杀则不受反击',
}

const DYNASTY_ZH: Record<string, string> = {
  wei: '魏', shu: '蜀', wu: '吴', qun: '群',
  'spring-autumn': '春秋', 'warring-states': '战国', qin: '秦', 'chu-han': '楚汉',
  'western-han': '西汉', jin: '两晋', 'southern-northern': '南北朝', sui: '隋',
  tang: '唐', 'five-dynasties': '五代', song: '宋', yuan: '元', ming: '明', qing: '清',
}

const RARITY_ZH: Record<string, string> = {
  common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇',
}

interface CardInspectProps {
  def: CardDef
  onClose: () => void
}

// 卡牌详情:长按/点选打开 —— 全身立绘 + 数值 + 效果文本 + 关键词图例。
export function CardInspect({ def, onClose }: CardInspectProps) {
  const pick = usePickText()
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.card}
        style={{ borderColor: DOCTRINE_COLORS[def.doctrine] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.portrait}>
          <Portrait id={def.id} nameZh={def.name.zh} doctrine={def.doctrine} full />
          <span className={styles.cost}>{def.cost}</span>
          {def.type === 'general' && (
            <>
              <span className={styles.atk}>{def.attack}</span>
              <span className={styles.hp}>{def.health}</span>
            </>
          )}
        </div>
        <div className={styles.info}>
          <div className={styles.name}>{pick(def.name)}</div>
          <div className={styles.metaLine}>
            <span className={`${styles.rarity} ${styles[def.rarity]}`}>{RARITY_ZH[def.rarity]}</span>
            <span style={{ color: DOCTRINE_COLORS[def.doctrine] }}>{DOCTRINE_ZH[def.doctrine]}</span>
            <span>{DYNASTY_ZH[def.dynasty] ?? def.dynasty}势力</span>
            <span>{def.type === 'stratagem' ? '锦囊' : def.archetype === 'strategist' ? '谋士' : '武将'}</span>
            <span className={styles.collector}>№{def.collectorNo}</span>
          </div>
          {def.text && <p className={styles.text}>{def.text.zh}</p>}
          {def.keywords.length > 0 && (
            <div className={styles.keywords}>
              {def.keywords.map((k) => (
                <div key={k} className={styles.keywordRow}>
                  <span className={styles.keywordName}>{KEYWORD_ZH[k]}</span>
                  <span className={styles.keywordRule}>{KEYWORD_RULES[k]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
