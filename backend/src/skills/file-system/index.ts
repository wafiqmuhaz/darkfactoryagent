import fs from 'fs/promises';
import path from 'path';
import { SkillDefinition } from '../skill-registry';

export const fileSystemSkill: SkillDefinition = {
  name: 'file-system',
  description: 'Read, write, and manage files on the local filesystem',
  category: 'filesystem',
  version: '1.0.0',
  execute: async (input: { action: 'read' | 'write' | 'delete'; filePath: string; content?: string; baseDir?: string }) => {
    // Confine the operation to baseDir when one is given, so a traversing
    // filePath cannot reach outside the project it was scoped to.
    const base = input.baseDir ? path.resolve(input.baseDir) : process.cwd();
    const resolvedPath = path.resolve(base, input.filePath);
    if (!resolvedPath.startsWith(base + path.sep) && resolvedPath !== base) {
      throw new Error(`Path escapes the allowed directory: ${input.filePath}`);
    }

    switch (input.action) {
      case 'read':
        return await fs.readFile(resolvedPath, 'utf-8');
      case 'write':
        if (input.content === undefined) throw new Error('Content required for write action');
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
        await fs.writeFile(resolvedPath, input.content, 'utf-8');
        return { success: true, message: `File written: ${input.filePath}` };
      case 'delete':
        await fs.unlink(resolvedPath);
        return { success: true, message: `File deleted: ${input.filePath}` };
      default:
        throw new Error(`Unsupported action: ${(input as any).action}`);
    }
  },
};
