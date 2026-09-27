import type { Locale } from "@/lib/i18n";
import type { AlcheScrollableSectionId, AlcheTopGroupId } from "@/lib/alche-top-page";

export interface AlcheNewsItem {
  date: string;
  title: string;
  href?: string;
}

export interface AlcheWorkItem {
  code: string;
  date: string;
  title: string;
  subtitle: string;
  categories: readonly string[];
  imageSrc: string;
}

export interface AlcheServiceItem {
  code: string;
  title: string;
  body: string;
  // Platform badge shown above the service panel (reference "CREATED IN
  // FORTNITE" / "UNREAL ENGINE" lock-ups, rendered as text).
  badge: string;
  imageSrc: string;
}

export interface AlcheEndmarkFooterColumn {
  title: string;
  items: readonly string[];
}

export interface AlcheEndmarkFooterCopy {
  columns: readonly AlcheEndmarkFooterColumn[];
  actions: readonly string[];
  legalLinks: readonly string[];
  copyright: string;
}

export interface AlcheTopPageCopy {
  metadata: {
    title: string;
    description: string;
  };
  loading: {
    eyebrow: string;
    body: string;
  };
  header: {
    navAria: string;
    localeLabel: string;
    navItems: Array<{
      id: "news" | "works" | "about" | "stellla";
      label: string;
      target: AlcheScrollableSectionId;
    }>;
    contactLabel: string;
    recruitLabel: string;
    soundLabel: string;
  };
  indicator: {
    title: string;
    groups: Record<AlcheTopGroupId, string>;
  };
  news: {
    title: string;
    items: AlcheNewsItem[];
  };
  hud: {
    title: string;
    subtitle: string;
    metrics: string[];
    note: string;
  };
  works: {
    eyebrow: string;
    title: string;
    body: string;
    moreLabel: string;
    items: AlcheWorkItem[];
  };
  mission: {
    eyebrow: string;
    title: string;
    body: string;
  };
  vision: {
    eyebrow: string;
    title: string;
    body: string;
  };
  service: {
    eyebrow: string;
    title: string;
    // Giant repeated word on the service wall (reference keeps it in English).
    wallWord: string;
    items: AlcheServiceItem[];
  };
  stellla: {
    eyebrow: string;
    title: string;
    body: string;
    frameLabel: string;
  };
  outro: {
    eyebrow: string;
    title: string;
    body: string;
    linksTitle: string;
    legalTitle: string;
    companyLabel: string;
    privacyLabel: string;
    licenseLabel: string;
    copyright: string;
    footer: AlcheEndmarkFooterCopy;
  };
}

const sharedNews = [
  {
    date: "2025 06.26",
    title: "Unreal Fest Bali 2025 appearance",
  },
  {
    date: "2025 05.16",
    title: "WEAR GO LAND launch partnership",
  },
  {
    date: "2024 10.29",
    title: "ReIMAGINE creative team formation",
  },
] as const;

const sharedWorks = [
  {
    code: "WK-01",
    date: "2026 01.17",
    title: "KizunaAI “Hello, Fortnite”",
    subtitle: "In-game concert / spatial runtime",
    categories: ["fortnite", "metaverse", "concert"],
    imageSrc: "/alche-top-page/works/kizunaai-poster.png",
  },
  {
    code: "WK-02",
    date: "2025 05.16",
    title: "WEAR GO LAND",
    subtitle: "Fashion metaverse / mobile + unreal",
    categories: ["stellla", "mobile", "unreal"],
    imageSrc: "/alche-top-page/works/wear-go-land-poster.png",
  },
  {
    code: "WK-03",
    date: "2025 02.20",
    title: "DISCOAT 2025SS EXHIBITION",
    subtitle: "Virtual exhibition / cloud rendered spatial retail",
    categories: ["fashion", "cloud", "metaverse"],
    imageSrc: "/alche-top-page/works/discoat-poster.png",
  },
  {
    code: "WK-04",
    date: "2024 10.18",
    title: "Matsuken Samba II Rise Up the World",
    subtitle: "Mass live activation / performance world",
    categories: ["fortnite", "live", "brand world"],
    imageSrc: "/alche-top-page/works/matsuken-samba-poster.png",
  },
] as const;

