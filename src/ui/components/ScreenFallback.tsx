import styles from './ScreenFallback.module.css'

// 按需加载画面时的过场:与各画面同底色的鎏金印记,避免白闪。
export function ScreenFallback() {
  return (
    <div className={styles.screen}>
      <div className={styles.seal} aria-hidden="true">
        將
      </div>
    </div>
  )
}
