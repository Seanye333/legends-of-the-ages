import { describe, expect, it } from 'vitest'
import { PROTOCOL_VERSION } from '../../src/app/protocol'
import { MIN_CLIENT_VERSION, clientVersionOf, isSupported, outdatedError } from './protocolGuard'

describe('protocol guard', () => {
  it('treats a missing version as 0 (clients from before versioning existed)', () => {
    expect(clientVersionOf(undefined)).toBe(0)
    expect(clientVersionOf(null)).toBe(0)
    expect(clientVersionOf('1')).toBe(0)
    expect(clientVersionOf(NaN)).toBe(0)
  })

  it('accepts the version this build ships', () => {
    expect(isSupported(PROTOCOL_VERSION)).toBe(true)
  })

  it('rejects anything below the server minimum', () => {
    expect(isSupported(MIN_CLIENT_VERSION - 1)).toBe(false)
    expect(isSupported(undefined)).toBe(false)
  })

  it('accepts newer clients — a rolling deploy must not break the ones already updated', () => {
    expect(isSupported(PROTOCOL_VERSION + 1)).toBe(true)
  })

  it('error string carries both versions so the mismatch is diagnosable', () => {
    expect(outdatedError(0)).toBe(`protocol-outdated:0<${MIN_CLIENT_VERSION}`)
  })

  it('server never demands a version it does not itself implement', () => {
    // 手滑把 MIN 抬过 PROTOCOL_VERSION 会让**所有**客户端被拒,包括刚发布的那个
    expect(MIN_CLIENT_VERSION).toBeLessThanOrEqual(PROTOCOL_VERSION)
  })
})
