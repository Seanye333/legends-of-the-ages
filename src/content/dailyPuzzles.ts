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
    scenario: {"activePlayer":0,"rng":1471773376,"players":[{"heroHp":11,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"deng-zhi"}],"hand":["zhang-fei"],"deck":["hist-wen-tianxiang","ma-liang","cui-yan","chen-dao","hist-xiao-he","eq-mingguang-kai","cui-yan","cheng-pu","wei-yan","liu-bei","wang-ping","eq-teng-jia","strat-huo-ji","strat-shengdong-jixi","hist-xie-xuan"]},{"heroHp":6,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"hist-tian-dan","exhausted":true}],"hand":[],"deck":["strat-shengdong-jixi","eq-mingguang-kai","mao-jie","hist-zhou-yafu","hist-zhou-yafu","li-dian","eq-teng-jia","deng-ai","hist-fan-kuai","xu-chu","wang-ping","hist-fan-kuai","wang-ping","cao-ang","xu-chu"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-02',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":2121203518,"players":[{"heroHp":17,"heroMaxHp":30,"armor":0,"mana":9,"board":[{"defId":"fei-yi","damage":5,"enchants":[{"attack":1,"health":2}]}],"hand":["cheng-pu","wei-yan","chen-dao","cui-yan","wang-ping"],"deck":["deng-zhi","ma-liang","deng-zhi","hist-xiao-he","ma-liang","strat-shengdong-jixi","strat-huo-ji","strat-huo-ji","eq-mingguang-kai","hist-wen-tianxiang","wang-ping","strat-shengdong-jixi","chen-dao","jiang-wan","fei-yi","liu-bei","cui-yan","eq-mingguang-kai"]},{"heroHp":11,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"cao-ang","damage":4,"attacksUsed":1},{"defId":"li-dian","damage":4,"attacksUsed":1}],"hand":["eq-mingguang-kai","hist-shang-yang","eq-teng-jia","wang-lang","wang-ping","mao-jie"],"deck":["eq-teng-jia","cao-rui","hist-tian-dan","deng-ai","xu-chu","wang-lang","strat-shengdong-jixi","hist-zhou-yafu","li-dian","cao-rui","hist-fan-kuai","cao-ang","wang-ping","eq-mingguang-kai","strat-shengdong-jixi","strat-huo-ji","cao-lin","hist-zhou-yafu"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-03',
    heroes: ["cao-cao","liu-bei"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1398489315,"players":[{"heroHp":22,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"mao-jie"},{"defId":"hist-fan-kuai","damage":6},{"defId":"li-dian"}],"hand":["hist-shang-yang"],"deck":["cao-rui","hist-zhou-yafu","eq-teng-jia","eq-mingguang-kai","strat-huo-ji","hist-fan-kuai","cao-ang","hist-tian-dan","strat-huo-ji","li-dian","zhang-liao"]},{"heroHp":5,"heroMaxHp":30,"armor":0,"mana":6,"board":[{"defId":"ma-liang","damage":5,"enchants":[{"attack":1,"health":2},{"attack":0,"health":3,"keywords":["guard"]},{"attack":1,"health":2}],"attacksUsed":1}],"hand":[],"deck":["fei-yi","liu-bei","liu-qi","wei-yan","hist-xie-xuan","strat-shengdong-jixi","deng-zhi","cheng-pu","wang-ping","eq-mingguang-kai","strat-shengdong-jixi"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-04',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":814907475,"players":[{"heroHp":29,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"zhou-tai","damage":6},{"defId":"hist-sima-guang"},{"defId":"cheng-pu"}],"hand":["hist-wei-zheng"],"deck":["hist-hai-rui","liu-xie"]},{"heroHp":1,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"xu-chu","exhausted":true}],"hand":[],"deck":["cao-ang","deng-ai","eq-mingguang-kai","hist-zhou-yafu","hist-zhou-yafu","wang-lang","hist-tian-dan","eq-mingguang-kai"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-05',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1012364449,"players":[{"heroHp":25,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"deng-zhi","damage":4},{"defId":"hist-wen-tianxiang"},{"defId":"cui-yan"}],"hand":["eq-mingguang-kai","strat-huo-ji","liu-qi","ma-liang"],"deck":["jiang-wan","hist-xiao-he","wang-ping","ma-liang","fei-yi","chen-dao","strat-huo-ji","wei-yan","wang-ping","liu-bei","deng-zhi","strat-shengdong-jixi","chen-dao","zhang-fei","eq-teng-jia","eq-teng-jia","eq-mingguang-kai"]},{"heroHp":3,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"hist-zhou-yafu","exhausted":true}],"hand":["strat-huo-ji","cao-ang","wang-lang","eq-teng-jia","cao-ang"],"deck":["mao-jie","hist-tian-dan","xu-chu","wang-ping","deng-ai","li-dian","cao-rui","eq-mingguang-kai","hist-zhou-yafu","hist-fan-kuai","xu-chu","zhang-liao","wang-lang","eq-teng-jia","eq-mingguang-kai","strat-huo-ji","cao-lin"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-06',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1004195587,"players":[{"heroHp":22,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"deng-zhi","damage":10,"enchants":[{"attack":0,"health":4,"keywords":["guard"]},{"attack":1,"health":2}]},{"defId":"ma-liang","damage":5,"enchants":[{"attack":1,"health":2}]},{"defId":"hist-xiao-he"}],"hand":["hist-xie-xuan"],"deck":["fei-yi","fei-yi","jiang-wan","cui-yan","wang-ping","hist-wen-tianxiang","eq-teng-jia","eq-teng-jia","wang-ping","chen-dao","wei-yan","strat-shengdong-jixi","cui-yan"]},{"heroHp":7,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"xu-chu","exhausted":true}],"hand":[],"deck":["cao-ang","eq-mingguang-kai","zhang-liao","hist-zhou-yafu","mao-jie","wang-lang","cao-ang","li-dian","hist-zhou-yafu","wang-ping","cao-rui","hist-tian-dan","wang-lang"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-07',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":1086905258,"players":[{"heroHp":21,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"zhang-fei","damage":1,"enchants":[{"attack":1,"health":2}]}],"hand":["fei-yi"],"deck":["wang-ping","hist-wen-tianxiang","cheng-pu","hist-xie-xuan","deng-zhi","ma-liang","ma-liang","jiang-wan","zhang-fei","wang-ping","liu-qi"]},{"heroHp":8,"heroMaxHp":30,"armor":0,"mana":3,"board":[{"defId":"cao-rui"},{"defId":"cao-lin"},{"defId":"li-dian","exhausted":true}],"hand":[],"deck":["hist-zhou-yafu","cao-ang","hist-fan-kuai","strat-shengdong-jixi","li-dian","wang-lang","wang-lang","eq-teng-jia","eq-mingguang-kai","hist-zhou-yafu","strat-shengdong-jixi"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-08',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-361572830,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-wei-zheng","damage":4},{"defId":"zhou-tai"},{"defId":"cheng-pu"}],"hand":["hist-wei-zheng","eq-mingguang-kai","wen-chou"],"deck":["hist-confucius","hist-sima-guang","hist-hai-rui","hist-lin-zexu","hist-yan-zhenqing","hist-wang-shouren","strat-huo-ji","strat-shengdong-jixi","eq-teng-jia","chen-dao","hist-hai-rui","cheng-yu","hist-yan-zhenqing","zhou-tai","hist-lin-zexu","eq-teng-jia","hist-fan-zhongyan"]},{"heroHp":2,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"xu-chu","exhausted":true}],"hand":["mao-jie","eq-mingguang-kai","li-dian","li-dian"],"deck":["strat-shengdong-jixi","eq-mingguang-kai","wang-lang","wang-ping","hist-fan-kuai","xu-chu","wang-ping","cao-rui","cao-lin","zhang-liao","cao-rui","eq-teng-jia","cao-ang","hist-shang-yang","wang-lang","strat-shengdong-jixi","hist-zhou-yafu"]}]},
  },
  {
    id: 'dp-09',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":1481827360,"players":[{"heroHp":25,"heroMaxHp":30,"armor":0,"mana":9,"board":[{"defId":"fei-yi","damage":3,"enchants":[{"attack":0,"health":3,"keywords":["guard"]}]},{"defId":"deng-zhi"},{"defId":"wei-yan"}],"hand":["strat-huo-ji","eq-mingguang-kai","eq-mingguang-kai","chen-dao"],"deck":["eq-teng-jia","strat-shengdong-jixi","hist-wen-tianxiang","jiang-wan","cheng-pu","strat-huo-ji","ma-liang","cui-yan","hist-xiao-he","ma-liang","zhang-fei","liu-qi","wang-ping","fei-yi","chen-dao","deng-zhi","zhang-fei","hist-xie-xuan"]},{"heroHp":3,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"xu-chu","enchants":[{"attack":0,"health":3,"keywords":["guard"]}],"exhausted":true}],"hand":["eq-mingguang-kai","strat-huo-ji","cao-ang","eq-teng-jia"],"deck":["cao-rui","mao-jie","hist-shang-yang","cao-ang","hist-fan-kuai","hist-zhou-yafu","wang-ping","strat-shengdong-jixi","cao-rui","eq-mingguang-kai","wang-lang","hist-tian-dan","li-dian","zhang-liao","strat-huo-ji","deng-ai","wang-ping","hist-fan-kuai"]}]},
  },
  {
    id: 'dp-10',
    heroes: ["liu-bei","hist-laozi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":1484236127,"players":[{"heroHp":27,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-xiao-he"},{"defId":"ma-liang"},{"defId":"jiang-wan"}],"hand":["strat-huo-ji","strat-huo-ji","eq-teng-jia"],"deck":["zhang-fei","wei-yan","cui-yan","liu-qi","fei-yi","hist-xie-xuan","hist-wen-tianxiang","wang-ping","wang-ping","eq-mingguang-kai","deng-zhi","liu-bei","cheng-pu","chen-dao","fei-yi","eq-mingguang-kai","eq-teng-jia"]},{"heroHp":4,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"chen-dao","exhausted":true}],"hand":["wang-ping","wang-ping","hist-kou-qianzhi","hist-kou-qianzhi","ji-kang"],"deck":["yu-jin","cheng-pu","strat-huo-ji","wen-chou","ji-kang","hist-xu-xiake","hist-zhang-heng","eq-teng-jia","guan-xing","eq-teng-jia","ruan-xian","strat-shengdong-jixi","hist-zhang-heng","eq-mingguang-kai","guan-xing","shi-tao"]}]},
  },
  {
    id: 'dp-11',
    heroes: ["sima-yi","hist-confucius"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":1495861046,"players":[{"heroHp":27,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"sima-yi","damage":3},{"defId":"cheng-pu"},{"defId":"hist-gao-jianli"}],"hand":["cao-pi","sima-shi"],"deck":["zhou-tai","sima-shi","strat-shengdong-jixi","han-fu","chen-dao","eq-mingguang-kai","hist-yang-su","eq-teng-jia","strat-huo-ji","eq-mingguang-kai","zhuge-ke","hist-you-yu","fa-zheng"]},{"heroHp":10,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"chen-dao","exhausted":true}],"hand":["chen-dao","eq-mingguang-kai"],"deck":["hist-wei-zheng","hist-lin-zexu","hist-fan-zhongyan","liu-xie","strat-huo-ji","strat-shengdong-jixi","hist-hai-rui","cheng-pu","hist-sima-guang","hist-sima-guang"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-12',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-967016792,"players":[{"heroHp":29,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-yan-zhenqing","damage":2},{"defId":"cheng-yu","damage":3,"enchants":[{"attack":0,"health":4,"keywords":["guard"]}]},{"defId":"hist-sima-guang"}],"hand":["eq-teng-jia","chen-dao"],"deck":["liu-xie","eq-mingguang-kai","zhou-tai","cheng-pu","hist-wei-zheng","hist-hai-rui","eq-teng-jia","wen-chou","hist-wang-shouren","hist-wei-zheng"]},{"heroHp":1,"heroMaxHp":30,"armor":0,"mana":3,"board":[{"defId":"wang-ping","exhausted":true}],"hand":[],"deck":["hist-tian-dan","zhang-liao","wang-lang","hist-fan-kuai","hist-fan-kuai","hist-zhou-yafu","li-dian","cao-ang","eq-mingguang-kai","eq-mingguang-kai","mao-jie","cao-rui","strat-shengdong-jixi"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-13',
    heroes: ["hist-laozi","liu-bei"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":1499945477,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"guan-xing","damage":5,"enchants":[{"attack":0,"health":3,"keywords":["guard"]}]},{"defId":"wen-chou","damage":4,"enchants":[{"attack":0,"health":3,"keywords":["guard"]}]},{"defId":"wang-ping"}],"hand":["hist-laozi"],"deck":["hist-xu-xiake","guan-xing","ji-kang","shi-tao","eq-mingguang-kai","hist-zhang-heng","hist-kou-qianzhi","shi-tao","chen-dao","ruan-xian","hist-kou-qianzhi"]},{"heroHp":5,"heroMaxHp":30,"armor":0,"mana":7,"board":[{"defId":"fei-yi","damage":4,"enchants":[{"attack":1,"health":2},{"attack":0,"health":4,"keywords":["guard"]}]}],"hand":[],"deck":["zhang-fei","wang-ping","strat-shengdong-jixi","liu-qi","eq-teng-jia","hist-xie-xuan","deng-zhi","hist-wen-tianxiang","cheng-pu","chen-dao","hist-xiao-he","strat-shengdong-jixi","ma-liang"]}]},
  },
  {
    id: 'dp-14',
    heroes: ["sun-quan","sima-yi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":1449466099,"players":[{"heroHp":29,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"sun-quan","damage":4},{"defId":"zhu-ran","damage":5},{"defId":"hist-wang-shichong"}],"hand":["eq-teng-jia","shi-xie","eq-teng-jia","wang-ping","lu-fan"],"deck":["cheng-pu","shi-xie","eq-mingguang-kai","ma-teng","hist-li-yu","sun-ce","man-chong","cheng-pu","eq-mingguang-kai","strat-shengdong-jixi","lu-fan","hu-zong"]},{"heroHp":2,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"zhuge-ke","enchants":[{"attack":0,"health":4,"keywords":["guard"]}],"attacksUsed":1},{"defId":"hist-yang-su","damage":5,"exhausted":true,"attacksUsed":1}],"hand":["sima-shi","wang-ping","cao-pi"],"deck":["zhou-yu","zhuge-ke","sima-yi","zhou-tai","fa-zheng","han-fu","hist-gao-jianli","sima-shi","cheng-pu","hist-gao-jianli","eq-teng-jia","strat-shengdong-jixi","eq-teng-jia","strat-huo-ji","strat-shengdong-jixi"]}]},
  },
  {
    id: 'dp-15',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-373616665,"players":[{"heroHp":25,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"cui-yan","damage":6,"enchants":[{"attack":1,"health":2},{"attack":1,"health":2}]},{"defId":"jiang-wan","damage":4},{"defId":"zhang-fei"}],"hand":["wei-yan"],"deck":["deng-zhi","strat-huo-ji","eq-mingguang-kai","wang-ping","chen-dao","eq-mingguang-kai","hist-xie-xuan","deng-zhi","liu-bei","ma-liang","eq-teng-jia","strat-huo-ji"]},{"heroHp":3,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"cao-ang"},{"defId":"hist-zhou-yafu","exhausted":true}],"hand":[],"deck":["wang-ping","eq-teng-jia","mao-jie","xu-chu","wang-lang","hist-fan-kuai","strat-shengdong-jixi","xu-chu","cao-lin","li-dian","cao-rui","li-dian","strat-shengdong-jixi"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-16',
    heroes: ["sun-quan","sima-yi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":1460148457,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"sun-ce","damage":4},{"defId":"hu-zong"},{"defId":"man-chong"},{"defId":"hist-li-yu"}],"hand":["strat-huo-ji","zhang-bu","hu-zong"],"deck":["lu-fan","eq-mingguang-kai","cheng-pu","strat-shengdong-jixi","zhou-tai","eq-mingguang-kai","hist-wang-shichong","strat-huo-ji","sun-quan","wang-ping","shi-xie","cheng-pu","eq-teng-jia","shi-xie","zhou-tai","man-chong"]},{"heroHp":1,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"cheng-pu","exhausted":true}],"hand":["wang-ping","strat-huo-ji"],"deck":["han-fu","eq-mingguang-kai","eq-teng-jia","zhou-tai","cao-pi","fa-zheng","zhou-tai","zhuge-ke","zhou-yu","eq-mingguang-kai","strat-shengdong-jixi","sima-shi","chen-dao","hist-gao-jianli","sima-shi","zhuge-ke"]}]},
  },
  {
    id: 'dp-17',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-367856570,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"chen-dao"},{"defId":"hist-hai-rui"},{"defId":"hist-sima-guang"}],"hand":["cheng-yu","hist-wei-zheng","hist-lin-zexu","hist-yan-zhenqing"],"deck":["hist-sima-guang","eq-mingguang-kai","hist-confucius","strat-huo-ji","hist-yan-zhenqing","strat-shengdong-jixi","zhou-tai","eq-mingguang-kai","hist-lin-zexu","cheng-pu","hist-wang-shouren","strat-shengdong-jixi","liu-xie","strat-huo-ji","eq-teng-jia"]},{"heroHp":3,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"xu-chu","exhausted":true},{"defId":"cao-rui","exhausted":true}],"hand":["eq-mingguang-kai","li-dian","eq-mingguang-kai"],"deck":["wang-ping","cao-rui","cao-ang","hist-fan-kuai","eq-teng-jia","strat-shengdong-jixi","wang-lang","wang-ping","strat-huo-ji","hist-fan-kuai","cao-lin","xu-chu","li-dian","hist-tian-dan","mao-jie","cao-ang"]}]},
  },
  {
    id: 'dp-18',
    heroes: ["cao-cao","liu-bei"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-997911847,"players":[{"heroHp":13,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-tian-dan","damage":4},{"defId":"cao-rui"},{"defId":"cao-ang"}],"hand":["eq-mingguang-kai","eq-mingguang-kai"],"deck":["eq-teng-jia","xu-chu","xu-chu","wang-lang","li-dian","cao-lin","li-dian","eq-teng-jia","cao-rui","deng-ai","mao-jie","hist-fan-kuai","wang-ping"]},{"heroHp":4,"heroMaxHp":30,"armor":0,"mana":3,"board":[{"defId":"fei-yi","damage":4,"enchants":[{"attack":1,"health":2},{"attack":1,"health":2}],"attacksUsed":1},{"defId":"wang-ping","exhausted":true}],"hand":[],"deck":["chen-dao","wang-ping","cui-yan","fei-yi","liu-bei","liu-qi","hist-wen-tianxiang","eq-mingguang-kai","ma-liang","strat-shengdong-jixi","chen-dao","hist-xie-xuan","strat-huo-ji","eq-teng-jia"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-19',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":1469259880,"players":[{"heroHp":27,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"fei-yi","damage":2},{"defId":"wei-yan","damage":4},{"defId":"hist-wen-tianxiang"}],"hand":["eq-mingguang-kai","ma-liang","ma-liang"],"deck":["deng-zhi","zhang-fei","fei-yi","strat-huo-ji","eq-mingguang-kai","liu-bei","cui-yan","eq-teng-jia","eq-teng-jia","cui-yan","strat-shengdong-jixi","deng-zhi","liu-qi","jiang-wan"]},{"heroHp":9,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"cao-lin","damage":4,"enchants":[{"attack":0,"health":3,"keywords":["guard"]}]},{"defId":"deng-ai","damage":4,"enchants":[{"attack":1,"health":0}],"exhausted":true,"attacksUsed":1}],"hand":[],"deck":["hist-fan-kuai","li-dian","wang-lang","xu-chu","hist-fan-kuai","hist-shang-yang","li-dian","strat-shengdong-jixi","eq-mingguang-kai","wang-ping","cao-ang","eq-mingguang-kai","mao-jie","hist-zhou-yafu"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-20',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1366442241,"players":[{"heroHp":14,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"cheng-pu","damage":6},{"defId":"fei-yi"},{"defId":"wang-ping"}],"hand":["ma-liang"],"deck":["strat-shengdong-jixi","fei-yi","strat-huo-ji","hist-xiao-he","eq-teng-jia","chen-dao","cui-yan","jiang-wan","deng-zhi","hist-wen-tianxiang","wang-ping","zhang-fei"]},{"heroHp":2,"heroMaxHp":30,"armor":0,"mana":3,"board":[{"defId":"li-dian","damage":5,"attacksUsed":1},{"defId":"wang-ping","exhausted":true}],"hand":[],"deck":["hist-shang-yang","hist-fan-kuai","cao-ang","xu-chu","hist-fan-kuai","deng-ai","hist-tian-dan","li-dian","eq-mingguang-kai","wang-lang","strat-huo-ji","cao-rui"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-21',
    heroes: ["cao-cao","hist-confucius"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":1479418593,"players":[{"heroHp":24,"heroMaxHp":30,"armor":0,"mana":9,"board":[{"defId":"cao-rui"},{"defId":"wang-ping"}],"hand":["eq-teng-jia","strat-huo-ji","xu-chu"],"deck":["mao-jie","cao-ang","eq-teng-jia","hist-fan-kuai","hist-zhou-yafu","deng-ai","xu-chu","hist-tian-dan","hist-shang-yang","cao-rui","li-dian","wang-lang","li-dian","eq-mingguang-kai","hist-zhou-yafu","hist-fan-kuai","cao-ang"]},{"heroHp":7,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"hist-wei-zheng","damage":6,"enchants":[{"attack":0,"health":3,"keywords":["guard"]}],"attacksUsed":1},{"defId":"hist-fan-zhongyan","damage":3,"attacksUsed":1},{"defId":"hist-sima-guang","exhausted":true}],"hand":["wen-chou","eq-teng-jia","zhou-tai"],"deck":["eq-mingguang-kai","hist-lin-zexu","cheng-yu","strat-huo-ji","hist-confucius","strat-shengdong-jixi","strat-shengdong-jixi","cheng-pu","hist-yan-zhenqing","zhou-tai","hist-wei-zheng","hist-yan-zhenqing","hist-lin-zexu","chen-dao","eq-mingguang-kai","hist-wang-shouren","hist-hai-rui"]}]},
  },
  {
    id: 'dp-22',
    heroes: ["hist-confucius","sima-yi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1612571961,"players":[{"heroHp":17,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-lin-zexu","damage":4},{"defId":"hist-wei-zheng"},{"defId":"hist-wei-zheng"},{"defId":"hist-yan-zhenqing"}],"hand":["strat-huo-ji"],"deck":["eq-teng-jia"]},{"heroHp":2,"heroMaxHp":30,"armor":0,"mana":5,"board":[{"defId":"token-si-shi","enchants":[{"attack":0,"health":4,"keywords":["guard"]}],"exhausted":true}],"hand":[],"deck":["chen-dao","zhou-tai","zhou-tai","sima-shi","strat-huo-ji","strat-shengdong-jixi","hist-yang-su","hist-gao-jianli"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-23',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":855018682,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"deng-zhi","damage":9,"enchants":[{"attack":0,"health":3,"keywords":["guard"]},{"attack":1,"health":2},{"attack":1,"health":2}]},{"defId":"hist-xiao-he"},{"defId":"liu-bei","enchants":[{"attack":1,"health":1}]}],"hand":["wei-yan"],"deck":["deng-zhi","strat-huo-ji","hist-wen-tianxiang","wang-ping","fei-yi","fei-yi","strat-huo-ji","chen-dao","eq-mingguang-kai","jiang-wan","chen-dao","wang-ping"]},{"heroHp":2,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"cao-lin"},{"defId":"hist-zhou-yafu","exhausted":true}],"hand":[],"deck":["eq-teng-jia","xu-chu","li-dian","cao-rui","wang-ping","wang-lang","deng-ai","cao-ang","hist-tian-dan","zhang-liao","hist-fan-kuai","li-dian"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-24',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":1488844203,"players":[{"heroHp":19,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-wang-shouren","damage":1},{"defId":"hist-sima-guang"}],"hand":["hist-yan-zhenqing","hist-confucius","hist-sima-guang","strat-shengdong-jixi"],"deck":["hist-fan-zhongyan","strat-huo-ji","zhou-tai","zhou-tai","hist-lin-zexu"]},{"heroHp":6,"heroMaxHp":30,"armor":0,"mana":3,"board":[{"defId":"cao-ang","damage":8,"enchants":[{"attack":0,"health":4,"keywords":["guard"]}],"attacksUsed":1},{"defId":"hist-fan-kuai","damage":5,"attacksUsed":1},{"defId":"hist-shang-yang","exhausted":true}],"hand":[],"deck":["wang-ping","zhang-liao","strat-huo-ji","strat-huo-ji","strat-shengdong-jixi","hist-zhou-yafu","mao-jie","wang-lang","li-dian","deng-ai","cao-lin"],"heroPowerUsed":true}]},
  },
]
