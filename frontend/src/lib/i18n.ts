export type PreferredLanguage = "en" | "fil" | "bilingual";

export function normalizeLanguage(lang?: string | null): PreferredLanguage {
  if (lang === "fil" || lang === "bilingual") return lang;
  return "en";
}

export function tText(
  lang: PreferredLanguage,
  en: string,
  fil?: string | null
): string {
  const filClean = fil?.trim();
  if (!filClean) return en;
  if (lang === "fil") return filClean;
  if (lang === "bilingual") return `${en} (${filClean})`;
  return en;
}

export function tLines(
  lang: PreferredLanguage,
  en: string,
  fil?: string | null
): { primary: string; secondary?: string } {
  const filClean = fil?.trim();
  if (!filClean || lang === "en") return { primary: en };
  if (lang === "fil") return { primary: filClean };
  return { primary: en, secondary: filClean };
}

export const SUBJECT_FIL: Record<string, string> = {
  "alphabet-language": "Alpabeto at Wika",
  mathematics: "Matematika at Pagbilang",
  "science-discovery": "Agham at Pagtuklas",
  "social-emotional": "Damdamin at Kabaitan",
  "arts-creativity": "Sining at Paglikha",
  "life-skills": "Kasanayan sa Araw-araw",
};

export const THEME_FIL: Record<string, { title: string; summary: string }> = {
  "colors-around-us": {
    title: "Mga Kulay sa Ating Paligid",
    summary: "Tuklasin ang matingkad na kulay ng kalikasan, prutas, at laruan!",
  },
  "my-alphabet-adventure": {
    title: "Paglalakbay sa Alpabeto at Abakada",
    summary: "Kilalanin ang tunog ng mga titik sa masayang kuwento at laro.",
  },
  "counting-everyday-objects": {
    title: "Pagbibilang ng Gamit sa Bahay",
    summary: "Magbilang mula 1 hanggang 20 gamit ang mangga, kutsara, at bloke.",
  },
  "shapes-at-home": {
    title: "Mga Hugis sa Ating Tahanan",
    summary: "Hanapin ang bilog, parisukat, at tatsulok sa plato, bintana, at bubong.",
  },
  "animals-and-their-homes": {
    title: "Mga Hayop at Kanilang Tirahan",
    summary: "Alamin kung saan nakatira ang ibon, isda, palaka, at kuneho.",
  },
  "healthy-food": {
    title: "Masustansyang Gulay at Prutas",
    summary: "Piliin ang makukulay na gulay, prutas, at tubig na nagpapalakas.",
  },
  "my-five-senses": {
    title: "Aking Limang Pandama",
    summary: "Gamitin ang mata, tainga, ilong, kamay, at panglasa sa pagtuklas.",
  },
  "understanding-emotions": {
    title: "Pag-unawa sa Damdamin",
    summary: "Kilalanin ang masaya, kalmado, nagulat, at malungkot na damdamin.",
  },
  "plants-and-gardening": {
    title: "Pagtatanim ng Halaman",
    summary: "Panoorin ang pagtubo ng buto ng munggo sa tulong ng tubig at araw.",
  },
  "community-helpers": {
    title: "Mga Katulong sa Barangay",
    summary: "Magpasalamat sa guro, doktor, magsasaka, at bumbero sa komunidad.",
  },
  "weather-and-nature": {
    title: "Panahon at Kalikasan",
    summary: "Kilalanin ang Tag-init at Tag-ulan at mga tamang gamit araw-araw.",
  },
  "friendship-and-kindness": {
    title: "Pagkakaibigan at Bayanihan",
    summary: "Magsanay sa pagbabahagi, paghihintay ng turn, at mabait na salita.",
  },
};

export interface GardenCropMeta {
  key: "kalabasa" | "kamatis" | "sitaw" | "talong" | "saging" | "sampaguita";
  nameEn: string;
  nameFil: string;
  stages: [string, string, string, string];
  factEn: string;
  factFil: string;
  bg: string;
}

