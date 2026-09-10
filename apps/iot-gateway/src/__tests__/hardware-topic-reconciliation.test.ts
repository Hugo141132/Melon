import { describe, it, expect } from 'vitest';
import { mqttTopicRouter } from '../mqtt/router';
import {
  hardwareMqttReconciliation,
  PERMANENT_HARDWARE_TOPICS,
  HardwareMappingContext,
} from '../mqtt/hardware-reconciliation';
import { ReservoirTelemetryPayloadSchema } from '@kebun-melon/contracts';

describe('Permanent Hardware MQTT Topic Reconciliation & Contract Tests (TASK-0411 / DEC-DEV-031)', () => {
  const reconciliation = hardwareMqttReconciliation;

  describe('Permanent Hardware Topic Recognition (DEC-DEV-031)', () => {
    it('should recognize permanent hardware topic names', () => {
      expect(reconciliation.isHardwareTopic(PERMANENT_HARDWARE_TOPICS.topicVolume)).toBe(true);
      expect(reconciliation.isHardwareTopic(PERMANENT_HARDWARE_TOPICS.topicValve)).toBe(true);
      expect(reconciliation.isHardwareTopic(PERMANENT_HARDWARE_TOPICS.topicOtomasi)).toBe(true);
      expect(reconciliation.isHardwareTopic(PERMANENT_HARDWARE_TOPICS.topicDebit!)).toBe(true);
      expect(reconciliation.isHardwareTopic(PERMANENT_HARDWARE_TOPICS.topicLiterKeluar!)).toBe(
        true
      );
      expect(
        reconciliation.isHardwareTopic(
          'agriculture/development/site-01/esp32-001/telemetry/reservoir'
        )
      ).toBe(false);
    });

    it('should confirm permanent topic values match approved hardware contract', () => {
      expect(PERMANENT_HARDWARE_TOPICS.topicVolume).toBe('irigasi/melon/sensor/volume');
      expect(PERMANENT_HARDWARE_TOPICS.topicValve).toBe('irigasi/melon/kontrol/valve');
      expect(PERMANENT_HARDWARE_TOPICS.topicOtomasi).toBe('irigasi/melon/setting/otomasi');
    });
  });

  describe('Negative Tests: Canonical Router Rejection of Raw Hardware Topics', () => {
    it('should reject raw hardware volume topic on canonical router', () => {
      const result = mqttTopicRouter.validateTopic(PERMANENT_HARDWARE_TOPICS.topicVolume);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Root topic segment must be "agriculture"');
    });

    it('should reject raw hardware valve control topic on canonical router', () => {
      const result = mqttTopicRouter.validateTopic(PERMANENT_HARDWARE_TOPICS.topicValve);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Root topic segment must be "agriculture"');
    });

    it('should reject raw hardware automation setting topic on canonical router', () => {
      const result = mqttTopicRouter.validateTopic(PERMANENT_HARDWARE_TOPICS.topicOtomasi);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Root topic segment must be "agriculture"');
    });
  });

  describe('Multi-Device Broadcast Control Isolation Evaluation', () => {
    it('should prove broker credentials alone do NOT isolate multiple subscribers on flat topic', () => {
      const evaluation = reconciliation.evaluateBroadcastControlIsolation(
        PERMANENT_HARDWARE_TOPICS.topicValve
      );

      expect(evaluation.hasBroadcastHazard).toBe(true);
      expect(evaluation.explanation).toContain(
        'MQTT credentials (username/password/mTLS) authenticate client identity'
      );
      expect(evaluation.explanation).toContain(
        'do NOT partition message delivery among multiple clients authorized on the same topic'
      );
      expect(evaluation.feasibleOptionsPreservingTopicName.length).toBeGreaterThanOrEqual(3);
    });

    it('should provide feasible isolation options preserving permanent topic names', () => {
      const evaluation = reconciliation.evaluateBroadcastControlIsolation(
        PERMANENT_HARDWARE_TOPICS.topicValve
      );

      const optionsText = evaluation.feasibleOptionsPreservingTopicName.join(' ');
      expect(optionsText).toContain(
        'Option 1 (Payload-Level Device Identity Filtering in Firmware)'
      );
      expect(optionsText).toContain('Option 2 (EMQX Broker Mountpoint / Client Topic Rewrite)');
      expect(optionsText).toContain('Option 3 (Single Physical Tank Actuator Scoping)');
    });
  });

  describe('Single Ingestion Path & Anti-Republish Loop Guard', () => {
    it('should reject republish loop when inbound and outbound topics are identical', () => {
      const guard = reconciliation.checkRepublishLoopGuard(
        'irigasi/melon/sensor/volume',
        'irigasi/melon/sensor/volume'
      );
      expect(guard.isSafe).toBe(false);
      expect(guard.reason).toContain('Republish loop detected');
    });

    it('should reject republishing hardware telemetry back into hardware telemetry topic', () => {
      const guard = reconciliation.checkRepublishLoopGuard(
        'irigasi/melon/sensor/volume',
        PERMANENT_HARDWARE_TOPICS.topicVolume
      );
      expect(guard.isSafe).toBe(false);
    });

    it('should allow unidirectional forwarding from hardware topic to internal canonical topic', () => {
      const guard = reconciliation.checkRepublishLoopGuard(
        'irigasi/melon/sensor/volume',
        'agriculture/development/site-01/water-tank-node-zi37gz/telemetry/reservoir'
      );
      expect(guard.isSafe).toBe(true);
    });
  });

  describe('Prototype Audit: Direct Browser MQTT Publishing Security Evaluation', () => {
    it('should strictly forbid direct browser MQTT publishing and list critical violations', () => {
      const audit = reconciliation.auditDirectBrowserPublishing();

      expect(audit.allowed).toBe(false);
      const codes = audit.violations.map((v) => v.code);
      expect(codes).toContain('DIRECT_BROWSER_MQTT_FORBIDDEN');
      expect(codes).toContain('RBAC_AND_AUTH_BYPASS');
      expect(codes).toContain('SAFETY_LOCK_BYPASS');
      expect(codes).toContain('NO_AUDIT_TRAIL');
      expect(codes).toContain('ZERO_IDEMPOTENCY_OR_LIFECYCLE');
      expect(codes).toContain('PUBLIC_BROKER_EXPOSURE');
    });
  });

  describe('TASK-0410 Protection: Flow Rate (Debit) Topic Conflict & Rejection', () => {
    it('should identify flowRate conflict for topicDebit and topicLiterKeluar', () => {
      const evaluationDebit = reconciliation.evaluateCompatibility(
        PERMANENT_HARDWARE_TOPICS.topicDebit!
      );
      expect(evaluationDebit.compatibleWithCanonicalRouter).toBe(false);
      expect(evaluationDebit.conflicts).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'TASK-0410 and DEC-MON-089: flowRate (debit/liter keluar) parameter was permanently removed'
          ),
        ])
      );

      const evaluationLiter = reconciliation.evaluateCompatibility(
        PERMANENT_HARDWARE_TOPICS.topicLiterKeluar!
      );
      expect(evaluationLiter.compatibleWithCanonicalRouter).toBe(false);
      expect(evaluationLiter.conflicts).toEqual(
        expect.arrayContaining([expect.stringContaining('TASK-0410 and DEC-MON-089')])
      );
    });

    it('should strictly reject mapping topicDebit or topicLiterKeluar to prevent flowRate reintroduction', () => {
      const context: HardwareMappingContext = {
        environment: 'development',
        siteId: 'site-01',
        deviceId: 'water-tank-node-zi37gz',
      };

      const resultDebit = reconciliation.mapHardwareTopicToCanonical(
        PERMANENT_HARDWARE_TOPICS.topicDebit!,
        context
      );
      expect(resultDebit.reconciled).toBe(false);
      expect(resultDebit.error).toContain('permanently removed per DEC-MON-089 (TASK-0410)');

      const resultLiter = reconciliation.mapHardwareTopicToCanonical(
        PERMANENT_HARDWARE_TOPICS.topicLiterKeluar!,
        context
      );
      expect(resultLiter.reconciled).toBe(false);
      expect(resultLiter.error).toContain('permanently removed per DEC-MON-089 (TASK-0410)');
    });
  });

  describe('Compatibility Evaluation & Architectural Conflicts', () => {
    it('should identify all structural and security conflicts for topicVolume', () => {
      const evaluation = reconciliation.evaluateCompatibility(
        PERMANENT_HARDWARE_TOPICS.topicVolume
      );

      expect(evaluation.compatibleWithCanonicalRouter).toBe(false);
      expect(evaluation.conflicts).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Root topic segment must be "agriculture"'),
          expect.stringContaining('Missing environment namespace'),
          expect.stringContaining('Missing site identifier'),
          expect.stringContaining('Missing device identifier'),
          expect.stringContaining('Non-canonical segments "sensor/volume"'),
        ])
      );
    });

    it('should identify broadcast, QoS 0, and primitive command conflicts for topicValve', () => {
      const evaluation = reconciliation.evaluateCompatibility(PERMANENT_HARDWARE_TOPICS.topicValve);

      expect(evaluation.compatibleWithCanonicalRouter).toBe(false);
      expect(evaluation.conflicts).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Broadcast valve control forbidden'),
          expect.stringContaining('Non-canonical segment "kontrol"'),
          expect.stringContaining('Missing device identifier'),
          expect.stringContaining('Prototype QoS 0 violates mandatory QoS 1'),
          expect.stringContaining('Primitive ON/OFF commands lack commandId'),
        ])
      );
    });

    it('should identify unsupported automation conflicts requiring DECISIONS.md resolution for topicOtomasi', () => {
      const evaluation = reconciliation.evaluateCompatibility(
        PERMANENT_HARDWARE_TOPICS.topicOtomasi
      );

      expect(evaluation.compatibleWithCanonicalRouter).toBe(false);
      expect(evaluation.conflicts).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Autonomous actuation settings ("otomasi") unsupported'),
          expect.stringContaining('requires formal DECISIONS.md record'),
          expect.stringContaining('Non-canonical segment "otomasi"'),
        ])
      );
    });
  });

  describe('Safe Mapping & Context Validation', () => {
    const validContext: HardwareMappingContext = {
      environment: 'development',
      siteId: 'site-01',
      deviceId: 'water-tank-node-zi37gz',
    };

    it('should fail mapping if context is omitted (no environment or deviceId)', () => {
      const result = reconciliation.mapHardwareTopicToCanonical(
        PERMANENT_HARDWARE_TOPICS.topicVolume
      );

      expect(result.reconciled).toBe(false);
      expect(result.error).toContain('Missing required context');
      expect(result.unresolvedReasons.length).toBeGreaterThan(0);
    });

    it('should fail mapping if deviceId is empty', () => {
      const result = reconciliation.mapHardwareTopicToCanonical(
        PERMANENT_HARDWARE_TOPICS.topicVolume,
        {
          environment: 'development',
          siteId: 'site-01',
          deviceId: '   ',
        }
      );

      expect(result.reconciled).toBe(false);
      expect(result.unresolvedReasons).toContain('deviceId is empty or undefined');
    });

    it('should strictly reject mapping topicOtomasi because it requires formal product approval', () => {
      const result = reconciliation.mapHardwareTopicToCanonical(
        PERMANENT_HARDWARE_TOPICS.topicOtomasi,
        validContext
      );

      expect(result.reconciled).toBe(false);
      expect(result.error).toContain('automated setting actuation is out of scope');
      expect(result.unresolvedReasons).toContain(
        'A formal product decision is required before automation settings can be specified'
      );
    });

    it('should strictly reject mapping flat topicValve to protect against broadcast faucet control', () => {
      const result = reconciliation.mapHardwareTopicToCanonical(
        PERMANENT_HARDWARE_TOPICS.topicValve,
        validContext
      );

      expect(result.reconciled).toBe(false);
      expect(result.error).toContain('Cannot map flat "irigasi/melon/kontrol/valve"');
      expect(result.unresolvedReasons).toContain('ENABLE_FAUCET_CONTROL is locked to false');
      expect(result.unresolvedReasons).toContain(
        'Prototype primitive ON/OFF strings lack commandId, idempotency key, and lifecycle tracking'
      );
    });

    it('should safely map topicVolume to canonical reservoir telemetry topic when explicit context is provided', () => {
      const result = reconciliation.mapHardwareTopicToCanonical(
        PERMANENT_HARDWARE_TOPICS.topicVolume,
        validContext
      );

      expect(result.reconciled).toBe(true);
      expect(result.canonicalTopic).toBe(
        'agriculture/development/site-01/water-tank-node-zi37gz/telemetry/reservoir'
      );
      expect(result.unresolvedReasons).toHaveLength(0);

      // Verify mapped topic is accepted by canonical router
      const validation = mqttTopicRouter.validateTopic(result.canonicalTopic!);
      expect(validation.valid).toBe(true);
      expect(validation.parsed?.category).toBe('telemetry');
      expect(validation.parsed?.subtype).toBe('reservoir');
      expect(validation.parsed?.deviceId).toBe('water-tank-node-zi37gz');
      expect(validation.parsed?.environment).toBe('development');
    });
  });

  describe('Contract Isolation: Telemetry Payload Device Identity Requirement', () => {
    it('should reject a telemetry payload lacking deviceId according to ReservoirTelemetryPayloadSchema', () => {
      const barePayload = {
        schemaVersion: '1.0',
        messageId: 'msg-001',
        data: {
          tankVolume: 1200,
          status: 'NORMAL',
        },
      };

      const parseResult = ReservoirTelemetryPayloadSchema.safeParse(barePayload);
      expect(parseResult.success).toBe(false);
      if (!parseResult.success) {
        const paths = parseResult.error.errors.map((e) => e.path.join('.'));
        expect(paths).toContain('deviceId');
      }
    });

    it('should accept a normalized telemetry payload with explicit deviceId matching canonical schema', () => {
      const validPayload = {
        schemaVersion: '1.0',
        messageId: 'msg-001',
        deviceId: 'water-tank-node-zi37gz',
        siteId: 'site-01',
        data: {
          tankVolume: 1200,
          status: 'NORMAL',
        },
      };

      const parseResult = ReservoirTelemetryPayloadSchema.safeParse(validPayload);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('Trailing Whitespace Audit (Exact Topic String Integrity)', () => {
    it('should flag trailing whitespace in topic string without silent trimming or auto-subscribing', () => {
      const topicWithTrailingSpace = 'irigasi/melon/kontrol/valve ';
      const audit = reconciliation.auditTrailingWhitespace(topicWithTrailingSpace);

      expect(audit.hasWhitespace).toBe(true);
      expect(audit.rawString).toBe('irigasi/melon/kontrol/valve ');
      expect(audit.sanitizedString).toBe('irigasi/melon/kontrol/valve');
      expect(audit.guidance).toContain('IMPLEMENTATION MISMATCH: Whitespace detected');
      expect(audit.guidance).toContain(
        'Do not silently trim, rename, or subscribe to alternate variants'
      );
      expect(audit.ingressBehavior.brokerDelivery).toContain('broker will NOT deliver');
      expect(audit.ingressBehavior.gatewayIngress).toContain('Fails exact string match');
    });

    it('should confirm clean topic string without trailing whitespace', () => {
      const cleanTopic = 'irigasi/melon/kontrol/valve';
      const audit = reconciliation.auditTrailingWhitespace(cleanTopic);

      expect(audit.hasWhitespace).toBe(false);
      expect(audit.guidance).toBe('Topic string has no leading or trailing whitespace.');
      expect(audit.ingressBehavior.brokerDelivery).toContain('delivers to matching subscribers');
      expect(audit.ingressBehavior.gatewayIngress).toContain('Matches exact topic filter');
    });
  });

  describe('Confirmed Purpose vs Unconfirmed Payload Semantics (Hardware Clarification)', () => {
    it('should document confirmed purpose for valve topic separately from unconfirmed wire payload syntax', () => {
      const audit = reconciliation.auditTopicSemantics('irigasi/melon/kontrol/valve');

      expect(audit.confirmedPurpose).toBe(
        'Valve OPEN/CLOSE commands (behavioral intent, NOT wire payload syntax)'
      );
      expect(audit.evidenceAudit.wirePayloadSyntaxConfirmed).toBe(false);
      expect(
        audit.unconfirmedSemantics.some((s) => s.includes('Wire payload syntax unconfirmed'))
      ).toBe(true);
      expect(
        audit.unconfirmedSemantics.some((s) => s.includes('Command identifier unconfirmed'))
      ).toBe(true);
    });

    it('should document confirmed purpose for irrigation topic separately from unconfirmed mode, target_liter, and feedback', () => {
      const audit = reconciliation.auditTopicSemantics('irigasi/melon/setting/otomasi');

      expect(audit.confirmedPurpose).toBe(
        'Irrigation (unconfirmed whether setting config, 1-shot dispense, or autonomous)'
      );
      expect(audit.evidenceAudit.equatesToCanonicalDispense).toBe(false);
      expect(
        audit.unconfirmedSemantics.some((s) => s.includes('Message function unconfirmed'))
      ).toBe(true);
      expect(audit.unconfirmedSemantics.some((s) => s.includes('mode'))).toBe(true);
      expect(audit.unconfirmedSemantics.some((s) => s.includes('target_liter'))).toBe(true);
      expect(
        audit.unconfirmedSemantics.some((s) =>
          s.includes('MUST NOT be equated with canonical DISPENSE')
        )
      ).toBe(true);
    });

    it('should document confirmed purpose for volume topic with unconfirmed payload calibration', () => {
      const audit = reconciliation.auditTopicSemantics('irigasi/melon/sensor/volume');

      expect(audit.confirmedPurpose).toBe('Tank water-volume telemetry');
      expect(
        audit.unconfirmedSemantics.some((s) => s.includes('Sensor measurement unit unconfirmed'))
      ).toBe(true);
    });
  });
});
