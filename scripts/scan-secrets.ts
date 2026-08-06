import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface SecretRule {
  id: string;
  name: string;
  pattern: RegExp;
}

export interface SecretFinding {
  filePath: string;
  lineNumber: number;
  ruleId: string;
  ruleName: string;
  matchedText: string;
}

export interface SecretException {
  id: string;
  pathPattern: string;
  ruleId: string;
  reason: string;
  approvedBy: string;
  approvedDate: string;
  expiresDate: string;
}

export const SECRET_RULES: SecretRule[] = [
  {
    id: 'AWS_ACCESS_KEY',
    name: 'AWS Access Key ID',
    pattern: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/,
  },
  {
    id: 'AWS_SECRET_KEY',
    name: 'AWS Secret Access Key',
    pattern: /\b(aws_secret_access_key|aws_secret_key)\s*[:=]\s*["']?[A-Za-z0-9\/+=]{40}["']?\b/i,
  },
  {
    id: 'PRIVATE_KEY',
    name: 'Private Key Header',
    pattern: /-----BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY-----/,
  },
  {
    id: 'GITHUB_TOKEN',
    name: 'GitHub Personal Access Token',
    pattern: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\b/,
  },
  {
    id: 'GENERIC_API_KEY',
    name: 'Generic API Key',
    pattern: /\b(sk_live_|sk_test_)[0-9a-zA-Z]{24,}\b/,
  },
  {
    id: 'JWT_TOKEN',
    name: 'JSON Web Token',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  },
];

export const IGNORE_DIR_PATTERNS = [
  'node_modules',
  '.git',
  '.next',
  'coverage',
  'dist',
  'build',
  'test-results',
];

export const IGNORE_FILE_PATTERNS = [
  'package-lock.json',
  'security-exceptions.json',
  '.env.example',
];

export function loadExceptions(configPath?: string): SecretException[] {
  const targetPath = configPath || path.join(__dirname, 'security-exceptions.json');
  if (!fs.existsSync(targetPath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(targetPath, 'utf8');
    const parsed = JSON.parse(raw);
    const exceptions: SecretException[] = parsed.secretExceptions || [];
    const now = new Date().toISOString().split('T')[0];
    return exceptions.filter(
      (ex) =>
        ex.approvedBy &&
        ex.approvedBy !== 'PENDING_USER_APPROVAL' &&
        (!ex.expiresDate || ex.expiresDate >= now)
    );
  } catch {
    return [];
  }
}

export function isExceptionMatch(finding: SecretFinding, exceptions: SecretException[]): boolean {
  const normalizedPath = finding.filePath.replace(/\\/g, '/');
  return exceptions.some((ex) => {
    const patternMatch = ex.pathPattern === '*' || normalizedPath.includes(ex.pathPattern);
    const ruleMatch = ex.ruleId === '*' || ex.ruleId === finding.ruleId;
    return patternMatch && ruleMatch;
  });
}

export function scanContent(content: string, filePath: string = 'inline'): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of SECRET_RULES) {
      if (rule.pattern.test(line)) {
        findings.push({
          filePath,
          lineNumber: i + 1,
          ruleId: rule.id,
          ruleName: rule.name,
          matchedText: line.trim(),
        });
      }
    }
  }

  return findings;
}

export function scanFile(filePath: string, exceptions: SecretException[] = []): SecretFinding[] {
  const baseName = path.basename(filePath);
  if (IGNORE_FILE_PATTERNS.includes(baseName)) {
    return [];
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const rawFindings = scanContent(content, filePath);
    return rawFindings.filter((finding) => !isExceptionMatch(finding, exceptions));
  } catch {
    return [];
  }
}

export function scanDirectory(
  dirPath: string,
  exceptions: SecretException[] = []
): SecretFinding[] {
  const findings: SecretFinding[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORE_DIR_PATTERNS.includes(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        const fileFindings = scanFile(fullPath, exceptions);
        findings.push(...fileFindings);
      }
    }
  }

  walk(dirPath);
  return findings;
}

export function scanGitHistory(
  rootDir: string,
  exceptions: SecretException[] = []
): SecretFinding[] {
  try {
    const gitDiff = execSync('git log -p -n 50 --no-color', {
      cwd: rootDir,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });

    const rawFindings = scanContent(gitDiff, 'git-history');
    // Only return additions (+) in diffs
    const addedFindings = rawFindings.filter(
      (f) => f.matchedText.startsWith('+') && !f.matchedText.startsWith('+++')
    );
    return addedFindings.filter((finding) => !isExceptionMatch(finding, exceptions));
  } catch {
    return [];
  }
}

export function runSecretScan(rootDir?: string): number {
  const targetDir = rootDir || path.resolve(__dirname, '..');
  const exceptions = loadExceptions();
  console.log(`[Secret Scanner] Scanning directory: ${targetDir}`);
  console.log(`[Secret Scanner] Loaded ${exceptions.length} active exceptions.`);

  const fileFindings = scanDirectory(targetDir, exceptions);
  const gitFindings = scanGitHistory(targetDir, exceptions);
  const totalFindings = [...fileFindings, ...gitFindings];

  if (totalFindings.length > 0) {
    console.error(`\n[Secret Scanner] ERROR: Found ${totalFindings.length} unapproved secret(s):`);
    for (const finding of totalFindings) {
      console.error(
        `  - ${finding.filePath}:${finding.lineNumber} [${finding.ruleId} - ${finding.ruleName}]`
      );
    }
    console.error('\nRefer to docs/SECURITY_EXCEPTIONS.md to review exceptions.');
    return 1;
  }

  console.log('[Secret Scanner] SUCCESS: No hardcoded secrets detected in files or Git history.');
  return 0;
}

if (require.main === module) {
  const exitCode = runSecretScan();
  process.exit(exitCode);
}
