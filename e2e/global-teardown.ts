import { teardownTestDatabase } from './test-environment';

export default async function globalTeardown() {
  teardownTestDatabase();
}
