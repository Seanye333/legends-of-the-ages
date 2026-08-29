import { useEffect, useState } from 'react'
import { normalizeDifficulty, useSettings } from '../../app/settingsStore'
import { useCollection } from '../../app/collectionStore'
import {
  exportTransferCode,
  getSyncStatus,
  importTransferCode,
  onSyncStatus,
  syncNow,
  type SyncStatus,
} from '../../app/profileSync'
import { getPlayerId } from '../../app/leaderboard'
import { COLLECTIBLE_CARDS } from '../../content/cards'
import { useT, usePickText } from '../i18n'
import { clearDiagnostics, crashes, diagnosticsText } from '../../app/telemetry'
import { CARD_BACKS, isBackUnlocked } from '../../content/cardBacks'
import { useWarMerit } from '../../app/useWarMerit'
import { useCampaign } from '../../app/campaignStore'
import { useBossRush } from '../../app/bossRushStore'
import { playSfx, setMasterVolume, setMusicVolume, startMusic, stopMusic } from '../sound'
import { ConfirmDialog } from '../components/ConfirmDialog'
import styles from './SettingsScreen.module.css'

interface SettingsScreenProps {
  onBack: () => void
}

const SYNC_LABEL: Record<SyncStatus, { zh: string; en: string }> = {
  idle: { zh: '未同步', en: 'Not synced' },
  syncing: { zh: '同步中…', en: 'Syncing…' },
  synced: { zh: '已同步', en: 'Synced' },
  offline: { zh: '离线(本地优先,不影响游玩)', en: 'Offline — local-first, play continues' },
}

