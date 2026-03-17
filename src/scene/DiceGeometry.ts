import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export function createRoundedBoxWithGroups(size: number, radius: number, segments: number): THREE.BufferGeometry {
  const geometry = new RoundedBoxGeometry(size, size, size, segments, radius);
  
  const normals = geometry.attributes.normal;
  const indices = geometry.index;
  if (!indices) return geometry;
  
  const newIndices = [];
  const groups: { start: number, count: number, materialIndex: number }[] = [];
  
  // Map dominant normal to 0..5 group matching BoxGeometry: +X, -X, +Y, -Y, +Z, -Z
  const getGroupFromNormal = (nx: number, ny: number, nz: number) => {
      const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
      if (ax > ay && ax > az) return nx > 0 ? 0 : 1;
      if (ay > ax && ay > az) return ny > 0 ? 2 : 3;
      return nz > 0 ? 4 : 5;
  };
  
  const trianglesByGroup: number[][] = [[], [], [], [], [], []];
  
  for (let i = 0; i < indices.count; i += 3) {
      const i0 = indices.array[i];
      const i1 = indices.array[i+1];
      const i2 = indices.array[i+2];
      
      const nx = normals.getX(i0);
      const ny = normals.getY(i0);
      const nz = normals.getZ(i0);
      
      const g = getGroupFromNormal(nx, ny, nz);
      trianglesByGroup[g].push(i0, i1, i2);
  }
  
  let start = 0;
  for (let g = 0; g < 6; g++) {
      const tris = trianglesByGroup[g];
      if (tris.length > 0) {
          newIndices.push(...tris);
          groups.push({ start, count: tris.length, materialIndex: g });
          start += tris.length;
      }
  }
  
  geometry.setIndex(newIndices);
  geometry.clearGroups();
  for (const grp of groups) {
      geometry.addGroup(grp.start, grp.count, grp.materialIndex);
  }
  
  return geometry;
}
