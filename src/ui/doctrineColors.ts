import type { CardDef, CardType, Keyword, LocalizedText, Rarity } from '../engine/types'

// 六主义 + 中立的主题色。标题画面与对战画面共用。
export const DOCTRINE_COLORS: Record<CardDef['doctrine'], string> = {
  royal: '#d4a84a',
  hegemonic: '#b8442e',
  ritual: '#88b7e8',
  fame: '#c19a3b',
  separatist: '#7a5a3a',
  reclusion: '#7a9a5a',
  neutral: '#8a8a8a',
}

// 词条徽章(中文单字 / 英文单字母)—— 用 pickCompact 取,'both' 跟随中文。
export const KEYWORD_BADGE: Record<Keyword, LocalizedText> = {
  charge: { zh: '冲', en: 'C' },
  rush: { zh: '突', en: 'R' },
  guard: { zh: '守', en: 'G' },
  windfury: { zh: '连', en: 'W' },
  duel: { zh: '单', en: 'D' },
  lifesteal: { zh: '吸', en: 'L' },
  poison: { zh: '毒', en: 'P' },
  divineShield: { zh: '壁', en: 'S' },
  stealth: { zh: '潜', en: 'H' },
  trample: { zh: '碾', en: 'T' },
}

export const KEYWORD_NAME: Record<Keyword, LocalizedText> = {
  charge: { zh: '冲锋', en: 'Charge' },
  rush: { zh: '突袭', en: 'Rush' },
  guard: { zh: '守护', en: 'Guard' },
  windfury: { zh: '连击', en: 'Windfury' },
  duel: { zh: '单挑', en: 'Duel' },
  lifesteal: { zh: '吸血', en: 'Lifesteal' },
  poison: { zh: '剧毒', en: 'Poison' },
  divineShield: { zh: '铁壁', en: 'Divine Shield' },
  stealth: { zh: '潜行', en: 'Stealth' },
  trample: { zh: '碾压', en: 'Trample' },
}

// 关键词规则图例(卡牌详情页)
export const KEYWORD_RULE: Record<Keyword, LocalizedText> = {
  charge: {
    zh: '上场当回合即可攻击任意目标',
    en: 'Can attack any target the turn it arrives',
  },
  rush: {
    zh: '上场当回合即可攻击武将(不能打主公)',
    en: 'Can attack generals the turn it arrives, but not the enemy hero',
  },
  guard: { zh: '敌方必须先攻击带守护的武将', en: 'Enemies must attack this general first' },
  windfury: { zh: '每回合可攻击两次', en: 'Can attack twice each turn' },
  duel: {
    zh: '上场时可指定一名敌将单挑:双方互击,攻高者先手,先手击杀则不受反击',
    en: 'On arrival, challenge an enemy general: both strike, higher attack goes first, and a first-strike kill takes no return blow',
  },
  lifesteal: {
    zh: '战斗中造成伤害时,为我方主公恢复等量生命',
    en: 'Damage dealt in combat heals your hero for the same amount',
  },
  poison: { zh: '战斗中伤害到的武将立即死亡', en: 'Any general it damages in combat dies at once' },
  divineShield: {
    zh: '抵消下一次受到的伤害,不论多少;被沉默会一并失去',
    en: 'Ignores the next damage it takes, however large. Lost when silenced.',
  },
  stealth: {
    zh: '不能被敌方选为目标,也不能用守护逼迫对手;自身发起攻击后解除',
    en: 'Cannot be targeted by the enemy and does not force attacks with Guard. Lost when it attacks.',
  },
  trample: {
    zh: '攻击武将时,超过其当前生命的伤害穿透到敌方主公;被铁壁挡下则无穿透',
    en: 'When attacking a general, damage beyond its current health carries through to the enemy hero. A Divine Shield that absorbs the hit stops it.',
  },
}

// 主义名的唯一来源在 content/names.ts(app 层也要用,不能只存在于 ui)
export { DOCTRINE_NAME } from '../content/names'

export const RARITY_NAME: Record<Rarity, LocalizedText> = {
  common: { zh: '普通', en: 'Common' },
  rare: { zh: '稀有', en: 'Rare' },
  epic: { zh: '史诗', en: 'Epic' },
  legendary: { zh: '传奇', en: 'Legendary' },
}

export const CARD_TYPE_NAME: Record<CardType | 'strategist', LocalizedText> = {
  general: { zh: '武将', en: 'General' },
  strategist: { zh: '谋士', en: 'Strategist' },
  stratagem: { zh: '锦囊', en: 'Stratagem' },
  equipment: { zh: '装备', en: 'Equipment' },
}

export const DYNASTY_NAME: Record<string, LocalizedText> = {
  wei: { zh: '魏', en: 'Wei' },
  shu: { zh: '蜀', en: 'Shu' },
  wu: { zh: '吴', en: 'Wu' },
  qun: { zh: '群', en: 'Qun' },
  'spring-autumn': { zh: '春秋', en: 'Spring & Autumn' },
  'warring-states': { zh: '战国', en: 'Warring States' },
  qin: { zh: '秦', en: 'Qin' },
  'chu-han': { zh: '楚汉', en: 'Chu-Han' },
  'western-han': { zh: '西汉', en: 'Western Han' },
  jin: { zh: '两晋', en: 'Jin' },
  'southern-northern': { zh: '南北朝', en: 'N. & S. Dynasties' },
  sui: { zh: '隋', en: 'Sui' },
  tang: { zh: '唐', en: 'Tang' },
  'five-dynasties': { zh: '五代', en: 'Five Dynasties' },
  song: { zh: '宋', en: 'Song' },
  yuan: { zh: '元', en: 'Yuan' },
  ming: { zh: '明', en: 'Ming' },
  qing: { zh: '清', en: 'Qing' },
}

export function dynastyName(dynasty: string): LocalizedText {
  return DYNASTY_NAME[dynasty] ?? { zh: dynasty, en: dynasty }
}
