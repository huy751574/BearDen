export interface Song {
  title: string;
  file: string;
  lyrics: boolean;
}

export interface YoutubeVideo {
  id: string;
  title: string;
  kind: 'instrumental' | 'lyrics';
}

export interface SceneInfo {
  id: string;
  theme: string;
  subLabel: string;
  title: string;
  folders: string[];
  hasLyrics: boolean;
  video: string | null;
  songs: Song[];
  youtube: YoutubeVideo[];
}

export interface ThemeInfo {
  id: string;
  name: string;
  scenes: string[];
}

export interface Manifest {
  themes: ThemeInfo[];
  scenes: SceneInfo[];
}
