// 每日谜题池 —— 由 `npm run mine-puzzles` 从真实自对弈局面挖出的残局,**勿手改**。
// 每道题都经过「重建后再解一次」验证:一回合内存在非平凡 lethal。
// 结构与手搓题(lethalPuzzles.ts)同构,复用同一套残局构造器与 UI。
import type { PuzzleScenario } from '../engine/types'

export interface GeneratedPuzzle {
  id: string
  heroes: [string, string]
  difficulty: 1 | 2 | 3
  scenario: PuzzleScenario
}

export const DAILY_POOL: GeneratedPuzzle[] = [
  {
    id: 'dp-01',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":222554638,"players":[{"heroHp":25,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"liu-qi","damage":1,"enchants":[{"attack":0,"health":3,"keywords":["guard"],"equip":"eq-teng-jia"},{"attack":1,"health":2}]}],"hand":["wei-yan"],"deck":["wang-ping","fei-yi","deng-zhi","hist-xiao-he","chen-dao","liu-bei"]},{"heroHp":9,"heroMaxHp":30,"armor":0,"mana":4,"board":[{"defId":"mao-jie","exhausted":true}],"hand":[],"deck":["hist-fan-kuai","wang-lang","wang-ping","zhang-liao","eq-mingguang-kai","strat-shengdong-jixi","cao-ang"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-02',
    heroes: ["cao-cao","hist-confucius"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":846326175,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":9,"board":[{"defId":"cao-rui","damage":4},{"defId":"hist-fan-kuai","damage":2}],"hand":["wang-ping","li-dian","wang-lang","eq-mingguang-kai","eq-mingguang-kai"],"deck":["strat-huo-ji","wang-lang","hist-tian-dan","strat-shengdong-jixi","deng-ai","eq-teng-jia","hist-zhou-yafu","hist-zhou-yafu","hist-shang-yang","wang-ping","eq-teng-jia","li-dian","mao-jie","strat-shengdong-jixi","cao-rui","hist-fan-kuai","cao-ang"]},{"heroHp":12,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"hist-fan-zhongyan","exhausted":true}],"hand":["eq-mingguang-kai","cheng-pu","hist-wei-zheng","hist-lin-zexu","hist-confucius","hist-lin-zexu","cheng-yu"],"deck":["eq-mingguang-kai","cheng-pu","strat-huo-ji","strat-huo-ji","zhou-tai","chen-dao","eq-teng-jia","hist-hai-rui","hist-wang-shouren","eq-teng-jia","hist-wei-zheng","zhou-tai","strat-shengdong-jixi","liu-xie","hist-sima-guang"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-03',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":817316242,"players":[{"heroHp":12,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"jiang-wan","damage":6,"enchants":[{"attack":1,"health":2},{"attack":0,"health":3,"keywords":["guard"],"equip":"eq-teng-jia"},{"attack":1,"health":2}]},{"defId":"cui-yan","damage":1},{"defId":"cui-yan","damage":3,"enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}]}],"hand":["strat-huo-ji"],"deck":["wang-ping","liu-qi","zhang-fei","cheng-pu","strat-huo-ji","chen-dao","wang-ping","fei-yi","deng-zhi","ma-liang","strat-shengdong-jixi"]},{"heroHp":4,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"xu-chu","exhausted":true}],"hand":[],"deck":["eq-teng-jia","zhang-liao","cao-rui","cao-ang","hist-zhou-yafu","li-dian","deng-ai","strat-huo-ji","li-dian","hist-fan-kuai","xu-chu","hist-zhou-yafu"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-04',
    heroes: ["cao-cao","liu-bei"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1578220849,"players":[{"heroHp":23,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"cao-ang"},{"defId":"xu-chu"}],"hand":["hist-tian-dan"],"deck":["hist-zhou-yafu","deng-ai","xu-chu","hist-shang-yang","eq-teng-jia","cao-rui","zhang-liao","eq-teng-jia","cao-ang","hist-fan-kuai"]},{"heroHp":3,"heroMaxHp":30,"armor":0,"mana":3,"board":[{"defId":"liu-qi","enchants":[{"attack":1,"health":2}]},{"defId":"wang-ping","enchants":[{"attack":1,"health":2}],"exhausted":true}],"hand":[],"deck":["cheng-pu","zhang-fei","eq-teng-jia","eq-mingguang-kai","zhang-fei","hist-xiao-he","fei-yi","hist-xie-xuan","fei-yi","liu-bei"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-05',
    heroes: ["cao-cao","hist-confucius"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-311931284,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":9,"board":[{"defId":"hist-fan-kuai","damage":4},{"defId":"wang-ping"},{"defId":"cao-ang"}],"hand":["wang-lang","eq-teng-jia","cao-rui","strat-huo-ji","strat-shengdong-jixi"],"deck":["xu-chu","eq-mingguang-kai","hist-tian-dan","xu-chu","hist-fan-kuai","cao-ang","li-dian","hist-zhou-yafu","eq-teng-jia","cao-rui","strat-huo-ji","wang-ping","strat-shengdong-jixi","hist-shang-yang","eq-mingguang-kai","deng-ai","mao-jie"]},{"heroHp":4,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"hist-confucius","enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}],"exhausted":true}],"hand":["cheng-pu","hist-lin-zexu","zhou-tai","zhou-tai","eq-teng-jia","hist-yan-zhenqing"],"deck":["hist-hai-rui","hist-sima-guang","eq-mingguang-kai","strat-shengdong-jixi","cheng-pu","eq-teng-jia","hist-wei-zheng","hist-hai-rui","wen-chou","hist-wei-zheng","hist-yan-zhenqing","liu-xie","strat-huo-ji","hist-wang-shouren","hist-lin-zexu"]}]},
  },
  {
    id: 'dp-06',
    heroes: ["cao-cao","liu-bei"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1651112233,"players":[{"heroHp":30,"heroMaxHp":30,"armor":2,"mana":10,"board":[{"defId":"hist-shang-yang","damage":11,"enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"},{"attack":0,"health":3,"keywords":["guard"],"equip":"eq-teng-jia"}]},{"defId":"hist-tian-dan","damage":3},{"defId":"zhang-liao","damage":3}],"hand":["cao-rui"],"deck":["xu-chu","mao-jie","xu-chu","hist-zhou-yafu","wang-lang","hist-fan-kuai","strat-huo-ji","li-dian","cao-ang","li-dian","deng-ai","cao-lin"]},{"heroHp":8,"heroMaxHp":30,"armor":0,"mana":4,"board":[{"defId":"hist-xie-xuan","damage":8,"enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"},{"attack":1,"health":2}],"attacksUsed":1},{"defId":"fei-yi","enchants":[{"attack":1,"health":2}],"exhausted":true}],"hand":[],"deck":["eq-teng-jia","wei-yan","deng-zhi","liu-qi","zhang-fei","liu-bei","fei-yi","zhang-fei","ma-liang","cui-yan","deng-zhi","jiang-wan"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-07',
    heroes: ["sima-yi","hist-confucius"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":2012228851,"players":[{"heroHp":30,"heroMaxHp":30,"armor":3,"mana":10,"board":[{"defId":"token-si-shi"},{"defId":"wang-ping"},{"defId":"hist-yang-su"}],"hand":["sima-shi","eq-mingguang-kai","eq-teng-jia"],"deck":["cheng-pu","zhou-tai","zhuge-ke","hist-you-yu","sima-yi","sima-shi","fa-zheng","hist-gao-jianli","wang-ping","hist-gao-jianli","cheng-pu","eq-teng-jia","chen-dao","zhuge-ke","zhou-yu","chen-dao"]},{"heroHp":9,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"cheng-pu","exhausted":true},{"defId":"hist-wei-zheng","exhausted":true}],"hand":["eq-teng-jia","eq-teng-jia","cheng-yu","hist-sima-guang"],"deck":["hist-lin-zexu","liu-xie","strat-huo-ji","hist-wang-shouren","eq-mingguang-kai","hist-fan-zhongyan","chen-dao","zhou-tai","chen-dao","hist-lin-zexu","hist-wei-zheng","eq-mingguang-kai","hist-hai-rui","strat-huo-ji","hist-yan-zhenqing"]}]},
  },
  {
    id: 'dp-08',
    heroes: ["hist-confucius","sima-yi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":835120172,"players":[{"heroHp":20,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-wang-shouren"},{"defId":"hist-sima-guang","damage":2},{"defId":"hist-yan-zhenqing"},{"defId":"token-tie-qi","enchants":[{"attack":0,"health":3,"keywords":["guard"],"equip":"eq-teng-jia"}]}],"hand":["hist-lin-zexu","wen-chou","eq-teng-jia"],"deck":["cheng-yu","strat-shengdong-jixi","hist-fan-zhongyan","liu-xie","hist-wei-zheng","hist-wei-zheng","zhou-tai","hist-confucius","cheng-pu","chen-dao"]},{"heroHp":7,"heroMaxHp":30,"armor":0,"mana":7,"board":[{"defId":"token-si-shi","enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}]}],"hand":[],"deck":["sima-shi","eq-mingguang-kai","cheng-pu","strat-shengdong-jixi","zhuge-ke","cheng-pu","chen-dao","cao-pi","eq-teng-jia","fa-zheng","strat-huo-ji","zhuge-ke","sima-shi","zhou-yu"]}]},
  },
  {
    id: 'dp-09',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-414203295,"players":[{"heroHp":29,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"chen-dao"},{"defId":"token-baimao-bing"},{"defId":"hist-sima-guang","damage":1}],"hand":["hist-lin-zexu","hist-hai-rui","cheng-yu","eq-teng-jia"],"deck":["hist-hai-rui","zhou-tai","eq-teng-jia","hist-lin-zexu","eq-mingguang-kai","hist-wang-shouren","strat-huo-ji","hist-yan-zhenqing","hist-wei-zheng"]},{"heroHp":7,"heroMaxHp":30,"armor":0,"mana":4,"board":[{"defId":"mao-jie","damage":6,"enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}]},{"defId":"cao-ang","exhausted":true}],"hand":[],"deck":["hist-fan-kuai","cao-ang","eq-teng-jia","eq-mingguang-kai","cao-rui","hist-tian-dan","li-dian","wang-ping","hist-fan-kuai","hist-zhou-yafu","wang-ping","cao-lin","xu-chu"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-10',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":2051083310,"players":[{"heroHp":27,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-yan-zhenqing","damage":4},{"defId":"cheng-yu","damage":2,"enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}]},{"defId":"cheng-pu","damage":4},{"defId":"wen-chou"}],"hand":["hist-hai-rui"],"deck":["strat-shengdong-jixi","strat-huo-ji","chen-dao","chen-dao","eq-teng-jia","hist-confucius","hist-fan-zhongyan"]},{"heroHp":6,"heroMaxHp":30,"armor":0,"mana":3,"board":[{"defId":"wang-ping","exhausted":true}],"hand":[],"deck":["mao-jie","strat-huo-ji","li-dian","cao-ang","cao-ang","cao-rui","hist-fan-kuai","eq-mingguang-kai","zhang-liao","strat-huo-ji","eq-mingguang-kai"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-11',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":221297890,"players":[{"heroHp":20,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"fei-yi","damage":8,"enchants":[{"attack":1,"health":2},{"attack":1,"health":2},{"attack":1,"health":2}]},{"defId":"hist-xiao-he","damage":1},{"defId":"zhang-fei"}],"hand":["liu-qi"],"deck":["deng-zhi","zhang-fei","liu-bei","strat-shengdong-jixi","deng-zhi","eq-teng-jia","eq-teng-jia","cui-yan","jiang-wan","wang-ping"]},{"heroHp":7,"heroMaxHp":30,"armor":0,"mana":7,"board":[{"defId":"xu-chu"},{"defId":"wang-lang","exhausted":true}],"hand":[],"deck":["strat-huo-ji","wang-ping","hist-fan-kuai","cao-lin","li-dian","mao-jie","hist-zhou-yafu","cao-rui","wang-ping","hist-fan-kuai","hist-tian-dan"]}]},
  },
  {
    id: 'dp-12',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":890207626,"players":[{"heroHp":27,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"chen-dao"},{"defId":"ma-liang"},{"defId":"fei-yi"}],"hand":["strat-shengdong-jixi","fei-yi","eq-mingguang-kai","liu-qi"],"deck":["wang-ping","strat-huo-ji","strat-huo-ji","hist-xie-xuan","cui-yan","wang-ping","zhang-fei","deng-zhi","eq-mingguang-kai","zhang-fei","eq-teng-jia","cheng-pu","chen-dao","wei-yan","eq-teng-jia"]},{"heroHp":2,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"mao-jie","enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}],"exhausted":true},{"defId":"wang-lang","exhausted":true}],"hand":["eq-mingguang-kai","cao-lin"],"deck":["cao-rui","cao-rui","hist-zhou-yafu","deng-ai","wang-ping","wang-lang","strat-huo-ji","wang-ping","zhang-liao","eq-teng-jia","hist-shang-yang","eq-teng-jia","hist-tian-dan","xu-chu","li-dian","li-dian"]}]},
  },
  {
    id: 'dp-13',
    heroes: ["hist-laozi","sun-quan"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":2009296439,"players":[{"heroHp":30,"heroMaxHp":30,"armor":1,"mana":10,"board":[{"defId":"wang-ping","damage":3},{"defId":"shi-tao"},{"defId":"wen-chou","damage":3},{"defId":"cheng-pu"}],"hand":["chen-dao"],"deck":[]},{"heroHp":8,"heroMaxHp":30,"armor":0,"mana":4,"board":[{"defId":"lu-fan","exhausted":true},{"defId":"token-shui-zhai","exhausted":true}],"hand":[],"deck":["wang-ping"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-14',
    heroes: ["sima-yi","sun-quan"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1018962376,"players":[{"heroHp":21,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"zhou-tai","damage":4},{"defId":"sima-shi"},{"defId":"wang-ping"}],"hand":["zhuge-ke","strat-huo-ji"],"deck":["zhuge-ke","eq-teng-jia","sima-yi","strat-shengdong-jixi","hist-you-yu","fa-zheng","strat-huo-ji","fa-zheng","hist-yang-su","wang-ping","chen-dao","cheng-pu","hist-gao-jianli","cao-pi"]},{"heroHp":8,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"zhu-ran","damage":5,"attacksUsed":1},{"defId":"zhou-tai","exhausted":true},{"defId":"lu-fan","exhausted":true}],"hand":["wang-ping","zhou-tai"],"deck":["man-chong","lu-kang","strat-shengdong-jixi","shi-xie","strat-shengdong-jixi","eq-teng-jia","wang-ping","man-chong","shi-xie","hist-li-yu","hist-wang-shichong","eq-mingguang-kai","hu-zong"]}]},
  },
  {
    id: 'dp-15',
    heroes: ["hist-confucius","sima-yi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-448030762,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"wen-chou","damage":1,"enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}]},{"defId":"hist-wei-zheng"},{"defId":"chen-dao"},{"defId":"hist-confucius","enchants":[{"attack":0,"health":3,"keywords":["guard"],"equip":"eq-teng-jia"}]}],"hand":["zhou-tai"],"deck":["hist-wei-zheng","cheng-pu","hist-fan-zhongyan","strat-huo-ji","hist-wang-shouren","hist-sima-guang"]},{"heroHp":8,"heroMaxHp":30,"armor":0,"mana":5,"board":[{"defId":"token-si-shi","enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}]},{"defId":"token-si-shi","exhausted":true}],"hand":[],"deck":["strat-huo-ji","zhou-tai","zhuge-ke","sima-shi","hist-yang-su","chen-dao","zhou-tai","zhou-yu","hist-gao-jianli","zhuge-ke","fa-zheng"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-16',
    heroes: ["sima-yi","hist-confucius"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":2022911209,"players":[{"heroHp":12,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"sima-shi","damage":2},{"defId":"zhuge-ke"},{"defId":"token-xiangyong"}],"hand":["strat-huo-ji","eq-teng-jia","zhou-tai"],"deck":["strat-huo-ji","hist-gao-jianli","zhuge-ke","hist-gao-jianli","eq-mingguang-kai","cheng-pu","hist-yang-su","han-fu","eq-teng-jia","cao-pi","eq-mingguang-kai","sima-shi","fa-zheng","hist-you-yu"]},{"heroHp":1,"heroMaxHp":30,"armor":0,"mana":3,"board":[{"defId":"hist-sima-guang","damage":4,"attacksUsed":1},{"defId":"hist-lin-zexu","damage":4,"enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}],"attacksUsed":1},{"defId":"cheng-yu","damage":3,"attacksUsed":1}],"hand":["zhou-tai"],"deck":["hist-sima-guang","hist-lin-zexu","cheng-pu","strat-huo-ji","hist-confucius","strat-huo-ji","hist-wang-shouren","liu-xie","hist-yan-zhenqing","chen-dao","eq-teng-jia","hist-wei-zheng","strat-shengdong-jixi"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-17',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":206321643,"players":[{"heroHp":20,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-lin-zexu","damage":4},{"defId":"cheng-yu","damage":4,"enchants":[{"attack":0,"health":3,"keywords":["guard"],"equip":"eq-teng-jia"}]},{"defId":"chen-dao"},{"defId":"token-baimao-bing"},{"defId":"hist-hai-rui"}],"hand":["eq-teng-jia"],"deck":["hist-confucius","hist-sima-guang","hist-hai-rui","hist-lin-zexu","hist-yan-zhenqing","hist-wang-shouren","strat-huo-ji","strat-shengdong-jixi"]},{"heroHp":7,"heroMaxHp":30,"armor":0,"mana":6,"board":[{"defId":"cao-ang","damage":4,"enchants":[{"attack":0,"health":3,"keywords":["guard"],"equip":"eq-teng-jia"}],"attacksUsed":1}],"hand":[],"deck":["strat-shengdong-jixi","eq-mingguang-kai","wang-lang","wang-ping","hist-fan-kuai","xu-chu","wang-ping","cao-rui","cao-lin","zhang-liao","cao-rui"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-18',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":1417362518,"players":[{"heroHp":29,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"token-baimao-bing","damage":1},{"defId":"hist-sima-guang","damage":1},{"defId":"hist-lin-zexu"},{"defId":"cheng-yu","damage":3}],"hand":["hist-hai-rui","eq-teng-jia","hist-wei-zheng"],"deck":["hist-hai-rui","zhou-tai","eq-teng-jia","hist-lin-zexu","eq-mingguang-kai","hist-wang-shouren","strat-huo-ji","hist-yan-zhenqing"]},{"heroHp":2,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"cao-ang","damage":4,"attacksUsed":1},{"defId":"xu-chu","exhausted":true}],"hand":[],"deck":["hist-fan-kuai","cao-ang","eq-teng-jia","eq-mingguang-kai","cao-rui","hist-tian-dan","li-dian","wang-ping","hist-fan-kuai","hist-zhou-yafu","wang-ping","cao-lin"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-19',
    heroes: ["hist-laozi","liu-bei"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":849886961,"players":[{"heroHp":29,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"guan-xing","damage":4},{"defId":"hist-zhang-heng","damage":3},{"defId":"hist-tang-yin","damage":1},{"defId":"guan-xing"},{"defId":"ji-kang"}],"hand":["eq-teng-jia","strat-huo-ji"],"deck":["shi-tao","eq-mingguang-kai","hist-laozi","yu-jin","hist-zhang-heng","wang-ping","wang-ping","wen-chou","cheng-pu","ji-kang","chen-dao","strat-shengdong-jixi"]},{"heroHp":9,"heroMaxHp":30,"armor":0,"mana":4,"board":[{"defId":"cheng-pu","exhausted":true}],"hand":[],"deck":["jiang-wan","hist-xiao-he","liu-bei","eq-mingguang-kai","strat-huo-ji","chen-dao","wei-yan","deng-zhi","cui-yan","zhang-fei","eq-teng-jia","hist-xie-xuan","deng-zhi"]}]},
  },
  {
    id: 'dp-20',
    heroes: ["cao-cao","hist-confucius"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1608906446,"players":[{"heroHp":30,"heroMaxHp":30,"armor":3,"mana":10,"board":[{"defId":"wang-ping","damage":4},{"defId":"deng-ai","damage":4,"enchants":[{"attack":1,"health":0}]},{"defId":"wang-lang","damage":2},{"defId":"hist-fan-kuai"}],"hand":["strat-huo-ji","hist-shang-yang","wang-lang"],"deck":["hist-zhou-yafu","eq-mingguang-kai","cao-ang","strat-huo-ji","hist-zhou-yafu","hist-tian-dan","eq-mingguang-kai","eq-teng-jia","li-dian","xu-chu","wang-ping","cao-ang","mao-jie","strat-shengdong-jixi"]},{"heroHp":7,"heroMaxHp":30,"armor":0,"mana":4,"board":[{"defId":"hist-sima-guang"},{"defId":"cheng-pu","exhausted":true}],"hand":["hist-wang-shouren","zhou-tai","hist-lin-zexu"],"deck":["hist-hai-rui","hist-fan-zhongyan","hist-lin-zexu","hist-sima-guang","strat-shengdong-jixi","liu-xie","eq-mingguang-kai","zhou-tai","hist-hai-rui","hist-confucius","hist-wei-zheng","cheng-yu"]}]},
  },
  {
    id: 'dp-21',
    heroes: ["hist-laozi","sun-quan"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":226115424,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"token-xiangyong"},{"defId":"hist-xu-xiake","enchants":[{"attack":0,"health":0,"keywords":["divineShield"]},{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}]},{"defId":"hist-kou-qianzhi"}],"hand":["ruan-xian","eq-teng-jia","wang-ping"],"deck":["guan-xing","guan-xing","eq-teng-jia","eq-mingguang-kai","hist-laozi","cheng-pu","chen-dao","hist-kou-qianzhi","hist-zhang-heng","ji-kang","chen-dao","ji-kang"]},{"heroHp":1,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"shi-xie","enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}]},{"defId":"zhu-ran","exhausted":true},{"defId":"man-chong","exhausted":true}],"hand":["eq-teng-jia"],"deck":["eq-mingguang-kai","shi-xie","eq-teng-jia","zhou-tai","lu-kang","man-chong","strat-huo-ji","sun-quan","hu-zong","zhang-bu","cheng-pu","zhou-tai","ma-teng"]}]},
  },
  {
    id: 'dp-22',
    heroes: ["sima-yi","hist-confucius"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-961256697,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":9,"board":[{"defId":"hist-gao-jianli","damage":2},{"defId":"chen-dao","damage":4},{"defId":"hist-yang-su","damage":7,"enchants":[{"attack":0,"health":3,"keywords":["guard"],"equip":"eq-teng-jia"}]},{"defId":"zhou-tai","damage":2}],"hand":["cao-pi","eq-teng-jia","strat-shengdong-jixi","hist-you-yu","chen-dao"],"deck":["cheng-pu","zhou-yu","sima-shi","hist-gao-jianli","zhou-tai","sima-yi","eq-mingguang-kai","sima-shi","strat-huo-ji","fa-zheng","strat-huo-ji","wang-ping","cheng-pu","zhuge-ke","eq-mingguang-kai","zhuge-ke","han-fu"]},{"heroHp":9,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"zhou-tai","exhausted":true},{"defId":"hist-hai-rui","exhausted":true}],"hand":["eq-mingguang-kai","hist-wei-zheng","eq-teng-jia","hist-lin-zexu","liu-xie"],"deck":["strat-shengdong-jixi","hist-yan-zhenqing","cheng-yu","hist-wei-zheng","eq-mingguang-kai","strat-huo-ji","hist-lin-zexu","wen-chou","hist-wang-shouren","eq-teng-jia","hist-yan-zhenqing","zhou-tai","hist-fan-zhongyan","cheng-pu","strat-huo-ji","hist-confucius","hist-hai-rui"]}]},
  },
  {
    id: 'dp-23',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":882143493,"players":[{"heroHp":23,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-wei-zheng","damage":2},{"defId":"cheng-yu","damage":7,"enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}]},{"defId":"hist-hai-rui"},{"defId":"zhou-tai"}],"hand":["strat-huo-ji","eq-teng-jia"],"deck":["cheng-pu","hist-fan-zhongyan","hist-yan-zhenqing","hist-sima-guang","wen-chou","eq-mingguang-kai","chen-dao","hist-wang-shouren","zhou-tai"]},{"heroHp":7,"heroMaxHp":30,"armor":0,"mana":4,"board":[{"defId":"cao-rui","damage":8,"enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"},{"attack":0,"health":3,"keywords":["guard"],"equip":"eq-teng-jia"}],"attacksUsed":1},{"defId":"cao-rui","exhausted":true}],"hand":[],"deck":["hist-zhou-yafu","cao-ang","wang-lang","hist-shang-yang","cao-ang","strat-shengdong-jixi","zhang-liao","hist-tian-dan","wang-lang","hist-zhou-yafu","deng-ai","strat-shengdong-jixi","xu-chu"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-24',
    heroes: ["hist-confucius","sima-yi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":2081978365,"players":[{"heroHp":24,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"chen-dao","damage":4,"enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}],"silenced":true},{"defId":"cheng-pu","damage":4},{"defId":"cheng-pu","damage":4},{"defId":"hist-lin-zexu","enchants":[{"attack":0,"health":3,"keywords":["guard"],"equip":"eq-teng-jia"}]}],"hand":["strat-huo-ji","cheng-yu"],"deck":["zhou-tai","strat-shengdong-jixi","eq-mingguang-kai","hist-wei-zheng","hist-confucius","hist-sima-guang"]},{"heroHp":8,"heroMaxHp":30,"armor":0,"mana":7,"board":[{"defId":"token-si-shi","enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}]},{"defId":"token-xiangyong"}],"hand":[],"deck":["strat-shengdong-jixi","wang-ping","eq-teng-jia","sima-yi","zhou-tai","zhuge-ke","chen-dao","chen-dao","strat-huo-ji","hist-gao-jianli","cao-pi"]}]},
  },
  {
    id: 'dp-25',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-373987359,"players":[{"heroHp":27,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-sima-guang","damage":5,"enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}]},{"defId":"cheng-yu","enchants":[{"attack":0,"health":3,"keywords":["guard"],"equip":"eq-teng-jia"}]},{"defId":"hist-wei-zheng"}],"hand":["cheng-pu"],"deck":[]},{"heroHp":2,"heroMaxHp":30,"armor":0,"mana":3,"board":[{"defId":"li-dian","damage":3},{"defId":"wang-lang"},{"defId":"wang-ping","exhausted":true}],"hand":[],"deck":["hist-tian-dan","cao-rui","cao-lin","eq-teng-jia","eq-teng-jia","strat-huo-ji","strat-huo-ji"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-26',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":-1648598737,"players":[{"heroHp":17,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"deng-zhi","damage":15,"enchants":[{"attack":1,"health":2},{"attack":1,"health":1},{"attack":1,"health":2},{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"},{"attack":1,"health":2}]},{"defId":"liu-bei","enchants":[{"attack":1,"health":1},{"attack":0,"health":3,"keywords":["guard"],"equip":"eq-teng-jia"},{"attack":1,"health":2}]}],"hand":["hist-wen-tianxiang"],"deck":["wei-yan","wang-ping","cheng-pu","cui-yan","ma-liang"]},{"heroHp":2,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"hist-fan-kuai","damage":1,"exhausted":true}],"hand":[],"deck":["strat-shengdong-jixi","hist-tian-dan","li-dian","wang-ping","eq-mingguang-kai"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-27',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":-1634774509,"players":[{"heroHp":13,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"fei-yi","damage":8,"enchants":[{"attack":1,"health":2},{"attack":1,"health":2},{"attack":1,"health":2}]},{"defId":"hist-xie-xuan"}],"hand":["eq-mingguang-kai"],"deck":["strat-huo-ji","deng-zhi","wang-ping","cheng-pu","cui-yan","chen-dao","zhang-fei","eq-mingguang-kai","strat-huo-ji","liu-bei","chen-dao"]},{"heroHp":3,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"hist-fan-kuai","damage":1,"exhausted":true}],"hand":[],"deck":["eq-teng-jia","mao-jie","eq-mingguang-kai","cao-ang","hist-zhou-yafu","strat-huo-ji","hist-fan-kuai","hist-tian-dan","cao-rui","cao-ang","hist-shang-yang","cao-lin"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-28',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":-1621473926,"players":[{"heroHp":29,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-lin-zexu","damage":3},{"defId":"cheng-yu"}],"hand":["eq-mingguang-kai","eq-mingguang-kai","chen-dao"],"deck":["hist-sima-guang","hist-hai-rui","hist-sima-guang","eq-teng-jia","hist-yan-zhenqing","hist-lin-zexu","hist-fan-zhongyan","strat-shengdong-jixi","strat-huo-ji"]},{"heroHp":2,"heroMaxHp":30,"armor":0,"mana":6,"board":[{"defId":"wang-lang","damage":6,"enchants":[{"attack":0,"health":3,"keywords":["guard"],"equip":"eq-teng-jia"}],"attacksUsed":1}],"hand":[],"deck":["hist-shang-yang","eq-mingguang-kai","li-dian","cao-rui","strat-shengdong-jixi","xu-chu","wang-ping","mao-jie","cao-rui","deng-ai","xu-chu","eq-mingguang-kai","hist-zhou-yafu"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-29',
    heroes: ["sima-yi","hist-confucius"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":259838162,"players":[{"heroHp":26,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"zhou-tai"}],"hand":["strat-shengdong-jixi","strat-huo-ji","hist-you-yu","fa-zheng"],"deck":["fa-zheng","cheng-pu","zhuge-ke","chen-dao","sima-yi","eq-mingguang-kai","sima-shi","han-fu","chen-dao","sima-shi","hist-gao-jianli","wang-ping","hist-gao-jianli","zhou-yu","cao-pi","eq-teng-jia"]},{"heroHp":9,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"hist-lin-zexu","damage":5,"enchants":[{"attack":0,"health":3,"keywords":["guard"],"equip":"eq-teng-jia"}],"attacksUsed":1},{"defId":"cheng-pu","exhausted":true}],"hand":["strat-huo-ji"],"deck":["hist-yan-zhenqing","eq-mingguang-kai","hist-lin-zexu","hist-confucius","zhou-tai","hist-yan-zhenqing","hist-hai-rui","wen-chou","hist-hai-rui","chen-dao","hist-sima-guang","hist-fan-zhongyan","hist-sima-guang","hist-wang-shouren","hist-wei-zheng","eq-mingguang-kai"]}]},
  },
  {
    id: 'dp-30',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":178568458,"players":[{"heroHp":5,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"liu-qi","damage":5,"enchants":[{"attack":0,"health":3,"keywords":["guard"],"equip":"eq-teng-jia"},{"attack":1,"health":2}]},{"defId":"fei-yi","enchants":[{"attack":1,"health":2}]}],"hand":["hist-wen-tianxiang"],"deck":["hist-xie-xuan","chen-dao","jiang-wan","cui-yan","eq-teng-jia","chen-dao","ma-liang","strat-shengdong-jixi","eq-mingguang-kai"]},{"heroHp":3,"heroMaxHp":30,"armor":0,"mana":3,"board":[{"defId":"hist-fan-kuai","damage":3,"attacksUsed":1},{"defId":"li-dian","exhausted":true}],"hand":[],"deck":["wang-lang","cao-rui","hist-tian-dan","mao-jie","li-dian","eq-teng-jia","strat-huo-ji","strat-huo-ji","hist-shang-yang"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-31',
    heroes: ["cao-cao","liu-bei"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1016134693,"players":[{"heroHp":23,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-tian-dan","enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}]},{"defId":"hist-shang-yang","damage":7,"enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}]},{"defId":"wang-lang"}],"hand":["xu-chu"],"deck":["strat-huo-ji","li-dian","strat-shengdong-jixi","wang-lang","hist-zhou-yafu","eq-teng-jia","wang-ping","wang-ping","xu-chu","cao-rui","hist-fan-kuai","cao-ang"]},{"heroHp":13,"heroMaxHp":30,"armor":0,"mana":6,"board":[{"defId":"liu-qi","enchants":[{"attack":1,"health":2}],"exhausted":true}],"hand":[],"deck":["cui-yan","deng-zhi","hist-xie-xuan","chen-dao","cui-yan","fei-yi","jiang-wan","cheng-pu","deng-zhi","hist-wen-tianxiang","strat-huo-ji","eq-teng-jia","zhang-fei"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-32',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":-1009222579,"players":[{"heroHp":21,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"token-baimao-bing"},{"defId":"deng-zhi"},{"defId":"hist-wen-tianxiang"}],"hand":["wang-ping","wang-ping","eq-mingguang-kai","hist-xiao-he"],"deck":["chen-dao","eq-mingguang-kai","hist-xie-xuan","cui-yan","strat-huo-ji","fei-yi","strat-huo-ji","fei-yi","eq-teng-jia","jiang-wan","cui-yan","strat-shengdong-jixi","wei-yan","ma-liang","liu-qi"]},{"heroHp":2,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"hist-fan-kuai","damage":2,"exhausted":true}],"hand":["wang-ping","cao-rui","mao-jie","li-dian"],"deck":["wang-ping","hist-tian-dan","eq-mingguang-kai","wang-lang","eq-teng-jia","cao-ang","cao-lin","eq-mingguang-kai","wang-lang","xu-chu","hist-fan-kuai","deng-ai","strat-shengdong-jixi","cao-ang","hist-shang-yang"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-33',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":191764312,"players":[{"heroHp":11,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"token-xiangyong"},{"defId":"ma-liang","enchants":[{"attack":1,"health":2}]},{"defId":"token-xiangyong"}],"hand":["strat-huo-ji"],"deck":["zhang-fei","fei-yi","eq-mingguang-kai","liu-bei","jiang-wan","deng-zhi","strat-shengdong-jixi"]},{"heroHp":1,"heroMaxHp":30,"armor":0,"mana":3,"board":[{"defId":"wang-ping","exhausted":true}],"hand":[],"deck":["hist-tian-dan","hist-fan-kuai","strat-huo-ji","cao-lin","wang-lang","zhang-liao","hist-zhou-yafu","wang-ping"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-34',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":835539088,"players":[{"heroHp":9,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"liu-bei","damage":5,"enchants":[{"attack":1,"health":1},{"attack":1,"health":2}]},{"defId":"deng-zhi","enchants":[{"attack":1,"health":2}]}],"hand":["wang-ping"],"deck":["deng-zhi","chen-dao","strat-huo-ji","ma-liang","fei-yi","fei-yi","jiang-wan","chen-dao","hist-wen-tianxiang","strat-huo-ji","strat-shengdong-jixi"]},{"heroHp":8,"heroMaxHp":30,"armor":0,"mana":3,"board":[{"defId":"zhang-liao","damage":3,"attacksUsed":1},{"defId":"wang-ping","exhausted":true}],"hand":[],"deck":["hist-zhou-yafu","cao-rui","strat-huo-ji","mao-jie","strat-shengdong-jixi","hist-zhou-yafu","eq-mingguang-kai","xu-chu","wang-ping","hist-fan-kuai","li-dian"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-35',
    heroes: ["cao-cao","liu-bei"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":848106568,"players":[{"heroHp":25,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"li-dian","damage":4},{"defId":"cao-ang","damage":6,"enchants":[{"attack":0,"health":3,"keywords":["guard"],"equip":"eq-teng-jia"}]},{"defId":"mao-jie"}],"hand":["hist-tian-dan"],"deck":["wang-ping","cao-rui","wang-ping","strat-huo-ji","strat-shengdong-jixi","cao-rui","li-dian","xu-chu","eq-mingguang-kai","hist-shang-yang","hist-zhou-yafu","eq-mingguang-kai"]},{"heroHp":7,"heroMaxHp":30,"armor":0,"mana":5,"board":[{"defId":"hist-wen-tianxiang","damage":7,"enchants":[{"attack":1,"health":2},{"attack":1,"health":2},{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}],"attacksUsed":1}],"hand":[],"deck":["eq-teng-jia","wei-yan","wang-ping","cui-yan","zhang-fei","ma-liang","ma-liang","liu-bei","strat-shengdong-jixi","deng-zhi","hist-xie-xuan","jiang-wan","strat-huo-ji"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-36',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":-1595710592,"players":[{"heroHp":16,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-wei-zheng","damage":5,"enchants":[{"attack":0,"health":3,"keywords":["guard"],"equip":"eq-teng-jia"}]},{"defId":"cheng-pu"}],"hand":["hist-yan-zhenqing","liu-xie"],"deck":["hist-fan-zhongyan","hist-yan-zhenqing","hist-hai-rui","eq-teng-jia","wen-chou","hist-lin-zexu","chen-dao"]},{"heroHp":3,"heroMaxHp":30,"armor":0,"mana":4,"board":[{"defId":"token-xiangyong"},{"defId":"wang-ping","exhausted":true}],"hand":[],"deck":["eq-teng-jia","eq-mingguang-kai","xu-chu","eq-mingguang-kai","cao-ang","mao-jie","eq-teng-jia","zhang-liao","hist-zhou-yafu","wang-lang","deng-ai","strat-shengdong-jixi"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-37',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":-955182415,"players":[{"heroHp":22,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"jiang-wan","damage":6,"enchants":[{"attack":1,"health":2},{"attack":1,"health":1}]},{"defId":"liu-bei","damage":1,"enchants":[{"attack":1,"health":1},{"attack":1,"health":2}]}],"hand":["fei-yi"],"deck":["cheng-pu","ma-liang","eq-teng-jia","eq-mingguang-kai","strat-huo-ji","eq-mingguang-kai","hist-xie-xuan","zhang-fei","strat-huo-ji"]},{"heroHp":4,"heroMaxHp":30,"armor":0,"mana":3,"board":[{"defId":"cao-ang","attacksUsed":1},{"defId":"wang-ping","exhausted":true}],"hand":[],"deck":["strat-shengdong-jixi","cao-rui","eq-teng-jia","xu-chu","xu-chu","strat-huo-ji","cao-rui","zhang-liao","eq-mingguang-kai","deng-ai"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-38',
    heroes: ["sun-quan","hist-laozi"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":-1020114395,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"shi-xie"},{"defId":"token-xiangyong"},{"defId":"ma-teng"}],"hand":["eq-teng-jia","eq-teng-jia","cheng-pu"],"deck":["man-chong","sun-ce","hist-li-yu","eq-mingguang-kai","shi-xie","lu-kang","lu-fan","hist-wang-shichong","strat-shengdong-jixi","zhou-tai","strat-huo-ji","zhou-tai","man-chong","hu-zong","sun-quan"]},{"heroHp":3,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"chen-dao","damage":4,"attacksUsed":1},{"defId":"yu-jin","exhausted":true}],"hand":["hist-kou-qianzhi","hist-xu-xiake","shi-tao","wang-ping","eq-teng-jia"],"deck":["eq-mingguang-kai","eq-mingguang-kai","wen-chou","hist-kou-qianzhi","wang-ping","guan-xing","ji-kang","guan-xing","ruan-xian","strat-shengdong-jixi","shi-tao","eq-teng-jia","cheng-pu","chen-dao"]}]},
  },
  {
    id: 'dp-39',
    heroes: ["cao-cao","hist-confucius"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":1463080869,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":9,"board":[{"defId":"wang-ping"},{"defId":"hist-shang-yang"},{"defId":"li-dian"}],"hand":["eq-teng-jia","eq-teng-jia","cao-lin","hist-tian-dan","cao-rui"],"deck":["hist-zhou-yafu","hist-zhou-yafu","deng-ai","eq-mingguang-kai","hist-fan-kuai","strat-huo-ji","wang-ping","mao-jie","cao-ang","li-dian","wang-lang","xu-chu","strat-shengdong-jixi","hist-fan-kuai","eq-mingguang-kai","strat-shengdong-jixi","zhang-liao"]},{"heroHp":6,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"token-baimao-bing"},{"defId":"cheng-pu","exhausted":true}],"hand":["hist-sima-guang","eq-mingguang-kai","zhou-tai","cheng-yu","hist-lin-zexu","eq-mingguang-kai","hist-wang-shouren","zhou-tai"],"deck":["hist-confucius","chen-dao","eq-teng-jia","liu-xie","hist-fan-zhongyan","hist-lin-zexu","strat-shengdong-jixi","eq-teng-jia","hist-wei-zheng","cheng-pu","hist-sima-guang","strat-shengdong-jixi","strat-huo-ji","hist-hai-rui","hist-hai-rui"]}]},
  },
  {
    id: 'dp-40',
    heroes: ["cao-cao","hist-confucius"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1000320614,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-shang-yang"},{"defId":"hist-tian-dan"},{"defId":"cao-rui"}],"hand":["eq-teng-jia","eq-teng-jia","cao-lin","zhang-liao"],"deck":["hist-zhou-yafu","hist-zhou-yafu","deng-ai","eq-mingguang-kai","hist-fan-kuai","strat-huo-ji","wang-ping","mao-jie","cao-ang","li-dian","wang-lang","xu-chu","strat-shengdong-jixi","hist-fan-kuai","eq-mingguang-kai","strat-shengdong-jixi"]},{"heroHp":9,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"hist-sima-guang","exhausted":true},{"defId":"zhou-tai","exhausted":true}],"hand":["eq-mingguang-kai","cheng-yu","hist-lin-zexu","eq-mingguang-kai","hist-wang-shouren","zhou-tai","hist-hai-rui"],"deck":["hist-confucius","chen-dao","eq-teng-jia","liu-xie","hist-fan-zhongyan","hist-lin-zexu","strat-shengdong-jixi","eq-teng-jia","hist-wei-zheng","cheng-pu","hist-sima-guang","strat-shengdong-jixi","strat-huo-ji","hist-hai-rui"]}]},
  },
  {
    id: 'dp-41',
    heroes: ["sun-quan","sima-yi"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":847792381,"players":[{"heroHp":27,"heroMaxHp":30,"armor":2,"mana":9,"board":[{"defId":"lu-fan","damage":4},{"defId":"lu-kang","damage":7,"enchants":[{"attack":3,"health":3}]},{"defId":"ma-teng"},{"defId":"token-xiangyong"}],"hand":["eq-teng-jia","man-chong","hist-li-yu","shi-xie","ma-teng"],"deck":["zhou-tai","eq-mingguang-kai","hist-wang-shichong","strat-shengdong-jixi","zhu-ran","zhou-tai","man-chong","wang-ping","lu-fan","strat-shengdong-jixi","shi-xie","strat-huo-ji","eq-teng-jia","eq-mingguang-kai","zhang-bu","cheng-pu","sun-quan","hu-zong"]},{"heroHp":4,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"hist-yang-su","damage":4,"enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}],"exhausted":true,"attacksUsed":1}],"hand":["zhuge-ke","zhuge-ke","sima-yi","eq-teng-jia"],"deck":["eq-teng-jia","strat-huo-ji","fa-zheng","wang-ping","strat-shengdong-jixi","hist-you-yu","han-fu","eq-mingguang-kai","sima-shi","sima-shi","zhou-tai","cao-pi","wang-ping","chen-dao","zhou-yu","strat-huo-ji","chen-dao","hist-gao-jianli"]}]},
  },
  {
    id: 'dp-42',
    heroes: ["hist-laozi","liu-bei"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":-1615399644,"players":[{"heroHp":24,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"ruan-xian"},{"defId":"wen-chou","damage":3},{"defId":"cheng-pu","damage":5}],"hand":["yu-jin","guan-xing","hist-tang-yin","hist-zhang-heng","strat-huo-ji"],"deck":["shi-tao","chen-dao","eq-teng-jia","wang-ping","hist-kou-qianzhi","hist-kou-qianzhi","ji-kang","strat-huo-ji","ji-kang","hist-xu-xiake","wang-ping","strat-shengdong-jixi","eq-mingguang-kai"]},{"heroHp":4,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"hist-xiao-he","damage":4,"attacksUsed":1},{"defId":"wei-yan","damage":7,"enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}],"exhausted":true,"attacksUsed":1}],"hand":[],"deck":["liu-bei","fei-yi","strat-huo-ji","hist-wen-tianxiang","cui-yan","eq-teng-jia","eq-mingguang-kai","ma-liang","wang-ping","hist-xie-xuan","zhang-fei","cheng-pu","strat-huo-ji","deng-zhi","wang-ping","eq-teng-jia"]}]},
  },
  {
    id: 'dp-43',
    heroes: ["hist-laozi","sun-quan"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":2063964977,"players":[{"heroHp":27,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-tang-yin","damage":7,"enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}]},{"defId":"ji-kang","damage":4,"enchants":[{"attack":0,"health":3,"keywords":["guard"],"equip":"eq-teng-jia"}]},{"defId":"wang-ping"},{"defId":"guan-xing"}],"hand":["hist-kou-qianzhi"],"deck":["hist-laozi","chen-dao","hist-zhang-heng","cheng-pu","eq-mingguang-kai","eq-teng-jia","ruan-xian","guan-xing","hist-zhang-heng","shi-tao"]},{"heroHp":9,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"token-shui-zhai","enchants":[{"attack":0,"health":3,"keywords":["guard"],"equip":"eq-teng-jia"}],"exhausted":true}],"hand":[],"deck":["ma-teng","hu-zong","sun-quan","zhu-ran","zhou-tai","lu-fan","zhang-bu","man-chong","strat-huo-ji","sun-ce","shi-xie","shi-xie"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-44',
    heroes: ["hist-laozi","liu-bei"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":2069096698,"players":[{"heroHp":24,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-zhang-heng","damage":2},{"defId":"guan-xing"}],"hand":["eq-mingguang-kai","wang-ping","hist-laozi"],"deck":["hist-kou-qianzhi","strat-shengdong-jixi","ruan-xian","yu-jin","eq-teng-jia","chen-dao","hist-tang-yin","shi-tao","ji-kang"]},{"heroHp":4,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"fei-yi","damage":5,"enchants":[{"attack":1,"health":1}],"attacksUsed":1},{"defId":"zhang-fei","damage":5,"enchants":[{"attack":1,"health":1},{"attack":1,"health":2}],"attacksUsed":1},{"defId":"liu-bei","enchants":[{"attack":1,"health":1}],"exhausted":true}],"hand":[],"deck":["deng-zhi","fei-yi","liu-qi","ma-liang","wang-ping","chen-dao","eq-mingguang-kai","strat-huo-ji","eq-teng-jia","wang-ping","chen-dao"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-45',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":1502563702,"players":[{"heroHp":14,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"jiang-wan","damage":5,"enchants":[{"attack":0,"health":3,"keywords":["guard"],"equip":"eq-teng-jia"},{"attack":1,"health":2}]},{"defId":"hist-xiao-he"},{"defId":"fei-yi","damage":3},{"defId":"deng-zhi"}],"hand":["strat-shengdong-jixi","zhang-fei"],"deck":["wei-yan","chen-dao","ma-liang","strat-shengdong-jixi","ma-liang","cheng-pu","strat-huo-ji","liu-qi","fei-yi","wang-ping","eq-mingguang-kai","eq-teng-jia"]},{"heroHp":2,"heroMaxHp":30,"armor":0,"mana":3,"board":[{"defId":"xu-chu","exhausted":true}],"hand":[],"deck":["wang-ping","strat-shengdong-jixi","hist-fan-kuai","li-dian","hist-zhou-yafu","hist-shang-yang","cao-rui","eq-mingguang-kai","eq-teng-jia","cao-ang","wang-ping","hist-tian-dan","xu-chu"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-46',
    heroes: ["hist-laozi","liu-bei"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-959685762,"players":[{"heroHp":30,"heroMaxHp":30,"armor":3,"mana":10,"board":[{"defId":"guan-xing"},{"defId":"wen-chou"}],"hand":["strat-huo-ji","wang-ping","eq-teng-jia","hist-tang-yin","strat-huo-ji"],"deck":["guan-xing","cheng-pu","eq-mingguang-kai","hist-xu-xiake","eq-teng-jia","yu-jin","ji-kang","hist-zhang-heng","shi-tao","hist-laozi","cheng-pu","chen-dao","eq-mingguang-kai","wang-ping"]},{"heroHp":8,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"liu-bei","damage":4,"enchants":[{"attack":1,"health":1},{"attack":1,"health":2}]},{"defId":"cheng-pu","exhausted":true},{"defId":"ma-liang","exhausted":true}],"hand":["hist-wen-tianxiang","fei-yi","deng-zhi","jiang-wan"],"deck":["wang-ping","wei-yan","fei-yi","eq-teng-jia","strat-shengdong-jixi","cui-yan","deng-zhi","strat-huo-ji","eq-teng-jia","eq-mingguang-kai","strat-shengdong-jixi","zhang-fei","liu-qi","eq-mingguang-kai","zhang-fei","cui-yan","ma-liang"]}]},
  },
  {
    id: 'dp-47',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":-958324285,"players":[{"heroHp":21,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"deng-zhi","damage":8,"enchants":[{"attack":0,"health":3,"keywords":["guard"],"equip":"eq-teng-jia"},{"attack":1,"health":2},{"attack":1,"health":2}]},{"defId":"ma-liang","damage":2},{"defId":"fei-yi"},{"defId":"cui-yan"}],"hand":["cheng-pu"],"deck":["eq-mingguang-kai","jiang-wan","hist-xiao-he","eq-teng-jia","strat-shengdong-jixi","chen-dao","wang-ping","chen-dao","strat-huo-ji","zhang-fei","hist-xie-xuan","eq-mingguang-kai","ma-liang","hist-wen-tianxiang"]},{"heroHp":3,"heroMaxHp":30,"armor":0,"mana":4,"board":[{"defId":"mao-jie","enchants":[{"attack":0,"health":3,"keywords":["guard"],"equip":"eq-teng-jia"}],"exhausted":true}],"hand":[],"deck":["hist-fan-kuai","hist-shang-yang","deng-ai","hist-zhou-yafu","cao-rui","hist-zhou-yafu","eq-teng-jia","li-dian","xu-chu","cao-lin","li-dian","cao-ang","hist-fan-kuai","strat-shengdong-jixi"]}]},
  },
  {
    id: 'dp-48',
    heroes: ["cao-cao","liu-bei"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":-1578220849,"players":[{"heroHp":20,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"cao-ang"},{"defId":"hist-tian-dan"}],"hand":["hist-fan-kuai"],"deck":["hist-zhou-yafu","deng-ai","xu-chu","hist-shang-yang","eq-teng-jia","cao-rui","zhang-liao","eq-teng-jia","cao-ang"]},{"heroHp":2,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"liu-qi","enchants":[{"attack":1,"health":2}],"attacksUsed":1},{"defId":"wang-ping","damage":6,"enchants":[{"attack":1,"health":2},{"attack":1,"health":1}],"attacksUsed":1},{"defId":"liu-bei","enchants":[{"attack":1,"health":1},{"attack":1,"health":2}],"exhausted":true}],"hand":[],"deck":["cheng-pu","zhang-fei","eq-teng-jia","eq-mingguang-kai","zhang-fei","hist-xiao-he","fei-yi","hist-xie-xuan","fei-yi"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-49',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1654149374,"players":[{"heroHp":27,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-confucius","damage":1},{"defId":"hist-lin-zexu","damage":8,"enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}]},{"defId":"hist-hai-rui"},{"defId":"hist-yan-zhenqing"},{"defId":"token-tie-qi"}],"hand":["wen-chou","strat-huo-ji"],"deck":["cheng-pu","hist-yan-zhenqing"]},{"heroHp":7,"heroMaxHp":30,"armor":0,"mana":5,"board":[{"defId":"hist-fan-kuai","damage":4,"enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}],"attacksUsed":1}],"hand":[],"deck":["hist-fan-kuai","strat-shengdong-jixi","hist-zhou-yafu","cao-lin","eq-teng-jia","cao-ang","deng-ai","hist-shang-yang","xu-chu"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-50',
    heroes: ["cao-cao","hist-confucius"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":824961459,"players":[{"heroHp":27,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"deng-ai","damage":4,"enchants":[{"attack":1,"health":0}]},{"defId":"hist-shang-yang"},{"defId":"cao-ang"}],"hand":["eq-mingguang-kai","wang-ping"],"deck":["cao-rui","li-dian","hist-fan-kuai","cao-ang","cao-lin","cao-rui","li-dian","mao-jie","xu-chu","eq-teng-jia","strat-shengdong-jixi","hist-tian-dan","strat-shengdong-jixi"]},{"heroHp":4,"heroMaxHp":30,"armor":0,"mana":4,"board":[{"defId":"wen-chou","damage":3,"attacksUsed":1},{"defId":"chen-dao","exhausted":true},{"defId":"token-baimao-bing","exhausted":true}],"hand":["zhou-tai"],"deck":["chen-dao","hist-confucius","hist-fan-zhongyan","hist-wang-shouren","strat-huo-ji","hist-wei-zheng","hist-lin-zexu","hist-wei-zheng","zhou-tai","hist-sima-guang","strat-shengdong-jixi","cheng-pu"]}]},
  },
  {
    id: 'dp-51',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1001053717,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"wei-yan","damage":3,"enchants":[{"attack":0,"health":3,"keywords":["guard"],"equip":"eq-teng-jia"}]},{"defId":"hist-wen-tianxiang","damage":3},{"defId":"wang-ping","damage":1},{"defId":"ma-liang"},{"defId":"fei-yi"}],"hand":["eq-teng-jia"],"deck":["cui-yan","deng-zhi","zhang-fei","zhang-fei","strat-huo-ji","wang-ping","ma-liang","eq-mingguang-kai","chen-dao","hist-xiao-he","jiang-wan","eq-mingguang-kai","strat-shengdong-jixi","strat-huo-ji"]},{"heroHp":11,"heroMaxHp":30,"armor":0,"mana":3,"board":[{"defId":"wang-ping","exhausted":true}],"hand":[],"deck":["hist-zhou-yafu","li-dian","cao-lin","mao-jie","xu-chu","xu-chu","hist-fan-kuai","li-dian","deng-ai","eq-teng-jia","wang-ping","hist-tian-dan","zhang-liao","wang-lang"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-52',
    heroes: ["liu-bei","hist-laozi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-999901698,"players":[{"heroHp":19,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-xiao-he","damage":4},{"defId":"deng-zhi","damage":5,"enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"},{"attack":1,"health":2}]},{"defId":"fei-yi","enchants":[{"attack":0,"health":3,"keywords":["guard"],"equip":"eq-teng-jia"}]}],"hand":["jiang-wan","ma-liang","cheng-pu","wei-yan"],"deck":["strat-shengdong-jixi","eq-mingguang-kai","fei-yi","chen-dao","liu-qi","cui-yan","strat-huo-ji","deng-zhi","eq-teng-jia","zhang-fei","ma-liang","hist-xie-xuan","liu-bei","strat-huo-ji"]},{"heroHp":14,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"guan-xing","damage":5,"attacksUsed":1},{"defId":"yu-jin","exhausted":true},{"defId":"ji-kang","exhausted":true}],"hand":["eq-teng-jia","wang-ping","shi-tao","eq-mingguang-kai","ji-kang"],"deck":["ruan-xian","hist-laozi","eq-teng-jia","chen-dao","hist-kou-qianzhi","wen-chou","hist-kou-qianzhi","chen-dao","strat-shengdong-jixi","strat-huo-ji","hist-zhang-heng","wang-ping","strat-huo-ji","cheng-pu"]}]},
  },
  {
    id: 'dp-53',
    heroes: ["hist-laozi","liu-bei"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":2037049624,"players":[{"heroHp":30,"heroMaxHp":30,"armor":1,"mana":10,"board":[{"defId":"wang-ping","damage":3},{"defId":"ji-kang","damage":7,"enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}]},{"defId":"guan-xing"}],"hand":["hist-xu-xiake","chen-dao"],"deck":["guan-xing","hist-kou-qianzhi","hist-tang-yin","ji-kang","shi-tao","hist-zhang-heng","strat-huo-ji"]},{"heroHp":6,"heroMaxHp":30,"armor":0,"mana":3,"board":[{"defId":"jiang-wan","damage":2,"attacksUsed":1},{"defId":"zhang-fei","damage":4,"enchants":[{"attack":1,"health":2}],"attacksUsed":1},{"defId":"wang-ping","exhausted":true}],"hand":[],"deck":["hist-wen-tianxiang","deng-zhi","hist-xie-xuan","cheng-pu","strat-huo-ji","eq-teng-jia","ma-liang","chen-dao","eq-mingguang-kai","liu-qi"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-54',
    heroes: ["hist-confucius","sima-yi"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":210824990,"players":[{"heroHp":29,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"chen-dao","damage":5,"silenced":true},{"defId":"hist-sima-guang","enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}]},{"defId":"zhou-tai"}],"hand":["zhou-tai","hist-wang-shouren","strat-shengdong-jixi"],"deck":["eq-teng-jia","strat-huo-ji","hist-fan-zhongyan","hist-wei-zheng","eq-teng-jia","hist-lin-zexu","wen-chou","hist-wei-zheng","hist-hai-rui","hist-sima-guang","hist-hai-rui"]},{"heroHp":4,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"chen-dao","damage":2,"exhausted":true},{"defId":"token-baimao-bing","exhausted":true},{"defId":"token-si-shi","exhausted":true}],"hand":[],"deck":["sima-shi","zhuge-ke","hist-gao-jianli","eq-teng-jia","cheng-pu","wang-ping","eq-mingguang-kai","fa-zheng","zhou-yu","cheng-pu","hist-yang-su","chen-dao","eq-teng-jia","hist-gao-jianli"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-55',
    heroes: ["hist-laozi","sun-quan"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":-1620531365,"players":[{"heroHp":27,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"token-baimao-bing"},{"defId":"hist-laozi","damage":5,"enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}]},{"defId":"hist-zhang-heng"},{"defId":"hist-xu-xiake"}],"hand":["eq-teng-jia","shi-tao"],"deck":["guan-xing","strat-huo-ji","guan-xing","ruan-xian","cheng-pu","hist-kou-qianzhi","cheng-pu","eq-mingguang-kai"]},{"heroHp":4,"heroMaxHp":30,"armor":0,"mana":6,"board":[{"defId":"token-xiangyong"},{"defId":"token-shui-zhai","exhausted":true}],"hand":[],"deck":["lu-fan","eq-mingguang-kai","zhou-tai","ma-teng","shi-xie","zhu-ran","lu-kang","shi-xie","hist-li-yu","strat-shengdong-jixi","eq-mingguang-kai","eq-teng-jia"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-56',
    heroes: ["sun-quan","sima-yi"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":-1616237476,"players":[{"heroHp":24,"heroMaxHp":30,"armor":5,"mana":10,"board":[{"defId":"zhu-ran","damage":3},{"defId":"lu-fan"},{"defId":"token-xiangyong"}],"hand":["eq-mingguang-kai"],"deck":["shi-xie","wang-ping","sun-ce","sun-quan","man-chong","hist-li-yu","hu-zong","eq-mingguang-kai","shi-xie","man-chong","zhou-tai","ma-teng","eq-teng-jia","hu-zong"]},{"heroHp":4,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"zhou-yu","damage":5,"attacksUsed":1},{"defId":"cheng-pu","exhausted":true},{"defId":"zhuge-ke","exhausted":true}],"hand":["zhou-tai"],"deck":["hist-you-yu","zhuge-ke","zhou-tai","strat-shengdong-jixi","eq-mingguang-kai","eq-teng-jia","eq-mingguang-kai","eq-teng-jia","strat-huo-ji","cao-pi","sima-shi","hist-yang-su","sima-shi","cheng-pu","sima-yi"]}]},
  },
  {
    id: 'dp-57',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":865072666,"players":[{"heroHp":26,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-xiao-he"},{"defId":"jiang-wan","damage":7,"enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"},{"attack":1,"health":2}]},{"defId":"ma-liang"},{"defId":"fei-yi"}],"hand":["fei-yi"],"deck":["strat-huo-ji","strat-shengdong-jixi","strat-huo-ji","chen-dao","cheng-pu","hist-xie-xuan","wang-ping","ma-liang","zhang-fei","zhang-fei","eq-mingguang-kai","cui-yan","wei-yan"]},{"heroHp":2,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"li-dian","exhausted":true},{"defId":"wang-ping","exhausted":true}],"hand":["hist-shang-yang"],"deck":["hist-fan-kuai","cao-ang","strat-huo-ji","strat-shengdong-jixi","li-dian","eq-mingguang-kai","cao-lin","eq-teng-jia","cao-rui","wang-lang","cao-rui","hist-tian-dan","cao-ang","deng-ai"]}]},
  },
  {
    id: 'dp-58',
    heroes: ["cao-cao","hist-confucius"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":865177395,"players":[{"heroHp":15,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"li-dian","damage":6,"enchants":[{"attack":0,"health":3,"keywords":["guard"],"equip":"eq-teng-jia"}]},{"defId":"wang-lang"},{"defId":"wang-ping"},{"defId":"cao-ang"}],"hand":["strat-huo-ji","strat-shengdong-jixi","xu-chu"],"deck":["cao-lin","eq-teng-jia","hist-fan-kuai","cao-rui","mao-jie","cao-ang","eq-mingguang-kai","cao-rui","eq-mingguang-kai","hist-zhou-yafu","wang-ping","li-dian","hist-tian-dan","hist-zhou-yafu","strat-huo-ji"]},{"heroHp":8,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"zhou-tai","exhausted":true},{"defId":"cheng-yu","exhausted":true}],"hand":[],"deck":["chen-dao","strat-huo-ji","hist-lin-zexu","hist-lin-zexu","eq-mingguang-kai","hist-wang-shouren","hist-confucius","hist-sima-guang","wen-chou","hist-yan-zhenqing","eq-teng-jia","eq-mingguang-kai","strat-shengdong-jixi","hist-wei-zheng","cheng-pu"]}]},
  },
  {
    id: 'dp-59',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":2066059557,"players":[{"heroHp":5,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"jiang-wan","damage":1,"enchants":[{"attack":1,"health":2},{"attack":1,"health":1},{"attack":1,"health":2}]},{"defId":"liu-bei","enchants":[{"attack":1,"health":1}]}],"hand":["ma-liang"],"deck":["hist-xie-xuan","wang-ping"]},{"heroHp":8,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"token-xiangyong","attacksUsed":1},{"defId":"cao-rui","damage":3,"attacksUsed":1},{"defId":"wang-lang","attacksUsed":1},{"defId":"hist-fan-kuai","damage":1,"exhausted":true}],"hand":[],"deck":["strat-huo-ji","mao-jie","deng-ai"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-60',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":869471284,"players":[{"heroHp":26,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"token-baimao-bing"},{"defId":"cui-yan","damage":5,"enchants":[{"attack":0,"health":4,"keywords":["guard"],"equip":"eq-mingguang-kai"}]},{"defId":"deng-zhi","enchants":[{"attack":1,"health":2}]}],"hand":["wei-yan","eq-mingguang-kai","strat-huo-ji","ma-liang"],"deck":["fei-yi","wang-ping","strat-shengdong-jixi","cui-yan","cheng-pu","wang-ping","eq-teng-jia","eq-teng-jia","deng-zhi","zhang-fei","hist-wen-tianxiang","zhang-fei","liu-qi","fei-yi","liu-bei","jiang-wan"]},{"heroHp":8,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"li-dian","damage":3,"attacksUsed":1},{"defId":"xu-chu","exhausted":true},{"defId":"cao-ang","exhausted":true}],"hand":["eq-mingguang-kai","hist-tian-dan","eq-teng-jia"],"deck":["eq-teng-jia","zhang-liao","strat-shengdong-jixi","hist-fan-kuai","strat-huo-ji","hist-shang-yang","cao-lin","cao-ang","wang-ping","deng-ai","hist-zhou-yafu","wang-lang","mao-jie","eq-mingguang-kai","hist-zhou-yafu","cao-rui"]}]},
  },
]
