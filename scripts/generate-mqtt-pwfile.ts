import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { getMqttTestCredentials } from './mqtt-config';

/**
 * Formats a password string into Mosquitto 2.0 PBKDF2-SHA512 password hash format ($7$).
 * Uses 1000 iterations and 64-byte salt matching official mosquitto_passwd output.
 */
export function generateMosquittoHash(password: string): string {
  const salt = crypto.randomBytes(64).toString('base64');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('base64');
  return `$7$1000$${salt}$${hash}`;
}

export function generatePwfileContent(): string {
  const creds = getMqttTestCredentials();
  const users = [
    {
      username: creds.gatewayUsername,
      password: creds.gatewayPassword,
      comment: 'IoT Gateway Service',
    },
    {
      username: creds.device1Username,
      password: creds.device1Password,
      comment: 'Development Device 1',
    },
    {
      username: creds.device2Username,
      password: creds.device2Password,
      comment: 'Development Device 2',
    },
    {
      username: creds.unauthUsername,
      password: creds.unauthPassword,
      comment: 'Unauthorized Test Device',
    },
  ];

  const lines: string[] = [
    '# Eclipse Mosquitto Password File for Kebun Melon Development Environment',
    '# DO NOT COMMIT PRODUCTION CREDENTIALS TO SOURCE CONTROL',
    '# Generated via scripts/generate-mqtt-pwfile.ts using official mosquitto_passwd format',
    '',
  ];

  for (const user of users) {
    if (user.comment) {
      lines.push(`# ${user.comment}`);
    }
    const hash = generateMosquittoHash(user.password);
    lines.push(`${user.username}:${hash}`);
  }

  lines.push('');
  return lines.join('\n');
}

export function writePwfile(): void {
  const targetDir = path.join(process.cwd(), 'docker', 'mosquitto', 'config');
  const targetPath = path.join(targetDir, 'pwfile');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Attempt using official dockerized mosquitto_passwd first for guaranteed compatibility
  try {
    const creds = getMqttTestCredentials();
    const cmd = `docker run --rm -v "${targetDir}:/config" eclipse-mosquitto:2 sh -c "rm -f /config/pwfile && mosquitto_passwd -c -b /config/pwfile ${creds.gatewayUsername} ${creds.gatewayPassword} && mosquitto_passwd -b /config/pwfile ${creds.device1Username} ${creds.device1Password} && mosquitto_passwd -b /config/pwfile ${creds.device2Username} ${creds.device2Password} && mosquitto_passwd -b /config/pwfile ${creds.unauthUsername} ${creds.unauthPassword} && chmod 644 /config/pwfile"`;
    execSync(cmd, { stdio: 'pipe' });
    console.log(
      `[MQTT] Development pwfile successfully created via official mosquitto_passwd tool at: ${targetPath}`
    );
    return;
  } catch {
    // Fallback to exact PBKDF2-SHA512 format generator
    const content = generatePwfileContent();
    fs.writeFileSync(targetPath, content, { encoding: 'utf8', mode: 0o644 });
    console.log(
      `[MQTT] Development pwfile created via PBKDF2-SHA512 fallback generator at: ${targetPath}`
    );
  }
}

if (require.main === module) {
  writePwfile();
}
