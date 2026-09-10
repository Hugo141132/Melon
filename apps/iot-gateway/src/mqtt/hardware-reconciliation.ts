import { AllowedEnvironment, mqttTopicRouter } from './router';

export interface HardwareTopicParameters {
  broker: string;
  port: number;
  protocol: 'wss' | 'mqtts';
  topicVolume: string;
  topicValve: string;
  topicOtomasi: string;
  topicDebit?: string;
  topicLiterKeluar?: string;
}

/**
 * Permanent external hardware topic contract per DEC-DEV-031.
 * Hardware team is not required to rename these topics through production.
 */
export const PERMANENT_HARDWARE_TOPICS: HardwareTopicParameters = {
  broker: 'broker.emqx.io',
  port: 8084,
  protocol: 'wss',
  topicVolume: 'irigasi/melon/sensor/volume',
  topicValve: 'irigasi/melon/kontrol/valve',
  topicOtomasi: 'irigasi/melon/setting/otomasi',
  topicDebit: 'irigasi/melon/sensor/debit',
  topicLiterKeluar: 'irigasi/melon/sensor/liter_keluar',
};

// Backwards-compatible alias
export const HARDWARE_TEAM_PARAMETERS = PERMANENT_HARDWARE_TOPICS;

export interface HardwareMappingContext {
  environment: AllowedEnvironment;
  siteId: string;
  deviceId: string;
}

export interface HardwareTopicMappingResult {
  reconciled: boolean;
  canonicalTopic?: string;
  error?: string;
  unresolvedReasons: string[];
}

export interface BrowserMqttAuditViolation {
  code: string;
  severity: 'CRITICAL' | 'HIGH';
  description: string;
}

export interface BroadcastControlIsolationEvaluation {
  topic: string;
  hasBroadcastHazard: boolean;
  brokerCredentialSufficient: boolean;
  explanation: string;
  feasibleOptionsPreservingTopicName: string[];
}

/**
 * Confirmed functional purposes of the permanent hardware topics per hardware clarification.
 * Documented separately from wire payload semantics.
 */
export const CONFIRMED_HARDWARE_TOPIC_PURPOSES = {
  topicVolume: 'Tank water-volume telemetry',
  topicValve: 'Valve OPEN/CLOSE commands (behavioral intent, NOT wire payload syntax)',
  topicOtomasi: 'Irrigation (unconfirmed whether setting config, 1-shot dispense, or autonomous)',
} as const;

export interface HardwareTopicSemanticAudit {
  topic: string;
  confirmedPurpose: string;
  unconfirmedSemantics: string[];
  evidenceAudit: {
    wirePayloadSyntaxConfirmed: boolean;
    modeSemanticsConfirmed: boolean;
    targetLiterUnitsConfirmed: boolean;
    startStopBehaviorConfirmed: boolean;
    completionFeedbackConfirmed: boolean;
    equatesToCanonicalDispense: boolean;
  };
}

export interface TrailingWhitespaceAuditResult {
  hasWhitespace: boolean;
  rawString: string;
  sanitizedString: string;
  guidance: string;
  ingressBehavior: {
    brokerDelivery: string;
    gatewayIngress: string;
  };
}

