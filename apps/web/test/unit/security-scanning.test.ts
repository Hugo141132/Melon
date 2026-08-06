import { describe, expect, it } from 'vitest';
import {
  isExceptionMatch,
  loadExceptions,
  scanContent,
  SecretFinding,
} from '../../../../scripts/scan-secrets';
import {
  evaluateAuditData,
  loadDependencyExceptions,
} from '../../../../scripts/check-dependencies';

describe('Security Scanning Suite (TASK-0906)', () => {
  describe('Secret Scanning - Positive Tests', () => {
    it('should report zero findings for clean source code content', () => {
      const cleanContent = `
        const apiEndpoint = "/api/v1/monitoring/latest";
        function calculateTotal(a: number, b: number): number {
          return a + b;
        }
        export const DEFAULT_TIMEOUT = 5000;
      `;
      const findings = scanContent(cleanContent, 'clean-file.ts');
      expect(findings).toHaveLength(0);
    });

    it('should load active exceptions from configuration without throwing', () => {
      const exceptions = loadExceptions();
      expect(Array.isArray(exceptions)).toBe(true);
      expect(exceptions.length).toBeGreaterThan(0);
    });
  });

  describe('Secret Scanning - Negative Tests', () => {
    it('should detect simulated AWS Access Key ID', () => {
      const snippet = 'const awsKey = "AKIAIOSFODNN7EXAMPLE";';
      const findings = scanContent(snippet, 'config.ts');
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('AWS_ACCESS_KEY');
    });

    it('should detect simulated AWS Secret Access Key', () => {
      const snippet =
        'const awsSecret = "aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";';
      const findings = scanContent(snippet, 'aws.ts');
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('AWS_SECRET_KEY');
    });

    it('should detect simulated Private Key header', () => {
      const snippet = 'const keyPem = "' + '-----BEGIN RSA PRIVATE KEY-----";';
      const findings = scanContent(snippet, 'cert.ts');
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('PRIVATE_KEY');
    });

    it('should detect simulated GitHub Personal Access Token', () => {
      const snippet = 'const ghToken = "' + 'ghp_' + '1234567890abcdefghijklmnopqrstuvwxyz";';
      const findings = scanContent(snippet, 'github.ts');
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('GITHUB_TOKEN');
    });

    it('should detect simulated Generic Stripe/API live key', () => {
      const snippet = 'const stripeKey = "' + 'sk_live_' + '51234567890abcdefghijklm";';
      const findings = scanContent(snippet, 'pay.ts');
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('GENERIC_API_KEY');
    });

    it('should detect simulated JWT token format', () => {
      const snippet =
        'const token = "' +
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.' +
        'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";';
      const findings = scanContent(snippet, 'auth.ts');
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('JWT_TOKEN');
    });
  });

  describe('Secret Scanning - Exception Handling', () => {
    it('should correctly match approved exceptions based on path and rule ID', () => {
      const finding: SecretFinding = {
        filePath: 'apps/web/test/unit/security-scanning.test.ts',
        lineNumber: 10,
        ruleId: 'SIMULATED_TEST_SECRET',
        ruleName: 'Simulated Test Secret',
        matchedText: 'dummy',
      };
      const exceptions = [
        {
          id: 'EXC-SEC-001',
          pathPattern: 'apps/web/test/unit/security-scanning.test.ts',
          ruleId: 'SIMULATED_TEST_SECRET',
          reason: 'Test fixture',
          approvedBy: 'Security Team',
          approvedDate: '2026-08-06',
          expiresDate: '2027-08-06',
        },
      ];

      expect(isExceptionMatch(finding, exceptions)).toBe(true);
    });

    it('should reject unapproved secret findings even if another exception exists', () => {
      const unapprovedFinding: SecretFinding = {
        filePath: 'apps/web/lib/env/server.ts',
        lineNumber: 5,
        ruleId: 'AWS_ACCESS_KEY',
        ruleName: 'AWS Access Key ID',
        matchedText: 'AKIAIOSFODNN7EXAMPLE',
      };
      const exceptions = [
        {
          id: 'EXC-SEC-001',
          pathPattern: 'apps/web/test/unit/security-scanning.test.ts',
          ruleId: 'SIMULATED_TEST_SECRET',
          reason: 'Test fixture',
          approvedBy: 'Security Team',
          approvedDate: '2026-08-06',
          expiresDate: '2027-08-06',
        },
      ];

      expect(isExceptionMatch(unapprovedFinding, exceptions)).toBe(false);
    });
  });

  describe('Dependency Vulnerability Scanning Tests', () => {
    it('should evaluate clean audit data with 0 vulnerabilities as passed', () => {
      const mockAudit = {
        metadata: {
          vulnerabilities: {
            info: 0,
            low: 1,
            moderate: 2,
            high: 0,
            critical: 0,
            total: 3,
          },
        },
        vulnerabilities: {},
      };

      const evalResult = evaluateAuditData(mockAudit, []);
      expect(evalResult.passed).toBe(true);
      expect(evalResult.unapprovedHighCount).toBe(0);
      expect(evalResult.unapprovedCriticalCount).toBe(0);
    });

    it('should flag audit data containing unapproved high vulnerabilities as failed', () => {
      const mockAudit = {
        metadata: {
          vulnerabilities: {
            info: 0,
            low: 0,
            moderate: 0,
            high: 1,
            critical: 0,
            total: 1,
          },
        },
        vulnerabilities: {
          'vulnerable-pkg': {
            name: 'vulnerable-pkg',
            severity: 'high',
            via: [{ name: 'vulnerable-pkg' }],
          },
        },
      };

      const evalResult = evaluateAuditData(mockAudit, []);
      expect(evalResult.passed).toBe(false);
      expect(evalResult.unapprovedHighCount).toBe(1);
    });

    it('should flag audit data containing unapproved critical vulnerabilities as failed', () => {
      const mockAudit = {
        metadata: {
          vulnerabilities: {
            info: 0,
            low: 0,
            moderate: 0,
            high: 0,
            critical: 1,
            total: 1,
          },
        },
        vulnerabilities: {
          'crit-pkg': {
            name: 'crit-pkg',
            severity: 'critical',
            via: [{ name: 'crit-pkg' }],
          },
        },
      };

      const evalResult = evaluateAuditData(mockAudit, []);
      expect(evalResult.passed).toBe(false);
      expect(evalResult.unapprovedCriticalCount).toBe(1);
    });

    it('should approve high vulnerability when matching a documented active exception', () => {
      const mockAudit = {
        metadata: {
          vulnerabilities: {
            info: 0,
            low: 0,
            moderate: 0,
            high: 1,
            critical: 0,
            total: 1,
          },
        },
        vulnerabilities: {
          'approved-vuln-pkg': {
            name: 'approved-vuln-pkg',
            severity: 'high',
            via: [{ name: 'approved-vuln-pkg' }],
          },
        },
      };

      const exceptions = [
        {
          id: 'EXC-DEP-001',
          packageName: 'approved-vuln-pkg',
          advisoryId: 'GHSA-1234-5678',
          reason: 'Unused sub-dependency',
          approvedBy: 'Security Lead',
          approvedDate: '2026-08-06',
          expiresDate: '2027-08-06',
        },
      ];

      const evalResult = evaluateAuditData(mockAudit, exceptions);
      expect(evalResult.passed).toBe(true);
      expect(evalResult.unapprovedHighCount).toBe(0);
    });

    it('should load dependency exceptions from config without error', () => {
      const exceptions = loadDependencyExceptions();
      expect(Array.isArray(exceptions)).toBe(true);
    });
  });
});
