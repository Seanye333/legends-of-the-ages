import { CARDS_BY_ID } from '../src/content/cards'
for (const id of ['wang-xiu','sun-qian','yuan-shang','strat-troop-volley']) {
  const c = CARDS_BY_ID[id]
  console.log(id, c ? `${c.cost}费 ${c.attack ?? '-'}/${c.health ?? '-'} troop=${c.troop} | ${c.text?.zh ?? ''}` : '不存在')
}