export class HardwareMqttReconciliation {
  /**
   * Audits a topic string for leading or trailing whitespace.
   * Clarification on runtime behavior:
   * - Detection: This helper flags whitespace presence during static configuration or validation audits.
   * - MQTT Broker Behavior: MQTT topic filters are strictly byte-exact. A subscriber to "irigasi/melon/kontrol/valve"
   *   will NOT receive messages published to "irigasi/melon/kontrol/valve " (broker-level non-delivery).
   * - Application Ingress: If evaluated by the gateway or canonical router, topics with whitespace fail exact matching
   *   and are rejected fail-closed without silent trimming or alternate subscriptions.
   */
  public auditTrailingWhitespace(topicString: string): TrailingWhitespaceAuditResult {
    const hasWhitespace =
      topicString.startsWith(' ') ||
      topicString.startsWith('\t') ||
      topicString.endsWith(' ') ||
      topicString.endsWith('\t');

    return {
      hasWhitespace,
      rawString: topicString,
      sanitizedString: topicString.trim(),
      guidance: hasWhitespace
        ? 'IMPLEMENTATION MISMATCH: Whitespace detected in topic string. MQTT topics are byte-exact; messages published with whitespace will not match subscriptions without whitespace (broker non-delivery). The authoritative external topic contract (DEC-DEV-031) is strictly "irigasi/melon/kontrol/valve" with NO whitespace. Do not silently trim, rename, or subscribe to alternate variants; report any whitespace occurrence as an implementation mismatch.'
        : 'Topic string has no leading or trailing whitespace.',
      ingressBehavior: {
        brokerDelivery: hasWhitespace
          ? 'MQTT broker will NOT deliver this message to subscribers listening on the exact topic without whitespace.'
          : 'MQTT broker delivers to matching subscribers.',
        gatewayIngress: hasWhitespace
          ? 'Fails exact string match in gateway router; rejected fail-closed without silent trimming.'
          : 'Matches exact topic filter.',
      },
    };
  }

  /**
   * Audits confirmed functional purpose vs unconfirmed payload semantics for a given hardware topic.
   */
  public auditTopicSemantics(topic: string): HardwareTopicSemanticAudit {
    if (topic === PERMANENT_HARDWARE_TOPICS.topicValve) {
      return {
        topic,
        confirmedPurpose: CONFIRMED_HARDWARE_TOPIC_PURPOSES.topicValve,
        unconfirmedSemantics: [
          'Wire payload syntax unconfirmed: whether device expects primitive "ON"/"OFF", "OPEN"/"CLOSE", integer 1/0, or structured JSON {"action":"OPEN"}',
          'Command identifier unconfirmed: whether firmware parses commandId for idempotency and duplicate deduplication',
          'QoS requirement unconfirmed: whether firmware handles QoS 1 packet acknowledgements',
          'Feedback channel unconfirmed: whether valve publishes execution ack/events on completion or timeout',
        ],
        evidenceAudit: {
          wirePayloadSyntaxConfirmed: false,
          modeSemanticsConfirmed: false,
          targetLiterUnitsConfirmed: false,
          startStopBehaviorConfirmed: false,
          completionFeedbackConfirmed: false,
          equatesToCanonicalDispense: false,
        },
      };
    }

    if (topic === PERMANENT_HARDWARE_TOPICS.topicOtomasi) {
      return {
        topic,
        confirmedPurpose: CONFIRMED_HARDWARE_TOPIC_PURPOSES.topicOtomasi,
        unconfirmedSemantics: [
          'Message function unconfirmed: does payload configure persistent settings, initiate a single target-volume dispensing cycle, or enable unmonitored autonomous scheduling?',
          'Payload parameter "mode" semantics unconfirmed: what values are supported beyond "AUTO"? Does "MANUAL" or "OFF" exist?',
          'Payload parameter "target_liter" units and precision unconfirmed: integer Liters, milliliters, or float?',
          'Start/Stop and abort trigger unconfirmed: how is an in-progress irrigation stopped or aborted over this topic?',
          'Completion feedback unconfirmed: does device publish an event when target_liter is reached, or is it fire-and-forget?',
          'Canonical mismatch: this topic MUST NOT be equated with canonical DISPENSE or invent platform-level automation without formal DECISIONS.md approval.',
        ],
        evidenceAudit: {
          wirePayloadSyntaxConfirmed: false, // Prototype shows { mode: "AUTO", target_liter }, but firmware parsing/schema unverified
          modeSemanticsConfirmed: false,
          targetLiterUnitsConfirmed: false,
          startStopBehaviorConfirmed: false,
          completionFeedbackConfirmed: false,
          equatesToCanonicalDispense: false,
        },
      };
    }

    if (topic === PERMANENT_HARDWARE_TOPICS.topicVolume) {
      return {
        topic,
        confirmedPurpose: CONFIRMED_HARDWARE_TOPIC_PURPOSES.topicVolume,
        unconfirmedSemantics: [
          'Sensor measurement unit unconfirmed: physical sensor raw cm depth vs calibrated Liters vs percentage',
          'Envelope structure unconfirmed: raw numeric string vs JSON envelope with timestamp and status',
        ],
        evidenceAudit: {
          wirePayloadSyntaxConfirmed: false,
          modeSemanticsConfirmed: true,
          targetLiterUnitsConfirmed: false,
          startStopBehaviorConfirmed: true,
          completionFeedbackConfirmed: true,
          equatesToCanonicalDispense: false,
        },
      };
    }

    return {
      topic,
      confirmedPurpose: 'Unknown topic',
      unconfirmedSemantics: ['Unrecognized topic in hardware contract'],
      evidenceAudit: {
        wirePayloadSyntaxConfirmed: false,
        modeSemanticsConfirmed: false,
        targetLiterUnitsConfirmed: false,
        startStopBehaviorConfirmed: false,
        completionFeedbackConfirmed: false,
        equatesToCanonicalDispense: false,
      },
    };
  }
  /**
   * Evaluates whether a raw topic matches known permanent hardware team topic patterns.
   */
  public isHardwareTopic(topic: string): boolean {
    return (
      topic === PERMANENT_HARDWARE_TOPICS.topicVolume ||
      topic === PERMANENT_HARDWARE_TOPICS.topicValve ||
      topic === PERMANENT_HARDWARE_TOPICS.topicOtomasi ||
      topic === PERMANENT_HARDWARE_TOPICS.topicDebit ||
      topic === PERMANENT_HARDWARE_TOPICS.topicLiterKeluar
    );
  }

