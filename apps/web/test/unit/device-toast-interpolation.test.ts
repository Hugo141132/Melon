import { describe, it, expect } from 'vitest';
import idMessages from '@/messages/id.json';
import enMessages from '@/messages/en.json';
import { createTranslator } from 'next-intl';

describe('Device toast message interpolation regression test', () => {
  it('correctly interpolates device name in updateSuccess for en and id without literal {name}', () => {
    const tEn = createTranslator({ locale: 'en', messages: enMessages, namespace: 'devices' });
    const tId = createTranslator({ locale: 'id', messages: idMessages, namespace: 'devices' });

    const deviceName = 'Soil Node Greenhouse A';

    const enResult = tEn('updateSuccess', { name: deviceName });
    const idResult = tId('updateSuccess', { name: deviceName });

    // Must interpolate the actual name and NOT leave literal {name}
    expect(enResult).toBe("Device 'Soil Node Greenhouse A' updated successfully.");
    expect(idResult).toBe("Perangkat 'Soil Node Greenhouse A' berhasil diperbarui.");
    expect(enResult).not.toContain('{name}');
    expect(idResult).not.toContain('{name}');
  });

  it('correctly interpolates device name in addSuccess for en and id without literal {name}', () => {
    const tEn = createTranslator({ locale: 'en', messages: enMessages, namespace: 'devices' });
    const tId = createTranslator({ locale: 'id', messages: idMessages, namespace: 'devices' });

    const deviceName = 'Water Tank Node B';

    const enResult = tEn('addSuccess', { name: deviceName });
    const idResult = tId('addSuccess', { name: deviceName });

    expect(enResult).toBe("Device 'Water Tank Node B' successfully added to registry.");
    expect(idResult).toBe("Perangkat 'Water Tank Node B' berhasil ditambahkan ke registri.");
    expect(enResult).not.toContain('{name}');
    expect(idResult).not.toContain('{name}');
  });
});