export const GARDEN_CROPS: readonly GardenCropMeta[] = [
  {
    key: "kalabasa",
    nameEn: "Squash (Kalabasa)",
    nameFil: "Kalabasa",
    stages: ["🌰", "🌱", "🌼", "🎃"],
    factEn: "Kalabasa helps keep our eyes bright and strong!",
    factFil: "Ang kalabasa ay nagpapalinaw ng ating mga mata!",
    bg: "#FFF5CF",
  },
  {
    key: "kamatis",
    nameEn: "Tomato (Kamatis)",
    nameFil: "Kamatis",
    stages: ["🌰", "🌱", "🌿", "🍅"],
    factEn: "Juicy red kamatis shines bright in healthy meals!",
    factFil: "Ang pulang kamatis ay masustansya at masarap!",
    bg: "#FFE3DE",
  },
  {
    key: "sitaw",
    nameEn: "String Beans (Sitaw)",
    nameFil: "Sitaw",
    stages: ["🌰", "🌱", "🪴", "🫛"],
    factEn: "Sitaw vines love climbing up bamboo trellises!",
    factFil: "Masayang gumagapang ang sitaw sa kawayan!",
    bg: "#DDF8EC",
  },
  {
    key: "talong",
    nameEn: "Eggplant (Talong)",
    nameFil: "Talong",
    stages: ["🌰", "🌱", "🪻", "🍆"],
    factEn: "Purple talong grows proudly in sunny gardens!",
    factFil: "Kulay lila ang talong sa hardin ng Bahay Kubo!",
    bg: "#EDE7FE",
  },
  {
    key: "saging",
    nameEn: "Banana (Saging)",
    nameFil: "Saging",
    stages: ["🌰", "🌱", "🌴", "🍌"],
    factEn: "Sweet saging gives busy kids happy energy to play!",
    factFil: "Ang matamis na saging ay nagbibigay-lakas sa paglalaro!",
    bg: "#FFE58A",
  },
  {
    key: "sampaguita",
    nameEn: "Sampaguita Flower",
    nameFil: "Sampaguita",
    stages: ["🌰", "🌱", "🪷", "🌸"],
    factEn: "Sampaguita smells sweet and reminds us of warm kindness!",
    factFil: "Mabango ang Sampaguita—ang ating pambansang bulaklak!",
    bg: "#DCF2FD",
  },
] as const;

export const STICKERS_META: Record<
  string,
  { emoji: string; titleEn: string; titleFil: string }
> = {
  "colors-around-us": { emoji: "🌈", titleEn: "Bahaghari Colors", titleFil: "Kulay Bahaghari" },
  "my-alphabet-adventure": { emoji: "🔤", titleEn: "Abakada Explorer", titleFil: "Abakada Star" },
  "counting-everyday-objects": { emoji: "🥭", titleEn: "Mango Counter", titleFil: "Bilang Mangga" },
  "shapes-at-home": { emoji: "🏡", titleEn: "Bahay Kubo Shapes", titleFil: "Hugis sa Bahay" },
  "animals-and-their-homes": { emoji: "🐃", titleEn: "Kalabaw Buddy", titleFil: "Kaibigang Hayop" },
  "healthy-food": { emoji: "🍌", titleEn: "Saging Energy", titleFil: "Batang Malusog" },
  "my-five-senses": { emoji: "👀", titleEn: "Senses Detective", titleFil: "Limang Pandama" },
  "understanding-emotions": { emoji: "💛", titleEn: "Kind Heart", titleFil: "Mabuting Puso" },
  "plants-and-gardening": { emoji: "🌱", titleEn: "Munggo Sprout", titleFil: "Hardinerong Bata" },
  "community-helpers": { emoji: "🙏", titleEn: "Salamat Po!", titleFil: "Magalang na Bata" },
  "weather-and-nature": { emoji: "☂️", titleEn: "Payong Explorer", titleFil: "Tag-araw at Ulan" },
  "friendship-and-kindness": { emoji: "🤝", titleEn: "Bayanihan Star", titleFil: "Bituin ng Bayanihan" },
};

export const KIDS_UI = {
  home: { en: "Home", fil: "Tahanan" },
  learn: { en: "Learn", fil: "Matuto" },
  play: { en: "Play", fil: "Laro" },
  stories: { en: "Stories", fil: "Kuwento" },
  rewards: { en: "My Rewards", fil: "Gantimpala" },
  whoIsPlaying: { en: "Who is playing today?", fil: "Sino ang maglalaro ngayon?" },
  hello: { en: "Hello", fil: "Kumusta" },
  hearInstructions: { en: "Hear Instructions", fil: "Pakinggan" },
  todaysMission: { en: "Today's Mission", fil: "Misyon Ngayon" },
  startAdventure: { en: "Start Adventure", fil: "Simulan" },
  openArtStudio: { en: "Open Art Studio", fil: "Buksan ang Sining" },
  playAgain: { en: "Play Again", fil: "Maglaro Uli" },
  startLesson: { en: "Start Lesson", fil: "Simulan ang Aralin" },
  starsLabel: { en: "Stars", fil: "Bituin" },
  streakLabel: { en: "Day Streak", fil: "Araw na Sunod" },
  exitGrownUp: { en: "Grown-Up Exit", fil: "Lumabas (Magulang)" },
  restHeadline: {
    en: "Time to Rest & Play Together!",
    fil: "Oras nang Magpahinga at Maglaro sa Labas!",
  },
  restMessage: {
    en: "You did wonderful learning today! Let's rest our eyes and try a fun no-screen activity with family.",
    fil: "Ang galing mo ngayong araw! Ipahinga muna natin ang mga mata at maglaro kasama si Nanay, Tatay, o Lola.",
  },
};