  /**
   * Evaluates the permanent hardware topics against canonical architecture constraints.
   * Identifies why direct unmapped consumption is blocked and what boundaries must be maintained.
   */
  public evaluateCompatibility(topic: string): {
    compatibleWithCanonicalRouter: boolean;
    conflicts: string[];
  } {
    const conflicts: string[] = [];
    const routerValidation = mqttTopicRouter.validateTopic(topic);

    if (!routerValidation.valid) {
      conflicts.push(`Fails canonical router validation: ${routerValidation.error}`);
    }

    if (!topic.startsWith('agriculture/')) {
      conflicts.push('Missing canonical root namespace "agriculture"');
    }

    // Structural conflicts common to all flat hardware topics
    conflicts.push(
      'Missing environment namespace ({environment}: development, staging, production)'
    );
    conflicts.push('Missing site identifier ({siteId})');
    conflicts.push('Missing device identifier ({deviceId}) - flat broadcast risk');

    if (topic === PERMANENT_HARDWARE_TOPICS.topicValve) {
      conflicts.push(
        'Broadcast valve control forbidden (violates DEV-TOPIC-003: commands must target single device)'
      );
      conflicts.push('Non-canonical segment "kontrol" (violates DEV-TOPIC-003: English only)');
      conflicts.push('Prototype QoS 0 violates mandatory QoS 1 at-least-once delivery');
      conflicts.push(
        'Primitive ON/OFF commands lack commandId, idempotency, and lifecycle state tracking'
      );
    }

    if (topic === PERMANENT_HARDWARE_TOPICS.topicOtomasi) {
      conflicts.push(
        'Autonomous actuation settings ("otomasi") unsupported and unapproved in architecture (requires formal DECISIONS.md record)'
      );
      conflicts.push('Non-canonical segment "otomasi" (violates DEV-TOPIC-003: English only)');
    }

    if (topic === PERMANENT_HARDWARE_TOPICS.topicVolume) {
      conflicts.push('Non-canonical segments "sensor/volume" instead of "telemetry/reservoir"');
    }

    if (
      topic === PERMANENT_HARDWARE_TOPICS.topicDebit ||
      topic === PERMANENT_HARDWARE_TOPICS.topicLiterKeluar
    ) {
      conflicts.push(
        'Conflicts with completed TASK-0410 and DEC-MON-089: flowRate (debit/liter keluar) parameter was permanently removed'
      );
    }

    return {
      compatibleWithCanonicalRouter: routerValidation.valid,
      conflicts,
    };
  }

