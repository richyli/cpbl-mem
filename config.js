/* ============================================================
   中職球團付費會員方案 Conjoint — 設計設定檔（單一真實來源）
   設計依據：analysis_output/design_memo_classified.md（6 屬性 × 各 4 水準）
   ============================================================ */

const CONFIG = {
  // ---- SheetMonkey 收件 endpoint（建好新 form 後替換這一行）----
  SHEETMONKEY_URL: "https://api.sheetmonkey.io/form/493MeKnuRjhvuguNAC4Ujo",

  ROUNDS: 8,          // 正式 CBC 共 8 輪（不含 trap、repeat）
  ENABLE_NONE: false, // 不問「是否真的會加入」（移除 dual-response）
  MIN_ANSWER_SEC: 3,  // 每題最短作答秒數（前端硬限制：未到不能按下一題）

  // 注意力 trap：插在第 1 題之後，指定須點哪一張
  TRAP_AFTER: 1,      // 第 1 題後插入 trap
  TRAP_SIDE: "A",     // 本研究單一 study，trap 指定點 A

  // 鏡像重複：來源題 index（避開第 1 題，0-based → 用第 3 題 index=2），於 +2 後鏡像重現
  REP_SRC_IDX: 2,

  // ---- 6 屬性 × 各 4 水準（水準陣列順序 = 由低到高，index 0..3）----
  // levels[i].label = 卡片顯示文字；levels[i].tag = 分析用簡碼
  // 水準數混合 4/3/4/2/4/4（使用者 2026-06-07 指定）。
  // 注意 number-of-levels effect：水準數多者 importance 略被高估，已於 design memo 限制節承認。
  attributes: [
    {
      key: "price", name: "年度會員費", icon: "💳", cls: "A 金錢",
      // 水準依 WTP 市場校準（見 analysis_output/wtp_market_benchmark.md）
      levels: [
        { tag: "699",  label: "699 元" },
        { tag: "1199", label: "1,199 元" },
        { tag: "1999", label: "1,999 元" },
        { tag: "2999", label: "2,999 元" },
      ],
    },
    {
      key: "media", name: "獨家媒體內容", icon: "🎥", cls: "F 內容",
      levels: [
        { tag: "report",  label: "賽後戰報" },
        { tag: "feature", label: "球員深度專訪" },
        { tag: "locker",  label: "休息室幕後影音" },
        { tag: "farm",    label: "二軍與新秀養成紀錄" },
      ],
    },
    {
      key: "ticket", name: "優先購票順位", icon: "🎟️", cls: "B 功能",
      // 3 水準
      levels: [
        { tag: "p4", label: "第四順位・每場 2 張" },
        { tag: "p3", label: "第三順位・每場 4 張" },
        { tag: "p2", label: "第二順位・每場 4 張" },
      ],
    },
    {
      key: "interact", name: "互動活動", icon: "🎤", cls: "E 社群",
      levels: [
        { tag: "none", label: "無互動活動" },
        { tag: "qa",   label: "線上球迷問答" },
        { tag: "vote", label: "會員限定投票" },
        { tag: "meet", label: "球員見面會報名資格" },
      ],
    },
    {
      key: "lane", name: "專屬通道", icon: "🚪", cls: "D 主場",
      // 2 水準（index0=低=無、index1=高=有，與其他屬性低→高一致）
      levels: [
        { tag: "no",  label: "無專屬通道" },
        { tag: "yes", label: "有專屬通道" },
      ],
    },
    {
      key: "gift", name: "會員周邊", icon: "🎁", cls: "C 情感",
      levels: [
        { tag: "none",   label: "無實體贈品" },
        { tag: "ball",   label: "紀念球" },
        { tag: "towel",  label: "球團限定毛巾" },
        { tag: "tshirt", label: "會員專屬T恤" },
      ],
    },
  ],

  // ---- S2：六支中職球隊 ----
  // color = 官方 logo 色（卡面漸層用）；ui = 深底提亮版（○符號/標題/選中態用，確保對比≥3）
  teams: [
    { zh:"中信兄弟",          en:"CTBC BROTHERS",    color:"#f0c419", ui:"#f0c419" }, // 兄弟金黃
    { zh:"統一 7-ELEVEn 獅",  en:"UNI-LIONS",        color:"#e95513", ui:"#e95513" }, // 獅朱橘
    { zh:"樂天桃猿",          en:"RAKUTEN MONKEYS",  color:"#9e1b32", ui:"#d63d57" }, // 樂天暗紅
    { zh:"富邦悍將",          en:"FUBON GUARDIANS",  color:"#13205e", ui:"#3f6fd8" }, // 富邦深藍
    { zh:"味全龍",            en:"WEI CHUAN DRAGONS",color:"#c8102e", ui:"#e23a52" }, // 味全紅
    { zh:"台鋼雄鷹",          en:"TSG HAWKS",        color:"#1a5632", ui:"#2f9e63" }, // 台鋼墨綠
  ],

  // ---- 量表（LCA 外部效標：球隊認同 / 球迷社群認同 / 知覺價值）----
  scales: {
    identity: {
      title: "球隊認同",
      items: [
        "我覺得自己是這支球隊的支持者。",
        "支持這支球隊是我個人身分認同的一部分。",
        "這支球隊的勝敗會影響我的心情。",
        "當別人稱讚這支球隊時，我會感到高興。",
        "當這支球隊受到批評時，我會覺得自己也受到影響。",
        "我願意持續關注這支球隊的比賽與消息。",
      ],
    },
    community: {
      title: "球迷社群認同",
      items: [
        "我覺得自己和其他支持這支球隊的球迷有共同連結。",
        "參與這支球隊的球迷活動，會讓我感到歸屬感。",
        "我願意和其他球迷討論這支球隊的比賽或消息。",
        "球迷之間的互動，是支持這支球隊的重要經驗。",
        "會員日、主場活動或應援活動，會讓我更覺得自己是球隊社群的一員。",
      ],
    },
    value: {
      title: "知覺價值",
      items: [
        "球團會員方案提供的內容或權益對我有實際幫助。",       // 功能
        "若會員方案能提升觀賽或追蹤球隊的經驗，我會更願意加入。", // 功能
        "球團會員方案若能讓我更接近球隊，會提高我的加入意願。",   // 情感
        "加入球團會員若能增加支持球隊的樂趣，我會覺得值得。",     // 情感
        "加入球團會員會讓我更覺得自己是球隊支持者的一員。",       // 社會
        "專屬活動或會員限定權益會讓我感到與一般球迷有所不同。",   // 社會
        "我會在意球團會員方案的價格是否合理。",                 // 金錢
        "若會員權益與價格相符，我會更願意加入。",               // 金錢
      ],
    },
  },

  // marker 題（CMV 共同方法變異校正，理論上與會員偏好無關）
  marker: "我很喜歡藍色。",

  scalePoints: 7, // 7 點 Likert

  // 人口變項（點選即可，不放開放題）
  demographics: [
    { key:"gender", label:"生理性別", options:["男","女","不願透露"] },
    { key:"age", label:"年齡", options:["18 歲以下","18–24","25–34","35–44","45–54","55 歲以上"] },
    { key:"watch_freq", label:"平均每月觀看中職場次", options:["幾乎不看","1–2 場","3–5 場","6 場以上"] },
    { key:"is_member", label:"目前是否為任一中職球隊付費會員", options:["是","否"] },
  ],
};
