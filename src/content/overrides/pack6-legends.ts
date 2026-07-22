import type { CardDef } from '../../engine/types'

// 第六卡包 · 名将记忆点。
//
// 这是一个**名将**游戏,但除了三国那批签名卡,横跨春秋到清的传奇大多是
// 自动播种出来的白板大身材 —— 24 个有名有姓的传奇没有任何效果。
// 这一批给最有名的一批赋予**专属记忆点**:一张牌捕捉一个人的历史形象。
//
// 全部是「签名集之外、且不在预组里」的安全花名册 —— 覆盖它们不碰平衡基线
// (sim-balance 只测预组),只让竞技场/冒险/图鉴里的名将各有各的魂。
// 身材一律不动,只加效果;都是 8–10 费的顶级传奇,配得上强效果。
export const PACK6_LEGEND_OVERRIDES: Record<string, Partial<CardDef>> = {
  // 康熙(10 费 6/13 · 清):千古一帝,盛世养兵 —— 战吼全体友军 +0/+2
  'hist-kangxi': {
    battlecry: { ops: [{ op: 'buffStats', attack: 0, health: 2, target: 'allFriendlyGenerals' }] },
    text: {
      zh: '戰吼:使你所有武將 +0/+2。康乾盛世,休養生息。',
      en: 'Battlecry: give all your generals +0/+2.',
    },
  },
  // 慕容恪(9 费 9/9 · 两晋):十六国第一名将,一生未尝败绩 —— 守护 + 吸血,近乎不可解
  'hist-murong-ke': {
    keywords: ['guard', 'lifesteal'],
    text: {
      zh: '守護、吸血。十六國第一名將,一生未嘗一敗。',
      en: 'Guard, Lifesteal. The finest general of the Sixteen Kingdoms — never once defeated.',
    },
  },
  // 穆桂英(9 费 11/7 · 宋):穆桂英挂帅,一往无前 —— 冲锋
  'hist-mu-guiying': {
    keywords: ['charge'],
    text: {
      zh: '衝鋒。穆桂英掛帥,大破天門陣。',
      en: 'Charge. Mu Guiying takes command and shatters the enemy line.',
    },
  },
  // 孙膑(10 费 6/11 · 战国):兵法大家,围魏救赵 —— 战吼发现一张锦囊
  'hist-sun-bin': {
    battlecry: { ops: [{ op: 'discover', pool: 'myStratagem' }] },
    text: {
      zh: '守護。戰吼:發現一張錦囊。圍魏救趙,減灶誘敵。',
      en: 'Guard. Battlecry: Discover a stratagem.',
    },
  },
  // 周文王(10 费 6/11 · 春秋):演周易、求贤若渴 —— 战吼发现一名武将
  'hist-zhou-wenwang': {
    battlecry: { ops: [{ op: 'discover', pool: 'myGeneral' }] },
    text: {
      zh: '戰吼:發現一名武將。演周易,渭水訪賢。',
      en: 'Battlecry: Discover a general.',
    },
  },
  // 张巡(10 费 9/8 · 唐):睢阳死守,与城偕亡 —— 守护 + 亡语对全场敌军 4 点
  'hist-zhang-xun': {
    deathrattle: { ops: [{ op: 'aoeDamage', amount: 4 }] },
    text: {
      zh: '守護。亡語:對所有敵方武將造成 4 點傷害。睢陽死守,雖死猶生。',
      en: 'Guard. Deathrattle: deal 4 damage to all enemy generals.',
    },
  },
  // 兰陵王(9 费 8/8 · 南北朝):戴面具的美男猛将,入阵曲 —— 冲锋 + 单挑
  'hist-lanlingwang': {
    keywords: ['charge', 'duel'],
    text: {
      zh: '衝鋒、單挑。面具之下,邙山破陣。',
      en: 'Charge, Duel. Behind the mask, he breaks the line at Mangshan.',
    },
  },
  // 刘伯温(9 费 5/11 · 明):神机妙算,前知五百年 —— 战吼抽三张
  'hist-liu-bowen': {
    battlecry: { ops: [{ op: 'draw', count: 3 }] },
    text: {
      zh: '戰吼:抽三張牌。前知五百年,後知五百載。',
      en: 'Battlecry: draw three cards.',
    },
  },
  // 辛弃疾(8 费 9/7 · 宋):词人将军,醉里挑灯看剑 —— 冲锋
  'hist-xin-qiji': {
    keywords: ['charge'],
    text: {
      zh: '衝鋒。醉裡挑燈看劍,夢回吹角連營。',
      en: 'Charge. Drunk, he trims the lamp to study his blade.',
    },
  },
  // 岳飞不在此列(已另有安排);此处专收非三国、原本无效果的大身材传奇。
}