  /**
   * Evaluates architectural and security violations of direct browser-to-broker publishing.
   */
  public auditDirectBrowserPublishing(): {
    allowed: boolean;
    violations: BrowserMqttAuditViolation[];
  } {
    return {
      allowed: false,
      violations: [
        {
          code: 'DIRECT_BROWSER_MQTT_FORBIDDEN',
          severity: 'CRITICAL',
          description:
            'Direct browser-to-broker connection violates ARCHITECTURE.md §3.2 and DEVICE_COMMUNICATION.md §3. Browser must never publish directly to MQTT.',
        },
        {
          code: 'RBAC_AND_AUTH_BYPASS',
          severity: 'CRITICAL',
          description:
            'Direct browser publishing bypasses server-side session authentication, active account checks, and device.control.dispense RBAC enforcement.',
        },
        {
          code: 'SAFETY_LOCK_BYPASS',
          severity: 'CRITICAL',
          description:
            'Direct browser publishing bypasses ENABLE_FAUCET_CONTROL=false server-side safety flag.',
        },
        {
          code: 'NO_AUDIT_TRAIL',
          severity: 'HIGH',
          description:
            'Direct browser publishing produces no durable PostgreSQL transaction, audit_logs entry, or operator attribution.',
        },
        {
          code: 'ZERO_IDEMPOTENCY_OR_LIFECYCLE',
          severity: 'HIGH',
          description:
            'QoS 0 ON/OFF strings omit commandId, preventing deduplication, timeout handling, and ACK tracking.',
        },
        {
          code: 'PUBLIC_BROKER_EXPOSURE',
          severity: 'CRITICAL',
          description:
            'Connecting to public broker.emqx.io exposes hardware control to unauthorized third parties without ACL isolation (violates SEC-DEV-002).',
        },
      ],
    };
  }

  /**
   * Rigorously evaluates multi-device control isolation on permanent flat topic `irigasi/melon/kontrol/valve`.
   * Credentials alone do not isolate multiple authorized subscribers on the exact same topic string.
   */
  public evaluateBroadcastControlIsolation(
    topic: string = PERMANENT_HARDWARE_TOPICS.topicValve
  ): BroadcastControlIsolationEvaluation {
    if (topic !== PERMANENT_HARDWARE_TOPICS.topicValve) {
      return {
        topic,
        hasBroadcastHazard: false,
        brokerCredentialSufficient: true,
        explanation: 'Topic is not a flat control topic.',
        feasibleOptionsPreservingTopicName: [],
      };
    }

    return {
      topic,
      hasBroadcastHazard: true,
      brokerCredentialSufficient: false,
      explanation:
        'Because the topic "irigasi/melon/kontrol/valve" lacks a device identifier segment ({deviceId}), standard MQTT publish-subscribe delivers any published message to EVERY authenticated client currently subscribed to that topic. MQTT credentials (username/password/mTLS) authenticate client identity and permit topic subscription, but do NOT partition message delivery among multiple clients authorized on the same topic.',
      feasibleOptionsPreservingTopicName: [
        'Option 1 (Payload-Level Device Identity Filtering in Firmware): Retain external topic "irigasi/melon/kontrol/valve". The command payload JSON includes "targetDeviceId". Each device firmware inspects the payload and only actuates if targetDeviceId matches its own identity, discarding non-matching commands.',
        'Option 2 (EMQX Broker Mountpoint / Client Topic Rewrite): EMQX broker configures a per-client Mountpoint or Rule Engine rewrite based on authenticated username (e.g. client "water-tank-01" subscribing to "irigasi/melon/kontrol/valve" is rewritten internally by EMQX to "tenants/water-tank-01/irigasi/melon/kontrol/valve"), preserving flat topic strings in firmware while achieving broker-enforced isolation.',
        'Option 3 (Single Physical Tank Actuator Scoping): In architectures where exactly one physical water tank actuator node exists per deployment environment, broadcast collision across devices is physically non-existent, provided environment namespaces are strictly segregated at broker or ingress level.',
      ],
    };
  }

