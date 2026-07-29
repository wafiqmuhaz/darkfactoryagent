import fs from 'fs/promises';
import path from 'path';
import { SkillDefinition } from '../skill-registry';

export const fileSystemSkill: SkillDefinition = {
  name: 'fileSystem',
  description: 'Read and write files within a project directory',
  execute: async (input: { action: 'read' | 'write' | 'delete'; filePath: string; content?: string }) => {
    // In a real implementation, we must sandbox this to prevent directory traversal.
    // E.g., verifying that filePath is inside the designated project root.
    const resolvedPath = path.resolve(process.cwd(), input.filePath);
    
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
  }
};
