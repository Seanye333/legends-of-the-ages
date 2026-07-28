// 音效名字的清单,单独一个文件。
//
// 【为什么不放在 sound.ts 里】
// `sound.ts` 里全是 Web Audio 的类型(AudioContext / GainNode / OscillatorType…),
// 而 `tsconfig.test.json` 的 lib 只有 ES2022、**故意不带 DOM** ——
// 那个项目是给引擎与内容层的纯逻辑测试用的。
// 静音优先那张表(soundParity.ts)需要 `SfxName` 来保证穷尽性,
// 它的测试一进 `src/**/*.test.ts` 就把整个 sound.ts 拖进了无 DOM 的项目里,
// 于是 30 多个 `Cannot find name 'AudioContext'`。
//
// 把**名字**和**合成实现**拆开,类型层就不再依赖 DOM 了。
// sound.ts 从这里 re-export,所有既有的 `import { SfxName } from './sound'` 照旧可用。
export type SfxName =
  | 'buttonTap' // UI 轻击
  | 'cardPlay' // 出牌落子:木质闷响
  | 'stratagemCast' // 锦囊施放:气声呼啸 + 铃音
  | 'attack' // 攻击:金铁交鸣
  | 'hit' // 受击:低沉闷响
  | 'duel' // 单挑:两音戏剧性重锤
  | 'death' // 阵亡:蒙皮闷鼓
  | 'heal' // 治疗:温润上行编钟
  | 'turnStart' // 回合开始:轻锣
  | 'lethal' // 主帅陨落:轰鸣 + 余晖
  | 'victory' // 胜利:宫商角徵羽短号
  | 'defeat' // 失败:低音渐弱长吟
  | 'draw' // 抽牌:纸帛抽出的摩擦
  | 'mana' // 法力水晶点亮:清脆玉磬
  | 'bond' // 羁绊/宿敌触发:双音共鸣
  | 'armorBreak' // 护甲破碎:甲片崩裂
  | 'discover' // 发现三选一:翻开的气声
