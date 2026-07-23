import type { LocalizedText, RunModifiers } from '../engine/types'

// 乱斗:一场怪规则的快速对局。规则**双方同吃**,所以是公平的混战 —— 纯图一乐,
// 也顺便让玩家在奇葩规则下重新认识自己的卡组。复用 RunModifiers,零引擎改动。
//
// hpDelta:双方主公血量增减(RunModifiers 里没有 HP,单列)。
export interface BrawlDef {
  id: string
  name: LocalizedText
  text: LocalizedText
  modifiers: RunModifiers // 双方同吃
  hpDelta?: number
}

export const BRAWLS: BrawlDef[] = [
  {
    id: 'brawl-chaos',
    name: { zh: '天下大亂', en: 'The Realm in Chaos' },
    text: { zh: '双方起手多抽四张牌。', en: 'Both players draw four extra opening cards.' },
    modifiers: { bonusHandSize: 4 },
  },
  {
    id: 'brawl-swift',
    name: { zh: '兵貴神速', en: 'Speed is the Soul of War' },
    text: { zh: '双方主公技免费。', en: 'Both Hero Powers are free.' },
    modifiers: { heroPowerCostDelta: -2 },
  },
  {
    id: 'brawl-fortress',
    name: { zh: '堅城對峙', en: 'Fortress Standoff' },
    text: { zh: '双方开局获得 10 点护甲。', en: 'Both players start with 10 Armor.' },
    modifiers: { startArmor: 10 },
  },
  {
    id: 'brawl-swarm',
    name: { zh: '群雄並起', en: 'Warlords Everywhere' },
    text: { zh: '双方开局各带三个 1/1 的乡勇。', en: 'Both players start with three 1/1 Village Levies.' },
    modifiers: { startTokens: ['token-xiangyong', 'token-xiangyong', 'token-xiangyong'] },
  },
  {
    id: 'brawl-cheap',
    name: { zh: '謀定後動', en: 'Plans Laid in Advance' },
    text: { zh: '双方起手手牌费用 -2。', en: 'Cards in both opening hands cost 2 less.' },
    modifiers: { handCostDelta: -2 },
  },
  {
    id: 'brawl-blitz',
    name: { zh: '破釜沉舟', en: 'Burn the Boats' },
    text: {
      zh: '双方开局 15 血、起手多抽两张 —— 速战速决。',
      en: 'Both heroes start at 15 HP and draw two extra cards. Make it quick.',
    },
    modifiers: { bonusHandSize: 2 },
    hpDelta: -15,
  },
  {
    id: 'brawl-titan',
    name: { zh: '巨闕在手', en: 'Colossus Unleashed' },
    text: {
      zh: '双方主公技免费、开局 5 护甲、起手多抽一张。',
      en: 'Both Hero Powers are free; both start with 5 Armor and an extra card.',
    },
    modifiers: { heroPowerCostDelta: -2, startArmor: 5, bonusHandSize: 1 },
  },
  {
    id: 'brawl-ironcav',
    name: { zh: '鐵騎洪流', en: 'Torrent of Iron' },
    text: { zh: '双方开局各带两个 2/2 的铁骑。', en: 'Both players start with two 2/2 Ironclad Cavalry.' },
    modifiers: { startTokens: ['token-tie-qi', 'token-tie-qi'] },
  },
  {
    id: 'brawl-imperial',
    name: { zh: '禁軍列陣', en: 'Guard in Formation' },
    text: {
      zh: '双方开局各带一个 3/3 禁军,并获得 5 点护甲。',
      en: 'Both players start with a 3/3 Imperial Guard and 5 Armor.',
    },
    modifiers: { startTokens: ['token-jin-jun'], startArmor: 5 },
  },
  {
    id: 'brawl-firestorm',
    name: { zh: '開局即決', en: 'Decided at the Gate' },
    text: {
      zh: '双方主公技免费、起手多抽三张 —— 一上来就是高潮。',
      en: 'Both Hero Powers are free and both draw three extra cards — it peaks from turn one.',
    },
    modifiers: { heroPowerCostDelta: -2, bonusHandSize: 3 },
  },
]
