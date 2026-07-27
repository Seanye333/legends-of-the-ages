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
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1611419942,"players":[{"heroHp":27,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-wang-shouren"}],"hand":["hist-lin-zexu","hist-wei-zheng","wen-chou","hist-confucius","hist-hai-rui"],"deck":["strat-shengdong-jixi","hist-sima-guang","chen-dao","hist-lin-zexu","hist-yan-zhenqing","eq-mingguang-kai","strat-huo-ji","zhou-tai","hist-yan-zhenqing","eq-teng-jia","cheng-yu","chen-dao","hist-wei-zheng","eq-mingguang-kai","eq-teng-jia"]},{"heroHp":5,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"xu-chu","damage":2,"exhausted":true}],"hand":["eq-mingguang-kai","cao-rui"],"deck":["eq-mingguang-kai","hist-zhou-yafu","mao-jie","deng-ai","wang-lang","hist-shang-yang","hist-zhou-yafu","li-dian","cao-rui","wang-lang","hist-fan-kuai","strat-shengdong-jixi","wang-ping","hist-tian-dan","strat-shengdong-jixi","cao-ang","hist-fan-kuai"]}]},
  },
  {
    id: 'dp-02',
    heroes: ["liu-bei","hist-laozi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":189146087,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"deng-zhi","damage":4,"enchants":[{"attack":0,"health":4,"keywords":["guard"]},{"attack":1,"health":2}],"frozen":true},{"defId":"fei-yi","damage":7,"enchants":[{"attack":0,"health":4,"keywords":["guard"]}]}],"hand":["strat-huo-ji","chen-dao"],"deck":["ma-liang","wei-yan","hist-wen-tianxiang","eq-teng-jia","jiang-wan","chen-dao","wang-ping","cui-yan","zhang-fei","liu-bei","hist-xiao-he","liu-qi","cui-yan","ma-liang","deng-zhi","zhang-fei"]},{"heroHp":5,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"wen-chou","damage":4,"enchants":[{"attack":0,"health":3,"keywords":["guard"]}],"exhausted":true,"attacksUsed":1}],"hand":["strat-huo-ji","hist-kou-qianzhi","shi-tao","shi-tao","eq-mingguang-kai"],"deck":["hist-zhang-heng","hist-laozi","chen-dao","chen-dao","eq-teng-jia","eq-mingguang-kai","ruan-xian","hist-tang-yin","strat-shengdong-jixi","wang-ping","hist-kou-qianzhi","yu-jin","hist-zhang-heng","ji-kang","hist-xu-xiake"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-03',
    heroes: ["cao-cao","liu-bei"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":835539088,"players":[{"heroHp":20,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-fan-kuai","damage":1,"enchants":[{"attack":0,"health":4,"keywords":["guard"]}]}],"hand":["zhang-liao"],"deck":["hist-zhou-yafu","cao-rui","strat-huo-ji","mao-jie","strat-shengdong-jixi","hist-zhou-yafu","eq-mingguang-kai","xu-chu","wang-ping","hist-fan-kuai","li-dian","wang-ping"]},{"heroHp":16,"heroMaxHp":30,"armor":0,"mana":4,"board":[{"defId":"liu-bei","enchants":[{"attack":1,"health":1}]},{"defId":"hist-xiao-he","enchants":[{"attack":1,"health":2}],"exhausted":true}],"hand":[],"deck":["deng-zhi","chen-dao","strat-huo-ji","ma-liang","fei-yi","fei-yi","jiang-wan","chen-dao","hist-wen-tianxiang","strat-huo-ji","strat-shengdong-jixi","wang-ping","deng-zhi"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-04',
    heroes: ["liu-bei","hist-laozi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1585866066,"players":[{"heroHp":29,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"deng-zhi","damage":2}],"hand":["strat-shengdong-jixi"],"deck":["strat-huo-ji","wei-yan","zhang-fei","eq-mingguang-kai","hist-xiao-he","jiang-wan","chen-dao","fei-yi","fei-yi","hist-xie-xuan","cui-yan"]},{"heroHp":6,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"ji-kang","exhausted":true},{"defId":"shi-tao","exhausted":true}],"hand":["eq-mingguang-kai","eq-mingguang-kai"],"deck":["eq-teng-jia","shi-tao","guan-xing","eq-teng-jia","hist-laozi","chen-dao","ruan-xian","strat-shengdong-jixi","cheng-pu","yu-jin"]}]},
  },
  {
    id: 'dp-05',
    heroes: ["cao-cao","liu-bei"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":250831468,"players":[{"heroHp":7,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-tian-dan"}],"hand":["zhang-liao"],"deck":["eq-mingguang-kai","wang-ping","strat-shengdong-jixi"]},{"heroHp":8,"heroMaxHp":30,"armor":0,"mana":6,"board":[{"defId":"deng-zhi","damage":1,"enchants":[{"attack":1,"health":2}],"attacksUsed":1},{"defId":"liu-qi","enchants":[{"attack":1,"health":2}],"exhausted":true}],"hand":[],"deck":["wei-yan","zhang-fei","hist-xie-xuan"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-06',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":821191215,"players":[{"heroHp":1,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-confucius"}],"hand":["wen-chou","hist-wang-shouren","hist-hai-rui"],"deck":["chen-dao","hist-lin-zexu","zhou-tai","cheng-pu","hist-lin-zexu"]},{"heroHp":1,"heroMaxHp":30,"armor":0,"mana":4,"board":[{"defId":"cao-rui","damage":4,"enchants":[{"attack":0,"health":3,"keywords":["guard"]}],"attacksUsed":1},{"defId":"li-dian","damage":2,"attacksUsed":1},{"defId":"cao-rui","exhausted":true}],"hand":[],"deck":["cao-lin","hist-fan-kuai","hist-fan-kuai","wang-lang","strat-huo-ji","cao-ang","hist-shang-yang","li-dian","hist-tian-dan","strat-shengdong-jixi"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-07',
    heroes: ["hist-laozi","liu-bei"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-989219340,"players":[{"heroHp":18,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"yu-jin","damage":6,"enchants":[{"attack":0,"health":4,"keywords":["guard"]},{"attack":0,"health":3,"keywords":["guard"]}]},{"defId":"hist-tang-yin","damage":2,"enchants":[{"attack":0,"health":3,"keywords":["guard"]}]},{"defId":"wang-ping"}],"hand":["hist-zhang-heng"],"deck":["chen-dao","wen-chou","guan-xing","eq-mingguang-kai","cheng-pu","ji-kang","shi-tao"]},{"heroHp":9,"heroMaxHp":30,"armor":0,"mana":8,"board":[{"defId":"ma-liang","damage":4,"enchants":[{"attack":0,"health":3,"keywords":["guard"]}]}],"hand":[],"deck":["strat-shengdong-jixi","zhang-fei","hist-xiao-he","cheng-pu","deng-zhi","chen-dao","strat-shengdong-jixi","hist-xie-xuan","eq-mingguang-kai","chen-dao"]}]},
  },
  {
    id: 'dp-08',
    heroes: ["sima-yi","hist-confucius"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-971939055,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"sima-shi","damage":2},{"defId":"cheng-pu"},{"defId":"cheng-pu"}],"hand":["eq-teng-jia","zhou-tai","sima-yi","hist-you-yu","sima-shi"],"deck":["wang-ping","strat-huo-ji","zhuge-ke","strat-huo-ji","eq-mingguang-kai","cao-pi","han-fu","zhuge-ke","zhou-tai","wang-ping","eq-mingguang-kai","hist-gao-jianli","zhou-yu","fa-zheng","hist-yang-su","eq-teng-jia"]},{"heroHp":10,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"cheng-pu","enchants":[{"attack":0,"health":3,"keywords":["guard"]},{"attack":0,"health":3,"keywords":["guard"]}],"exhausted":true}],"hand":["hist-wang-shouren","hist-confucius","zhou-tai"],"deck":["strat-huo-ji","hist-wei-zheng","hist-yan-zhenqing","chen-dao","strat-shengdong-jixi","hist-lin-zexu","hist-sima-guang","hist-lin-zexu","cheng-yu","liu-xie","hist-fan-zhongyan","hist-hai-rui","strat-huo-ji","hist-wei-zheng","cheng-pu"]}]},
  },
  {
    id: 'dp-09',
    heroes: ["hist-confucius","sima-yi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1597490985,"players":[{"heroHp":29,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"chen-dao"},{"defId":"hist-fan-zhongyan"}],"hand":["hist-lin-zexu","eq-mingguang-kai","strat-huo-ji","hist-hai-rui"],"deck":["eq-mingguang-kai","hist-wei-zheng","cheng-pu","wen-chou","zhou-tai","hist-yan-zhenqing","zhou-tai","strat-huo-ji","hist-wang-shouren","hist-confucius","hist-sima-guang","eq-teng-jia","hist-yan-zhenqing","hist-wei-zheng","hist-hai-rui","chen-dao"]},{"heroHp":4,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"token-si-shi"},{"defId":"zhou-tai","exhausted":true}],"hand":["sima-shi","zhuge-ke","cao-pi","wang-ping"],"deck":["strat-shengdong-jixi","strat-huo-ji","zhou-tai","chen-dao","zhuge-ke","zhou-yu","hist-yang-su","cheng-pu","wang-ping","han-fu","hist-you-yu","eq-mingguang-kai","eq-teng-jia","hist-gao-jianli","hist-gao-jianli","strat-huo-ji","sima-yi"]}]},
  },
  {
    id: 'dp-10',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":1511360938,"players":[{"heroHp":29,"heroMaxHp":30,"armor":0,"mana":8,"board":[{"defId":"fei-yi","damage":5,"enchants":[{"attack":1,"health":1}]},{"defId":"liu-bei","enchants":[{"attack":1,"health":1}]},{"defId":"ma-liang","damage":3}],"hand":["eq-teng-jia","eq-mingguang-kai","strat-huo-ji","strat-shengdong-jixi","chen-dao"],"deck":["wang-ping","cheng-pu","jiang-wan","fei-yi","hist-wen-tianxiang","hist-xiao-he","deng-zhi","cui-yan","strat-huo-ji","chen-dao","zhang-fei","hist-xie-xuan","eq-mingguang-kai","wei-yan","deng-zhi","liu-qi","zhang-fei","eq-teng-jia","wang-ping"]},{"heroHp":10,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"xu-chu","exhausted":true}],"hand":["wang-ping","eq-teng-jia","hist-shang-yang","eq-mingguang-kai","strat-huo-ji","cao-lin","eq-teng-jia"],"deck":["hist-fan-kuai","cao-ang","strat-shengdong-jixi","li-dian","wang-ping","hist-zhou-yafu","cao-rui","wang-lang","cao-rui","xu-chu","mao-jie","eq-mingguang-kai","deng-ai","cao-ang","wang-lang","zhang-liao","hist-fan-kuai","strat-shengdong-jixi","hist-tian-dan"]}]},
  },
  {
    id: 'dp-11',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":830512096,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"fei-yi"},{"defId":"hist-wen-tianxiang","damage":4},{"defId":"wang-ping"}],"hand":["ma-liang","eq-teng-jia","fei-yi"],"deck":["cui-yan","deng-zhi","zhang-fei","zhang-fei","strat-huo-ji","wang-ping","ma-liang","eq-mingguang-kai","chen-dao","hist-xiao-he","jiang-wan","eq-mingguang-kai","strat-shengdong-jixi","strat-huo-ji","eq-teng-jia"]},{"heroHp":8,"heroMaxHp":30,"armor":0,"mana":3,"board":[{"defId":"cao-ang","damage":4,"enchants":[{"attack":0,"health":3,"keywords":["guard"]}],"attacksUsed":1},{"defId":"wang-lang","exhausted":true}],"hand":[],"deck":["hist-zhou-yafu","li-dian","cao-lin","mao-jie","xu-chu","xu-chu","hist-fan-kuai","li-dian","deng-ai","eq-teng-jia","wang-ping","hist-tian-dan","zhang-liao","wang-lang","wang-ping"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-12',
    heroes: ["sun-quan","sima-yi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":2047522524,"players":[{"heroHp":15,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"shi-xie"},{"defId":"hist-wang-shichong"}],"hand":["eq-teng-jia","strat-huo-ji","eq-mingguang-kai","eq-teng-jia","strat-huo-ji"],"deck":["zhou-tai","eq-mingguang-kai","ma-teng","strat-shengdong-jixi","zhu-ran","cheng-pu","man-chong","wang-ping","lu-fan","strat-shengdong-jixi","shi-xie"]},{"heroHp":6,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"token-baimao-bing","damage":5,"enchants":[{"attack":0,"health":4,"keywords":["guard"]}],"attacksUsed":1},{"defId":"zhuge-ke","damage":2,"attacksUsed":1},{"defId":"zhuge-ke","exhausted":true}],"hand":[],"deck":["eq-teng-jia","strat-huo-ji","fa-zheng","wang-ping","strat-shengdong-jixi","hist-you-yu","han-fu","eq-mingguang-kai","sima-shi","sima-shi","zhou-tai","cao-pi","wang-ping","chen-dao","zhou-yu"]}]},
  },
  {
    id: 'dp-13',
    heroes: ["sun-quan","sima-yi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1604926744,"players":[{"heroHp":16,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"lu-fan"},{"defId":"lu-fan"},{"defId":"hu-zong"}],"hand":["cheng-pu"],"deck":["ma-teng","wang-ping","man-chong","strat-shengdong-jixi","hu-zong","zhang-bu","shi-xie","shi-xie","hist-li-yu","zhou-tai"]},{"heroHp":1,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"token-si-shi","attacksUsed":1},{"defId":"zhou-tai","exhausted":true}],"hand":[],"deck":["cao-pi","strat-shengdong-jixi","hist-yang-su","cheng-pu","sima-shi","eq-teng-jia","zhou-tai","wang-ping","wang-ping","fa-zheng","cheng-pu"]}]},
  },
  {
    id: 'dp-14',
    heroes: ["sun-quan","sima-yi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":243605167,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-wang-shichong","damage":4},{"defId":"zhu-ran"}],"hand":["zhang-bu","hu-zong","strat-huo-ji"],"deck":["sun-ce","strat-shengdong-jixi","cheng-pu","shi-xie","man-chong","ma-teng","eq-mingguang-kai","sun-quan","strat-shengdong-jixi","eq-mingguang-kai","lu-fan","man-chong"]},{"heroHp":7,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"cao-pi","damage":4,"enchants":[{"attack":0,"health":3,"keywords":["guard"]}],"attacksUsed":1},{"defId":"sima-yi","damage":2,"exhausted":true},{"defId":"hist-gao-jianli","exhausted":true}],"hand":["eq-mingguang-kai","chen-dao"],"deck":["hist-yang-su","wang-ping","sima-shi","eq-mingguang-kai","zhou-yu","fa-zheng","strat-huo-ji","eq-teng-jia","han-fu","zhuge-ke","wang-ping","hist-you-yu"]}]},
  },
  {
    id: 'dp-15',
    heroes: ["cao-cao","liu-bei"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-946385179,"players":[{"heroHp":20,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"li-dian","damage":4},{"defId":"wang-lang"}],"hand":["wang-ping"],"deck":["hist-zhou-yafu","deng-ai","xu-chu","hist-shang-yang","eq-teng-jia","cao-rui","zhang-liao","eq-teng-jia","cao-ang","hist-fan-kuai","hist-tian-dan","xu-chu","mao-jie","cao-ang","strat-huo-ji"]},{"heroHp":2,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"deng-zhi","damage":5,"enchants":[{"attack":1,"health":2}],"attacksUsed":1},{"defId":"jiang-wan","damage":4,"enchants":[{"attack":0,"health":3,"keywords":["guard"]}],"attacksUsed":1},{"defId":"cui-yan","damage":7,"enchants":[{"attack":0,"health":4,"keywords":["guard"]}],"attacksUsed":1}],"hand":[],"deck":["cheng-pu","zhang-fei","eq-teng-jia","eq-mingguang-kai","zhang-fei","hist-xiao-he","fei-yi","hist-xie-xuan","fei-yi","liu-bei","wang-ping","wang-ping","liu-qi","strat-shengdong-jixi","strat-huo-ji","hist-wen-tianxiang"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-16',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1020533311,"players":[{"heroHp":25,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-xie-xuan"},{"defId":"liu-bei","enchants":[{"attack":1,"health":1}]}],"hand":["eq-mingguang-kai","wang-ping","deng-zhi","strat-huo-ji","deng-zhi"],"deck":["zhang-fei","fei-yi","ma-liang","ma-liang","cheng-pu","eq-mingguang-kai","cui-yan","jiang-wan","strat-shengdong-jixi","wang-ping","hist-xiao-he","chen-dao","eq-teng-jia","eq-teng-jia","fei-yi"]},{"heroHp":11,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"hist-fan-kuai","damage":5,"attacksUsed":1},{"defId":"wang-lang","attacksUsed":1},{"defId":"li-dian","exhausted":true},{"defId":"cao-ang","exhausted":true}],"hand":["eq-mingguang-kai","eq-mingguang-kai","cao-lin","eq-teng-jia"],"deck":["hist-zhou-yafu","wang-ping","hist-shang-yang","cao-rui","cao-ang","zhang-liao","wang-ping","wang-lang","strat-huo-ji","strat-shengdong-jixi","strat-huo-ji","eq-teng-jia","deng-ai","cao-rui","hist-tian-dan","xu-chu"]}]},
  },
  {
    id: 'dp-17',
    heroes: ["sun-quan","hist-laozi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-385765229,"players":[{"heroHp":27,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"token-xiangyong"},{"defId":"lu-fan","frozen":true},{"defId":"hist-li-yu"}],"hand":["zhang-bu","eq-teng-jia","hu-zong","strat-huo-ji","eq-teng-jia"],"deck":["shi-xie","eq-mingguang-kai","zhou-tai","strat-shengdong-jixi","cheng-pu","cheng-pu","strat-shengdong-jixi","zhu-ran","strat-huo-ji","eq-mingguang-kai","sun-ce","zhou-tai","ma-teng"]},{"heroHp":4,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"yu-jin","attacksUsed":1},{"defId":"wang-ping","exhausted":true},{"defId":"shi-tao","exhausted":true}],"hand":["eq-mingguang-kai","eq-teng-jia","eq-teng-jia","eq-mingguang-kai","cheng-pu"],"deck":["ruan-xian","strat-shengdong-jixi","hist-laozi","hist-xu-xiake","hist-zhang-heng","strat-shengdong-jixi","wen-chou","guan-xing","chen-dao","hist-tang-yin","ji-kang","ji-kang","wang-ping"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-18',
    heroes: ["liu-bei","hist-laozi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1646189970,"players":[{"heroHp":20,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"fei-yi","enchants":[{"attack":0,"health":4,"keywords":["guard"]}]},{"defId":"token-xiangyong","damage":2,"enchants":[{"attack":0,"health":4,"keywords":["guard"]}]},{"defId":"token-xiangyong"}],"hand":["strat-huo-ji","fei-yi"],"deck":["wei-yan","eq-teng-jia","cheng-pu","jiang-wan","liu-qi","hist-wen-tianxiang","strat-huo-ji","hist-xiao-he","chen-dao","chen-dao","zhang-fei","ma-liang","zhang-fei","deng-zhi","eq-teng-jia","ma-liang"]},{"heroHp":5,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"cheng-pu","damage":4,"attacksUsed":1},{"defId":"yu-jin","exhausted":true},{"defId":"hist-zhang-heng","exhausted":true}],"hand":["shi-tao","ji-kang","ruan-xian","guan-xing"],"deck":["eq-mingguang-kai","wang-ping","eq-teng-jia","guan-xing","hist-xu-xiake","hist-laozi","hist-tang-yin","eq-mingguang-kai","strat-huo-ji","chen-dao","wang-ping","shi-tao","hist-kou-qianzhi","wen-chou","eq-teng-jia"]}]},
  },
  {
    id: 'dp-19',
    heroes: ["sima-yi","sun-quan"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":2038096914,"players":[{"heroHp":25,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"zhou-yu"},{"defId":"sima-shi","damage":3},{"defId":"token-si-shi"},{"defId":"cao-pi","enchants":[{"attack":0,"health":0,"keywords":["divineShield"]}]},{"defId":"token-si-shi"}],"hand":["hist-gao-jianli","wang-ping"],"deck":["eq-mingguang-kai","zhou-tai","sima-yi","han-fu","hist-yang-su","cheng-pu","zhuge-ke","sima-shi","eq-mingguang-kai","hist-you-yu","strat-huo-ji"]},{"heroHp":6,"heroMaxHp":30,"armor":0,"mana":5,"board":[{"defId":"token-shui-zhai","exhausted":true}],"hand":[],"deck":["sun-quan","sun-ce","hist-wang-shichong","shi-xie","wang-ping","cheng-pu","man-chong","zhou-tai","lu-fan","eq-mingguang-kai","wang-ping","shi-xie"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-20',
    heroes: ["hist-laozi","liu-bei"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-989219340,"players":[{"heroHp":18,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"yu-jin","damage":10,"enchants":[{"attack":0,"health":4,"keywords":["guard"]},{"attack":0,"health":3,"keywords":["guard"]}]},{"defId":"hist-tang-yin","damage":2,"enchants":[{"attack":0,"health":3,"keywords":["guard"]}]},{"defId":"wang-ping"},{"defId":"hist-zhang-heng"}],"hand":["shi-tao"],"deck":["chen-dao","wen-chou","guan-xing","eq-mingguang-kai","cheng-pu","ji-kang"]},{"heroHp":1,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"chen-dao","enchants":[{"attack":1,"health":2}],"exhausted":true},{"defId":"token-baimao-bing","exhausted":true}],"hand":[],"deck":["strat-shengdong-jixi","zhang-fei","hist-xiao-he","cheng-pu","deng-zhi","chen-dao","strat-shengdong-jixi","hist-xie-xuan","eq-mingguang-kai"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-21',
    heroes: ["sun-quan","sima-yi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":845907259,"players":[{"heroHp":25,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"shi-xie","damage":4},{"defId":"cheng-pu","damage":4},{"defId":"lu-fan","damage":2}],"hand":["eq-teng-jia","ma-teng"],"deck":["shi-xie","strat-shengdong-jixi","eq-mingguang-kai","zhou-tai","man-chong","sun-quan","strat-huo-ji","zhou-tai","man-chong","strat-huo-ji","cheng-pu","hist-wang-shichong","hu-zong","lu-fan"]},{"heroHp":2,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"sima-shi","damage":5,"enchants":[{"attack":0,"health":3,"keywords":["guard"]}],"attacksUsed":1},{"defId":"cheng-pu","exhausted":true},{"defId":"zhuge-ke","exhausted":true}],"hand":["zhou-tai"],"deck":["zhou-tai","strat-huo-ji","strat-shengdong-jixi","hist-gao-jianli","hist-gao-jianli","han-fu","fa-zheng","eq-mingguang-kai","hist-yang-su","hist-you-yu","wang-ping","wang-ping","sima-shi","sima-yi","zhuge-ke"]}]},
  },
  {
    id: 'dp-22',
    heroes: ["cao-cao","hist-confucius"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":2116281255,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":8,"board":[{"defId":"cao-rui","damage":4},{"defId":"wang-ping"},{"defId":"cao-ang"}],"hand":["eq-teng-jia","strat-shengdong-jixi","strat-shengdong-jixi","strat-huo-ji","li-dian"],"deck":["eq-mingguang-kai","hist-fan-kuai","cao-rui","hist-fan-kuai","li-dian","wang-ping","wang-lang","mao-jie","xu-chu","hist-shang-yang","eq-teng-jia","wang-lang","hist-zhou-yafu","deng-ai","cao-ang","hist-zhou-yafu","hist-tian-dan","xu-chu"]},{"heroHp":4,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"token-tie-qi"},{"defId":"chen-dao","exhausted":true},{"defId":"token-baimao-bing","exhausted":true}],"hand":["zhou-tai","zhou-tai","cheng-pu","hist-lin-zexu","hist-sima-guang","eq-mingguang-kai","hist-sima-guang","hist-hai-rui"],"deck":["eq-mingguang-kai","strat-huo-ji","hist-lin-zexu","hist-confucius","wen-chou","hist-wei-zheng","hist-wang-shouren","hist-fan-zhongyan","strat-shengdong-jixi","strat-huo-ji","liu-xie","cheng-yu","eq-teng-jia","cheng-pu","hist-wei-zheng","hist-hai-rui"]}]},
  },
  {
    id: 'dp-23',
    heroes: ["liu-bei","hist-laozi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":223078283,"players":[{"heroHp":7,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"fei-yi","enchants":[{"attack":1,"health":2}]}],"hand":["hist-xie-xuan"],"deck":["jiang-wan","wang-ping","eq-teng-jia","liu-bei","eq-mingguang-kai","liu-qi","cheng-pu","eq-teng-jia","hist-wen-tianxiang","wang-ping","ma-liang","hist-xiao-he"]},{"heroHp":6,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"token-xiangyong","attacksUsed":1},{"defId":"hist-tang-yin","damage":4,"attacksUsed":1},{"defId":"shi-tao","attacksUsed":1},{"defId":"yu-jin","exhausted":true},{"defId":"hist-zhang-heng","exhausted":true}],"hand":["eq-teng-jia","eq-mingguang-kai","eq-teng-jia"],"deck":["ruan-xian","guan-xing","eq-mingguang-kai","shi-tao","hist-kou-qianzhi","hist-laozi","wang-ping","hist-xu-xiake","strat-shengdong-jixi"]}]},
  },
  {
    id: 'dp-24',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-333400729,"players":[{"heroHp":17,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"fei-yi","enchants":[{"attack":0,"health":3,"keywords":["guard"]}]},{"defId":"hist-wen-tianxiang"},{"defId":"zhang-fei"}],"hand":["strat-shengdong-jixi","ma-liang","eq-teng-jia","liu-qi"],"deck":["hist-xie-xuan","wang-ping","ma-liang","liu-bei","jiang-wan","cui-yan","eq-mingguang-kai","hist-xiao-he","deng-zhi","chen-dao","strat-shengdong-jixi","strat-huo-ji","zhang-fei","cheng-pu","wang-ping","eq-mingguang-kai","fei-yi"]},{"heroHp":3,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"hist-tian-dan"},{"defId":"wang-lang","enchants":[{"attack":0,"health":4,"keywords":["guard"]}],"exhausted":true},{"defId":"cao-lin","exhausted":true}],"hand":["eq-teng-jia","eq-mingguang-kai","eq-teng-jia"],"deck":["strat-huo-ji","mao-jie","deng-ai","hist-fan-kuai","wang-lang","cao-rui","hist-fan-kuai","xu-chu","hist-shang-yang","strat-shengdong-jixi","wang-ping","cao-rui","li-dian","xu-chu","wang-ping","cao-ang","hist-zhou-yafu"]}]},
  },
]
