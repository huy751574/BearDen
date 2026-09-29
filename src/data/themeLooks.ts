// Visual preset per theme. M3 replaces these with full templates; for now they
// drive sky, light, ground, vegetation and particles of the shared test diorama.

export type Vegetation = 'pine' | 'round' | 'bamboo' | 'palm' | 'crystal' | 'none';
export type Particles = 'fireflies' | 'snow' | 'petals' | 'sparks' | 'stars' | 'rain' | 'none';

export interface ThemeLook {
  tagline: string;
  skyTop: string;
  skyBottom: string;
  fog: string;
  ground: string;
  groundSide: string;
  water: string;
  sun: string;
  sunIntensity: number;
  ambient: number;
  accent: string;
  vegetation: Vegetation;
  leaf: string;
  particles: Particles;
  lanterns: boolean;
}

const night = { sun: '#9fb4ff', sunIntensity: 0.9, ambient: 0.55 };
const day = { sun: '#fff1d6', sunIntensity: 2.2, ambient: 0.9 };

export const THEME_LOOKS: Record<string, ThemeLook> = {
  adventure: { tagline: 'Castles, pyramids and the moon', skyTop: '#4a8fd8', skyBottom: '#f7d9a8', fog: '#e8d4b0', ground: '#d9b97a', groundSide: '#8a6a44', water: '#3aa6c9', ...day, accent: '#f2a93b', vegetation: 'palm', leaf: '#5aa34a', particles: 'none', lanterns: false },
  bloom: { tagline: 'Cat idol, festivals and spring', skyTop: '#f7a8c8', skyBottom: '#ffe6c9', fog: '#ffd9e6', ground: '#9fd18a', groundSide: '#6b8f52', water: '#8fd3f0', ...day, accent: '#ff7eb6', vegetation: 'round', leaf: '#ffb3d1', particles: 'petals', lanterns: false },
  chill: { tagline: 'Neon cafés, ramen and night trains', skyTop: '#1b1640', skyBottom: '#6a3d8f', fog: '#3d2a5c', ground: '#4a4560', groundSide: '#2a2640', water: '#4a6fd0', ...night, accent: '#ff4fd8', vegetation: 'none', leaf: '#4fd1ff', particles: 'rain', lanterns: true },
  cover: { tagline: 'Game and cartoon covers', skyTop: '#2d2150', skyBottom: '#d96a6a', fog: '#8a4a6a', ground: '#5b4a7a', groundSide: '#33284a', water: '#6ab0ff', ...night, accent: '#ffcf4f', vegetation: 'crystal', leaf: '#9f7bff', particles: 'stars', lanterns: true },
  hunting: { tagline: 'Wild forest, rivers and peaks', skyTop: '#3a4a52', skyBottom: '#a8a890', fog: '#7d8579', ground: '#5d6b3f', groundSide: '#3d3527', water: '#3f6f7a', sun: '#ffe2b8', sunIntensity: 1.3, ambient: 0.6, accent: '#d24b3a', vegetation: 'pine', leaf: '#2f4d33', particles: 'none', lanterns: false },
  isekai: { tagline: 'Hero party, taverns and dungeons', skyTop: '#3f6fb5', skyBottom: '#f3c98b', fog: '#d9b98f', ground: '#86b35a', groundSide: '#6a4f33', water: '#4a9fd0', ...day, accent: '#c9a13b', vegetation: 'round', leaf: '#4f8f3a', particles: 'fireflies', lanterns: true },
  lullabies: { tagline: 'Cozy naps and bedtime stories', skyTop: '#1d2550', skyBottom: '#5a5a9a', fog: '#3a3f70', ground: '#dfe6f5', groundSide: '#8d8fb0', water: '#5a6fb0', ...night, accent: '#ffd98a', vegetation: 'pine', leaf: '#3c5a6a', particles: 'snow', lanterns: true },
  parfum: { tagline: 'Mademoiselle on the bridge', skyTop: '#f0b8a0', skyBottom: '#fff0d8', fog: '#f5d8c8', ground: '#b8d49a', groundSide: '#8a7a6a', water: '#8fc0d8', ...day, accent: '#e05a7a', vegetation: 'round', leaf: '#f5a0b8', particles: 'petals', lanterns: false },
  'power-bearer': { tagline: 'Mecha battles and villains', skyTop: '#140d2a', skyBottom: '#c2410c', fog: '#4a1d2a', ground: '#3a3d48', groundSide: '#1f2028', water: '#ff6a2a', sun: '#ffb070', sunIntensity: 1.6, ambient: 0.5, accent: '#38e1ff', vegetation: 'crystal', leaf: '#38e1ff', particles: 'sparks', lanterns: false },
  relax: { tagline: 'Lakes, snow, wheat and stars', skyTop: '#5b8fd6', skyBottom: '#ffd8a8', fog: '#e8d8c0', ground: '#9cc37a', groundSide: '#6b5a44', water: '#5ab0d8', ...day, accent: '#f5b84a', vegetation: 'pine', leaf: '#4a7d4f', particles: 'fireflies', lanterns: false },
  'sun-and-moon': { tagline: 'Light, rain and prisms', skyTop: '#2a3a7a', skyBottom: '#ffb88a', fog: '#c89aa8', ground: '#c8d8e8', groundSide: '#7a8098', water: '#9ad0ff', sun: '#ffd8a0', sunIntensity: 1.8, ambient: 0.8, accent: '#ffe07a', vegetation: 'crystal', leaf: '#cfe8ff', particles: 'stars', lanterns: false },
  'to-hong': { tagline: 'Red threads and the weaver', skyTop: '#3a1a3a', skyBottom: '#e07a5a', fog: '#9a4a4a', ground: '#8aa86a', groundSide: '#5a3a2a', water: '#5a7ab0', ...night, accent: '#e0303a', vegetation: 'bamboo', leaf: '#6a9a4a', particles: 'fireflies', lanterns: true },
  vietnam: { tagline: 'Rivers, lotus and the homeland', skyTop: '#4a9ad0', skyBottom: '#ffe0a0', fog: '#d8e0c0', ground: '#7ab84a', groundSide: '#6a4a2a', water: '#3a9a9a', ...day, accent: '#da251d', vegetation: 'palm', leaf: '#3a8a3a', particles: 'none', lanterns: true },
  wuxia: { tagline: 'Bamboo, jade bridges and duels', skyTop: '#6a9ab0', skyBottom: '#f0e8d0', fog: '#d0dcd0', ground: '#8ab07a', groundSide: '#5a6a4a', water: '#6ab0a0', sun: '#fff0d0', sunIntensity: 1.6, ambient: 0.85, accent: '#c0392b', vegetation: 'bamboo', leaf: '#5a9a4a', particles: 'petals', lanterns: true },
};

export function lookFor(themeId: string): ThemeLook {
  return THEME_LOOKS[themeId] ?? THEME_LOOKS.relax;
}
