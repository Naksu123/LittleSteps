export type NoteName =
  | "C3"
  | "D3"
  | "E3"
  | "F3"
  | "G3"
  | "A3"
  | "Bb3"
  | "B3"
  | "C4"
  | "D4"
  | "E4"
  | "F4"
  | "F#4"
  | "G4"
  | "A4"
  | "Bb4"
  | "B4"
  | "C5"
  | "D5"
  | "E5"
  | "F5"
  | "F#5"
  | "G5"
  | "A5"
  | "Bb5"
  | "B5"
  | "C6";

export interface MusicNote {
  note: NoteName | null;
  beats: number;
  bass?: NoteName;
}

export interface PreschoolSong {
  id: string;
  title: string;
  emoji: string;
  culture?: "global" | "filipino";
  lyrics?: string;
  bpm: number;
  notes: readonly MusicNote[];
}

export interface PreschoolSongSummary {
  id: string;
  title: string;
  emoji: string;
  culture?: "global" | "filipino";
  lyrics?: string;
}

/**
 * Equal-temperament note frequencies (A4 = 440 Hz) for cozy kindergarten melodies.
 */
export const NOTE_FREQUENCIES: Record<NoteName, number> = {
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  G3: 196.0,
  A3: 220.0,
  Bb3: 233.08,
  B3: 246.94,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  "F#4": 369.99,
  G4: 392.0,
  A4: 440.0,
  Bb4: 466.16,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  "F#5": 739.99,
  G5: 783.99,
  A5: 880.0,
  Bb5: 932.33,
  B5: 987.77,
  C6: 1046.5,
};

/**
 * Traditional public-domain preschool melodies arranged with warm bass roots.
 */
