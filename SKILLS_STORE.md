# 🧩 Skills Store — Marketplace Design

## Overview

The Skills Store allows users to browse, install, and manage agent skills. Skills are packaged capabilities that extend agent functionality. The store supports local skills from `./skills/` directory and manual external downloads.

```
 ┌──────────────────────────────────────────────────────────────┐
 │                        SKILLS STORE                          │
 ├──────────────────────────────────────────────────────────────┤
 │                                                              │
 │  ┌─────────────┐  ┌─────────────┐  ┌────────────────────┐   │
 │  │  Browse     │  │  Installed  │  │  Categories        │   │
 │  │  All Skills │  │  (3/8)      │  │  ──────────        │   │
 │  ├─────────────┤  ├─────────────┤  │  • Browser (1)     │   │
 │  │ ⭐ Browser  │  │ ✔ Browser   │  │  • Mobile (1)      │   │
 │  │   -Use     │  │   -Use      │  │  • File Sys (2)    │   │
 │  │ ⭐ DroidMind│  │ ✔ File Sys  │  │  • API (2)         │   │
 │  │ ⭐ File Sys │  │   -API Int  │  │  • Custom (2)      │   │
 │  │   ...      │  │             │  │                     │   │
 │  └─────────────┘  └─────────────┘  └────────────────────┘   │
 │                                                              │
 └──────────────────────────────────────────────────────────────┘
```

---

## Categories

| Category | Description | Example Skills |
|----------|-------------|---------------|
| Browser | Web automation & scraping | browser-use, playwright |
| Mobile | Mobile app testing | DroidMind, Appium |
| File System | File operations | file-system, glob-reader |
| API | API integration | api-integration, github |
| Custom | User-defined skills | custom-prompts, templates |

---

## Database Schema

```prisma
model Skill {
  id            String   @id @default(uuid())
  name          String   @unique
  displayName   String   @map("display_name")
  description   String?
  category      String                    // browser, mobile, filesystem, api, custom
  version       String   @default("1.0.0")
  author        String   @default("dark-factory")
  icon          String?                   // Icon identifier
  tags          String?                   // comma-separated
  codePath      String   @map("code_path") // Path to skill code in ./skills/
  entrypoint    String                    // Main file (e.g., "index.js")
  configSchema  String?  @map("config_schema") // JSON schema for config params
  isInstalled   Boolean  @default(false)  @map("is_installed")
  isEnabled     Boolean  @default(true)   @map("is_enabled")
  isBuiltIn     Boolean  @default(false)  @map("is_built_in")
  installedAt   DateTime? @map("installed_at")
  createdAt     DateTime @default(now())  @map("created_at")
  updatedAt     DateTime @updatedAt       @map("updated_at")
}
```

---

## API Endpoints

### `GET /api/skills`
List all available skills (from database + filesystem scan).

### `POST /api/skills/install`
Install a skill from the `./skills/` directory.
```json
{
  "skillName": "browser-use",
  "source": "local"
}
```

### `POST /api/skills/uninstall`
Uninstall a skill (marks as uninstalled, code remains on disk).
```json
{
  "skillName": "browser-use"
}
```

### `GET /api/skills/:name`
Get skill details including config and version.

---

## Installation Flow

```
User clicks "Install"
       │
       ▼
 ┌─────────────┐
 │ Validate     │──→ Error: skill not found
 │ skill exists │
 └──────┬──────┘
        │
        ▼
 ┌─────────────┐
 │ Check deps  │──→ Error: dependency missing (show message)
 │ (if any)    │
 └──────┬──────┘
        │
        ▼
 ┌─────────────┐
 │ Copy/       │
 │ register    │──→ Success: Skill registered, ready to use
 │ skill       │
 └─────────────┘
        │
        ▼
  Confirm installation
  Show skill in Installed tab
```

---

## Skill Format

Each skill in `./skills/` follows this structure:

```
skills/
├── browser-use/
│   ├── meta.json         # { name, displayName, description, category, version, entrypoint, tags }
│   ├── index.js          # Main implementation
│   ├── config.js         # Default configuration
│   └── prompts/          # Agent prompts for this skill
│       └── main.md
├── droidmind/
│   ├── meta.json
│   ├── index.js
│   └── prompts/
└── file-system/
    ├── meta.json
    ├── index.js
    └── prompts/
```

### meta.json Example
```json
{
  "name": "browser-use",
  "displayName": "Browser Automation",
  "description": "Automate web browsers for testing, scraping, and form filling",
  "category": "browser",
  "version": "1.0.0",
  "author": "dark-factory",
  "icon": "globe",
  "tags": "browser,automation,scraping,testing",
  "entrypoint": "index.js",
  "configSchema": {
    "type": "object",
    "properties": {
      "headless": { "type": "boolean", "default": true },
      "viewport": { "type": "object", "default": { "width": 1280, "height": 720 } }
    }
  }
}
```

---

## Version Management

- Skills have a `version` field in `meta.json`
- On install, version is recorded in DB
- When a skill is updated in `./skills/`, version comparison triggers an update prompt
- Breaking changes require re-installation confirmation
- `/api/skills/check-updates` scans for version differences

## Categories Page

The frontend displays:
1. **All** — grid of all skills with search
2. **Installed** — only installed skills, with enable/disable toggle
3. **By Category** — grouped browser, mobile, filesystem, api, custom
4. **Search** — real-time search by name, description, tags