const sharedServiceMeta = [
  {
    code: "SV-01",
    title: "Fortnite Creative Works",
    badge: "CREATED IN FORTNITE",
    imageSrc: "/alche-top-page/works/matsuken-samba-poster.png",
  },
  {
    code: "SV-02",
    title: "Unreal Engine Works",
    badge: "UNREAL ENGINE",
    imageSrc: "/alche-top-page/works/discoat-poster.png",
  },
  {
    code: "SV-03",
    title: "stellla Platform",
    badge: "stellla",
    imageSrc: "/alche-top-page/works/wear-go-land-poster.png",
  },
] as const;

function buildServiceItems(bodies: readonly [string, string, string]): AlcheServiceItem[] {
  return sharedServiceMeta.map((meta, index) => ({ ...meta, body: bodies[index] }));
}

const serviceBodies = {
  en: [
    "Branded playable worlds and large-scale interactive events built around IP, artists, and audience participation.",
    "Cloud-rendered and device-targeted experiences that extend game-engine quality into immersive entertainment products.",
    "A reusable metaverse platform layer for fashion, live events, and industrial-grade digital spaces.",
  ],
  "zh-CN": [
    "围绕 IP、艺人与观众参与打造的品牌可玩世界与大型互动活动。",
    "以云渲染与多终端适配，把游戏引擎级画质延伸到沉浸式娱乐产品中。",
    "面向时尚、现场活动与工业级数字空间的可复用元宇宙平台层。",
  ],
  ja: [
    "IP・アーティスト・観客参加を軸にした、ブランドのプレイアブルワールドと大規模インタラクティブイベント。",
    "クラウドレンダリングとデバイス最適化で、ゲームエンジン品質を没入型エンタメへ広げる体験。",
    "ファッション、ライブイベント、産業向けデジタル空間に使える再利用可能なメタバース基盤。",
  ],
  ko: [
    "IP, 아티스트, 관객 참여를 중심으로 만든 브랜드 플레이어블 월드와 대규모 인터랙티브 이벤트.",
    "클라우드 렌더링과 디바이스 최적화로 게임 엔진 품질을 몰입형 엔터테인먼트로 확장하는 경험.",
    "패션, 라이브 이벤트, 산업용 디지털 공간을 위한 재사용 가능한 메타버스 플랫폼 레이어.",
  ],
} as const satisfies Record<Locale, readonly [string, string, string]>;

const sharedEndmarkFooter = {
  columns: [
    { title: "Top", items: ["News", "Works"] },
    { title: "About", items: ["stellla", "Contact"] },
    { title: "Links ▼", items: ["GitHub", "Email"] },
  ],
  actions: ["Contact ↗", "Recruit ↗"],
  legalLinks: ["Privacy Policy", "License"],
  copyright: "©2026 MOONFLOW.",
} as const satisfies AlcheEndmarkFooterCopy;

