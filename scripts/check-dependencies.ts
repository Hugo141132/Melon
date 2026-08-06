import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface VulnerabilitySummary {
  info: number;
  low: number;
  moderate: number;
  high: number;
  critical: number;
  total: number;
}

export interface DependencyException {
  id: string;
  packageName: string;
  advisoryId: string;
  reason: string;
  approvedBy: string;
  approvedDate: string;
  expiresDate: string;
}

export interface AdvisoryFinding {
  id: string; // e.g. GHSA-xxx or source ID
  packageName: string;
  severity: string;
  title: string;
  url: string;
  affectedPackage: string;
  isApproved: boolean;
}

export interface AuditEvaluationResult {
  passed: boolean;
  highCount: number;
  criticalCount: number;
  unapprovedHighCount: number;
  unapprovedCriticalCount: number;
  advisories: AdvisoryFinding[];
}

export function loadDependencyExceptions(configPath?: string): DependencyException[] {
  const targetPath = configPath || path.join(__dirname, 'security-exceptions.json');
  if (!fs.existsSync(targetPath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(targetPath, 'utf8');
    const parsed = JSON.parse(raw);
    const exceptions: DependencyException[] = parsed.dependencyExceptions || [];
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

export function extractAdvisories(
  auditJson: Record<string, unknown>,
  exceptions: DependencyException[] = []
): AdvisoryFinding[] {
  const vulnerabilities = (auditJson.vulnerabilities as Record<string, unknown>) || {};
  const advisoryMap = new Map<string, AdvisoryFinding>();

  for (const [pkgName, vulnObj] of Object.entries(vulnerabilities)) {
    const vuln = vulnObj as {
      severity?: string;
      via?: Array<
        string | { source?: number; name?: string; title?: string; url?: string; severity?: string }
      >;
    };

    if (!vuln) continue;

    if (!vuln.via || vuln.via.length === 0) {
      // Fallback for simple/mock vulnerability objects
      const advisoryId = pkgName;
      const severity = (vuln.severity || 'high').toLowerCase();
      const key = `${advisoryId}:${pkgName}`;
      if (!advisoryMap.has(key)) {
        const isApproved = exceptions.some(
          (ex) =>
            ex.packageName === '*' || ex.packageName === pkgName || ex.advisoryId === advisoryId
        );
        advisoryMap.set(key, {
          id: advisoryId,
          packageName: pkgName,
          severity,
          title: `${pkgName} vulnerability`,
          url: '',
          affectedPackage: pkgName,
          isApproved,
        });
      }
      continue;
    }

    for (const viaItem of vuln.via) {
      let advisoryId = '';
      let packageName = pkgName;
      let title = 'Security Vulnerability';
      let url = '';
      let severity = (vuln.severity || 'high').toLowerCase();

      if (typeof viaItem === 'string') {
        advisoryId = viaItem;
        packageName = viaItem;
        title = `${viaItem} advisory`;
      } else if (typeof viaItem === 'object' && viaItem !== null) {
        if (viaItem.url) {
          const urlParts = viaItem.url.split('/');
          advisoryId = urlParts[urlParts.length - 1] || String(viaItem.source || 'UNKNOWN');
          url = viaItem.url;
        } else {
          advisoryId = String(viaItem.source || viaItem.name || 'UNKNOWN');
        }
        packageName = viaItem.name || pkgName;
        title = viaItem.title || title;
        severity = (viaItem.severity || severity).toLowerCase();
      }

      if (!advisoryId) continue;
      const key = `${advisoryId}:${packageName}`;

      if (!advisoryMap.has(key)) {
        const isApproved = exceptions.some((ex) => {
          const advMatch =
            ex.advisoryId === '*' ||
            ex.advisoryId === advisoryId ||
            advisoryId === 'UNKNOWN' ||
            advisoryId === packageName;
          const pkgMatch =
            ex.packageName === '*' || ex.packageName === packageName || ex.packageName === pkgName;
          return advMatch && pkgMatch;
        });

        advisoryMap.set(key, {
          id: advisoryId,
          packageName,
          severity,
          title,
          url,
          affectedPackage: pkgName,
          isApproved,
        });
      }
    }
  }

  return Array.from(advisoryMap.values());
}

export function evaluateAuditData(
  auditJson: Record<string, unknown>,
  exceptions: DependencyException[] = []
): AuditEvaluationResult {
  const metadata = (auditJson.metadata as Record<string, unknown>) || {};
  const summary = (metadata.vulnerabilities as VulnerabilitySummary) || {
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
    total: 0,
  };

  const advisories = extractAdvisories(auditJson, exceptions);

  let unapprovedHigh = 0;
  let unapprovedCritical = 0;

  for (const adv of advisories) {
    if (!adv.isApproved) {
      if (adv.severity === 'high') {
        unapprovedHigh++;
      } else if (adv.severity === 'critical') {
        unapprovedCritical++;
      }
    }
  }

  const passed = unapprovedHigh === 0 && unapprovedCritical === 0;

  return {
    passed,
    highCount: summary.high || 0,
    criticalCount: summary.critical || 0,
    unapprovedHighCount: unapprovedHigh,
    unapprovedCriticalCount: unapprovedCritical,
    advisories,
  };
}

export function runDependencyScan(cwd?: string): number {
  const rootDir = cwd || path.resolve(__dirname, '..');
  const exceptions = loadDependencyExceptions();
  console.log(`[Dependency Scanner] Running npm audit check in: ${rootDir}`);
  console.log(`[Dependency Scanner] Loaded ${exceptions.length} active dependency exception(s).`);

  let auditRaw = '';
  try {
    auditRaw = execSync('npm audit --json', {
      cwd: rootDir,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error: unknown) {
    const execError = error as { stdout?: string };
    if (execError.stdout) {
      auditRaw = execError.stdout;
    } else {
      console.error('[Dependency Scanner] Failed to execute npm audit command.');
      return 1;
    }
  }

  try {
    const auditJson = JSON.parse(auditRaw);
    const result = evaluateAuditData(auditJson, exceptions);

    if (!result.passed) {
      console.error(
        `\n[Dependency Scanner] ERROR: Found ${result.unapprovedHighCount} unapproved HIGH and ${result.unapprovedCriticalCount} unapproved CRITICAL advisories:`
      );
      for (const adv of result.advisories) {
        if ((adv.severity === 'high' || adv.severity === 'critical') && !adv.isApproved) {
          console.error(`  - [${adv.id}] ${adv.packageName}: ${adv.title} (${adv.severity})`);
        }
      }
      console.error(
        '\nRefer to docs/SECURITY_EXCEPTIONS.md to remediate or document approved exceptions.'
      );
      return 1;
    }

    console.log(
      `[Dependency Scanner] SUCCESS: ${result.highCount} high and ${result.criticalCount} critical advisories evaluated (0 unapproved).`
    );
    return 0;
  } catch (parseError) {
    console.error('[Dependency Scanner] Failed to parse npm audit JSON output:', parseError);
    return 1;
  }
}

if (require.main === module) {
  const exitCode = runDependencyScan();
  process.exit(exitCode);
}
