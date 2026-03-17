export interface AnimationFrame {
  t: number;
  dice: { px: number; py: number; pz: number; qx: number; qy: number; qz: number; qw: number }[];
}

export interface AnimationData {
  diceCount: number;
  duration: number;
  finalFaces: number[];
  frames: AnimationFrame[];
}

type Manifest = Partial<Record<string, string[]>>;

let manifestCache: Manifest | null = null;
const animCache = new Map<string, AnimationData>();

export async function loadManifest(): Promise<Manifest> {
  if (manifestCache) return manifestCache;
  const res = await fetch(`${import.meta.env.BASE_URL}animations/manifest.json`);
  if (!res.ok) throw new Error(`Failed to load manifest: ${res.status}`);
  manifestCache = await res.json() as Manifest;
  return manifestCache;
}

export function clearManifestCache(): void {
  manifestCache = null;
  animCache.clear();
}

async function fetchAnimation(path: string): Promise<AnimationData> {
  if (animCache.has(path)) return animCache.get(path)!;
  const res = await fetch(`${import.meta.env.BASE_URL}animations/${path}`);
  if (!res.ok) throw new Error(`Failed to load animation ${path}: ${res.status}`);
  const data = await res.json() as AnimationData;
  animCache.set(path, data);
  return data;
}

export async function pickAnimation(diceCount: number): Promise<AnimationData> {
  const manifest = await loadManifest();

  for (let n = diceCount; n >= 1; n--) {
    const key = `${n}d`;
    const files = manifest[key];
    if (files && files.length > 0) {
      const file = files[Math.floor(Math.random() * files.length)];
      return fetchAnimation(`${key}/${file}`);
    }
  }

  throw new Error('No animations available');
}
