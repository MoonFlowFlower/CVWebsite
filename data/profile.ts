export interface StudioDossierAsset {
  available: boolean;
  href: string;
}

export interface ContactLink {
  key: "email" | "github" | "linkedin" | "dossier";
  href: string;
  label: string;
  available: boolean;
}

export const studioDossierAsset: StudioDossierAsset = {
  available: false,
  href: "",
};

export const contactLinks: ContactLink[] = [
  {
    key: "email",
    href: "mailto:moonlight1939300864@gmail.com",
    label: "moonlight1939300864@gmail.com",
    available: true,
  },
  {
    key: "github",
    href: "https://github.com/MoonFlowFlower",
    label: "github.com/MoonFlowFlower",
    available: true,
  },
  {
    key: "linkedin",
    href: "",
    label: "LinkedIn profile available on request",
    available: false,
  },
  {
    key: "dossier",
    href: "",
    label: "",
    available: false,
  },
];
