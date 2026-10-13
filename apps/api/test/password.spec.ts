import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/password';
describe('Password hashing', () => {
  it('uses independent salts and rejects wrong passwords and malformed hashes', async () => {
    const a = await hashPassword('password-with-entropy');
    const b = await hashPassword('password-with-entropy');
    assert.notEqual(a, b);
    assert.equal(await verifyPassword('password-with-entropy', a), true);
    assert.equal(await verifyPassword('wrong-password', a), false);
    assert.equal(await verifyPassword('password', 'scrypt:bad:bad'), false);
  });
});