export const alcheTopPageCopy: Record<Locale, AlcheTopPageCopy> = {
  en: {
    metadata: {
      title: "MOONFLOW Top-Page",
      description: "MOONFLOW top-page with a persistent single-canvas world, editorial DOM systems, and fine-grained top-page choreography.",
    },
    loading: {
      eyebrow: "Architect worlds",
      body: "that move hearts and spark hope.",
    },
    header: {
      navAria: "MOONFLOW top-page navigation",
      localeLabel: "Language",
      navItems: [
        { id: "news", label: "News", target: "kv" },
        { id: "works", label: "Works", target: "works" },
        { id: "about", label: "About", target: "mission" },
        { id: "stellla", label: "stellla", target: "stellla" },
      ],
      contactLabel: "Contact",
      recruitLabel: "Recruit",
      soundLabel: "Sound",
    },
    indicator: {
      title: "Top scroll indicator",
      groups: {
        top: "TOP",
        works: "WORKS",
        about: "ABOUT",
        vision: "VISION",
        service: "SERVICE",
      },
    },
    news: {
      title: "News",
      items: [...sharedNews],
    },
    hud: {
      title: "MOONFLOW",
      subtitle: "Black stage / technical field / brand motion",
      metrics: ["THICK REFRACTIVE A", "EMISSIVE MOONFLOW", "CYLINDRICAL MEDIA WALL"],
      note: "Signal folds through the A before the wall hands authority to works.",
    },
    works: {
      eyebrow: "Works / same world, reassigned authority",
      title: "The project field detaches from the wall and takes foreground authority.",
      body: "The active work holds center while the side queue keeps the curved system visible.",
      moreLabel: "More Works",
      items: [...sharedWorks],
    },
    mission: {
      eyebrow: "Mission",
      title: "Pioneering immersive and experiential entertainment like no other.",
      body: "The world is purified into a white technical field instead of cutting to a generic content page.",
    },
    vision: {
      eyebrow: "Vision",
      title: "Architect worlds that move hearts and spark hope.",
      body: "Mission and vision are distinct conceptual beats. They are not one undifferentiated about section.",
    },
    service: {
      eyebrow: "Service",
      title: "Production systems across interactive worlds, Unreal environments, and platformized spatial products.",
      wallWord: "SERVICES",
      items: buildServiceItems(serviceBodies.en),
    },
    stellla: {
      eyebrow: "stellla",
      title: "A branded platform module layered over a deeper spatial scene.",
      body: "The architectural read stabilizes first; editorial framing arrives after the space is understood.",
      frameLabel: "Platform frame",
    },
    outro: {
      eyebrow: "Outro",
      title: "The deep scene drains into a black brand stage.",
      body: "The final read is MOONFLOW, then footer utility. This is an outro system, not a plain contact block.",
      linksTitle: "Links",
      legalTitle: "Legal",
      companyLabel: "Brand system / Zhouyu Liao · 流月工作室",
      privacyLabel: "Privacy Policy",
      licenseLabel: "License",
      copyright: "©2026 MOONFLOW.",
      footer: sharedEndmarkFooter,
    },
  },
  "zh-CN": {
    metadata: {
      title: "MOONFLOW 首页",
      description: "MOONFLOW top-page，包含单 canvas 世界、编辑化 DOM 系统和细粒度转场状态图。",
    },
    loading: {
      eyebrow: "构筑世界",
      body: "让它打动人心，并点燃希望。",
    },
    header: {
      navAria: "MOONFLOW 首页导航",
      localeLabel: "语言",
      navItems: [
        { id: "news", label: "News", target: "kv" },
        { id: "works", label: "Works", target: "works" },
        { id: "about", label: "About", target: "mission" },
        { id: "stellla", label: "stellla", target: "stellla" },
      ],
      contactLabel: "Contact",
      recruitLabel: "Recruit",
      soundLabel: "声音",
    },
    indicator: {
      title: "滚动指示器",
      groups: {
        top: "TOP",
        works: "WORKS",
        about: "ABOUT",
        vision: "VISION",
        service: "SERVICE",
      },
    },
    news: {
      title: "News",
      items: sharedNews.map((item) => ({ ...item })),
    },
    hud: {
      title: "MOONFLOW",
      subtitle: "黑色舞台 / 技术场 / 品牌运动",
      metrics: ["厚实体折射 A", "发光 MOONFLOW 字层", "圆柱媒体墙"],
      note: "信号先穿过 A，再把主读交给 works。",
    },
    works: {
      eyebrow: "Works / 同一世界内的主次转移",
      title: "项目场从墙体中抽离，并接管前景主读。",
      body: "主作品稳定在中央，侧卡继续维持弧形队列关系。",
      moreLabel: "More Works",
      items: sharedWorks.map((item) => ({ ...item })),
    },
    mission: {
      eyebrow: "Mission",
      title: "创造前所未有的沉浸式、体验式娱乐。",
      body: "世界被净化成白色技术场，而不是硬切到普通内容页。",
    },
    vision: {
      eyebrow: "Vision",
      title: "构筑能撼动内心、也能激发希望的世界。",
      body: "Mission 和 Vision 是两个独立的概念节拍，不能再被压成一个 about。",
    },
    service: {
      eyebrow: "Service",
      title: "覆盖互动世界、Unreal 场景与平台化空间产品的制作系统。",
      wallWord: "SERVICES",
      items: buildServiceItems(serviceBodies["zh-CN"]),
    },
    stellla: {
      eyebrow: "stellla",
      title: "先读到更深的空间，再由品牌化 editorial 模块接管。",
      body: "必须先建立建筑/场景读数，再进入 `stellla` 的版式层。",
      frameLabel: "平台框架",
    },
    outro: {
      eyebrow: "Outro",
      title: "深 3D 世界退场，收束为黑色品牌舞台。",
      body: "最终先读到 MOONFLOW，再读页脚信息。这里是 outro，不是普通 contact 区块。",
      linksTitle: "链接",
      legalTitle: "法律",
      companyLabel: "品牌系统 / Zhouyu Liao · 流月工作室",
      privacyLabel: "隐私政策",
      licenseLabel: "许可",
      copyright: "©2026 MOONFLOW.",
      footer: sharedEndmarkFooter,
    },
  },
  ja: {
    metadata: {
      title: "MOONFLOW Top-Page",
      description: "MOONFLOW top-page。単一 canvas、編集的 DOM、細粒度セクション構造を持つ。",
    },
    loading: {
      eyebrow: "Architect worlds",
      body: "that move hearts and spark hope.",
    },
    header: {
      navAria: "MOONFLOW top-page navigation",
      localeLabel: "Language",
      navItems: [
        { id: "news", label: "News", target: "kv" },
        { id: "works", label: "Works", target: "works" },
        { id: "about", label: "About", target: "mission" },
        { id: "stellla", label: "stellla", target: "stellla" },
      ],
      contactLabel: "Contact",
      recruitLabel: "Recruit",
      soundLabel: "Sound",
    },
    indicator: {
      title: "Top scroll indicator",
      groups: {
        top: "TOP",
        works: "WORKS",
        about: "ABOUT",
        vision: "VISION",
        service: "SERVICE",
      },
    },
    news: {
      title: "News",
      items: sharedNews.map((item) => ({ ...item })),
    },
    hud: {
      title: "MOONFLOW",
      subtitle: "黒いステージ / テクニカルフィールド / ブランドモーション",
      metrics: ["厚い屈折 A", "発光する MOONFLOW", "円筒メディアウォール"],
      note: "信号はまず A を通り、その後 works へ主読を渡す。",
    },
    works: {
      eyebrow: "Works / 同じ世界の中で権威が移る",
      title: "プロジェクトフィールドが壁から離れ、前景の主読になる。",
      body: "メインワークが中央に定着し、サイドキューが曲面システムを維持する。",
      moreLabel: "More Works",
      items: sharedWorks.map((item) => ({ ...item })),
    },
    mission: {
      eyebrow: "Mission",
      title: "これまでにない没入型・体験型エンターテインメントを生み出す。",
      body: "世界は白い技術場へ純化され、一般的な内容ページへは切り替わらない。",
    },
    vision: {
      eyebrow: "Vision",
      title: "心を揺さぶり、希望を持てる世界を作る。",
      body: "Mission と Vision は別の概念ビートであり、一つの about にまとめてはいけない。",
    },
    service: {
      eyebrow: "Service",
      title: "インタラクティブな世界、Unreal 環境、空間プロダクト基盤を横断する制作システム。",
      wallWord: "SERVICES",
      items: buildServiceItems(serviceBodies["ja"]),
    },
    stellla: {
      eyebrow: "stellla",
      title: "より深い空間読解のあとに、ブランド化された editorial モジュールが入る。",
      body: "まず建築的な読みが必要で、その後に `stellla` の版面が支配する。",
      frameLabel: "Platform frame",
    },
    outro: {
      eyebrow: "Outro",
      title: "深い 3D は抜け、黒いブランドステージへ収束する。",
      body: "最終読解は MOONFLOW、その後にフッター情報。ここは contact ではなく outro である。",
      linksTitle: "Links",
      legalTitle: "Legal",
      companyLabel: "Brand system / Zhouyu Liao · 流月工作室",
      privacyLabel: "Privacy Policy",
      licenseLabel: "License",
      copyright: "©2026 MOONFLOW.",
      footer: sharedEndmarkFooter,
    },
  },
  ko: {
    metadata: {
      title: "MOONFLOW Top-Page",
      description: "MOONFLOW top-page. 단일 canvas, 편집형 DOM, 세분화된 section graph를 사용한다.",
    },
    loading: {
      eyebrow: "Architect worlds",
      body: "that move hearts and spark hope.",
    },
    header: {
      navAria: "MOONFLOW top-page navigation",
      localeLabel: "Language",
      navItems: [
        { id: "news", label: "News", target: "kv" },
        { id: "works", label: "Works", target: "works" },
        { id: "about", label: "About", target: "mission" },
        { id: "stellla", label: "stellla", target: "stellla" },
      ],
      contactLabel: "Contact",
      recruitLabel: "Recruit",
      soundLabel: "Sound",
    },
    indicator: {
      title: "Top scroll indicator",
      groups: {
        top: "TOP",
        works: "WORKS",
        about: "ABOUT",
        vision: "VISION",
        service: "SERVICE",
      },
    },
    news: {
      title: "News",
      items: sharedNews.map((item) => ({ ...item })),
    },
    hud: {
      title: "MOONFLOW",
      subtitle: "블랙 스테이지 / 테크니컬 필드 / 브랜드 모션",
      metrics: ["두꺼운 굴절 A", "발광 MOONFLOW", "원통형 미디어 월"],
      note: "신호는 먼저 A를 통과하고, 그 다음 works로 권한을 넘긴다.",
    },
    works: {
      eyebrow: "Works / 같은 세계 안에서 권한이 이동한다",
      title: "프로젝트 필드가 벽에서 분리되어 전경의 주도권을 잡는다.",
      body: "메인 워크가 중앙을 잡고, 사이드 큐는 곡면 시스템을 유지한다.",
      moreLabel: "More Works",
      items: sharedWorks.map((item) => ({ ...item })),
    },
    mission: {
      eyebrow: "Mission",
      title: "지금까지 없던 몰입형·체험형 엔터테인먼트를 만든다.",
      body: "세계는 일반 콘텐츠 페이지가 아니라 흰 기술 필드로 정제된다.",
    },
    vision: {
      eyebrow: "Vision",
      title: "마음을 흔들고 희망을 주는 세계를 설계한다.",
      body: "Mission 과 Vision 은 하나의 about 덩어리가 아니라 분리된 개념 비트다.",
    },
    service: {
      eyebrow: "Service",
      title: "인터랙티브 월드, Unreal 환경, 플랫폼형 공간 제품을 가로지르는 제작 시스템.",
      wallWord: "SERVICES",
      items: buildServiceItems(serviceBodies["ko"]),
    },
    stellla: {
      eyebrow: "stellla",
      title: "더 깊은 공간이 먼저 읽히고, 그 뒤에 브랜드형 editorial 모듈이 온다.",
      body: "건축적 읽기가 먼저 안정되어야 하며, 그 다음 `stellla` 레이어가 들어와야 한다.",
      frameLabel: "Platform frame",
    },
    outro: {
      eyebrow: "Outro",
      title: "깊은 3D 는 빠지고 검은 브랜드 스테이지로 수렴한다.",
      body: "최종 읽기는 MOONFLOW, 그 다음이 푸터 유틸리티다. 이것은 단순 contact 블록이 아니다.",
      linksTitle: "Links",
      legalTitle: "Legal",
      companyLabel: "Brand system / Zhouyu Liao · 流月工作室",
      privacyLabel: "Privacy Policy",
      licenseLabel: "License",
      copyright: "©2026 MOONFLOW.",
      footer: sharedEndmarkFooter,
    },
  },
};
