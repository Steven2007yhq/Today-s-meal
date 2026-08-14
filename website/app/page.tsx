import Image from "next/image";
import { releases } from "./releases";

const features = [
  {
    number: "01",
    title: "三餐计划，不再临时抓瞎",
    copy: "把早餐、午餐、晚餐放进一张清晰的今日计划。时间、用量、热量和蛋白质都能按真实情况调整。",
    accent: "orange",
  },
  {
    number: "02",
    title: "150+ 道菜，搜到就能吃",
    copy: "覆盖八大菜系与节日、西式菜品。按菜名、食材、口味和做法搜索，再从一万多条关系中找到相近搭配。",
    accent: "green",
  },
  {
    number: "03",
    title: "饭量不是标准答案",
    copy: "饭量引擎结合你的同餐次历史与热量目标，换算食材克数和营养数据，让建议更接近你真正吃得下的份量。",
    accent: "blue",
  },
  {
    number: "04",
    title: "日历、报告、收藏都在一起",
    copy: "按日期回看餐食，把喜欢的菜放进收藏夹，阅读营养趋势，还能把单道食谱或一周菜单导出为 PDF。",
    accent: "gold",
  },
];

const scenes = [
  { icon: "日", title: "日常模式", copy: "一日三餐，均衡、轻松、可持续。", tone: "scene-orange", image: null, alt: "" },
  { icon: "家", title: "家庭餐桌", copy: "照顾成人和孩子，一锅饭安排不同份量。", tone: "scene-gold", image: "/lifestyle/family-dinner.webp", alt: "东亚家庭一起分享家常晚餐" },
  { icon: "养", title: "乐龄养护", copy: "更重视清淡、盐糖钙与风险提醒。", tone: "scene-green", image: "/lifestyle/elder-tea.webp", alt: "乐龄夫妇在家中安静品茶" },
  { icon: "燃", title: "燃力健身", copy: "围绕训练日安排蛋白质与宏量营养。", tone: "scene-blue", image: "/lifestyle/fitness-training.webp", alt: "男士进行哑铃力量训练" },
];

const faqs = [
  ["这是减肥软件吗？", "不只是。好吃的今天首先解决“今天吃什么、怎么安排”的决策负担。减脂、增肌只是燃力健身场景中的一部分。"],
  ["小饭 AI 会透露底层模型吗？", "不会。应用对外统一使用“小饭 AI”品牌，客户端不会展示上游服务商、模型名称、接口凭证或后台通道信息。"],
  ["需要一直联网吗？", "菜品浏览和部分本地记录可继续使用；账号、云端收藏、小饭 AI 和在线图片等能力需要网络连接。"],
  ["营养建议可以代替医生吗？", "不可以。所有营养与 AI 建议只作日常饮食参考，疾病、过敏、孕产、儿童喂养或用药问题请咨询专业人员。"],
  ["哪个版本适合我？", "优先选择标有“推荐”的最新版。历史版本用于旧设备兼容和问题回退，不会获得最新功能与安全改进。"],
];

