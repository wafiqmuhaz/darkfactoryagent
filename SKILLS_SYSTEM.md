# 🛠️ Skills System

The Skills System is the extensibility layer of the Dark Factory AI Agent System. It provides a plugin architecture that allows agents to interact with external tools, services, and environments beyond simple code generation.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Skill Interface](#skill-interface)
4. [Built-in Skills](#built-in-skills)
5. [Skill Registry](#skill-registry)
6. [Creating Custom Skills](#creating-custom-skills)
7. [Skill Configuration](#skill-configuration)
8. [Skill Execution](#skill-execution)
9. [Security & Sandboxing](#security--sandboxing)
10. [Skill Marketplace (Future)](#skill-marketplace-future)

---

## Overview

Skills are modular capabilities that extend what agents can do. While agents handle reasoning, planning, and code generation through AI models, skills provide the **tools and actions** agents need to interact with the real world:

- Browse and interact with websites
- Automate mobile applications
- Read and write files on the local filesystem
- Make API calls to external services
- Execute shell commands
- Manage Git repositories

```
┌─────────────────────────────────────────────────────────┐
│                    Agent Layer                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │  Chief   │ │   Code   │ │   Test   │ │  Review  │  │
│  │ of Staff │ │  Writer  │ │  Writer  │ │  Agent   │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│       │             │            │             │        │
│  ─────┴─────────────┴────────────┴─────────────┴─────   │
│                    Skill Registry                       │
│  ─────┬─────────────┬────────────┬─────────────┬─────   │
│       │             │            │             │        │
│  ┌────▼─────┐ ┌─────▼────┐ ┌────▼─────┐ ┌────▼─────┐  │
│  │Browser-  │ │DroidMind │ │   File   │ │   API    │  │
│  │Use       │ │          │ │  System  │ │ Integr.  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                    Skills Layer                         │
└─────────────────────────────────────────────────────────┘
```

---

## Architecture

### Directory Structure

```
skills/
├── browser-use/                 # Web automation skill
│   ├── index.ts                 # Skill entry point
│   ├── skill.config.json        # Skill metadata & parameters
│   ├── prompts/                 # Agent prompts for this skill
│   │   └── browser-use.prompt.ts
│   ├── lib/                     # Skill implementation
│   │   ├── browser.ts
│   │   ├── page.ts
│   │   └── actions.ts
│   └── tests/                   # Skill tests
│       └── browser-use.test.ts
│
├── DroidMind/                   # Android automation skill
│   ├── index.ts
│   ├── skill.config.json
│   ├── prompts/
│   ├── lib/
│   └── tests/
│
├── file-system/                 # File operations skill
│   ├── index.ts
│   ├── skill.config.json
│   ├── lib/
│   └── tests/
│
├── api-integration/             # HTTP/API skill
│   ├── index.ts
│   ├── skill.config.json
│   ├── lib/
│   └── tests/
│
├── git-operations/              # Git management skill
│   ├── index.ts
│   ├── skill.config.json
│   ├── lib/
│   └── tests/
│
├── shell-executor/              # Shell command skill
│   ├── index.ts
│   ├── skill.config.json
│   ├── lib/
│   └── tests/
│
└── custom-skills/               # User-created skills
    ├── skill-template/          # Template for new skills
    │   ├── index.ts
    │   └── skill.config.json
    └── README.md
```

---

## Skill Interface

Every skill must implement the `ISkill` interface:

```typescript
/**
 * Base interface that all skills must implement.
 */
interface ISkill {
  /** Unique skill identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Skill description */
  description: string;

  /** Skill category */
  category: SkillCategory;

  /** Which agent types can use this skill */
  allowedAgents: AgentType[];

  /**
   * Initialize the skill with configuration.
   * Called once when the skill is loaded.
   */
  initialize(config: SkillConfig): Promise<void>;

  /**
   * Validate input parameters before execution.
   * @returns true if valid, throws SkillValidationError if invalid.
   */
  validate(params: Record<string, unknown>): Promise<boolean>;

  /**
   * Execute the skill with the given parameters.
   * @returns The execution result.
   */
  execute(params: Record<string, unknown>): Promise<SkillResult>;

  /**
   * Clean up resources when the skill is unloaded.
   */
  dispose(): Promise<void>;
}

/** Skill categories */
type SkillCategory =
  | 'browser'     // Web automation
  | 'mobile'      // Mobile device automation
  | 'filesystem'  // File operations
  | 'api'         // HTTP/API interactions
  | 'git'         // Version control
  | 'shell'       // Command execution
  | 'custom';     // User-defined

/** Agent types that can use skills */
type AgentType =
  | 'chief-of-staff'
  | 'spec-writer'
  | 'code-writer'
  | 'test-writer'
  | 'review-agent'
  | 'doc-agent'
  | 'browser-agent'
  | 'mobile-agent';

/** Skill execution result */
interface SkillResult {
  success: boolean;
  data: unknown;
  error?: string;
  metadata: {
    duration: number;      // Execution time in ms
    tokensUsed?: number;   // If AI was involved
    cost?: number;         // Estimated cost
  };
}

/** Skill configuration */
interface SkillConfig {
  enabled: boolean;
  parameters: Record<string, unknown>;
  limits: {
    maxExecutionTime: number;  // Timeout in ms
    maxRetries: number;
    rateLimit: number;         // Executions per minute
  };
}
```

---

## Built-in Skills

### 1. Browser-Use Skill

**Category**: `browser`  
**Allowed Agents**: `code-writer`, `test-writer`, `browser-agent`

| Action | Description |
|--------|-------------|
| `navigate(url)` | Navigate to a URL |
| `click(selector)` | Click on an element |
| `type(selector, text)` | Type text into an input |
| `extract(selector)` | Extract text/data from elements |
| `screenshot()` | Capture a screenshot |
| `waitFor(selector)` | Wait for an element to appear |
| `evaluate(script)` | Execute JavaScript in the page |
| `fillForm(data)` | Fill a form with provided data |

**Use Cases**:
- Web application testing
- Data extraction from websites
- Form automation
- Visual regression testing
- Web scraping for research

---

### 2. DroidMind Skill

**Category**: `mobile`  
**Allowed Agents**: `test-writer`, `mobile-agent`

| Action | Description |
|--------|-------------|
| `connect(deviceId)` | Connect to an Android device via ADB |
| `install(apkPath)` | Install an APK |
| `launch(packageName)` | Launch an application |
| `tap(x, y)` | Tap at coordinates |
| `swipe(x1, y1, x2, y2)` | Swipe gesture |
| `inputText(text)` | Type text into focused element |
| `screenshot()` | Capture device screenshot |
| `shell(command)` | Execute ADB shell command |

**Use Cases**:
- Mobile app testing
- UI interaction automation
- Performance monitoring
- Device-specific testing
- Automated QA workflows

---

### 3. File System Skill

**Category**: `filesystem`  
**Allowed Agents**: `code-writer`, `test-writer`, `doc-agent`, `spec-writer`

| Action | Description |
|--------|-------------|
| `readFile(path)` | Read file contents |
| `writeFile(path, content)` | Write content to a file |
| `appendFile(path, content)` | Append content to a file |
| `deleteFile(path)` | Delete a file |
| `listDir(path)` | List directory contents |
| `createDir(path)` | Create a directory (recursive) |
| `copyFile(src, dest)` | Copy a file |
| `moveFile(src, dest)` | Move/rename a file |
| `exists(path)` | Check if path exists |
| `stat(path)` | Get file metadata |
| `watch(path, callback)` | Watch for file changes |
| `glob(pattern)` | Find files matching a pattern |

**Security**: All file operations are sandboxed to the project directory. Access outside the project root is denied.

---

### 4. API Integration Skill

**Category**: `api`  
**Allowed Agents**: `code-writer`, `test-writer`, `chief-of-staff`

| Action | Description |
|--------|-------------|
| `get(url, options)` | HTTP GET request |
| `post(url, body, options)` | HTTP POST request |
| `put(url, body, options)` | HTTP PUT request |
| `patch(url, body, options)` | HTTP PATCH request |
| `delete(url, options)` | HTTP DELETE request |
| `graphql(url, query, variables)` | GraphQL request |
| `upload(url, file)` | File upload |
| `download(url, path)` | File download |

**Features**:
- Automatic retry with exponential backoff
- Rate limiting per domain
- Authentication support (API key, OAuth, JWT, Basic)
- Response caching
- Request/response logging

---

### 5. Git Operations Skill

**Category**: `git`  
**Allowed Agents**: `code-writer`, `chief-of-staff`

| Action | Description |
|--------|-------------|
| `clone(url, path)` | Clone a repository |
| `checkout(branch)` | Switch branches |
| `createBranch(name)` | Create a new branch |
| `add(files)` | Stage files for commit |
| `commit(message)` | Commit staged changes |
| `push(remote, branch)` | Push to remote |
| `pull(remote, branch)` | Pull from remote |
| `merge(branch)` | Merge a branch |
| `diff()` | Show unstaged changes |
| `log(n)` | Show recent commits |
| `status()` | Show working tree status |
| `stash()` / `stashPop()` | Stash/unstash changes |

---

### 6. Shell Executor Skill

**Category**: `shell`  
**Allowed Agents**: `code-writer`, `test-writer`

| Action | Description |
|--------|-------------|
| `exec(command)` | Execute a shell command |
| `spawn(command, args)` | Spawn a long-running process |
| `kill(pid)` | Kill a process |
| `isRunning(pid)` | Check if process is running |

**Security**: Commands are executed in a restricted environment:
- Working directory locked to project root
- No access to system directories
- Dangerous commands blocked (`rm -rf /`, `sudo`, etc.)
- Execution timeout enforced
- Output size limited

---

## Skill Registry

The Skill Registry is the central management system for all skills:

```typescript
class SkillRegistry {
  private skills: Map<string, ISkill> = new Map();

  /** Register a new skill */
  register(skill: ISkill): void;

  /** Unregister a skill */
  unregister(skillId: string): void;

  /** Get a skill by ID */
  get(skillId: string): ISkill | undefined;

  /** List all registered skills */
  listAll(): ISkill[];

  /** List skills available to a specific agent type */
  listForAgent(agentType: AgentType): ISkill[];

  /** Check if a skill is available */
  has(skillId: string): boolean;

  /** Enable/disable a skill */
  setEnabled(skillId: string, enabled: boolean): void;

  /** Load skills from the skills directory */
  loadFromDirectory(dir: string): Promise<void>;
}
```

### Registration Process

1. Skill module is loaded from the `skills/` directory
2. `skill.config.json` is read for metadata and parameters
3. Skill `initialize()` is called with configuration
4. Skill is added to the registry
5. Skill becomes available to permitted agents

---

## Creating Custom Skills

### Step 1: Create the Skill Directory

```bash
mkdir -p skills/my-custom-skill/lib
```

### Step 2: Define the Configuration

Create `skills/my-custom-skill/skill.config.json`:

```json
{
  "id": "my-custom-skill",
  "name": "My Custom Skill",
  "description": "A description of what this skill does",
  "version": "1.0.0",
  "category": "custom",
  "allowedAgents": ["code-writer", "test-writer"],
  "parameters": {
    "type": "object",
    "properties": {
      "input": {
        "type": "string",
        "description": "The input to process"
      },
      "options": {
        "type": "object",
        "properties": {
          "format": {
            "type": "string",
            "enum": ["json", "text", "xml"],
            "default": "json"
          }
        }
      }
    },
    "required": ["input"]
  },
  "limits": {
    "maxExecutionTime": 30000,
    "maxRetries": 3,
    "rateLimit": 10
  }
}
```

### Step 3: Implement the Skill

Create `skills/my-custom-skill/index.ts`:

```typescript
import { ISkill, SkillConfig, SkillResult, SkillCategory, AgentType } from '../types';

export class MyCustomSkill implements ISkill {
  id = 'my-custom-skill';
  name = 'My Custom Skill';
  description = 'A description of what this skill does';
  category: SkillCategory = 'custom';
  allowedAgents: AgentType[] = ['code-writer', 'test-writer'];

  private config: SkillConfig | null = null;

  async initialize(config: SkillConfig): Promise<void> {
    this.config = config;
    // Setup resources, connections, etc.
  }

  async validate(params: Record<string, unknown>): Promise<boolean> {
    if (!params.input || typeof params.input !== 'string') {
      throw new Error('Parameter "input" is required and must be a string');
    }
    return true;
  }

  async execute(params: Record<string, unknown>): Promise<SkillResult> {
    const startTime = Date.now();

    try {
      // Your skill logic here
      const result = await this.processInput(params.input as string);

      return {
        success: true,
        data: result,
        metadata: {
          duration: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: (error as Error).message,
        metadata: {
          duration: Date.now() - startTime,
        },
      };
    }
  }

  async dispose(): Promise<void> {
    // Cleanup resources
  }

  private async processInput(input: string): Promise<unknown> {
    // Implementation
    return { processed: input };
  }
}

export default MyCustomSkill;
```

### Step 4: Write Tests

Create `skills/my-custom-skill/tests/my-custom-skill.test.ts`:

```typescript
import { MyCustomSkill } from '../index';

describe('MyCustomSkill', () => {
  let skill: MyCustomSkill;

  beforeEach(async () => {
    skill = new MyCustomSkill();
    await skill.initialize({ enabled: true, parameters: {}, limits: { maxExecutionTime: 5000, maxRetries: 3, rateLimit: 10 } });
  });

  afterEach(async () => {
    await skill.dispose();
  });

  test('should validate valid parameters', async () => {
    const result = await skill.validate({ input: 'test' });
    expect(result).toBe(true);
  });

  test('should reject invalid parameters', async () => {
    await expect(skill.validate({})).rejects.toThrow();
  });

  test('should execute successfully', async () => {
    const result = await skill.execute({ input: 'test' });
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });
});
```

### Step 5: Register

The skill will be automatically discovered when placed in the `skills/` directory. No manual registration is needed.

---

## Skill Configuration

Skills are configured via `skill.config.json` and can be overridden in the project settings:

```json
{
  "skills": {
    "browser-use": {
      "enabled": true,
      "parameters": {
        "headless": true,
        "timeout": 30000,
        "viewport": { "width": 1280, "height": 720 }
      },
      "limits": {
        "maxExecutionTime": 60000,
        "maxRetries": 3,
        "rateLimit": 5
      }
    },
    "file-system": {
      "enabled": true,
      "parameters": {
        "allowedPaths": ["./src", "./tests", "./docs"],
        "blockedPatterns": ["node_modules", ".env", ".git"]
      }
    },
    "shell-executor": {
      "enabled": false,
      "parameters": {
        "blockedCommands": ["rm -rf", "sudo", "chmod 777"]
      }
    }
  }
}
```

---

## Skill Execution

### Execution Lifecycle

```
Request → Validate → Execute → Result
   │          │          │         │
   │          │          │         └── Return to agent
   │          │          └── Run skill logic, enforce timeout
   │          └── Check params against JSON Schema
   └── Agent requests skill from registry
```

### Execution with Retry

```
Attempt 1 ──→ Success? ──→ Return result
                │
               No
                │
         Wait (backoff)
                │
Attempt 2 ──→ Success? ──→ Return result
                │
               No
                │
         Wait (backoff × 2)
                │
Attempt 3 ──→ Success? ──→ Return result
                │
               No
                │
         Move to dead letter ──→ Notify agent of failure
```

---

## Security & Sandboxing

### Principle of Least Privilege

Each skill operates under strict security constraints:

| Constraint | Description |
|------------|-------------|
| **Path Sandboxing** | File operations restricted to project directory |
| **Command Blocking** | Dangerous shell commands are rejected |
| **Rate Limiting** | Maximum executions per minute per skill |
| **Timeout Enforcement** | Hard timeout kills long-running executions |
| **Output Limiting** | Maximum response size to prevent memory issues |
| **Agent Permissions** | Skills only available to authorized agent types |
| **Network Restrictions** | Optional: block external network access |

### Blocked Operations

```typescript
const BLOCKED_COMMANDS = [
  'rm -rf /',
  'sudo',
  'chmod 777',
  'mkfs',
  'dd if=',
  ':(){:|:&};:',   // Fork bomb
  'curl | sh',
  'wget -O- | sh',
];

const BLOCKED_PATHS = [
  '/etc',
  '/usr',
  '/bin',
  '/sbin',
  '/var',
  '/root',
  process.env.HOME + '/.ssh',
  process.env.HOME + '/.aws',
];
```

---

## Skill Marketplace (Future)

> **Phase 6 Feature**: Planned for Sprint 17

The Skill Marketplace will allow community members to share and discover skills:

### Features

- **Browse**: Search and filter community-created skills
- **Install**: One-click installation from the marketplace
- **Publish**: Share your custom skills with the community
- **Rate & Review**: Help others find quality skills
- **Version Management**: Automatic updates with changelog
- **Security Review**: All marketplace skills undergo security audit

### Publishing Process

1. Create your skill following the template
2. Write comprehensive tests (>80% coverage)
3. Submit for security review
4. Publish to the marketplace
5. Maintain and update as needed

---

## Skill Development Best Practices

1. **Keep skills focused**: One skill, one responsibility
2. **Validate thoroughly**: Check all parameters before execution
3. **Handle errors gracefully**: Return meaningful error messages
4. **Log appropriately**: Not too much, not too little
5. **Test extensively**: Unit tests, integration tests, edge cases
6. **Document clearly**: Parameters, examples, limitations
7. **Respect limits**: Honor timeouts, rate limits, and sandboxing
8. **Clean up resources**: Implement `dispose()` properly
9. **Be idempotent**: Same input should produce same output
10. **Version carefully**: Semantic versioning for breaking changes