// 设置页。之前根本没有这一屏:语言/音效/难度是标题页上的三排小胶囊,
// 没有音量、没有战绩、没有账号、也没有「立即同步」——
// 而 profileSync 里的 syncNow()/getSyncStatus()/onSyncStatus() 早就写好了,
// 注释直接写着「设置页『立即同步』用」,却一个调用方都没有。
export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const t = useT()
  const pick = usePickText()
  const s = useSettings()
  const [diagCopied, setDiagCopied] = useState(false)
  // 卡背解锁只读**已经在记的东西**:军衔、冒险通关数、连斩最远、收藏数。
  // 不新开统计 —— 那意味着又要在 achievement.test 那道闸门里登记一次。
  const campaignCleared = useCampaign((c) => c.cleared.length)
  const gauntletBest = useBossRush((c) => c.best)
  const ownedSize = useCollection((c) => Object.values(c.owned).filter((n) => n > 0).length)
  const { rank: warRank } = useWarMerit()
  const backProgress = {
    // 与标题页/書房读同一个数 —— 从前这里只传 3 个字段,算出来的军衔
    // 系统性偏低,于是「已经是都尉了但卡背还没解锁」
    rankIndex: warRank.index,
    campaignCleared,
    gauntletBest,
    collectionSize: ownedSize,
  }
  const [crashCount, setCrashCount] = useState(() => crashes().length)
  const wins = useCollection((c) => c.wins)
  const losses = useCollection((c) => c.losses)
  const packs = useCollection((c) => c.packs)
  const merit = useCollection((c) => c.merit)
  const owned = useCollection((c) => c.owned)

  const [sync, setSync] = useState<SyncStatus>(getSyncStatus())
  const [confirmReset, setConfirmReset] = useState(false)
  const [copied, setCopied] = useState(false)
  const [moveCopied, setMoveCopied] = useState(false)
  const [moveCode, setMoveCode] = useState('')
  const [moveMsg, setMoveMsg] = useState<string | null>(null)

  useEffect(() => onSyncStatus(setSync), [])

  const total = wins + losses
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0
  const ownedCount = Object.values(owned).filter((n) => n > 0).length

  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        <button
          className={styles.backBtn}
          onClick={() => {
            playSfx('buttonTap')
            onBack()
          }}
        >
          {t('← 返回', '← Back')}
        </button>
        <h2 className={styles.title}>{t('设置', 'Settings')}</h2>
      </header>

      {/* 分组导航。
          设置页是七张卡片竖着排下来的一长列 —— 想改个音量要滚过战绩、
          想开色觉辅助要滚过音效和卡背。七个锚点比七次滚动便宜得多。
          用 <a href="#id"> 而不是 scrollIntoView:锚点跳转是浏览器原生行为,
          自带 `scroll-behavior: smooth`(在样式表里开),而且键盘可达。 */}
      <nav className={styles.nav} aria-label={t('设置分组', 'Settings sections')}>
        {(
          [
            ['set-record', { zh: '战绩', en: 'Record' }],
            ['set-audio', { zh: '音效', en: 'Audio' }],
            ['set-display', { zh: '显示', en: 'Display' }],
            ['set-cardback', { zh: '卡背', en: 'Card Back' }],
            ['set-difficulty', { zh: '敌手', en: 'Difficulty' }],
            ['set-save', { zh: '存档', en: 'Save' }],
          ] as const
        ).map(([id, label]) => (
          <a key={id} className={styles.navLink} href={`#${id}`}>
            {pick(label)}
          </a>
        ))}
      </nav>

      {/* ---- 战绩:一直在记录、一直在同步,但界面上从来没显示过 ---- */}
      <section id="set-record" className={styles.card}>
        <h3 className={styles.sectionTitle}>{t('战绩', 'Record')}</h3>
        <div className={styles.statRow}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{wins}</span>
            <span className={styles.statLabel}>{t('胜', 'Wins')}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{losses}</span>
            <span className={styles.statLabel}>{t('负', 'Losses')}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{winRate}%</span>
            <span className={styles.statLabel}>{t('胜率', 'Win rate')}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>
              {ownedCount}
              <small>/{COLLECTIBLE_CARDS.length}</small>
            </span>
            <span className={styles.statLabel}>{t('收集', 'Collected')}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{packs}</span>
            <span className={styles.statLabel}>{t('卡包', 'Packs')}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{merit}</span>
            <span className={styles.statLabel}>{t('功勋', 'Merit')}</span>
          </div>
        </div>
      </section>

      {/* ---- 音频 ---- */}
      <section id="set-audio" className={styles.card}>
        <h3 className={styles.sectionTitle}>{t('音效', 'Audio')}</h3>
        <label className={styles.toggleRow}>
          <span>{t('音效开关', 'Sound effects')}</span>
          <input
            type="checkbox"
            checked={s.soundEnabled}
            onChange={(e) => {
              s.setSoundEnabled(e.target.checked)
              if (e.target.checked) playSfx('buttonTap')
            }}
          />
        </label>
        <label className={styles.sliderRow}>
          <span>
            {t('音效音量', 'SFX volume')} · {Math.round(s.volume * 100)}%
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(s.volume * 100)}
            disabled={!s.soundEnabled}
            onChange={(e) => {
              const v = Number(e.target.value) / 100
              s.setVolume(v)
              setMasterVolume(v)
            }}
            onPointerUp={() => playSfx('buttonTap')}
          />
        </label>
        <label className={styles.toggleRow}>
          <span>
            {t('背景音乐', 'Music')}
            <small className={styles.hint}>
              {t('五声音阶实时合成,不循环固定旋律', 'Pentatonic, synthesized live — never loops')}
            </small>
          </span>
          <input
            type="checkbox"
            checked={s.musicEnabled}
            onChange={(e) => {
              s.setMusicEnabled(e.target.checked)
              if (e.target.checked) startMusic('title')
              else stopMusic()
            }}
          />
        </label>
        <label className={styles.sliderRow}>
          <span>
            {t('音乐音量', 'Music volume')} · {Math.round(s.musicVolume * 100)}%
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(s.musicVolume * 100)}
            disabled={!s.musicEnabled || !s.soundEnabled}
            onChange={(e) => {
              const v = Number(e.target.value) / 100
              s.setMusicVolume(v)
              setMusicVolume(v)
            }}
          />
        </label>
      </section>

      {/* ---- 显示 ---- */}
      <section id="set-display" className={styles.card}>
        <h3 className={styles.sectionTitle}>{t('显示', 'Display')}</h3>
        <div className={styles.chipRow}>
          {(['zh', 'en', 'both'] as const).map((lang) => (
            <button
              key={lang}
              className={s.language === lang ? styles.chipActive : styles.chip}
              onClick={() => {
                playSfx('buttonTap')
                s.setLanguage(lang)
              }}
            >
              {lang === 'zh' ? '中文' : lang === 'en' ? 'English' : '双语 · Both'}
            </button>
          ))}
        </div>
        {/* 【亮色主题的开关**故意还没放出来**】
            CSS 那一组覆盖已经在 index.css 里了,store 与 main.tsx 也接好了 ——
            差的是它还不合格:e2e/theme-contrast.spec.ts 实测,设置页 76 个文字元素
            里 75 个在亮色下低于 4.5:1,图鉴 426/545。
            根因是 307 处 alpha≥0.5 的半透明**填充**没进色阶(见 ROADMAP 30):
            0.8 不透明度的深色面板压在浅底上仍然是深色面板。
            放一个会把设置页变成读不出字的开关,比不放更糟。 */}
        <label className={styles.toggleRow}>
          <span>
            {t('减少动效', 'Reduce motion')}
            <small className={styles.hint}>
              {t('关闭冲锋/震屏/斩杀白闪', 'Turns off lunge, shake and lethal flash')}
            </small>
          </span>
          <input
            type="checkbox"
            checked={s.reducedMotion}
            onChange={(e) => s.setReducedMotion(e.target.checked)}
          />
        </label>

        {/* 色觉辅助。主义符号是**一直开着**的(六个主义只靠颜色的问题上一轮就修了),
            这个开关管的是剩下两处只靠颜色的地方:稀有度玉印、以及牌桌上
            「可攻击」(绿)与「可被指定」(红)那两圈光 —— 恰好是最常见的
            那种色觉异常分不开的一对,而它们是对局里最要紧的两个状态。 */}
        <label className={styles.toggleRow}>
          <span>
            {t('色觉辅助', 'Color-blind aid')}
            <small className={styles.hint}>
              {t(
                '给稀有度与场上状态补形状标记 —— 不再只靠红绿分辨',
                'Adds shape markers to rarity and board state, so red/green is not the only cue',
              )}
            </small>
          </span>
          <input
            type="checkbox"
            checked={s.colorBlind}
            onChange={(e) => s.setColorBlind(e.target.checked)}
          />
        </label>

        {/* 字形。卡池文案是繁體(导入自姊妹仓库),界面文案是手写的简体,
            同一屏两种字形混排。**只做繁→简,不做简→繁** ——
            繁→简是多对一(發/髮 都作发),纯查表永远不会错;
            简→繁是一对多(发 到底是 發 还是 髮 要看词),没有词典会错得看不出来。 */}
        <div className={styles.chipRow}>
          {(
            [
              ['trad', { zh: '繁體(原文)', en: 'Traditional (as written)' }],
              ['simp', { zh: '简体', en: 'Simplified' }],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              className={s.zhVariant === k ? styles.chipActive : styles.chip}
              onClick={() => {
                playSfx('buttonTap')
                s.setZhVariant(k)
              }}
            >
              {pick(label)}
            </button>
          ))}
        </div>

        {/* 牌桌。舆图是默认(复用战场底图),另外两张全部程序生成 ——
            包体红线 150MB 里立绘已占 59.6MB,三张牌桌图加不起。
            木案与绢帛都比舆图安静:舆图上有山有河有海船,虽然压得很暗,
            但满场立绘之外仍有东西在争注意力。 */}
        <div className={styles.chipRow}>
          {(
            [
              ['map', { zh: '輿圖', en: 'Map' }],
              ['wood', { zh: '木案', en: 'Wood' }],
              ['silk', { zh: '絹帛', en: 'Silk' }],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              className={s.tableStyle === k ? styles.chipActive : styles.chip}
              onClick={() => {
                playSfx('buttonTap')
                s.setTableStyle(k)
              }}
            >
              {pick(label)}
            </button>
          ))}
        </div>

        {/* 书法卡面。2,375 张卡里只有签名卡有真立绘,其余本来就是拓印 ——
            混排时那种参差在图鉴里最明显。整站统一成拓印之后它是一套自洽的画风,
            顺带一张图都不下(那层兜底早就写好了,一直只被当成占位在用)。 */}
        <div className={styles.chipRow}>
          {(
            [
              ['art', { zh: '立繪', en: 'Illustrated' }],
              ['ink', { zh: '書法拓印', en: 'Ink Rubbing' }],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              className={s.portraitStyle === k ? styles.chipActive : styles.chip}
              onClick={() => {
                playSfx('buttonTap')
                s.setPortraitStyle(k)
              }}
            >
              {pick(label)}
            </button>
          ))}
        </div>

        {/* 界面缩放。**不是只改字号** —— 全站字号写的都是 clamp(px, vh, px),
            一个 rem 都没有,改根字号对它们完全没有作用(见 main.tsx 那段)。
            走 zoom 缩放整个界面,于是按钮的点击区也跟着变大 ——
            对手抖的人比单放大文字更有用。 */}
        <label className={styles.sliderRow}>
          <span>
            {t(`界面缩放 ${Math.round(s.uiScale * 100)}%`, `Interface scale ${Math.round(s.uiScale * 100)}%`)}
            <small className={styles.hint}>
              {t('整体放大,按钮也跟着变大', 'Scales the whole interface, buttons included')}
            </small>
          </span>
          <input
            type="range"
            min={0.8}
            max={1.5}
            step={0.05}
            value={s.uiScale}
            onChange={(e) => s.setUiScale(Number(e.target.value))}
            aria-label={t('界面缩放', 'Interface scale')}
          />
        </label>
      </section>

      {/* ---- 卡背 ---- */}
      {/* 奖励此前只有功勋与卡包,两者最终都落回卡池 —— 于是「我通关了第三章」
          这件事在牌桌上是不可见的。卡背是唯一一样**对手也看得见**的东西。
          全部程序生成(CSS 渐变),零字节 —— 六张手绘卡背是六张图,
          而包体红线 150MB 里立绘已经占了 65MB。 */}
      <section id="set-cardback" className={styles.card}>
        <h3 className={styles.sectionTitle}>{t('卡背', 'Card Back')}</h3>
        <div className={styles.chipRow}>
          {CARD_BACKS.map((b) => {
            const unlocked = isBackUnlocked(b, backProgress)
            return (
              <button
                key={b.id}
                className={s.cardBack === b.id ? styles.chipActive : styles.chip}
                disabled={!unlocked}
                title={unlocked ? pick(b.name) : pick(b.hint)}
                onClick={() => {
                  playSfx('buttonTap')
                  s.setCardBack(b.id)
                }}
              >
                {/* 预览的形状/边框/锁定态都进了 CSS(.backSwatch);
                    background 留在内联 —— 每张卡背的渐变是内容层数据(b.css) */}
                <span className={styles.backSwatch} style={{ background: b.css }} />
                {unlocked ? pick(b.name) : '???'}
              </button>
            )
          })}
        </div>
        <p className={styles.hint}>
          {CARD_BACKS.filter((b) => !isBackUnlocked(b, backProgress))
            .map((b) => pick(b.hint))
            .join(' · ') || t('全部已解锁', 'All unlocked')}
        </p>
      </section>

      {/* ---- 诊断信息 ---- */}
      {/* 客户端此前没有任何崩溃留档:错误边界显示一次,刷新就永远没了,
          而玩家往往第二天才来说「昨天闪退过」。这一层只落 localStorage、
          不上报任何服务器 —— 要不要交出去由玩家点那一下决定(见 app/telemetry.ts)。 */}
      <section id="set-diag" className={styles.card}>
        <h3 className={styles.sectionTitle}>{t('诊断信息', 'Diagnostics')}</h3>
        <p className={styles.hint}>
          {t(
            `记录在本机:模式使用次数、最近 ${crashCount} 次错误。不会发送到任何服务器。`,
            `Kept on this device: mode usage and the last ${crashCount} errors. Never sent anywhere.`,
          )}
        </p>
        <div className={styles.chipRow}>
          <button
            className={styles.chip}
            onClick={async () => {
              playSfx('buttonTap')
              try {
                await navigator.clipboard.writeText(diagnosticsText())
                setDiagCopied(true)
                window.setTimeout(() => setDiagCopied(false), 1600)
              } catch {
                // 剪贴板被拒(iOS 非用户手势等):不做提示,按钮保持原样
              }
            }}
          >
            {diagCopied ? t('已复制', 'Copied') : t('复制诊断信息', 'Copy diagnostics')}
          </button>
          <button
            className={styles.chip}
            onClick={() => {
              playSfx('buttonTap')
              clearDiagnostics()
              setCrashCount(0)
            }}
          >
            {t('清空', 'Clear')}
          </button>
        </div>
      </section>

      {/* ---- 难度 ---- */}
      <section id="set-difficulty" className={styles.card}>
        <h3 className={styles.sectionTitle}>{t('敌手强度', 'AI difficulty')}</h3>
        <div className={styles.chipRow}>
          {(
            [
              { k: 'recruit', zh: '新兵', en: 'Novice', d: { zh: '常有失误,看不见多步斩杀', en: 'Blunders often; misses multi-step lethal' } },
              { k: 'veteran', zh: '宿将', en: 'Veteran', d: { zh: '偶尔失误', en: 'Occasional blunders' } },
              { k: 'general', zh: '名将', en: 'Legend', d: { zh: '零失误,必算斩杀', en: 'No blunders; always finds lethal' } },
              { k: 'marshal', zh: '军神', en: 'Marshal', d: { zh: '规划整个回合,看得见先亏后赚的组合', en: 'Plans the whole turn; sees setups that lose tempo to win value' } },
            ] as const
          ).map((o) => (
            <button
              key={o.k}
              className={s.difficulty === o.k ? styles.chipActive : styles.chip}
              title={pick(o.d)}
              onClick={() => {
                playSfx('buttonTap')
                s.setDifficulty(o.k)
              }}
            >
              {pick({ zh: o.zh, en: o.en })}
            </button>
          ))}
        </div>
        <p className={styles.hint}>
          {pick(
            [
              { zh: '新兵', en: 'Novice' },
              { zh: '宿将', en: 'Veteran' },
              { zh: '名将', en: 'Legend' },
              { zh: '军神', en: 'Marshal' },
              { zh: '天機', en: 'Oracle' },
            ][['recruit', 'veteran', 'general', 'marshal'].indexOf(normalizeDifficulty(s.difficulty))] ?? { zh: '', en: '' },
          )}
          {' — '}
          {pick(
            [
              { zh: '常有失误,且看不见多步斩杀线', en: 'Blunders often and cannot see multi-step lethal' },
              { zh: '偶尔失误', en: 'Occasional blunders' },
              { zh: '零失误,每回合先算一遍斩杀', en: 'No blunders; checks for lethal every turn' },
              { zh: '规划整个回合 —— 会为了后面赚回来而先走一步亏分的', en: 'Plans the entire turn, including moves that lose value now to gain more later' },
              { zh: '树搜索 —— 对军神实测 58.3%、对名将 72.2%', en: 'Tree search — measured 58.3% against Marshal and 72.2% against Legend' },
            ][['recruit', 'veteran', 'general', 'marshal'].indexOf(normalizeDifficulty(s.difficulty))] ?? { zh: '', en: '' },
          )}
        </p>
      </section>

      {/* ---- 账号与存档 ---- */}
      <section id="set-save" className={styles.card}>
        <h3 className={styles.sectionTitle}>{t('存档', 'Save data')}</h3>
        <div className={styles.kvRow}>
          <span>{t('云同步', 'Cloud sync')}</span>
          <span className={styles.kvValue}>{pick(SYNC_LABEL[sync])}</span>
        </div>
        <div className={styles.kvRow}>
          <span>{t('设备 ID', 'Device ID')}</span>
          <code className={styles.deviceId}>{getPlayerId()}</code>
        </div>
        <p className={styles.hint}>
          {t(
            '存档本地优先,云端只是镜像。换设备请用下面的「搬迁码」—— 它同时带着设备 ID 与归属密钥,只抄 ID 是换不过去的。搬迁码等同于账号凭据,别发给别人。',
            'Saves are local-first; the cloud is a mirror. To move devices use the transfer code below — it carries both your ID and the ownership key; the ID alone will not work. Treat it like a password.',
          )}
        </p>
        <div className={styles.buttonRow}>
          <button
            className={styles.action}
            onClick={() => {
              playSfx('buttonTap')
              void syncNow().then(setSync)
            }}
          >
            {t('立即同步', 'Sync now')}
          </button>
          <button
            className={styles.action}
            onClick={() => {
              playSfx('buttonTap')
              void navigator.clipboard?.writeText(getPlayerId())
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1600)
            }}
          >
            {copied ? t('已复制', 'Copied') : t('复制设备 ID', 'Copy device ID')}
          </button>
          <button
            className={styles.action}
            onClick={() => {
              playSfx('buttonTap')
              void navigator.clipboard?.writeText(exportTransferCode())
              setMoveCopied(true)
              window.setTimeout(() => setMoveCopied(false), 1600)
            }}
          >
            {moveCopied ? t('已复制', 'Copied') : t('复制搬迁码', 'Copy transfer code')}
          </button>
          <button className={styles.danger} onClick={() => setConfirmReset(true)}>
            {t('清空本地进度', 'Reset local progress')}
          </button>
        </div>
        {/* 导入搬迁码:粘进来 → 本机改用那份归属 → 立刻拉一次云端。
            这是「换设备」真正生效的那一步,此前根本不存在。 */}
        <div className={styles.buttonRow}>
          <input
            className={styles.codeInput}
            value={moveCode}
            onChange={(e) => setMoveCode(e.target.value)}
            placeholder={t('粘贴搬迁码', 'Paste a transfer code')}
            aria-label={t('搬迁码', 'Transfer code')}
          />
          <button
            className={styles.action}
            disabled={!moveCode.trim()}
            onClick={() => {
              playSfx('buttonTap')
              if (!importTransferCode(moveCode)) {
                setMoveMsg(t('这串码不对', 'That code is not valid'))
                return
              }
              setMoveMsg(t('已接手,正在拉取云端存档…', 'Adopted — pulling your save…'))
              void syncNow().then((st) => {
                setSync(st)
                setMoveMsg(
                  st === 'synced'
                    ? t('存档已接过来了', 'Save restored')
                    : t('接手了,但云端没连上 —— 稍后再同步', 'Adopted, but the cloud is unreachable — try syncing later'),
                )
              })
            }}
          >
            {t('接手存档', 'Adopt save')}
          </button>
        </div>
        {moveMsg && <p className={styles.hint}>{moveMsg}</p>}
      </section>

      {confirmReset && (
        <ConfirmDialog
          title={t('清空本地进度?', 'Reset local progress?')}
          body={t(
            '所有本机进度都会清空:收藏、卡包、功勋、战绩、自组卡组,以及冒险、登楼、远征、竞技场、成就与个人纪录。设备 ID 与搬迁码保留。无法撤销;若此前同步过云端,下次同步会以清空后的版本覆盖。',
            'Everything on this device is erased: collection, packs, merit, record, custom decks, plus campaign, tower, expedition, arena, achievements and personal bests. Your device ID and transfer code are kept. This cannot be undone, and the next cloud sync will overwrite the server copy.',
          )}
          confirmLabel={t('清空', 'Erase')}
          cancelLabel={t('取消', 'Cancel')}
          onConfirm={() => {
            // 删掉**所有** qiangu- 开头的键,只留搬迁凭据(设备 ID 与归属密钥)——
            // 从前只删三个,于是冒险/登楼/远征/竞技场/成就/纪录等 14 个 store
            // 原样留着,而按钮写的是「清空本地进度」。
            // 保留凭据是刻意的:清进度不该把云端那份变成孤儿。
            // 隐私模式下连**枚举** localStorage 都可能抛 —— 而这一句在
            // React 事件处理器里,抛出去错误边界看不见,表现是「点了确定没反应」。
            const keep = new Set(['qiangu-player-id', 'qiangu-profile-secret'])
            try {
              for (const k of Object.keys(localStorage)) {
                if (k.startsWith('qiangu-') && !keep.has(k)) localStorage.removeItem(k)
              }
            } catch {
              /* 存储不可用 = 本来也没有存档要清 */
            }
            location.reload()
          }}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  )
}
