// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { GeneralToken } from './GeneralToken'
import { CARDS_BY_ID } from '../../content/cards'
import { createInstance } from '../../engine/init'
import { addEnchant } from '../../engine/resolve'
import type { CardInstance, Keyword } from '../../engine/types'

afterEach(cleanup)

function unit(defId: string, over: Partial<CardInstance> = {}, grant: Keyword[] = []): CardInstance {
  const c = createInstance(defId, 1, CARDS_BY_ID)
  if (grant.length) addEnchant(c, CARDS_BY_ID, { attack: 0, health: 0, keywords: grant }, null, 0)
  return { ...c, ...over }
}

// 场上单位的状态(守护/铁壁/潜行/冰封/沉默)此前**只靠颜色和小徽章**传达。
// 补 aria-label 之后,读屏器才拿得到;这些断言防止它悄悄退化。
describe('GeneralToken 把状态读出来', () => {
  it('标签里带名字与当前身材', () => {
    render(<GeneralToken inst={unit('guan-yu')} onClick={() => undefined} />)
    const label = screen.getByRole('button').getAttribute('aria-label') ?? ''
    expect(label).toContain('關羽')
    expect(label).toMatch(/\d+\/\d+/)
  })

  it('铁壁 / 潜行 / 守护会出现在标签里', () => {
    render(
      <GeneralToken
        inst={unit('guan-yu', {}, ['divineShield', 'stealth', 'guard'])}
        onClick={() => undefined}
      />,
    )
    const label = screen.getByRole('button').getAttribute('aria-label') ?? ''
    expect(label).toContain('铁壁')
    expect(label).toContain('潜行')
    expect(label).toContain('守护')
  })

  it('冰封与沉默会出现在标签里', () => {
    render(
      <GeneralToken
        inst={unit('guan-yu', { frozen: true, silenced: true })}
        onClick={() => undefined}
      />,
    )
    const label = screen.getByRole('button').getAttribute('aria-label') ?? ''
    expect(label).toContain('冰封')
    expect(label).toContain('沉默')
  })

  it('可攻击状态也读得出来(否则键盘玩家不知道谁能动)', () => {
    render(<GeneralToken inst={unit('guan-yu')} ready onClick={() => undefined} />)
    expect(screen.getByRole('button').getAttribute('aria-label')).toContain('可攻击')
  })

  it('派生身材来自附魔层,而不是卡面原值', () => {
    const buffed = unit('guan-yu')
    addEnchant(buffed, CARDS_BY_ID, { attack: 3, health: 2 }, null, 0)
    render(<GeneralToken inst={buffed} onClick={() => undefined} />)
    const base = CARDS_BY_ID['guan-yu']
    const label = screen.getByRole('button').getAttribute('aria-label') ?? ''
    expect(label).toContain(`${(base.attack ?? 0) + 3}/${(base.health ?? 0) + 2}`)
  })
})
