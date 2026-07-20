import { useEffect, useState } from 'react'
import { EMOTES, type EmoteId } from '../../app/protocol'
import { useLang } from '../i18n'
import { useT } from '../i18n'
import { playSfx } from '../sound'
import { haptic } from '../haptics'
import styles from './EmoteWheel.module.css'

interface EmoteWheelProps {
  onSend: (emote: EmoteId) => void
  // 对手发来的表情(带序号 —— 连发同一个也要能再播一次)
  incoming: { emote: EmoteId; seq: number } | null
}

// 本地冷却:服务端也有 3 秒限速,这里先拦一道给即时反馈,免得点了没反应
const COOLDOWN_MS = 3000

// 表情轮盘。此前联机对局**完全没有任何社交通道** —— 协议里连这类消息都没有。
// 刻意做成固定六句而不是自由聊天:在没有举报/封禁系统的前提下开自由文本,
// 等于给骚扰开一扇没锁的门。六句都是「幸会 / 好手段 / 承让」这类中性用语,
// 连挑衅都收敛在「看招」以内。
export function EmoteWheel({ onSend, incoming }: EmoteWheelProps) {
  const t = useT()
  const lang = useLang()
  const [open, setOpen] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [bubble, setBubble] = useState<{ text: string; seq: number } | null>(null)

  // 对手表情 → 气泡
  useEffect(() => {
    if (!incoming) return
    const def = EMOTES.find((e) => e.id === incoming.emote)
    if (!def) return
    setBubble({ text: lang === 'en' ? def.en : def.zh, seq: incoming.seq })
    playSfx('buttonTap')
    const timer = window.setTimeout(() => setBubble(null), 2600)
    return () => window.clearTimeout(timer)
  }, [incoming, lang])

  // 点外面收起
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [open])

  const onPick = (id: EmoteId) => {
    if (Date.now() < cooldownUntil) return
    setCooldownUntil(Date.now() + COOLDOWN_MS)
    setOpen(false)
    playSfx('buttonTap')
    haptic('tap')
    onSend(id)
  }

  return (
    <>
      {bubble && (
        <div key={bubble.seq} className={styles.bubble} role="status" aria-live="polite">
          {bubble.text}
        </div>
      )}

      <div className={styles.anchor} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.trigger}
          aria-expanded={open}
          aria-label={t('表情', 'Emotes')}
          onClick={() => {
            playSfx('buttonTap')
            setOpen((v) => !v)
          }}
        >
          {t('言', 'Say')}
        </button>
        {open && (
          <div className={styles.wheel} role="menu">
            {EMOTES.map((e) => (
              <button
                key={e.id}
                type="button"
                role="menuitem"
                className={styles.item}
                onClick={() => onPick(e.id)}
              >
                {lang === 'en' ? e.en : e.zh}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
