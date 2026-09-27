export const SITE = {
  name: "Ashen Archive",
  studioName: "流月工作室",
  founderName: "Zhouyu Liao",
  siteUrl: "https://moonflowflower.github.io",
  basePath: "/CVWebsite",
  localeStorageKey: "ashen-archive-locale",
} as const;

export const SECTION_IDS = [
  "hero-wordmark",
  "discipline-strip",
  "showcase-wall",
  "manifesto-inversion",
  "selected-work",
  "contact-coda",
] as const;

export function assetPath(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${SITE.basePath}${normalizedPath}`;
}

export function absoluteUrl(path: string) {
  return new URL(path, SITE.siteUrl).toString();
}
