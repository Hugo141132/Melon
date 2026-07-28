import { PrismaClient } from '@prisma/client';
import readline from 'readline';
import { provisionFirstOwner, validateTestDatabaseUrl } from '../src/owner-provisioning';

async function readInputMasked(promptText: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    process.stdout.write(promptText);
    let input = '';

    if (!process.stdin.isTTY) {
      rl.question('', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
      return;
    }

    const onData = (char: Buffer) => {
      const str = char.toString('utf-8');
      switch (str) {
        case '\n':
        case '\r':
        case '\u0004':
          process.stdin.removeListener('data', onData);
          process.stdin.setRawMode(false);
          rl.close();
          console.log();
          resolve(input.trim());
          break;
        case '\u0003':
          process.exit(1);
          break;
        case '\u007f':
        case '\b':
          if (input.length > 0) {
            input = input.slice(0, -1);
          }
          break;
        default:
          input += str;
          break;
      }
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

async function main() {
  const isTestRun = process.env.IS_TEST_RUN === 'true';
  let dbUrl: string;

  if (isTestRun) {
    dbUrl = validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);
    process.env.DATABASE_URL = dbUrl;
  } else {
    dbUrl = process.env.DATABASE_URL || '';
    if (!dbUrl) {
      console.error(
        'ERROR: DATABASE_URL environment variable is required to run the seed:owner command.'
      );
      process.exit(1);
    }
  }

  let email = process.env.OWNER_EMAIL || '';
  let password = process.env.OWNER_PASSWORD || '';
  let fullName = process.env.OWNER_NAME || '';

  if (process.env.OWNER_PASSWORD) {
    console.log(
      'NOTE: Using OWNER_PASSWORD from environment variable. Operator warning: Environment variables may be visible to local process inspection tools.'
    );
  }

  if (!email && process.stdin.isTTY) {
    email = await readInputMasked('Enter Owner Email: ');
  }
  if (!fullName && process.stdin.isTTY) {
    fullName = await readInputMasked('Enter Owner Full Name: ');
  }
  if (!password && process.stdin.isTTY) {
    password = await readInputMasked('Enter Owner Password: ');
  }

  if (!email || !password || !fullName) {
    console.error(
      'ERROR: Missing required Owner inputs. OWNER_EMAIL, OWNER_PASSWORD, and OWNER_NAME must be provided.'
    );
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: {
      db: { url: dbUrl },
    },
  });

  try {
    const result = await provisionFirstOwner(
      prisma,
      {
        email,
        password,
        fullName,
      },
      {
        simulateFailure: process.env.SIMULATE_FAILURE === 'true',
      }
    );

    password = '';

    console.log('SUCCESS: First Owner account provisioned successfully.');
    console.log(`User ID: ${result.user.id}`);
    console.log(`Email: ${result.user.email}`);
    console.log(`Full Name: ${result.user.fullName}`);
    console.log(`Account Status: ${result.user.accountStatus}`);
    console.log(`Role: OWNER`);
  } catch (error: any) {
    password = '';
    console.error(`PROVISIONING FAILED: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
