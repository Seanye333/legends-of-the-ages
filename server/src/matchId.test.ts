import { describe, expect, it } from 'vitest'
import { signMatchId, verifyMatchId } from './matchId'

// 这是天梯反刷分的唯一屏障:验签一旦出错,自选 matchId 就能刷分。
describe('match id signing', () => {
  it('round-trips', async () => {
    const raw = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    const id = await signMatchId(raw)
    expect(id.startsWith(`${raw}~`)).toBe(true)
    expect(await verifyMatchId(id)).toBe(true)
  })

  it('is deterministic for the same secret', async () => {
    expect(await signMatchId('x', 's')).toBe(await signMatchId('x', 's'))
  })

  it('rejects an unsigned id — this is the anti-farming barrier', async () => {
    expect(await verifyMatchId('just-a-uuid')).toBe(false)
    expect(await verifyMatchId('')).toBe(false)
    expect(await verifyMatchId('~')).toBe(false)
    expect(await verifyMatchId('~sig')).toBe(false)
  })

  it('rejects a tampered payload', async () => {
    const id = await signMatchId('match-one')
    const sig = id.slice(id.lastIndexOf('~') + 1)
    expect(await verifyMatchId(`match-two~${sig}`)).toBe(false)
  })

  it('rejects a signature made with a different secret', async () => {
    const id = await signMatchId('m', 'secret-a')
    expect(await verifyMatchId(id, 'secret-b')).toBe(false)
    expect(await verifyMatchId(id, 'secret-a')).toBe(true)
  })

  it('uses the last tilde so a raw id containing ~ still verifies', async () => {
    const raw = 'weird~id~with~tildes'
    expect(await verifyMatchId(await signMatchId(raw))).toBe(true)
  })
})
