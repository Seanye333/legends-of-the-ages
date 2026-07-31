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
    scenario: {"activePlayer":0,"rng":1556603866,"players":[{"heroHp":20,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"liu-bei","damage":1,"enchants":[{"attack":1,"health":1}]}],"hand":["fei-yi"],"deck":["fei-yi","chen-dao","wang-ping","eq-teng-jia","ma-liang","strat-shengdong-jixi","zhang-fei","strat-shengdong-jixi","liu-qi","eq-teng-jia","cheng-pu","cui-yan","hist-wen-tianxiang"]},{"heroHp":7,"heroMaxHp":30,"armor":0,"mana":4,"board":[{"defId":"cao-ang","exhausted":true}],"hand":[],"deck":["strat-huo-ji","hist-tian-dan","deng-ai","eq-mingguang-kai","wang-lang","zhang-liao","hist-fan-kuai","cao-ang","xu-chu","mao-jie","strat-shengdong-jixi","eq-teng-jia","hist-shang-yang"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-02',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":833653966,"players":[{"heroHp":16,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-xiao-he","damage":10,"enchants":[{"attack":1,"health":2},{"attack":0,"health":3,"keywords":["guard"]},{"attack":1,"health":2},{"attack":1,"health":2}]},{"defId":"fei-yi","damage":5,"enchants":[{"attack":1,"health":2}]}],"hand":["hist-xie-xuan"],"deck":["chen-dao","wang-ping","cui-yan","fei-yi","liu-bei","liu-qi","hist-wen-tianxiang","eq-mingguang-kai","ma-liang","strat-shengdong-jixi","chen-dao"]},{"heroHp":2,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"hist-fan-kuai","exhausted":true}],"hand":[],"deck":["eq-teng-jia","xu-chu","xu-chu","wang-lang","li-dian","cao-lin","li-dian","eq-teng-jia","cao-rui","deng-ai","mao-jie"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-03',
    heroes: ["cao-cao","liu-bei"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":835539088,"players":[{"heroHp":19,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-fan-kuai","damage":1,"enchants":[{"attack":0,"health":4,"keywords":["guard"]}]}],"hand":["zhang-liao"],"deck":["hist-zhou-yafu","cao-rui","strat-huo-ji","mao-jie","strat-shengdong-jixi","hist-zhou-yafu","eq-mingguang-kai","xu-chu","wang-ping","hist-fan-kuai","li-dian","wang-ping"]},{"heroHp":16,"heroMaxHp":30,"armor":0,"mana":4,"board":[{"defId":"liu-bei","enchants":[{"attack":1,"health":1}]},{"defId":"hist-xiao-he","enchants":[{"attack":1,"health":2}],"exhausted":true}],"hand":[],"deck":["deng-zhi","chen-dao","strat-huo-ji","ma-liang","fei-yi","fei-yi","jiang-wan","chen-dao","hist-wen-tianxiang","strat-huo-ji","strat-shengdong-jixi","wang-ping","deng-zhi"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-04',
    heroes: ["cao-cao","liu-bei"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-933189325,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"wang-lang","enchants":[{"attack":0,"health":3,"keywords":["guard"]}]},{"defId":"wang-lang"}],"hand":["hist-zhou-yafu"],"deck":["hist-shang-yang","hist-fan-kuai","li-dian","strat-shengdong-jixi","hist-zhou-yafu","hist-tian-dan","strat-shengdong-jixi","cao-ang","eq-mingguang-kai","li-dian","eq-teng-jia","deng-ai","cao-ang"]},{"heroHp":7,"heroMaxHp":30,"armor":0,"mana":5,"board":[{"defId":"ma-liang","damage":4,"enchants":[{"attack":1,"health":2},{"attack":1,"health":2}],"attacksUsed":1}],"hand":[],"deck":["deng-zhi","zhang-fei","ma-liang","zhang-fei","deng-zhi","chen-dao","wang-ping","liu-bei","eq-mingguang-kai","wei-yan","hist-xie-xuan","cheng-pu","strat-shengdong-jixi"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-05',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1653521000,"players":[{"heroHp":18,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-sima-guang","damage":3,"enchants":[{"attack":0,"health":3,"keywords":["guard"]}]},{"defId":"hist-sima-guang"},{"defId":"cheng-pu"}],"hand":["zhou-tai","zhou-tai","chen-dao"],"deck":["cheng-pu","hist-yan-zhenqing","hist-hai-rui","strat-huo-ji","eq-mingguang-kai","hist-yan-zhenqing"]},{"heroHp":4,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"hist-fan-kuai","damage":1,"exhausted":true}],"hand":[],"deck":["li-dian","xu-chu","xu-chu","cao-rui","zhang-liao","strat-huo-ji","hist-tian-dan","wang-lang","hist-zhou-yafu","eq-teng-jia","wang-ping","hist-zhou-yafu"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-06',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-379900405,"players":[{"heroHp":20,"heroMaxHp":30,"armor":0,"mana":9,"board":[{"defId":"liu-bei","damage":5,"enchants":[{"attack":1,"health":1},{"attack":0,"health":3,"keywords":["guard"]}]},{"defId":"hist-xie-xuan","damage":3},{"defId":"wei-yan"}],"hand":["eq-mingguang-kai","eq-mingguang-kai","deng-zhi","cui-yan"],"deck":["zhang-fei","strat-shengdong-jixi","zhang-fei","hist-xiao-he","strat-huo-ji","ma-liang","cui-yan","strat-huo-ji","hist-wen-tianxiang","chen-dao","deng-zhi","jiang-wan","cheng-pu","fei-yi","strat-shengdong-jixi","chen-dao","wang-ping","wang-ping"]},{"heroHp":2,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"hist-fan-kuai","enchants":[{"attack":0,"health":3,"keywords":["guard"]}],"exhausted":true}],"hand":["wang-ping","wang-ping","hist-shang-yang","deng-ai"],"deck":["eq-mingguang-kai","li-dian","hist-zhou-yafu","eq-mingguang-kai","wang-lang","hist-fan-kuai","strat-huo-ji","cao-ang","strat-shengdong-jixi","hist-tian-dan","eq-teng-jia","strat-shengdong-jixi","mao-jie","zhang-liao","xu-chu","cao-rui","cao-ang","cao-rui"]}]},
  },
  {
    id: 'dp-07',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1598852462,"players":[{"heroHp":26,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-sima-guang","damage":2},{"defId":"token-tie-qi"},{"defId":"zhou-tai"}],"hand":["hist-lin-zexu","hist-confucius","eq-mingguang-kai","strat-huo-ji","hist-yan-zhenqing"],"deck":["liu-xie","eq-mingguang-kai","zhou-tai","cheng-pu","hist-wei-zheng","hist-hai-rui","eq-teng-jia","wen-chou","hist-wang-shouren","hist-wei-zheng","chen-dao","eq-teng-jia","hist-sima-guang","strat-shengdong-jixi"]},{"heroHp":3,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"li-dian","enchants":[{"attack":0,"health":3,"keywords":["guard"]}],"exhausted":true}],"hand":["wang-lang","cao-rui"],"deck":["hist-tian-dan","zhang-liao","wang-lang","hist-fan-kuai","hist-fan-kuai","hist-zhou-yafu","li-dian","cao-ang","eq-mingguang-kai","eq-mingguang-kai","mao-jie","cao-rui","strat-shengdong-jixi","wang-ping","eq-teng-jia","wang-ping"]}]},
  },
  {
    id: 'dp-08',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-966388418,"players":[{"heroHp":20,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"token-tie-qi"},{"defId":"hist-wei-zheng"}],"hand":["strat-shengdong-jixi","cheng-yu","zhou-tai"],"deck":["chen-dao","strat-huo-ji","hist-lin-zexu","hist-lin-zexu","eq-mingguang-kai","hist-wang-shouren","hist-confucius","hist-sima-guang","wen-chou","hist-yan-zhenqing","eq-teng-jia","eq-mingguang-kai","strat-shengdong-jixi","hist-wei-zheng","cheng-pu"]},{"heroHp":1,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"wang-ping","exhausted":true},{"defId":"hist-shang-yang","exhausted":true}],"hand":["eq-teng-jia","wang-lang","strat-shengdong-jixi"],"deck":["cao-lin","eq-teng-jia","hist-fan-kuai","cao-rui","mao-jie","cao-ang","eq-mingguang-kai","cao-rui","eq-mingguang-kai","hist-zhou-yafu","wang-ping","li-dian","hist-tian-dan","hist-zhou-yafu","strat-huo-ji","xu-chu"]}]},
  },
  {
    id: 'dp-09',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":1511360938,"players":[{"heroHp":29,"heroMaxHp":30,"armor":0,"mana":8,"board":[{"defId":"fei-yi","damage":5,"enchants":[{"attack":1,"health":1}]},{"defId":"liu-bei","enchants":[{"attack":1,"health":1}]},{"defId":"ma-liang","damage":3}],"hand":["eq-teng-jia","eq-mingguang-kai","strat-huo-ji","strat-shengdong-jixi","chen-dao"],"deck":["wang-ping","cheng-pu","jiang-wan","fei-yi","hist-wen-tianxiang","hist-xiao-he","deng-zhi","cui-yan","strat-huo-ji","chen-dao","zhang-fei","hist-xie-xuan","eq-mingguang-kai","wei-yan","deng-zhi","liu-qi","zhang-fei","eq-teng-jia","wang-ping"]},{"heroHp":9,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"xu-chu","exhausted":true}],"hand":["wang-ping","eq-teng-jia","hist-shang-yang","eq-mingguang-kai","strat-huo-ji","cao-lin","eq-teng-jia"],"deck":["hist-fan-kuai","cao-ang","strat-shengdong-jixi","li-dian","wang-ping","hist-zhou-yafu","cao-rui","wang-lang","cao-rui","xu-chu","mao-jie","eq-mingguang-kai","deng-ai","cao-ang","wang-lang","zhang-liao","hist-fan-kuai","strat-shengdong-jixi","hist-tian-dan"]}]},
  },
  {
    id: 'dp-10',
    heroes: ["hist-confucius","sima-yi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":897329198,"players":[{"heroHp":27,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"zhou-tai","damage":5,"silenced":true},{"defId":"cheng-pu"}],"hand":["strat-shengdong-jixi","zhou-tai","hist-wei-zheng","hist-hai-rui"],"deck":["eq-teng-jia","liu-xie","hist-wang-shouren","strat-huo-ji","hist-confucius","eq-teng-jia","chen-dao","strat-huo-ji","hist-wei-zheng","hist-lin-zexu","hist-sima-guang","hist-sima-guang","hist-yan-zhenqing","cheng-pu","eq-mingguang-kai","wen-chou"]},{"heroHp":6,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"hist-gao-jianli","damage":4,"enchants":[{"attack":0,"health":4,"keywords":["guard"]}],"attacksUsed":1},{"defId":"hist-gao-jianli","exhausted":true}],"hand":["eq-mingguang-kai","eq-teng-jia"],"deck":["hist-you-yu","eq-teng-jia","zhou-yu","hist-yang-su","wang-ping","zhuge-ke","zhou-tai","chen-dao","sima-yi","chen-dao","fa-zheng","sima-shi","han-fu","zhou-tai","cheng-pu","wang-ping","strat-shengdong-jixi"]}]},
  },
  {
    id: 'dp-11',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":269159043,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-lin-zexu","damage":4},{"defId":"hist-confucius"},{"defId":"liu-xie"}],"hand":["strat-huo-ji","zhou-tai","hist-yan-zhenqing"],"deck":["hist-lin-zexu","cheng-pu","chen-dao","hist-sima-guang","cheng-yu","eq-teng-jia","hist-wei-zheng","hist-hai-rui","eq-mingguang-kai","hist-wang-shouren","strat-shengdong-jixi"]},{"heroHp":3,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"xu-chu","exhausted":true}],"hand":[],"deck":["wang-ping","hist-fan-kuai","eq-mingguang-kai","li-dian","hist-shang-yang","strat-huo-ji","wang-lang","mao-jie","wang-ping","deng-ai","cao-ang","hist-zhou-yafu","strat-shengdong-jixi","hist-tian-dan"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-12',
    heroes: ["cao-cao","liu-bei"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-923763715,"players":[{"heroHp":10,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"mao-jie","damage":3,"enchants":[{"attack":0,"health":3,"keywords":["guard"]}]},{"defId":"li-dian","enchants":[{"attack":0,"health":3,"keywords":["guard"]}]},{"defId":"hist-fan-kuai"}],"hand":["cao-ang"],"deck":["wang-ping","strat-shengdong-jixi","zhang-liao","strat-shengdong-jixi","cao-lin","deng-ai","cao-rui","hist-zhou-yafu","cao-ang","li-dian","wang-ping","eq-mingguang-kai"]},{"heroHp":2,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"ma-liang","enchants":[{"attack":0,"health":3,"keywords":["guard"]},{"attack":1,"health":2}],"exhausted":true}],"hand":[],"deck":["zhang-fei","fei-yi","fei-yi","strat-shengdong-jixi","strat-huo-ji","eq-mingguang-kai","jiang-wan","chen-dao","hist-xie-xuan","cheng-pu","hist-xiao-he","hist-wen-tianxiang","chen-dao"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-13',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-898628755,"players":[{"heroHp":23,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"fei-yi","damage":4,"enchants":[{"attack":0,"health":4,"keywords":["guard"]},{"attack":1,"health":2}]},{"defId":"deng-zhi"}],"hand":["strat-huo-ji","ma-liang"],"deck":["cheng-pu","wei-yan","eq-mingguang-kai","wang-ping","wang-ping","zhang-fei","jiang-wan","cui-yan","ma-liang","eq-teng-jia","zhang-fei","fei-yi","chen-dao","liu-qi"]},{"heroHp":4,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"mao-jie","enchants":[{"attack":0,"health":4,"keywords":["guard"]}],"exhausted":true},{"defId":"cao-lin","exhausted":true}],"hand":[],"deck":["deng-ai","hist-zhou-yafu","hist-fan-kuai","cao-ang","hist-shang-yang","eq-teng-jia","wang-ping","hist-fan-kuai","xu-chu","wang-lang","eq-teng-jia","xu-chu","li-dian","hist-tian-dan","wang-lang"]}]},
  },
  {
    id: 'dp-14',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1010479327,"players":[{"heroHp":19,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"jiang-wan","damage":6,"enchants":[{"attack":0,"health":3,"keywords":["guard"]}]},{"defId":"fei-yi","enchants":[{"attack":0,"health":4,"keywords":["guard"]}]},{"defId":"wei-yan"}],"hand":["eq-teng-jia","wang-ping"],"deck":["eq-mingguang-kai","strat-shengdong-jixi","zhang-fei","wang-ping","chen-dao","fei-yi","liu-bei","strat-huo-ji","hist-xiao-he","hist-wen-tianxiang","liu-qi","ma-liang","deng-zhi","hist-xie-xuan","chen-dao","cui-yan"]},{"heroHp":3,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"hist-fan-kuai","exhausted":true},{"defId":"cao-rui","exhausted":true}],"hand":["cao-ang","hist-shang-yang","li-dian","eq-teng-jia"],"deck":["strat-huo-ji","deng-ai","wang-ping","hist-tian-dan","wang-lang","strat-shengdong-jixi","xu-chu","strat-huo-ji","eq-mingguang-kai","cao-rui","wang-lang","eq-mingguang-kai","hist-zhou-yafu","strat-shengdong-jixi","mao-jie","li-dian"]}]},
  },
  {
    id: 'dp-15',
    heroes: ["sun-quan","hist-laozi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1640010959,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hu-zong","damage":6,"enchants":[{"attack":0,"health":3,"keywords":["guard"]}]},{"defId":"token-xiangyong"},{"defId":"sun-ce","damage":4},{"defId":"zhou-tai","frozen":true}],"hand":["eq-mingguang-kai"],"deck":["zhang-bu","strat-shengdong-jixi","hist-li-yu","eq-teng-jia","sun-quan","hist-wang-shichong","cheng-pu","man-chong","shi-xie","strat-shengdong-jixi","shi-xie"]},{"heroHp":1,"heroMaxHp":30,"armor":0,"mana":3,"board":[{"defId":"yu-jin","damage":4,"enchants":[{"attack":0,"health":4,"keywords":["guard"]},{"attack":0,"health":3,"keywords":["guard"]}],"attacksUsed":1}],"hand":[],"deck":["shi-tao","hist-tang-yin","wen-chou","hist-zhang-heng","hist-laozi","hist-zhang-heng","hist-kou-qianzhi","chen-dao"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-16',
    heroes: ["liu-bei","hist-laozi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":823495253,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"wei-yan","damage":8,"enchants":[{"attack":1,"health":1},{"attack":0,"health":4,"keywords":["guard"]}]},{"defId":"liu-bei","enchants":[{"attack":1,"health":1}]}],"hand":["strat-huo-ji","strat-shengdong-jixi","fei-yi","ma-liang","eq-teng-jia"],"deck":["fei-yi","liu-qi","eq-mingguang-kai","deng-zhi","cheng-pu","wang-ping","cui-yan","zhang-fei","ma-liang","chen-dao","wang-ping","cui-yan","strat-huo-ji","zhang-fei","hist-xie-xuan","jiang-wan"]},{"heroHp":7,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"guan-xing","attacksUsed":1},{"defId":"hist-kou-qianzhi","exhausted":true},{"defId":"ji-kang","exhausted":true}],"hand":["eq-teng-jia","strat-huo-ji","guan-xing","ruan-xian","strat-huo-ji"],"deck":["hist-laozi","hist-kou-qianzhi","cheng-pu","shi-tao","eq-teng-jia","wang-ping","eq-mingguang-kai","eq-mingguang-kai","wang-ping","wen-chou","hist-tang-yin","shi-tao","yu-jin","chen-dao","hist-xu-xiake","chen-dao"]}]},
  },
  {
    id: 'dp-17',
    heroes: ["sima-yi","hist-confucius"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":202027754,"players":[{"heroHp":19,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"cao-pi","damage":2},{"defId":"wang-ping","damage":4},{"defId":"wang-ping"}],"hand":["sima-shi","hist-you-yu"],"deck":["strat-shengdong-jixi","eq-mingguang-kai","cheng-pu","eq-teng-jia","zhuge-ke","zhou-tai","strat-huo-ji","eq-mingguang-kai","strat-shengdong-jixi","eq-teng-jia","hist-gao-jianli","fa-zheng","zhou-tai"]},{"heroHp":8,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"hist-lin-zexu","damage":4,"enchants":[{"attack":0,"health":4,"keywords":["guard"]}],"attacksUsed":1},{"defId":"hist-hai-rui","exhausted":true}],"hand":[],"deck":["eq-teng-jia","wen-chou","hist-sima-guang","hist-yan-zhenqing","liu-xie","cheng-pu","eq-mingguang-kai","hist-fan-zhongyan","hist-sima-guang","zhou-tai"]}]},
  },
  {
    id: 'dp-18',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-334552748,"players":[{"heroHp":18,"heroMaxHp":30,"armor":0,"mana":8,"board":[{"defId":"hist-hai-rui","damage":3},{"defId":"hist-fan-zhongyan","damage":3},{"defId":"token-tie-qi"}],"hand":["hist-wei-zheng","strat-huo-ji","cheng-pu","zhou-tai","eq-teng-jia"],"deck":["chen-dao","strat-huo-ji","hist-lin-zexu","hist-lin-zexu","eq-mingguang-kai","hist-wang-shouren","hist-confucius","hist-sima-guang","wen-chou","hist-yan-zhenqing","eq-teng-jia","eq-mingguang-kai","strat-shengdong-jixi","hist-wei-zheng","cheng-pu","zhou-tai","cheng-yu","strat-shengdong-jixi","hist-hai-rui"]},{"heroHp":3,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"cao-ang","damage":4,"attacksUsed":1},{"defId":"xu-chu","exhausted":true}],"hand":["hist-shang-yang","eq-teng-jia","wang-ping","strat-shengdong-jixi","deng-ai","hist-fan-kuai"],"deck":["cao-lin","eq-teng-jia","hist-fan-kuai","cao-rui","mao-jie","cao-ang","eq-mingguang-kai","cao-rui","eq-mingguang-kai","hist-zhou-yafu","wang-ping","li-dian","hist-tian-dan","hist-zhou-yafu","strat-huo-ji","xu-chu","strat-shengdong-jixi","wang-lang","strat-huo-ji"]}]},
  },
  {
    id: 'dp-19',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":242767335,"players":[{"heroHp":9,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-wei-zheng","damage":7,"enchants":[{"attack":0,"health":4,"keywords":["guard"]}]},{"defId":"token-tie-qi"},{"defId":"hist-confucius"}],"hand":["hist-wang-shouren"],"deck":["zhou-tai","cheng-pu"]},{"heroHp":6,"heroMaxHp":30,"armor":0,"mana":6,"board":[{"defId":"wang-lang","damage":6,"enchants":[{"attack":0,"health":3,"keywords":["guard"]}],"attacksUsed":1},{"defId":"cao-rui","damage":3,"attacksUsed":1}],"hand":[],"deck":["xu-chu","eq-mingguang-kai","hist-zhou-yafu","mao-jie","strat-huo-ji","strat-shengdong-jixi","zhang-liao","cao-ang"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-20',
    heroes: ["hist-confucius","sima-yi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-946804095,"players":[{"heroHp":29,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"token-baimao-bing","damage":1},{"defId":"hist-wei-zheng"},{"defId":"cheng-pu"},{"defId":"hist-hai-rui"}],"hand":["eq-teng-jia","hist-confucius","hist-lin-zexu","hist-sima-guang"],"deck":["hist-sima-guang","eq-mingguang-kai","cheng-yu","hist-yan-zhenqing","liu-xie","wen-chou","zhou-tai","strat-shengdong-jixi","chen-dao","hist-yan-zhenqing","hist-fan-zhongyan","eq-mingguang-kai"]},{"heroHp":6,"heroMaxHp":30,"armor":0,"mana":4,"board":[{"defId":"zhou-tai","damage":2,"exhausted":true}],"hand":["wang-ping","sima-shi"],"deck":["fa-zheng","zhuge-ke","hist-gao-jianli","sima-yi","strat-huo-ji","cheng-pu","strat-shengdong-jixi","chen-dao","hist-yang-su","zhuge-ke","zhou-yu","cheng-pu","eq-mingguang-kai","cao-pi","eq-mingguang-kai"]}]},
  },
  {
    id: 'dp-21',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-916851601,"players":[{"heroHp":26,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"ma-liang","damage":3,"enchants":[{"attack":1,"health":1},{"attack":1,"health":2}]},{"defId":"hist-xiao-he"},{"defId":"jiang-wan"}],"hand":["cui-yan","eq-mingguang-kai","liu-qi"],"deck":["hist-xie-xuan","fei-yi","zhang-fei","deng-zhi","chen-dao","cheng-pu","eq-teng-jia","ma-liang","eq-mingguang-kai","fei-yi","wang-ping","wang-ping","wei-yan","chen-dao","strat-huo-ji"]},{"heroHp":1,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"hist-fan-kuai","exhausted":true},{"defId":"wang-lang","exhausted":true}],"hand":["wang-ping","li-dian","deng-ai","hist-tian-dan"],"deck":["hist-shang-yang","eq-mingguang-kai","cao-ang","cao-ang","xu-chu","strat-huo-ji","mao-jie","wang-ping","cao-rui","strat-shengdong-jixi","eq-mingguang-kai","cao-lin","strat-shengdong-jixi","strat-huo-ji","zhang-liao","cao-rui"]}]},
  },
  {
    id: 'dp-22',
    heroes: ["hist-laozi","sun-quan"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":2010553187,"players":[{"heroHp":21,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"shi-tao","damage":3,"enchants":[{"attack":0,"health":4,"keywords":["guard"]}]},{"defId":"hist-tang-yin","damage":3},{"defId":"wen-chou","damage":3},{"defId":"wang-ping"}],"hand":["eq-mingguang-kai","ruan-xian","hist-xu-xiake","strat-huo-ji"],"deck":["cheng-pu","wang-ping","eq-teng-jia","hist-zhang-heng"]},{"heroHp":6,"heroMaxHp":30,"armor":0,"mana":6,"board":[{"defId":"shi-xie"},{"defId":"token-shui-zhai","exhausted":true}],"hand":[],"deck":["hist-wang-shichong","sun-quan","cheng-pu","hu-zong","strat-huo-ji","lu-fan","sun-ce","wang-ping"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-23',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1020533311,"players":[{"heroHp":25,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-xie-xuan"},{"defId":"liu-bei","enchants":[{"attack":1,"health":1}]}],"hand":["eq-mingguang-kai","wang-ping","deng-zhi","strat-huo-ji","deng-zhi"],"deck":["zhang-fei","fei-yi","ma-liang","ma-liang","cheng-pu","eq-mingguang-kai","cui-yan","jiang-wan","strat-shengdong-jixi","wang-ping","hist-xiao-he","chen-dao","eq-teng-jia","eq-teng-jia","fei-yi"]},{"heroHp":10,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"hist-fan-kuai","damage":5,"attacksUsed":1},{"defId":"wang-lang","attacksUsed":1},{"defId":"li-dian","exhausted":true},{"defId":"cao-ang","exhausted":true}],"hand":["eq-mingguang-kai","eq-mingguang-kai","cao-lin","eq-teng-jia"],"deck":["hist-zhou-yafu","wang-ping","hist-shang-yang","cao-rui","cao-ang","zhang-liao","wang-ping","wang-lang","strat-huo-ji","strat-shengdong-jixi","strat-huo-ji","eq-teng-jia","deng-ai","cao-rui","hist-tian-dan","xu-chu"]}]},
  },
  {
    id: 'dp-24',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1014249571,"players":[{"heroHp":27,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-xiao-he","damage":3},{"defId":"liu-bei","damage":5,"enchants":[{"attack":1,"health":1}]},{"defId":"ma-liang"},{"defId":"jiang-wan"},{"defId":"cui-yan"}],"hand":["eq-mingguang-kai","cui-yan"],"deck":["wang-ping","liu-qi","zhang-fei","cheng-pu","strat-huo-ji","chen-dao","wang-ping","fei-yi","deng-zhi","ma-liang","strat-shengdong-jixi","strat-huo-ji","eq-teng-jia"]},{"heroHp":8,"heroMaxHp":30,"armor":0,"mana":3,"board":[{"defId":"wang-ping","exhausted":true}],"hand":[],"deck":["eq-teng-jia","zhang-liao","cao-rui","cao-ang","hist-zhou-yafu","li-dian","deng-ai","strat-huo-ji","li-dian","hist-fan-kuai","xu-chu","hist-zhou-yafu","xu-chu","eq-mingguang-kai"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-25',
    heroes: ["hist-confucius","sima-yi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1644619035,"players":[{"heroHp":29,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"token-baimao-bing","damage":4,"enchants":[{"attack":0,"health":3,"keywords":["guard"]}]},{"defId":"token-tie-qi"},{"defId":"hist-wang-shouren"},{"defId":"zhou-tai"}],"hand":["hist-lin-zexu","hist-wei-zheng","cheng-yu","wen-chou","hist-sima-guang"],"deck":["hist-fan-zhongyan","strat-shengdong-jixi","eq-teng-jia","hist-wei-zheng","liu-xie","hist-confucius","chen-dao","hist-lin-zexu","hist-hai-rui","cheng-pu","zhou-tai","hist-hai-rui"]},{"heroHp":1,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"cheng-pu","exhausted":true},{"defId":"zhuge-ke","exhausted":true}],"hand":["sima-shi","wang-ping"],"deck":["fa-zheng","cao-pi","cheng-pu","sima-shi","eq-teng-jia","eq-mingguang-kai","strat-huo-ji","zhou-tai","hist-you-yu","chen-dao","strat-shengdong-jixi","wang-ping","han-fu","hist-yang-su","zhou-yu","hist-gao-jianli"]}]},
  },
  {
    id: 'dp-26',
    heroes: ["sima-yi","hist-confucius"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-444260518,"players":[{"heroHp":17,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"cao-pi","damage":4,"enchants":[{"attack":0,"health":4,"keywords":["guard"]}]},{"defId":"wang-ping"},{"defId":"chen-dao"},{"defId":"token-baimao-bing"},{"defId":"token-si-shi"}],"hand":["sima-shi"],"deck":["sima-yi","sima-shi","cheng-pu","strat-huo-ji","hist-gao-jianli","fa-zheng","zhuge-ke","wang-ping","eq-teng-jia","fa-zheng","eq-mingguang-kai"]},{"heroHp":8,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"hist-lin-zexu","enchants":[{"attack":0,"health":4,"keywords":["guard"]}],"exhausted":true}],"hand":[],"deck":["cheng-pu","hist-yan-zhenqing","zhou-tai","hist-wang-shouren","chen-dao","hist-confucius","liu-xie","hist-wei-zheng"]}]},
  },
  {
    id: 'dp-27',
    heroes: ["hist-confucius","sima-yi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":193230518,"players":[{"heroHp":21,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-lin-zexu","damage":5},{"defId":"hist-wang-shouren"},{"defId":"hist-wei-zheng"}],"hand":["hist-confucius","eq-mingguang-kai","zhou-tai","eq-mingguang-kai"],"deck":["zhou-tai","hist-fan-zhongyan","cheng-pu","hist-sima-guang"]},{"heroHp":6,"heroMaxHp":30,"armor":0,"mana":6,"board":[{"defId":"token-si-shi","enchants":[{"attack":0,"health":3,"keywords":["guard"]}],"attacksUsed":1},{"defId":"cao-pi","attacksUsed":1},{"defId":"token-si-shi","exhausted":true}],"hand":[],"deck":["eq-teng-jia","sima-yi","zhuge-ke","zhou-tai","strat-shengdong-jixi","sima-shi","eq-mingguang-kai","cheng-pu","zhou-yu","wang-ping","fa-zheng"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-28',
    heroes: ["hist-laozi","sun-quan"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":2027519285,"players":[{"heroHp":22,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"token-xiangyong","damage":3,"enchants":[{"attack":0,"health":3,"keywords":["guard"]}]},{"defId":"wen-chou"},{"defId":"ji-kang","damage":2},{"defId":"yu-jin"}],"hand":["hist-xu-xiake","shi-tao","chen-dao"],"deck":["hist-tang-yin","cheng-pu","eq-mingguang-kai","eq-mingguang-kai","guan-xing","strat-huo-ji","wang-ping","strat-huo-ji","ruan-xian","shi-tao","ji-kang"]},{"heroHp":3,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"zhang-bu"},{"defId":"token-shui-zhai","enchants":[{"attack":0,"health":4,"keywords":["guard"]},{"attack":0,"health":3,"keywords":["guard"]}],"exhausted":true}],"hand":["eq-teng-jia"],"deck":["strat-huo-ji","ma-teng","shi-xie","ma-teng","shi-xie","eq-mingguang-kai","cheng-pu","hu-zong","zhou-tai","lu-fan","zhou-tai","hu-zong"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-29',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1344344422,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-fan-zhongyan","damage":5},{"defId":"hist-sima-guang"},{"defId":"hist-hai-rui"},{"defId":"hist-confucius"},{"defId":"liu-xie"}],"hand":["eq-teng-jia","eq-mingguang-kai","zhou-tai"],"deck":["strat-huo-ji","hist-yan-zhenqing","cheng-pu","strat-shengdong-jixi","hist-lin-zexu","hist-yan-zhenqing","hist-lin-zexu","hist-wei-zheng","eq-teng-jia"]},{"heroHp":3,"heroMaxHp":30,"armor":0,"mana":5,"board":[{"defId":"mao-jie","damage":3,"enchants":[{"attack":0,"health":4,"keywords":["guard"]}],"attacksUsed":1}],"hand":[],"deck":["eq-mingguang-kai","xu-chu","wang-ping","xu-chu","cao-rui","cao-ang","hist-zhou-yafu","cao-lin","strat-shengdong-jixi","li-dian","zhang-liao","deng-ai","hist-fan-kuai"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-30',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-138330539,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-lin-zexu","damage":4},{"defId":"wen-chou"},{"defId":"hist-confucius"},{"defId":"hist-wei-zheng","damage":1}],"hand":["strat-shengdong-jixi","strat-huo-ji","chen-dao"],"deck":["cheng-pu","liu-xie","hist-fan-zhongyan","eq-mingguang-kai","hist-yan-zhenqing","eq-teng-jia","hist-wang-shouren","hist-hai-rui","eq-teng-jia","eq-mingguang-kai","hist-wei-zheng","hist-lin-zexu"]},{"heroHp":8,"heroMaxHp":30,"armor":0,"mana":4,"board":[{"defId":"hist-shang-yang","damage":4,"enchants":[{"attack":0,"health":3,"keywords":["guard"]}],"attacksUsed":1},{"defId":"cao-ang","exhausted":true}],"hand":[],"deck":["eq-mingguang-kai","wang-lang","hist-zhou-yafu","xu-chu","cao-lin","li-dian","zhang-liao","hist-zhou-yafu","wang-ping","wang-ping","deng-ai","li-dian","eq-mingguang-kai","hist-fan-kuai"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-31',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":240253839,"players":[{"heroHp":24,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-lin-zexu","damage":5,"enchants":[{"attack":0,"health":4,"keywords":["guard"]}]},{"defId":"hist-wei-zheng"},{"defId":"hist-sima-guang"},{"defId":"wen-chou"},{"defId":"hist-hai-rui"}],"hand":["strat-huo-ji"],"deck":["hist-sima-guang","cheng-yu","hist-wei-zheng"]},{"heroHp":2,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"hist-fan-kuai","damage":1,"exhausted":true}],"hand":[],"deck":["strat-huo-ji","xu-chu","mao-jie","cao-ang","eq-teng-jia","cao-ang","hist-tian-dan","deng-ai","cao-rui"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-32',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-315806257,"players":[{"heroHp":21,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"liu-bei","damage":7,"enchants":[{"attack":1,"health":1},{"attack":0,"health":4,"keywords":["guard"]},{"attack":1,"health":2}]},{"defId":"token-xiangyong"}],"hand":["hist-xie-xuan"],"deck":["wei-yan","eq-mingguang-kai","jiang-wan","deng-zhi","chen-dao","fei-yi","zhang-fei","eq-teng-jia","strat-shengdong-jixi","cheng-pu","deng-zhi","ma-liang","chen-dao","hist-wen-tianxiang","strat-huo-ji","eq-teng-jia"]},{"heroHp":9,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"li-dian","damage":5},{"defId":"wang-lang"},{"defId":"zhang-liao","damage":4,"exhausted":true,"attacksUsed":1},{"defId":"cao-rui","exhausted":true}],"hand":["eq-mingguang-kai","eq-teng-jia","eq-mingguang-kai","wang-lang"],"deck":["strat-shengdong-jixi","hist-zhou-yafu","mao-jie","cao-lin","cao-ang","strat-huo-ji","xu-chu","xu-chu","strat-shengdong-jixi","hist-tian-dan","eq-teng-jia","hist-shang-yang","cao-rui","wang-ping","li-dian","hist-fan-kuai"]}]},
  },
  {
    id: 'dp-33',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-947013553,"players":[{"heroHp":23,"heroMaxHp":30,"armor":0,"mana":9,"board":[{"defId":"deng-zhi","damage":4},{"defId":"token-baimao-bing"},{"defId":"chen-dao"},{"defId":"token-baimao-bing"}],"hand":["hist-wen-tianxiang","eq-mingguang-kai","strat-huo-ji","strat-shengdong-jixi","wang-ping"],"deck":["deng-zhi","ma-liang","jiang-wan","strat-huo-ji","liu-bei","eq-teng-jia","cheng-pu","fei-yi","wang-ping","hist-xiao-he","eq-mingguang-kai","eq-teng-jia","ma-liang","wei-yan","zhang-fei","cui-yan","hist-xie-xuan","cui-yan"]},{"heroHp":1,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"hist-fan-kuai","exhausted":true},{"defId":"cao-lin","exhausted":true}],"hand":["eq-mingguang-kai","eq-mingguang-kai","strat-huo-ji","eq-teng-jia","wang-lang"],"deck":["mao-jie","li-dian","strat-huo-ji","cao-ang","hist-tian-dan","wang-ping","hist-zhou-yafu","li-dian","wang-lang","hist-zhou-yafu","eq-teng-jia","hist-shang-yang","hist-fan-kuai","strat-shengdong-jixi","deng-ai","wang-ping","xu-chu","cao-ang"]}]},
  },
  {
    id: 'dp-34',
    heroes: ["liu-bei","hist-laozi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-312140742,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"token-baimao-bing","damage":2,"enchants":[{"attack":1,"health":1}]},{"defId":"liu-bei","damage":4,"enchants":[{"attack":1,"health":1}]},{"defId":"hist-xie-xuan","damage":4},{"defId":"chen-dao","frozen":true},{"defId":"token-baimao-bing"}],"hand":["eq-teng-jia","hist-xiao-he","hist-wen-tianxiang","ma-liang"],"deck":["fei-yi","eq-mingguang-kai","fei-yi","deng-zhi","strat-shengdong-jixi","wei-yan","zhang-fei","wang-ping","deng-zhi","zhang-fei","eq-mingguang-kai","cheng-pu","ma-liang","jiang-wan","strat-huo-ji","eq-teng-jia","liu-qi"]},{"heroHp":9,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"cheng-pu","exhausted":true}],"hand":["eq-mingguang-kai","hist-kou-qianzhi","cheng-pu","hist-kou-qianzhi","ji-kang","guan-xing"],"deck":["eq-teng-jia","yu-jin","hist-xu-xiake","eq-mingguang-kai","strat-shengdong-jixi","shi-tao","hist-tang-yin","eq-teng-jia","strat-huo-ji","ruan-xian","hist-laozi","hist-zhang-heng","hist-zhang-heng","wen-chou","ji-kang","guan-xing"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-35',
    heroes: ["sima-yi","sun-quan"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1569109426,"players":[{"heroHp":26,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"token-baimao-bing"},{"defId":"fa-zheng","damage":2},{"defId":"sima-shi","enchants":[{"attack":0,"health":4,"keywords":["guard"]}]}],"hand":["eq-mingguang-kai","hist-you-yu"],"deck":["eq-teng-jia","cao-pi","cheng-pu","sima-shi","eq-teng-jia","zhuge-ke","hist-yang-su","zhou-tai","sima-yi","wang-ping","fa-zheng","strat-huo-ji","zhou-yu","han-fu"]},{"heroHp":4,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"token-shui-zhai","damage":2,"silenced":true},{"defId":"zhou-tai","exhausted":true},{"defId":"hu-zong","exhausted":true}],"hand":["eq-teng-jia","shi-xie"],"deck":["wang-ping","eq-teng-jia","sun-ce","zhang-bu","eq-mingguang-kai","wang-ping","eq-mingguang-kai","strat-shengdong-jixi","cheng-pu","man-chong","zhou-tai","strat-shengdong-jixi","zhu-ran"]}]},
  },
  {
    id: 'dp-36',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1568062136,"players":[{"heroHp":5,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-wei-zheng","damage":5,"enchants":[{"attack":0,"health":4,"keywords":["guard"]}]},{"defId":"hist-lin-zexu","damage":4},{"defId":"cheng-yu"},{"defId":"hist-confucius"}],"hand":["cheng-pu","zhou-tai"],"deck":["hist-hai-rui","hist-lin-zexu","hist-fan-zhongyan","hist-sima-guang","chen-dao","zhou-tai","strat-shengdong-jixi","hist-wei-zheng"]},{"heroHp":1,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"li-dian","damage":2,"attacksUsed":1},{"defId":"xu-chu","exhausted":true}],"hand":[],"deck":["deng-ai","hist-zhou-yafu","eq-mingguang-kai","strat-huo-ji","hist-tian-dan","wang-ping","cao-rui","cao-rui","strat-shengdong-jixi","hist-fan-kuai","cao-ang","xu-chu","hist-zhou-yafu"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-37',
    heroes: ["sun-quan","hist-laozi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-933398783,"players":[{"heroHp":27,"heroMaxHp":30,"armor":0,"mana":9,"board":[{"defId":"hu-zong"},{"defId":"token-tie-qi"},{"defId":"man-chong","frozen":true},{"defId":"man-chong"}],"hand":["strat-huo-ji","strat-shengdong-jixi","eq-teng-jia","eq-teng-jia","strat-huo-ji"],"deck":["lu-fan","ma-teng","hist-li-yu","hist-wang-shichong","sun-ce","sun-quan","strat-shengdong-jixi","eq-mingguang-kai","eq-mingguang-kai","cheng-pu","cheng-pu","zhou-tai","shi-xie","lu-fan","shi-xie","zhang-bu","wang-ping","zhu-ran"]},{"heroHp":5,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"hist-zhang-heng","damage":3,"attacksUsed":1},{"defId":"cheng-pu","exhausted":true}],"hand":["wang-ping","guan-xing","wang-ping","ji-kang","shi-tao","ji-kang"],"deck":["hist-xu-xiake","chen-dao","hist-kou-qianzhi","eq-mingguang-kai","strat-shengdong-jixi","hist-laozi","shi-tao","chen-dao","eq-teng-jia","hist-tang-yin","guan-xing","hist-zhang-heng","eq-teng-jia","ruan-xian","yu-jin","strat-huo-ji","strat-huo-ji","eq-mingguang-kai"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-38',
    heroes: ["cao-cao","liu-bei"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-1563768247,"players":[{"heroHp":11,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"token-xiangyong","damage":2,"enchants":[{"attack":0,"health":4,"keywords":["guard"]}]},{"defId":"hist-shang-yang"},{"defId":"wang-lang"},{"defId":"cao-rui"}],"hand":["wang-ping"],"deck":["strat-huo-ji","hist-tian-dan","mao-jie","cao-ang","cao-ang","strat-shengdong-jixi","hist-zhou-yafu","xu-chu","strat-huo-ji","deng-ai","eq-teng-jia","cao-lin","zhang-liao"]},{"heroHp":7,"heroMaxHp":30,"armor":0,"mana":3,"board":[{"defId":"hist-xie-xuan","damage":6,"enchants":[{"attack":1,"health":2},{"attack":1,"health":2}],"attacksUsed":1},{"defId":"wang-ping","exhausted":true}],"hand":[],"deck":["cui-yan","deng-zhi","eq-mingguang-kai","strat-huo-ji","zhang-fei","zhang-fei","chen-dao","strat-huo-ji","liu-bei","deng-zhi","jiang-wan","fei-yi","wang-ping"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-39',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":269787417,"players":[{"heroHp":26,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"cheng-pu","damage":6,"enchants":[{"attack":0,"health":4,"keywords":["guard"]}]},{"defId":"wen-chou"},{"defId":"liu-xie"},{"defId":"chen-dao"},{"defId":"token-baimao-bing","damage":1}],"hand":["hist-confucius","hist-fan-zhongyan","hist-hai-rui"],"deck":[]},{"heroHp":2,"heroMaxHp":30,"armor":0,"mana":5,"board":[{"defId":"cao-lin","enchants":[{"attack":0,"health":4,"keywords":["guard"]}]}],"hand":[],"deck":["li-dian","eq-teng-jia","wang-ping","strat-huo-ji","hist-fan-kuai","wang-ping","hist-fan-kuai","xu-chu"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-40',
    heroes: ["sun-quan","sima-yi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":901832545,"players":[{"heroHp":24,"heroMaxHp":30,"armor":0,"mana":9,"board":[{"defId":"man-chong","damage":4},{"defId":"sun-ce"},{"defId":"zhang-bu"}],"hand":["shi-xie","zhu-ran","shi-xie","hist-wang-shichong","eq-teng-jia"],"deck":["cheng-pu","strat-huo-ji","eq-mingguang-kai","lu-fan","zhou-tai","sun-quan","hu-zong","ma-teng","wang-ping","cheng-pu","hist-li-yu","eq-mingguang-kai","zhou-tai","lu-fan","eq-teng-jia","man-chong","hu-zong","strat-huo-ji"]},{"heroHp":4,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"sima-yi","damage":3,"attacksUsed":1},{"defId":"cheng-pu","exhausted":true},{"defId":"token-si-shi","exhausted":true}],"hand":["sima-shi","zhou-tai","strat-huo-ji","eq-mingguang-kai","eq-mingguang-kai"],"deck":["eq-teng-jia","chen-dao","zhuge-ke","zhuge-ke","hist-gao-jianli","hist-you-yu","strat-shengdong-jixi","fa-zheng","wang-ping","sima-shi","wang-ping","eq-teng-jia","strat-huo-ji","cao-pi","fa-zheng","chen-dao","cheng-pu","zhou-tai"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-41',
    heroes: ["sun-quan","sima-yi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":904974415,"players":[{"heroHp":29,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"sun-quan","damage":4},{"defId":"ma-teng","damage":4},{"defId":"token-tie-qi"}],"hand":["eq-teng-jia","cheng-pu","zhang-bu","zhu-ran"],"deck":["man-chong","eq-teng-jia","hist-li-yu","shi-xie","strat-shengdong-jixi","zhou-tai","wang-ping","lu-fan","eq-mingguang-kai","lu-fan","eq-mingguang-kai","hist-wang-shichong","shi-xie"]},{"heroHp":2,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"zhou-tai","exhausted":true},{"defId":"zhuge-ke","exhausted":true},{"defId":"token-xiangyong","exhausted":true}],"hand":["cao-pi","wang-ping","hist-gao-jianli"],"deck":["hist-yang-su","strat-huo-ji","zhuge-ke","strat-huo-ji","chen-dao","hist-you-yu","eq-teng-jia","fa-zheng","han-fu","strat-shengdong-jixi","eq-mingguang-kai","fa-zheng","cheng-pu","strat-shengdong-jixi","sima-shi"]}]},
  },
  {
    id: 'dp-42',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":910420323,"players":[{"heroHp":29,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-wei-zheng","damage":1},{"defId":"hist-lin-zexu","damage":4},{"defId":"hist-hai-rui"},{"defId":"liu-xie"},{"defId":"chen-dao"}],"hand":["eq-mingguang-kai","eq-mingguang-kai","strat-shengdong-jixi","hist-fan-zhongyan"],"deck":["strat-shengdong-jixi","cheng-yu","eq-teng-jia","hist-lin-zexu","hist-confucius","chen-dao","zhou-tai","hist-wang-shouren","hist-wei-zheng","zhou-tai","eq-teng-jia"]},{"heroHp":4,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"hist-fan-kuai","exhausted":true}],"hand":[],"deck":["strat-huo-ji","hist-shang-yang","hist-zhou-yafu","xu-chu","strat-shengdong-jixi","wang-ping","wang-ping","hist-fan-kuai","li-dian","strat-shengdong-jixi","hist-zhou-yafu","li-dian","zhang-liao","deng-ai"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-43',
    heroes: ["sun-quan","sima-yi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":283821103,"players":[{"heroHp":28,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"token-tie-qi"},{"defId":"shi-xie","damage":4},{"defId":"zhou-tai","silenced":true},{"defId":"zhu-ran"},{"defId":"token-shui-zhai"}],"hand":["hist-li-yu","man-chong","lu-fan","wang-ping","eq-mingguang-kai"],"deck":["zhang-bu","eq-teng-jia","zhou-tai","sun-ce","strat-huo-ji","shi-xie","strat-huo-ji","hist-wang-shichong","hu-zong","lu-fan","ma-teng","eq-teng-jia","eq-mingguang-kai","cheng-pu","sun-quan"]},{"heroHp":3,"heroMaxHp":30,"armor":0,"mana":4,"board":[{"defId":"hist-gao-jianli","enchants":[{"attack":0,"health":4,"keywords":["guard"]}],"exhausted":true}],"hand":["eq-teng-jia","eq-teng-jia"],"deck":["zhou-tai","cheng-pu","hist-gao-jianli","zhuge-ke","wang-ping","sima-shi","fa-zheng","zhou-yu","fa-zheng","hist-you-yu","eq-mingguang-kai","cao-pi","chen-dao","cheng-pu","chen-dao","zhuge-ke"]}]},
  },
  {
    id: 'dp-44',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":293037255,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"cheng-pu","damage":5},{"defId":"zhou-tai"}],"hand":["hist-confucius","strat-huo-ji"],"deck":["hist-lin-zexu","hist-wei-zheng","hist-hai-rui","hist-sima-guang","strat-huo-ji","hist-lin-zexu","zhou-tai","eq-teng-jia","strat-shengdong-jixi","liu-xie","hist-wang-shouren"]},{"heroHp":6,"heroMaxHp":30,"armor":0,"mana":2,"board":[{"defId":"li-dian","damage":9,"enchants":[{"attack":0,"health":4,"keywords":["guard"]}]},{"defId":"cao-rui"},{"defId":"wang-lang"},{"defId":"wang-lang","exhausted":true}],"hand":[],"deck":["wang-ping","deng-ai","cao-rui","hist-zhou-yafu","wang-ping","eq-teng-jia","strat-huo-ji","mao-jie","strat-shengdong-jixi","hist-shang-yang","eq-mingguang-kai","hist-zhou-yafu","cao-lin"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-45',
    heroes: ["sun-quan","sima-yi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":931366123,"players":[{"heroHp":25,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"token-danyang-bing"},{"defId":"man-chong","damage":2},{"defId":"hist-li-yu"}],"hand":["zhang-bu","eq-teng-jia","eq-teng-jia","strat-huo-ji","lu-fan"],"deck":["cheng-pu","zhou-tai","wang-ping","wang-ping","hist-wang-shichong","eq-mingguang-kai","man-chong","shi-xie","ma-teng","hu-zong","ma-teng","eq-mingguang-kai","cheng-pu","sun-quan","strat-shengdong-jixi","strat-huo-ji"]},{"heroHp":2,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"sima-yi","damage":5},{"defId":"wang-ping","exhausted":true},{"defId":"han-fu","exhausted":true}],"hand":["sima-shi","cao-pi","zhuge-ke"],"deck":["zhou-tai","eq-mingguang-kai","zhuge-ke","wang-ping","cheng-pu","chen-dao","strat-huo-ji","zhou-yu","strat-huo-ji","hist-gao-jianli","sima-shi","fa-zheng","hist-you-yu","hist-gao-jianli","cheng-pu","fa-zheng","eq-teng-jia"]}]},
  },
  {
    id: 'dp-46',
    heroes: ["cao-cao","liu-bei"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":225068134,"players":[{"heroHp":25,"heroMaxHp":30,"armor":0,"mana":10,"board":[],"hand":["zhang-liao"],"deck":["cao-rui","li-dian","hist-tian-dan","eq-mingguang-kai","wang-lang","xu-chu","deng-ai","hist-zhou-yafu","eq-teng-jia","eq-teng-jia","hist-shang-yang","wang-lang"]},{"heroHp":6,"heroMaxHp":30,"armor":0,"mana":5,"board":[],"hand":[],"deck":["chen-dao","eq-teng-jia","zhang-fei","wang-ping","eq-mingguang-kai","eq-mingguang-kai","wei-yan","liu-bei","chen-dao","wang-ping","cui-yan","zhang-fei"]}]},
  },
  {
    id: 'dp-47',
    heroes: ["cao-cao","hist-confucius"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":176788065,"players":[{"heroHp":21,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"zhang-liao","damage":4}],"hand":["deng-ai"],"deck":["hist-fan-kuai","cao-rui","hist-fan-kuai","hist-shang-yang","li-dian","strat-shengdong-jixi","eq-mingguang-kai"]},{"heroHp":7,"heroMaxHp":30,"armor":0,"mana":8,"board":[{"defId":"cheng-yu","attacksUsed":1},{"defId":"liu-xie","exhausted":true}],"hand":[],"deck":["chen-dao","strat-shengdong-jixi","strat-shengdong-jixi"]}]},
  },
  {
    id: 'dp-48',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":851876812,"players":[{"heroHp":15,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"ma-liang","damage":1,"enchants":[{"attack":1,"health":1}]},{"defId":"liu-bei","enchants":[{"attack":1,"health":1}]}],"hand":["wei-yan"],"deck":["strat-huo-ji","wang-ping","zhang-fei","strat-shengdong-jixi","hist-wen-tianxiang","deng-zhi","liu-qi","chen-dao","strat-huo-ji","chen-dao","strat-shengdong-jixi","eq-mingguang-kai"]},{"heroHp":9,"heroMaxHp":30,"armor":0,"mana":3,"board":[{"defId":"wang-ping","exhausted":true}],"hand":[],"deck":["xu-chu","eq-mingguang-kai","wang-lang","mao-jie","hist-shang-yang","hist-fan-kuai","hist-fan-kuai","cao-ang","strat-huo-ji","hist-zhou-yafu","hist-zhou-yafu","cao-rui"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-49',
    heroes: ["hist-confucius","sima-yi"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":927491150,"players":[{"heroHp":29,"heroMaxHp":30,"armor":0,"mana":9,"board":[{"defId":"hist-wei-zheng","damage":3,"enchants":[{"attack":0,"health":3,"keywords":["guard"]}]},{"defId":"cheng-pu","damage":2}],"hand":["zhou-tai","hist-wang-shouren","eq-mingguang-kai","liu-xie"],"deck":["cheng-yu","hist-fan-zhongyan","hist-lin-zexu","hist-hai-rui","eq-teng-jia","hist-sima-guang","zhou-tai","hist-wei-zheng","chen-dao","hist-confucius","wen-chou","chen-dao","hist-lin-zexu","strat-huo-ji","hist-sima-guang","hist-yan-zhenqing","eq-mingguang-kai"]},{"heroHp":1,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"zhou-tai","exhausted":true}],"hand":["strat-huo-ji","eq-teng-jia","eq-mingguang-kai","hist-gao-jianli","hist-you-yu"],"deck":["eq-teng-jia","zhuge-ke","cheng-pu","wang-ping","strat-shengdong-jixi","eq-mingguang-kai","chen-dao","sima-shi","strat-huo-ji","zhuge-ke","wang-ping","cheng-pu","chen-dao","fa-zheng","cao-pi","hist-yang-su","han-fu","sima-shi"]}]},
  },
  {
    id: 'dp-50',
    heroes: ["cao-cao","hist-confucius"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":-1006604354,"players":[{"heroHp":27,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-fan-kuai","damage":4},{"defId":"deng-ai","damage":4,"enchants":[{"attack":1,"health":0}]},{"defId":"wang-lang"}],"hand":["eq-mingguang-kai","hist-shang-yang","cao-ang"],"deck":["cao-rui","li-dian","hist-fan-kuai","cao-ang","cao-lin","cao-rui","li-dian","mao-jie","xu-chu","eq-teng-jia","strat-shengdong-jixi","hist-tian-dan","strat-shengdong-jixi","wang-ping"]},{"heroHp":7,"heroMaxHp":30,"armor":0,"mana":4,"board":[{"defId":"zhou-tai","exhausted":true}],"hand":["wen-chou"],"deck":["chen-dao","hist-confucius","hist-fan-zhongyan","hist-wang-shouren","strat-huo-ji","hist-wei-zheng","hist-lin-zexu","hist-wei-zheng","zhou-tai","hist-sima-guang","strat-shengdong-jixi","cheng-pu","chen-dao"]}]},
  },
  {
    id: 'dp-51',
    heroes: ["cao-cao","hist-confucius"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":218260749,"players":[{"heroHp":14,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-fan-kuai","damage":2},{"defId":"wang-ping","damage":4}],"hand":["strat-shengdong-jixi"],"deck":["cao-lin","li-dian","strat-shengdong-jixi","wang-lang","hist-zhou-yafu","eq-teng-jia","wang-ping","hist-tian-dan","strat-huo-ji"]},{"heroHp":2,"heroMaxHp":30,"armor":0,"mana":6,"board":[{"defId":"hist-yan-zhenqing","damage":4,"attacksUsed":1},{"defId":"cheng-yu","exhausted":true}],"hand":[],"deck":["hist-wei-zheng","hist-lin-zexu","cheng-pu","hist-wang-shouren","strat-huo-ji"]}]},
  },
  {
    id: 'dp-52',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-965760044,"players":[{"heroHp":25,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"cheng-yu","damage":2},{"defId":"zhou-tai"},{"defId":"hist-hai-rui"}],"hand":["strat-huo-ji","strat-huo-ji","eq-teng-jia","wen-chou","cheng-pu"],"deck":["hist-confucius","hist-wei-zheng","zhou-tai","liu-xie","hist-lin-zexu","hist-wang-shouren","hist-sima-guang","hist-wei-zheng","eq-teng-jia","hist-lin-zexu","eq-mingguang-kai","hist-yan-zhenqing","hist-fan-zhongyan","hist-sima-guang","strat-shengdong-jixi","eq-mingguang-kai"]},{"heroHp":8,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"deng-ai","enchants":[{"attack":0,"health":3,"keywords":["guard"]}],"exhausted":true}],"hand":["cao-ang","eq-teng-jia","wang-ping","li-dian"],"deck":["wang-lang","eq-mingguang-kai","cao-rui","cao-ang","li-dian","strat-huo-ji","eq-mingguang-kai","mao-jie","strat-shengdong-jixi","hist-zhou-yafu","hist-tian-dan","cao-lin","wang-lang","xu-chu","xu-chu","hist-fan-kuai","wang-ping"]}]},
  },
  {
    id: 'dp-53',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-138330539,"players":[{"heroHp":30,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-lin-zexu","damage":4},{"defId":"wen-chou"},{"defId":"cheng-yu"}],"hand":["hist-confucius","strat-shengdong-jixi","hist-wei-zheng"],"deck":["cheng-pu","liu-xie","hist-fan-zhongyan","eq-mingguang-kai","hist-yan-zhenqing","eq-teng-jia","hist-wang-shouren","hist-hai-rui","eq-teng-jia","eq-mingguang-kai","hist-wei-zheng","hist-lin-zexu","chen-dao","strat-huo-ji"]},{"heroHp":8,"heroMaxHp":30,"armor":0,"mana":1,"board":[{"defId":"hist-shang-yang","enchants":[{"attack":0,"health":3,"keywords":["guard"]}],"exhausted":true}],"hand":[],"deck":["eq-mingguang-kai","wang-lang","hist-zhou-yafu","xu-chu","cao-lin","li-dian","zhang-liao","hist-zhou-yafu","wang-ping","wang-ping","deng-ai","li-dian","eq-mingguang-kai","hist-fan-kuai","cao-ang"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-54',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":2094964761,"players":[{"heroHp":11,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"jiang-wan","damage":1,"enchants":[{"attack":1,"health":2}]},{"defId":"wei-yan","damage":4,"enchants":[{"attack":1,"health":2}]}],"hand":["fei-yi","wang-ping"],"deck":["cui-yan","liu-qi","ma-liang","zhang-fei","chen-dao","fei-yi","strat-huo-ji","hist-xiao-he","eq-teng-jia","eq-mingguang-kai","deng-zhi"]},{"heroHp":4,"heroMaxHp":30,"armor":0,"mana":5,"board":[{"defId":"cao-rui","damage":4,"enchants":[{"attack":0,"health":4,"keywords":["guard"]}],"attacksUsed":1},{"defId":"cao-ang","attacksUsed":1}],"hand":[],"deck":["hist-zhou-yafu","wang-lang","wang-ping","eq-teng-jia","wang-lang","hist-tian-dan","mao-jie","li-dian","li-dian","hist-shang-yang","strat-huo-ji","eq-teng-jia"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-55',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":-1941724251,"players":[{"heroHp":21,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"chen-dao","damage":5,"enchants":[{"attack":1,"health":1}]},{"defId":"token-baimao-bing","enchants":[{"attack":1,"health":1}]},{"defId":"liu-bei","enchants":[{"attack":1,"health":1}]}],"hand":["eq-teng-jia"],"deck":["eq-teng-jia","cheng-pu","ma-liang","deng-zhi","deng-zhi","wang-ping","eq-mingguang-kai","zhang-fei","hist-wen-tianxiang","wei-yan","hist-xiao-he","ma-liang","cui-yan","fei-yi"]},{"heroHp":3,"heroMaxHp":30,"armor":0,"mana":3,"board":[{"defId":"wang-ping","exhausted":true}],"hand":[],"deck":["hist-fan-kuai","strat-huo-ji","wang-lang","cao-lin","li-dian","hist-tian-dan","cao-ang","hist-zhou-yafu","xu-chu","eq-mingguang-kai","hist-fan-kuai","mao-jie","cao-rui","zhang-liao"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-56',
    heroes: ["cao-cao","hist-confucius"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-355764513,"players":[{"heroHp":27,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-tian-dan","damage":6,"enchants":[{"attack":0,"health":4,"keywords":["guard"]}]},{"defId":"hist-fan-kuai"},{"defId":"cao-rui","enchants":[{"attack":0,"health":3,"keywords":["guard"]}]}],"hand":["strat-huo-ji"],"deck":["cao-rui","strat-huo-ji","li-dian","deng-ai","wang-ping","wang-lang","hist-fan-kuai","eq-teng-jia","cao-lin","hist-zhou-yafu","mao-jie","hist-shang-yang"]},{"heroHp":6,"heroMaxHp":30,"armor":0,"mana":4,"board":[{"defId":"cheng-pu","exhausted":true}],"hand":[],"deck":["zhou-tai","hist-sima-guang","liu-xie","hist-yan-zhenqing","hist-fan-zhongyan","eq-mingguang-kai","hist-wei-zheng","hist-hai-rui","hist-lin-zexu","hist-wang-shouren","hist-confucius"]}]},
  },
  {
    id: 'dp-57',
    heroes: ["liu-bei","cao-cao"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":1545921508,"players":[{"heroHp":17,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"hist-xie-xuan"},{"defId":"cui-yan"}],"hand":["hist-wen-tianxiang","fei-yi","wei-yan","fei-yi","ma-liang"],"deck":["wang-ping","strat-huo-ji","strat-huo-ji","zhang-fei","chen-dao","strat-shengdong-jixi","liu-qi","deng-zhi","hist-xiao-he","cui-yan","wang-ping","strat-shengdong-jixi","jiang-wan","eq-mingguang-kai","eq-teng-jia","zhang-fei","eq-mingguang-kai"]},{"heroHp":14,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"hist-shang-yang","exhausted":true},{"defId":"cao-ang","exhausted":true}],"hand":["eq-teng-jia","eq-teng-jia","cao-ang"],"deck":["strat-huo-ji","xu-chu","eq-mingguang-kai","hist-fan-kuai","strat-huo-ji","li-dian","eq-mingguang-kai","wang-ping","xu-chu","strat-shengdong-jixi","deng-ai","zhang-liao","wang-ping","wang-lang","cao-rui","mao-jie","hist-zhou-yafu"]}]},
  },
  {
    id: 'dp-58',
    heroes: ["liu-bei","hist-laozi"],
    difficulty: 2,
    scenario: {"activePlayer":0,"rng":-912557712,"players":[{"heroHp":24,"heroMaxHp":30,"armor":0,"mana":9,"board":[{"defId":"ma-liang","damage":4,"enchants":[{"attack":1,"health":1}]},{"defId":"fei-yi","damage":4,"enchants":[{"attack":1,"health":1}]},{"defId":"cheng-pu"}],"hand":["eq-teng-jia","deng-zhi","jiang-wan","strat-huo-ji","wei-yan"],"deck":["wang-ping","zhang-fei","eq-mingguang-kai","eq-mingguang-kai","deng-zhi","strat-shengdong-jixi","cui-yan","hist-wen-tianxiang","strat-huo-ji","hist-xie-xuan","zhang-fei","ma-liang","eq-teng-jia","cui-yan","chen-dao","hist-xiao-he","fei-yi","wang-ping"]},{"heroHp":11,"heroMaxHp":30,"armor":0,"mana":0,"board":[{"defId":"wang-ping","exhausted":true}],"hand":["strat-huo-ji","eq-teng-jia","wang-ping","cheng-pu","guan-xing"],"deck":["cheng-pu","shi-tao","hist-zhang-heng","ruan-xian","hist-kou-qianzhi","guan-xing","strat-shengdong-jixi","hist-zhang-heng","eq-teng-jia","eq-mingguang-kai","hist-laozi","ji-kang","hist-xu-xiake","ji-kang","hist-tang-yin","chen-dao","yu-jin"]}]},
  },
  {
    id: 'dp-59',
    heroes: ["cao-cao","liu-bei"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":-912452983,"players":[{"heroHp":12,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"deng-ai","damage":2,"enchants":[{"attack":1,"health":0}]},{"defId":"hist-tian-dan"},{"defId":"hist-shang-yang"}],"hand":["xu-chu"],"deck":["mao-jie","cao-ang","wang-ping","cao-rui","li-dian","strat-huo-ji","wang-lang","eq-teng-jia","wang-lang","li-dian","eq-mingguang-kai"]},{"heroHp":7,"heroMaxHp":30,"armor":0,"mana":6,"board":[{"defId":"fei-yi","damage":7,"enchants":[{"attack":0,"health":3,"keywords":["guard"]},{"attack":1,"health":2}],"attacksUsed":1}],"hand":[],"deck":["deng-zhi","zhang-fei","hist-xie-xuan","strat-shengdong-jixi","cheng-pu","liu-qi","wei-yan","hist-xiao-he","ma-liang","strat-huo-ji","strat-shengdong-jixi"],"heroPowerUsed":true}]},
  },
  {
    id: 'dp-60',
    heroes: ["hist-confucius","cao-cao"],
    difficulty: 1,
    scenario: {"activePlayer":0,"rng":186213675,"players":[{"heroHp":27,"heroMaxHp":30,"armor":0,"mana":10,"board":[{"defId":"chen-dao","damage":4},{"defId":"token-baimao-bing","damage":4,"enchants":[{"attack":0,"health":4,"keywords":["guard"]}]},{"defId":"token-tie-qi"},{"defId":"cheng-pu"}],"hand":["hist-lin-zexu","zhou-tai","strat-huo-ji"],"deck":["hist-sima-guang","cheng-pu","liu-xie"]},{"heroHp":4,"heroMaxHp":30,"armor":0,"mana":3,"board":[{"defId":"wang-ping","exhausted":true}],"hand":[],"deck":["hist-shang-yang","hist-fan-kuai","xu-chu","eq-teng-jia","hist-fan-kuai","eq-teng-jia","hist-tian-dan","li-dian","li-dian","mao-jie"],"heroPowerUsed":true}]},
  },
]
