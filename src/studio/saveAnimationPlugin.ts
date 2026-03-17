// src/studio/saveAnimationPlugin.ts
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import type { AnimationData } from '../animation/animationLibrary';

type Manifest = Record<string, string[]>;

export function saveAnimationPlugin(): Plugin {
  return {
    name: 'save-animation',
    apply: 'serve', // dev only
    configureServer(server) {
      server.middlewares.use('/api/save-animation', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        let body = '';
        for await (const chunk of req) body += chunk;

        let data: AnimationData;
        try {
          data = JSON.parse(body) as AnimationData;
        } catch {
          res.statusCode = 400;
          res.end('Invalid JSON');
          return;
        }

        const publicDir = path.resolve(process.cwd(), 'public/animations');
        const groupDir = path.join(publicDir, `${data.diceCount}d`);
        fs.mkdirSync(groupDir, { recursive: true });

        // Use highest existing index + 1 to prevent overwriting on manual deletes
        const existing = fs.readdirSync(groupDir).filter(f => f.endsWith('.json'));
        const maxIdx = existing.reduce((max, f) => {
          const m = f.match(/(\d+)\.json$/);
          return m ? Math.max(max, parseInt(m[1])) : max;
        }, 0);
        const nextIndex = maxIdx + 1;
        const filename = `anim_${data.diceCount}d_${String(nextIndex).padStart(3, '0')}.json`;
        fs.writeFileSync(path.join(groupDir, filename), JSON.stringify(data, null, 2));

        // Update manifest
        const manifestPath = path.join(publicDir, 'manifest.json');
        let manifest: Manifest = {};
        if (fs.existsSync(manifestPath)) {
          manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Manifest;
        }
        const key = `${data.diceCount}d`;
        manifest[key] = manifest[key] ?? [];
        if (!manifest[key].includes(filename)) manifest[key].push(filename);
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ filename }));
      });
    },
  };
}