  /**
   * Safely maps permanent hardware volume telemetry to the canonical internal topic.
   * Enforces explicit context binding and prevents republishing loops.
   */
  public mapHardwareTopicToCanonical(
    topic: string,
    context?: HardwareMappingContext
  ): HardwareTopicMappingResult {
    const unresolvedReasons: string[] = [];

    if (!context) {
      return {
        reconciled: false,
        error:
          'Missing required context: environment, siteId, and deviceId must be explicitly supplied to map flat hardware topics.',
        unresolvedReasons: [
          'No environment context to isolate development/staging/production',
          'No deviceId to bind telemetry to an authenticated database device record',
          'Risk of multi-device data collision on shared topic',
        ],
      };
    }

    if (!context.deviceId || !context.deviceId.trim()) {
      unresolvedReasons.push('deviceId is empty or undefined');
    }

    if (
      topic === PERMANENT_HARDWARE_TOPICS.topicDebit ||
      topic === PERMANENT_HARDWARE_TOPICS.topicLiterKeluar
    ) {
      return {
        reconciled: false,
        error:
          'Cannot map flow rate or dispensed liter topics: permanently removed per DEC-MON-089 (TASK-0410).',
        unresolvedReasons: [
          'Flow rate was completely purged from database, contracts, API, and UI in TASK-0410',
          'Reintroducing flowRate or debit topics is strictly prohibited',
        ],
      };
    }

    if (topic === PERMANENT_HARDWARE_TOPICS.topicOtomasi) {
      return {
        reconciled: false,
        error:
          'Cannot map "irigasi/melon/setting/otomasi": automated setting actuation is out of scope and requires a formal DECISIONS.md resolution.',
        unresolvedReasons: [
          'Autonomous control logic without web backend RBAC violates SECURITY.md and PRD.md',
          'No database schema or contracts exist for autonomous irrigation settings',
          'A formal product decision is required before automation settings can be specified',
        ],
      };
    }

    if (topic === PERMANENT_HARDWARE_TOPICS.topicValve) {
      return {
        reconciled: false,
        error:
          'Cannot map flat "irigasi/melon/kontrol/valve" as a general inbound or outbound topic without device binding and physical control safety clearance.',
        unresolvedReasons: [
          'Faucet commands must target single device: agriculture/{env}/{siteId}/{deviceId}/command/faucet',
          'ENABLE_FAUCET_CONTROL is locked to false',
          'Physical fail-safe upon connection loss remains unresolved (DEC-CTRL-090)',
          'Prototype primitive ON/OFF strings lack commandId, idempotency key, and lifecycle tracking',
          'Credentials alone cannot isolate multiple subscribers on a shared flat control topic',
        ],
      };
    }

    if (topic === PERMANENT_HARDWARE_TOPICS.topicVolume) {
      if (unresolvedReasons.length > 0) {
        return {
          reconciled: false,
          error: 'Context validation failed',
          unresolvedReasons,
        };
      }

      try {
        const canonicalTopic = mqttTopicRouter.buildTopic(
          context.environment,
          context.siteId,
          context.deviceId,
          'telemetry',
          'reservoir'
        );

        return {
          reconciled: true,
          canonicalTopic,
          unresolvedReasons: [],
        };
      } catch (err) {
        return {
          reconciled: false,
          error: (err as Error).message,
          unresolvedReasons: [(err as Error).message],
        };
      }
    }

    return {
      reconciled: false,
      error: `Unknown hardware topic: "${topic}"`,
      unresolvedReasons: ['Topic not recognized in hardware parameter set'],
    };
  }

  /**
   * Anti-Republish Loop Guard:
   * Validates that an ingested message is not republishing into the same hardware topic,
   * preserving a single unidirectional ingestion path.
   */
  public checkRepublishLoopGuard(
    inboundTopic: string,
    outboundTopic: string
  ): { isSafe: boolean; reason?: string } {
    if (inboundTopic === outboundTopic) {
      return {
        isSafe: false,
        reason: `Republish loop detected: inbound and outbound topic are identical ("${inboundTopic}")`,
      };
    }

    if (
      this.isHardwareTopic(inboundTopic) &&
      outboundTopic === PERMANENT_HARDWARE_TOPICS.topicVolume
    ) {
      return {
        isSafe: false,
        reason:
          'Circular mapping detected: cannot republish hardware telemetry back to hardware telemetry topic',
      };
    }

    return { isSafe: true };
  }
}

export const hardwareMqttReconciliation = new HardwareMqttReconciliation();
