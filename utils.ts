import type { PathLike } from "fs";
import fs from 'fs';

/**
 * Accepts a path to a mod descriptor and returns the value of the `version` keyword found in that file.
 */
export const getModVersionFromDescriptor = (path: PathLike) => {
  const data = fs.readFileSync(path, 'utf8');
  const versionLine = data.split('\n').find(line => line.startsWith('version='));
  if (!versionLine) throw new Error('Version not found in descriptor');
  const version = versionLine.split('=')[1].replace(/"/g, '');
  return version;
}

/**
 * Accepts a path to a mod descriptor and returns the value of the `supported_version` keyword found in that file.
 */
export const getGameVersionFromDescriptor = (path: PathLike) => {
    const data = fs.readFileSync(path, 'utf8');
  const versionLine = data.split('\n').find(line => line.startsWith('supported_version='));
  if (!versionLine) throw new Error('Game version not found in descriptor');
  const version = versionLine.split('=')[1].replace(/"/g, '');
  return version;
}