import { describe, it, expect } from 'vitest';
import {
  DeviceType,
  SOIL_NODE_MONITORING_PARAMETERS,
  WATER_QUALITY_NODE_MONITORING_PARAMETERS,
  WATER_TANK_NODE_CONTROL_CAPABILITIES,
  getCanonicalCapabilitiesForDeviceType,
  getCapabilityCategory,
  CapabilityCategory,
  supportsCapability,
} from '../device';

describe('Device Capabilities Contracts', () => {
  it('SOIL_NODE canonical capability set is correct', () => {
    const caps = getCanonicalCapabilitiesForDeviceType(DeviceType.SOIL_NODE);
    expect(caps).toEqual([...SOIL_NODE_MONITORING_PARAMETERS]);
    expect(caps).toContain('SOIL_NITROGEN');
    expect(caps).toContain('SOIL_PHOSPHORUS');
    expect(caps).toContain('SOIL_POTASSIUM');
    expect(caps).toContain('SOIL_TEMPERATURE');
    expect(caps).toContain('SOIL_MOISTURE');
    expect(caps).toContain('SOIL_PH');
    expect(caps).toContain('SOIL_EC');
    expect(caps).not.toContain('FAUCET_CONTROL');
  });

  it('WATER_QUALITY_NODE canonical capability set is correct', () => {
    const caps = getCanonicalCapabilitiesForDeviceType(DeviceType.WATER_QUALITY_NODE);
    expect(caps).toEqual([...WATER_QUALITY_NODE_MONITORING_PARAMETERS]);
    expect(caps).toContain('WATER_PH');
    expect(caps).toContain('WATER_TDS');
    expect(caps).toContain('WATER_EC');
    expect(caps).not.toContain('SOIL_PH');
  });

  it('WATER_TANK_NODE canonical capability set is correct', () => {
    const caps = getCanonicalCapabilitiesForDeviceType(DeviceType.WATER_TANK_NODE);
    expect(caps).toContain('WATER_TANK_VOLUME');
    expect(caps).toContain('WATER_FLOW_RATE');
    expect(caps).toContain('FAUCET_CONTROL');
    expect(caps).toHaveLength(3);
  });

  it('WATER_TANK_NODE does NOT expose RELAY_CONTROL or SOLENOID_VALVE_CONTROL as product capabilities', () => {
    const caps = getCanonicalCapabilitiesForDeviceType(DeviceType.WATER_TANK_NODE);
    expect(caps).not.toContain('RELAY_CONTROL');
    expect(caps).not.toContain('SOLENOID_VALVE_CONTROL');
    expect(WATER_TANK_NODE_CONTROL_CAPABILITIES).toEqual(['FAUCET_CONTROL']);
  });

  it('correctly classifies MONITORING vs CONTROL capabilities', () => {
    expect(getCapabilityCategory('SOIL_PH')).toBe(CapabilityCategory.MONITORING);
    expect(getCapabilityCategory('WATER_TDS')).toBe(CapabilityCategory.MONITORING);
    expect(getCapabilityCategory('WATER_TANK_VOLUME')).toBe(CapabilityCategory.MONITORING);
    expect(getCapabilityCategory('WATER_FLOW_RATE')).toBe(CapabilityCategory.MONITORING);
    expect(getCapabilityCategory('FAUCET_CONTROL')).toBe(CapabilityCategory.CONTROL);
  });

  it('supportsCapability feature detection helper works for string array DTOs', () => {
    const device = {
      capabilities: ['WATER_TANK_VOLUME', 'WATER_FLOW_RATE', 'FAUCET_CONTROL'],
    };
    expect(supportsCapability(device, 'FAUCET_CONTROL')).toBe(true);
    expect(supportsCapability(device, 'WATER_TANK_VOLUME')).toBe(true);
    expect(supportsCapability(device, 'SOIL_PH')).toBe(false);
    expect(supportsCapability(null, 'FAUCET_CONTROL')).toBe(false);
  });

  it('supportsCapability feature detection helper works for object arrays and respects enabled=false', () => {
    const device = {
      capabilities: [
        { capability: 'WATER_TANK_VOLUME', enabled: true },
        { capability: 'FAUCET_CONTROL', enabled: false },
      ],
    };
    expect(supportsCapability(device, 'WATER_TANK_VOLUME')).toBe(true);
    expect(supportsCapability(device, 'FAUCET_CONTROL')).toBe(false);
    expect(supportsCapability(device, 'SOIL_PH')).toBe(false);
  });

  it('returns empty array for unknown or unrecognised device type', () => {
    expect(getCanonicalCapabilitiesForDeviceType('UNKNOWN_DEVICE_TYPE' as any)).toEqual([]);
  });
});