export default function Home() {
  const latest = releases[0];

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="好吃的今天首页">
          <span className="brand-mark">吃</span>
          <span><strong>好吃的今天</strong><small>一日三餐 · 不再为难</small></span>
        </a>
        <nav aria-label="主导航">
          <a href="#advantages">产品优势</a>
          <a href="#scenes">场景模式</a>
          <a href="#xiaofan">小饭 AI</a>
          <a href="#download">下载</a>
        </nav>
        <a className="header-download" href={`/api/downloads/${latest.version}`}>下载 Windows 版</a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span /> Windows 桌面版 · 封闭测试开放下载</div>
          <h1>把每天吃什么，<br /><em>变成一件轻松的事。</em></h1>
          <p>从今天的一日三餐，到一家人的长期餐桌。好吃的今天用菜谱、饭量记录、日历和小饭 AI，把饮食规划变成一个温暖、清晰、能坚持的日常。</p>
          <div className="hero-actions">
            <a className="primary-cta" href={`/api/downloads/${latest.version}`}><span>↓</span> 下载最新版 <small>v{latest.version}</small></a>
            <a className="secondary-cta" href="#advantages">看看它能做什么 <span>→</span></a>
          </div>
          <div className="hero-meta">
            <span><i>✓</i> Windows 10 / 11</span>
            <span><i>✓</i> x64 安装包</span>
            <span><i>✓</i> 无需自备 AI 密钥</span>
          </div>
        </div>

        <div className="product-stage" aria-label="好吃的今天应用界面示意">
          <div className="stage-orbit orbit-one" />
          <div className="stage-orbit orbit-two" />
          <div className="app-window">
            <div className="window-bar"><span /><span /><span /><strong>好吃的今天</strong><small>— □ ×</small></div>
            <div className="app-body">
              <aside>
                <div className="mini-logo"><b>吃</b><span>好吃的今天</span></div>
                <small>我的餐桌</small>
                <i className="active">⌂ <span>好吃的今天</span></i>
                <i>□ <span>餐食日历</span></i>
                <i>⌕ <span>八大菜系库</span></i>
                <i>♡ <span>我的收藏</span></i>
                <small>场景模式</small>
                <i>◉ <span>日常模式</span></i>
              </aside>
              <div className="app-content">
                <div className="preview-top"><span><b>8 月 14 日 · 星期五</b><strong>日常模式</strong></span><i>⌕ 搜食谱、食材</i></div>
                <div className="welcome-preview">
                  <span><small>今日推荐</small><strong>吃得舒服，<br />日子就有底气。</strong><em>三餐已为你安排好</em></span>
                  <b>🍲</b>
                </div>
                <div className="preview-grid">
                  <div className="meal-preview">
                    <strong>今日三餐 <small>3 餐已安排</small></strong>
                    <span><i>07:30</i><b>紫薯燕麦碗</b><em>436 kcal</em></span>
                    <span><i>12:10</i><b>照烧鸡腿饭</b><em>628 kcal</em></span>
                    <span><i>18:30</i><b>番茄豆腐煲</b><em>492 kcal</em></span>
                  </div>
                  <div className="energy-preview"><small>今日能量</small><strong>1,556</strong><span>kcal</span><div><i style={{ width: "74%" }} /></div><em>蛋白质 87g</em></div>
                </div>
              </div>
            </div>
          </div>
          <div className="ai-float"><b>饭</b><span><strong>小饭 AI</strong><small>今晚想吃什么？</small></span><i>✦</i></div>
          <div className="season-card"><span>本周好好吃饭</span><strong>6<small>天</small></strong><i>连续记录中</i></div>
        </div>
      </section>

      <section className="proof-strip" aria-label="产品数据">
        <span><strong>150<sup>+</sup></strong><small>可搜索菜品</small></span>
        <span><strong>10,000<sup>+</sup></strong><small>菜品关联关系</small></span>
        <span><strong>4</strong><small>独立饮食场景</small></span>
        <span><strong>1</strong><small>位懂吃饭的小饭 AI</small></span>
      </section>

      <section className="purpose-section">
        <div className="section-kicker">WHY WE BUILT IT</div>
        <div className="purpose-grid">
          <h2>不是教你“完美饮食”，<br />是让你<em>少为吃饭发愁。</em></h2>
          <div>
            <p>真正消耗人的，常常不是做饭本身，而是每天重复出现的三个问题：吃什么、吃多少、怎么搭配。</p>
            <p>好吃的今天把这些决定放进一个顺手的工作台。它记得你的饭量，也理解不同家庭和生活阶段的需要，让每顿饭有依据，但不制造焦虑。</p>
          </div>
        </div>
      </section>

      <section className="feature-section" id="advantages">
        <div className="section-heading">
          <div><span className="section-kicker">ONE APP, EVERY MEAL</span><h2>从“吃什么”到“吃得怎么样”</h2></div>
          <p>把零散的菜谱、记录与建议，连成一条真正能用的饮食路径。</p>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <article className={`feature-card ${feature.accent}`} key={feature.number}>
              <span>{feature.number}</span>
              <div className="feature-visual" aria-hidden="true"><i /><i /><i /></div>
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="scene-section" id="scenes">
        <div className="scene-intro"><span className="section-kicker">ONE TABLE, DIFFERENT LIVES</span><h2>一张餐桌，<br />照顾四种生活状态。</h2><p>场景不是换一个颜色，而是改变建议重点、沟通方式和饮食关注。</p></div>
        <div className="scene-list">
          {scenes.map((scene, index) => (
            <article className={`${scene.tone}${scene.image ? " has-photo" : ""}`} key={scene.title}>
              <span>{scene.icon}</span>
              <div>
                <small>0{index + 1}</small>
                <h3>{scene.title}</h3>
                <p>{scene.copy}</p>
              </div>
              {scene.image && (
                <Image
                  className="scene-photo"
                  src={scene.image}
                  alt={scene.alt}
                  width={132}
                  height={82}
                  unoptimized
                />
              )}
              <i>→</i>
            </article>
          ))}
        </div>
      </section>

      <section className="ai-section" id="xiaofan">
        <div className="ai-portrait"><span>饭</span><i className="spark-one">✦</i><i className="spark-two">✦</i><small>只聊吃饭<br />但很会聊吃饭</small></div>
        <div className="ai-copy">
          <span className="section-kicker">MEET XIAOFAN AI</span>
          <h2>有些饭，不用搜。<br />直接问小饭。</h2>
          <p>告诉它冰箱里有什么、今天想吃辣还是清淡、最近训练得怎么样。小饭 AI 会结合当前场景、今日餐食和近期饭量，给出更贴近当下的一餐。</p>
          <div className="question-cloud"><span>“今晚想吃点辣的”</span><span>“冰箱只剩鸡蛋和番茄”</span><span>“训练后怎么补蛋白？”</span></div>
          <div className="ai-trust"><i>✓</i><span><strong>统一的小饭 AI 品牌</strong><small>用户端不展示底层供应商、模型名称和服务凭证。</small></span></div>
        </div>
      </section>

      <section className="privacy-section">
        <div><span className="section-kicker">CALM BY DESIGN</span><h2>懂你的胃，<br />不打听你的秘密。</h2></div>
        <div className="privacy-points">
          <span><i>01</i><strong>后台托管 AI 通道</strong><small>安装后无需填写或保存任何 AI 服务密钥。</small></span>
          <span><i>02</i><strong>本地记录优先</strong><small>餐食历史与日历调整优先保存在当前设备。</small></span>
          <span><i>03</i><strong>健康边界明确</strong><small>饮食建议只作生活参考，不替代医生诊疗。</small></span>
        </div>
      </section>

      <section className="download-section" id="download">
        <div className="download-heading"><span className="section-kicker">DOWNLOAD CENTER</span><h2>选一个版本，今天就好好吃饭。</h2><p>优先下载最新版；历史版本仅用于兼容和问题回退。</p></div>
        <div className="release-grid">
          {releases.map((release) => (
            <article className={release.recommended ? "release-card recommended" : "release-card"} key={release.version}>
              {release.recommended && <span className="recommended-tag">推荐版本</span>}
              <div className="release-title"><span className="windows-mark">田</span><div><small>Windows x64</small><h3>v{release.version}</h3></div></div>
              <p>{release.summary}</p>
              <ul>{release.highlights.map((item) => <li key={item}>{item}</li>)}</ul>
              <div className="release-meta"><span>{release.size}</span><span>{release.date}</span></div>
              <a href={`/api/downloads/${release.version}`}>下载安装包 <span>↓</span></a>
              <small className="checksum">SHA-256 · {release.sha256.slice(0, 16)}…</small>
            </article>
          ))}
        </div>
        <div className="system-note"><strong>运行要求</strong><span>Windows 10 / 11 64 位</span><span>建议 8 GB 内存</span><span>至少 500 MB 可用空间</span><span>部分功能需要网络</span></div>
      </section>

      <section className="faq-section">
        <div><span className="section-kicker">QUESTIONS, ANSWERED</span><h2>下载前，你可能还想知道</h2></div>
        <div className="faq-list">
          {faqs.map(([question, answer], index) => <details key={question} open={index === 0}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}
        </div>
      </section>

      <section className="final-cta">
        <span>🍚</span><small>今天吃什么？</small><h2>别纠结了，交给好吃的今天。</h2><p>先安排好下一顿，再慢慢把日子吃得更有滋味。</p><a href={`/api/downloads/${latest.version}`}>下载 Windows 最新版 <i>↓</i></a>
      </section>

      <footer>
        <div className="brand"><span className="brand-mark">吃</span><span><strong>好吃的今天</strong><small>一日三餐 · 不再为难</small></span></div>
        <p>面向中国家庭的智能饮食规划 Windows 桌面应用。</p>
        <span>© 2026 好吃的今天产品团队 · 营养建议仅作生活参考</span>
      </footer>
    </main>
  );
}