export const PRESCHOOL_SONGS: readonly PreschoolSong[] = [
  {
    id: "twinkle-twinkle",
    title: "Twinkle, Twinkle, Little Star",
    emoji: "⭐",
    bpm: 102,
    notes: [
      { note: "C5", beats: 1, bass: "C3" },
      { note: "C5", beats: 1 },
      { note: "G5", beats: 1, bass: "C3" },
      { note: "G5", beats: 1 },
      { note: "A5", beats: 1, bass: "F3" },
      { note: "A5", beats: 1 },
      { note: "G5", beats: 2, bass: "C3" },

      { note: "F5", beats: 1, bass: "F3" },
      { note: "F5", beats: 1 },
      { note: "E5", beats: 1, bass: "C3" },
      { note: "E5", beats: 1 },
      { note: "D5", beats: 1, bass: "G3" },
      { note: "D5", beats: 1 },
      { note: "C5", beats: 2, bass: "C3" },

      { note: "G5", beats: 1, bass: "C3" },
      { note: "G5", beats: 1 },
      { note: "F5", beats: 1, bass: "G3" },
      { note: "F5", beats: 1 },
      { note: "E5", beats: 1, bass: "C3" },
      { note: "E5", beats: 1 },
      { note: "D5", beats: 2, bass: "G3" },

      { note: "G5", beats: 1, bass: "C3" },
      { note: "G5", beats: 1 },
      { note: "F5", beats: 1, bass: "G3" },
      { note: "F5", beats: 1 },
      { note: "E5", beats: 1, bass: "C3" },
      { note: "E5", beats: 1 },
      { note: "D5", beats: 2, bass: "G3" },

      { note: "C5", beats: 1, bass: "C3" },
      { note: "C5", beats: 1 },
      { note: "G5", beats: 1, bass: "C3" },
      { note: "G5", beats: 1 },
      { note: "A5", beats: 1, bass: "F3" },
      { note: "A5", beats: 1 },
      { note: "G5", beats: 2, bass: "C3" },

      { note: "F5", beats: 1, bass: "F3" },
      { note: "F5", beats: 1 },
      { note: "E5", beats: 1, bass: "C3" },
      { note: "E5", beats: 1 },
      { note: "D5", beats: 1, bass: "G3" },
      { note: "D5", beats: 1 },
      { note: "C5", beats: 2, bass: "C3" },
    ],
  },
  {
    id: "mary-had-a-little-lamb",
    title: "Mary Had a Little Lamb",
    emoji: "🐑",
    bpm: 108,
    notes: [
      { note: "E5", beats: 1, bass: "C3" },
      { note: "D5", beats: 1 },
      { note: "C5", beats: 1, bass: "G3" },
      { note: "D5", beats: 1 },
      { note: "E5", beats: 1, bass: "C3" },
      { note: "E5", beats: 1 },
      { note: "E5", beats: 2, bass: "C3" },

      { note: "D5", beats: 1, bass: "G3" },
      { note: "D5", beats: 1 },
      { note: "D5", beats: 2 },
      { note: "E5", beats: 1, bass: "C3" },
      { note: "G5", beats: 1 },
      { note: "G5", beats: 2, bass: "C3" },

      { note: "E5", beats: 1, bass: "C3" },
      { note: "D5", beats: 1 },
      { note: "C5", beats: 1, bass: "G3" },
      { note: "D5", beats: 1 },
      { note: "E5", beats: 1, bass: "C3" },
      { note: "E5", beats: 1 },
      { note: "E5", beats: 1 },
      { note: "E5", beats: 1 },

      { note: "D5", beats: 1, bass: "G3" },
      { note: "D5", beats: 1 },
      { note: "E5", beats: 1, bass: "G3" },
      { note: "D5", beats: 1 },
      { note: "C5", beats: 4, bass: "C3" },
    ],
  },
  {
    id: "row-your-boat",
    title: "Row, Row, Row Your Boat",
    emoji: "⛵",
    bpm: 106,
    notes: [
      { note: "C5", beats: 1.5, bass: "C3" },
      { note: "C5", beats: 1.5, bass: "G3" },
      { note: "C5", beats: 1, bass: "C3" },
      { note: "D5", beats: 0.5 },
      { note: "E5", beats: 1.5, bass: "C3" },

      { note: "E5", beats: 1, bass: "C3" },
      { note: "D5", beats: 0.5 },
      { note: "E5", beats: 1, bass: "G3" },
      { note: "F5", beats: 0.5 },
      { note: "G5", beats: 3, bass: "C3" },

      { note: "C6", beats: 0.5, bass: "C3" },
      { note: "C6", beats: 0.5 },
      { note: "C6", beats: 0.5 },
      { note: "G5", beats: 0.5, bass: "G3" },
      { note: "G5", beats: 0.5 },
      { note: "G5", beats: 0.5 },
      { note: "E5", beats: 0.5, bass: "C3" },
      { note: "E5", beats: 0.5 },
      { note: "E5", beats: 0.5 },
      { note: "C5", beats: 0.5, bass: "G3" },
      { note: "C5", beats: 0.5 },
      { note: "C5", beats: 0.5 },

      { note: "G5", beats: 1, bass: "G3" },
      { note: "F5", beats: 0.5 },
      { note: "E5", beats: 1, bass: "G3" },
      { note: "D5", beats: 0.5 },
      { note: "C5", beats: 3, bass: "C3" },
    ],
  },
  {
    id: "old-macdonald",
    title: "Old MacDonald Had a Farm",
    emoji: "🚜",
    bpm: 112,
    notes: [
      { note: "C5", beats: 1, bass: "C3" },
      { note: "C5", beats: 1 },
      { note: "C5", beats: 1, bass: "G3" },
      { note: "G4", beats: 1 },
      { note: "A4", beats: 1, bass: "F3" },
      { note: "A4", beats: 1 },
      { note: "G4", beats: 2, bass: "C3" },

      { note: "E5", beats: 1, bass: "C3" },
      { note: "E5", beats: 1 },
      { note: "D5", beats: 1, bass: "G3" },
      { note: "D5", beats: 1 },
      { note: "C5", beats: 3, bass: "C3" },
      { note: "G4", beats: 1 },

      { note: "C5", beats: 1, bass: "C3" },
      { note: "C5", beats: 1 },
      { note: "C5", beats: 1, bass: "G3" },
      { note: "G4", beats: 1 },
      { note: "A4", beats: 1, bass: "F3" },
      { note: "A4", beats: 1 },
      { note: "G4", beats: 2, bass: "C3" },

      { note: "E5", beats: 1, bass: "C3" },
      { note: "E5", beats: 1 },
      { note: "D5", beats: 1, bass: "G3" },
      { note: "D5", beats: 1 },
      { note: "C5", beats: 4, bass: "C3" },
    ],
  },
  {
    id: "london-bridge",
    title: "London Bridge Is Falling Down",
    emoji: "🌉",
    bpm: 110,
    notes: [
      { note: "G5", beats: 1.5, bass: "C3" },
      { note: "A5", beats: 0.5 },
      { note: "G5", beats: 1 },
      { note: "F5", beats: 1, bass: "G3" },
      { note: "E5", beats: 1, bass: "C3" },
      { note: "F5", beats: 1 },
      { note: "G5", beats: 2, bass: "C3" },

      { note: "D5", beats: 1, bass: "G3" },
      { note: "E5", beats: 1 },
      { note: "F5", beats: 2 },
      { note: "E5", beats: 1, bass: "C3" },
      { note: "F5", beats: 1 },
      { note: "G5", beats: 2, bass: "C3" },

      { note: "G5", beats: 1.5, bass: "C3" },
      { note: "A5", beats: 0.5 },
      { note: "G5", beats: 1 },
      { note: "F5", beats: 1, bass: "G3" },
      { note: "E5", beats: 1, bass: "C3" },
      { note: "F5", beats: 1 },
      { note: "G5", beats: 2, bass: "C3" },

      { note: "D5", beats: 2, bass: "G3" },
      { note: "G5", beats: 2, bass: "G3" },
      { note: "E5", beats: 1, bass: "C3" },
      { note: "C5", beats: 3, bass: "C3" },
    ],
  },
  {
    id: "frere-jacques",
    title: "Are You Sleeping?",
    emoji: "🔔",
    bpm: 104,
    notes: [
      { note: "C5", beats: 1, bass: "C3" },
      { note: "D5", beats: 1 },
      { note: "E5", beats: 1, bass: "G3" },
      { note: "C5", beats: 1 },

      { note: "C5", beats: 1, bass: "C3" },
      { note: "D5", beats: 1 },
      { note: "E5", beats: 1, bass: "G3" },
      { note: "C5", beats: 1 },

      { note: "E5", beats: 1, bass: "C3" },
      { note: "F5", beats: 1 },
      { note: "G5", beats: 2, bass: "G3" },

      { note: "E5", beats: 1, bass: "C3" },
      { note: "F5", beats: 1 },
      { note: "G5", beats: 2, bass: "G3" },

      { note: "G5", beats: 0.5, bass: "C3" },
      { note: "A5", beats: 0.5 },
      { note: "G5", beats: 0.5 },
      { note: "F5", beats: 0.5 },
      { note: "E5", beats: 1, bass: "C3" },
      { note: "C5", beats: 1 },

      { note: "G5", beats: 0.5, bass: "G3" },
      { note: "A5", beats: 0.5 },
      { note: "G5", beats: 0.5 },
      { note: "F5", beats: 0.5 },
      { note: "E5", beats: 1, bass: "C3" },
      { note: "C5", beats: 1 },

      { note: "C5", beats: 1, bass: "C3" },
      { note: "G4", beats: 1, bass: "G3" },
      { note: "C5", beats: 2, bass: "C3" },

      { note: "C5", beats: 1, bass: "C3" },
      { note: "G4", beats: 1, bass: "G3" },
      { note: "C5", beats: 2, bass: "C3" },
    ],
  },
  {
    id: "itsy-bitsy-spider",
    title: "Itsy Bitsy Spider",
    emoji: "🕷️",
    bpm: 108,
    notes: [
      { note: "G4", beats: 0.5, bass: "G3" },
      { note: "C5", beats: 1, bass: "C3" },
      { note: "C5", beats: 0.5 },
      { note: "C5", beats: 1 },
      { note: "D5", beats: 0.5 },
      { note: "E5", beats: 1.5, bass: "C3" },
      { note: "E5", beats: 1 },
      { note: "E5", beats: 0.5 },
      { note: "D5", beats: 1, bass: "G3" },
      { note: "C5", beats: 0.5 },
      { note: "D5", beats: 1 },
      { note: "E5", beats: 0.5 },
      { note: "C5", beats: 2.5, bass: "C3" },

      { note: "E5", beats: 1.5, bass: "C3" },
      { note: "E5", beats: 1 },
      { note: "F5", beats: 0.5 },
      { note: "G5", beats: 1.5, bass: "C3" },
      { note: "G5", beats: 1.5 },
      { note: "F5", beats: 1, bass: "G3" },
      { note: "E5", beats: 0.5 },
      { note: "F5", beats: 1 },
      { note: "G5", beats: 0.5 },
      { note: "E5", beats: 2.5, bass: "C3" },

      { note: "C5", beats: 1.5, bass: "C3" },
      { note: "C5", beats: 1 },
      { note: "D5", beats: 0.5 },
      { note: "E5", beats: 1.5, bass: "C3" },
      { note: "E5", beats: 1.5 },
      { note: "D5", beats: 1, bass: "G3" },
      { note: "C5", beats: 0.5 },
      { note: "D5", beats: 1 },
      { note: "E5", beats: 0.5 },
      { note: "C5", beats: 2.5, bass: "C3" },
    ],
  },
  {
    id: "brahms-lullaby",
    title: "Lullaby and Goodnight",
    emoji: "🌙",
    bpm: 86,
    notes: [
      { note: "E5", beats: 0.5, bass: "C3" },
      { note: "E5", beats: 0.5 },
      { note: "G5", beats: 2, bass: "C3" },
      { note: "E5", beats: 0.5 },
      { note: "E5", beats: 0.5 },
      { note: "G5", beats: 2, bass: "C3" },

      { note: "E5", beats: 0.5, bass: "C3" },
      { note: "G5", beats: 0.5 },
      { note: "C6", beats: 1, bass: "F3" },
      { note: "B5", beats: 1 },
      { note: "A5", beats: 1, bass: "F3" },
      { note: "A5", beats: 1 },
      { note: "G5", beats: 1, bass: "C3" },

      { note: "D5", beats: 0.5, bass: "G3" },
      { note: "E5", beats: 0.5 },
      { note: "F5", beats: 1, bass: "G3" },
      { note: "D5", beats: 1 },
      { note: "D5", beats: 0.5 },
      { note: "E5", beats: 0.5 },
      { note: "F5", beats: 2, bass: "G3" },

      { note: "D5", beats: 0.5, bass: "G3" },
      { note: "F5", beats: 0.5 },
      { note: "B5", beats: 0.5 },
      { note: "A5", beats: 0.5 },
      { note: "G5", beats: 1, bass: "G3" },
      { note: "B5", beats: 1 },
      { note: "C6", beats: 2, bass: "C3" },

      { note: "C5", beats: 0.5, bass: "F3" },
      { note: "C5", beats: 0.5 },
      { note: "C6", beats: 2, bass: "F3" },
      { note: "A5", beats: 0.5 },
      { note: "F5", beats: 0.5 },
      { note: "G5", beats: 2, bass: "C3" },

      { note: "E5", beats: 0.5, bass: "C3" },
      { note: "C5", beats: 0.5 },
      { note: "F5", beats: 1, bass: "F3" },
      { note: "G5", beats: 1 },
      { note: "A5", beats: 1, bass: "G3" },
      { note: "G5", beats: 2, bass: "C3" },

      { note: "C5", beats: 0.5, bass: "F3" },
      { note: "C5", beats: 0.5 },
      { note: "C6", beats: 2, bass: "F3" },
      { note: "A5", beats: 0.5 },
      { note: "F5", beats: 0.5 },
      { note: "G5", beats: 2, bass: "C3" },

      { note: "E5", beats: 0.5, bass: "C3" },
      { note: "C5", beats: 0.5 },
      { note: "F5", beats: 1, bass: "G3" },
      { note: "E5", beats: 1 },
      { note: "D5", beats: 1 },
      { note: "C5", beats: 3, bass: "C3" },
    ],
  },
  {
    id: "bahay-kubo",
    title: "Bahay Kubo",
    emoji: "🏡",
    culture: "filipino",
    lyrics: "Bahay kubo, kahit munti, ang halaman doon ay sari-sari...",
    bpm: 108,
    notes: [
      { note: "G4", beats: 1, bass: "C3" },
      { note: "C5", beats: 2, bass: "C3" },
      { note: "D5", beats: 1 },
      { note: "E5", beats: 2, bass: "C3" },
      { note: "C5", beats: 1 },
      { note: "E5", beats: 1 },
      { note: "F5", beats: 2, bass: "F3" },
      { note: "D5", beats: 1 },
      { note: "B4", beats: 2, bass: "G3" },
      { note: "G4", beats: 1 },
      { note: "C5", beats: 2, bass: "C3" },
      { note: "A4", beats: 1, bass: "F3" },
      { note: "G4", beats: 2, bass: "C3" },
      { note: "E5", beats: 1 },
      { note: "D5", beats: 2, bass: "G3" },
      { note: "C5", beats: 3, bass: "C3" },
    ],
  },
  {
    id: "leron-leron-sinta",
    title: "Leron, Leron Sinta",
    emoji: "🥭",
    culture: "filipino",
    lyrics: "Leron, Leron sinta, buko ng papaya, dala-dala'y buslo...",
    bpm: 112,
    notes: [
      { note: "G4", beats: 0.5, bass: "C3" },
      { note: "E5", beats: 1, bass: "C3" },
      { note: "D5", beats: 0.5 },
      { note: "C5", beats: 1, bass: "C3" },
      { note: "E5", beats: 1 },
      { note: "G5", beats: 1, bass: "C3" },
      { note: "F5", beats: 1, bass: "F3" },
      { note: "D5", beats: 2, bass: "G3" },
      { note: "F5", beats: 1, bass: "G3" },
      { note: "E5", beats: 1, bass: "C3" },
      { note: "D5", beats: 1, bass: "G3" },
      { note: "C5", beats: 2, bass: "C3" },
    ],
  },
  {
    id: "sampung-mga-daliri",
    title: "Sampung Mga Daliri",
    emoji: "🖐️",
    culture: "filipino",
    lyrics: "Sampung mga daliri, kamay at paa, dalawang tainga, dalawang mata...",
    bpm: 108,
    notes: [
      { note: "C5", beats: 0.5, bass: "C3" },
      { note: "C5", beats: 0.5 },
      { note: "D5", beats: 0.5 },
      { note: "E5", beats: 0.5, bass: "C3" },
      { note: "G5", beats: 1, bass: "C3" },
      { note: "E5", beats: 1 },
      { note: "F5", beats: 0.5, bass: "F3" },
      { note: "F5", beats: 0.5 },
      { note: "E5", beats: 0.5 },
      { note: "D5", beats: 0.5, bass: "G3" },
      { note: "E5", beats: 1, bass: "C3" },
      { note: "C5", beats: 2, bass: "C3" },
    ],
  },
  {
    id: "ako-ay-may-lobo",
    title: "Ako ay May Lobo",
    emoji: "🎈",
    culture: "filipino",
    lyrics: "Ako ay may lobo, lumipad sa langit, di ko na nakita...",
    bpm: 100,
    notes: [
      { note: "G4", beats: 0.5, bass: "C3" },
      { note: "C5", beats: 1, bass: "C3" },
      { note: "C5", beats: 0.5 },
      { note: "D5", beats: 1, bass: "G3" },
      { note: "E5", beats: 1, bass: "C3" },
      { note: "E5", beats: 1 },
      { note: "F5", beats: 1, bass: "F3" },
      { note: "E5", beats: 1, bass: "C3" },
      { note: "D5", beats: 1, bass: "G3" },
      { note: "C5", beats: 1, bass: "C3" },
      { note: "G4", beats: 0.5, bass: "C3" },
      { note: "C5", beats: 1 },
      { note: "E5", beats: 1, bass: "C3" },
      { note: "D5", beats: 1, bass: "G3" },
      { note: "C5", beats: 2, bass: "C3" },
    ],
  },
  {
    id: "tong-tong-tong",
    title: "Tong, Tong, Tong Pakitong-Kitong",
    emoji: "🦀",
    culture: "filipino",
    lyrics: "Tong, tong, tong, tong pakitong-kitong, alimango sa dagat...",
    bpm: 112,
    notes: [
      { note: "C5", beats: 1, bass: "C3" },
      { note: "C5", beats: 1 },
      { note: "C5", beats: 1, bass: "C3" },
      { note: "G5", beats: 1 },
      { note: "E5", beats: 0.5, bass: "C3" },
      { note: "E5", beats: 0.5 },
      { note: "D5", beats: 0.5, bass: "G3" },
      { note: "D5", beats: 0.5 },
      { note: "C5", beats: 1, bass: "C3" },
      { note: "E5", beats: 0.5, bass: "C3" },
      { note: "G5", beats: 0.5 },
      { note: "E5", beats: 1, bass: "C3" },
      { note: "D5", beats: 1, bass: "G3" },
      { note: "C5", beats: 2, bass: "C3" },
    ],
  },
];

/**
 * Returns a Fisher-Yates shuffled playlist queue, ensuring the first track does
 * not immediately repeat the previously playing song.
 */
export function createShuffledSongQueue(excludeFirstId?: string): PreschoolSong[] {
  const queue = [...PRESCHOOL_SONGS];
  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = queue[i];
    queue[i] = queue[j];
    queue[j] = tmp;
  }

  if (excludeFirstId && queue.length > 1 && queue[0].id === excludeFirstId) {
    const swapIdx = 1 + Math.floor(Math.random() * (queue.length - 1));
    const tmp = queue[0];
    queue[0] = queue[swapIdx];
    queue[swapIdx] = tmp;
  }

  return queue;
}

export function toSongSummary(song: PreschoolSong): PreschoolSongSummary {
  return {
    id: song.id,
    title: song.title,
    emoji: song.emoji,
    culture: song.culture,
    lyrics: song.lyrics,
  };
}
