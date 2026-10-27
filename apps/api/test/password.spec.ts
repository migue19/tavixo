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

import { restaurantBranding } from '../src/branding';
import { ticketPdf, TicketKind, Ticket } from '../src/ticket';
describe('Restaurant branding', () => {
  it('uses only the exact tenant identity and keeps other tenants generic', () => {
    assert.equal(restaurantBranding('birria-el-cachanilla')?.primary, '#0b0907');
    assert.equal(restaurantBranding('bill-cochi-nada')?.primary, '#075839');
    assert.equal(restaurantBranding('other')?.logo, undefined);
    for (const slug of ['other', 'Birria-el-cachanilla', '../birria-el-cachanilla', '']) {
      assert.equal(restaurantBranding(slug), null);
    }
  });
  it('embeds the bundled logo in tickets while retaining a generic fallback', async () => {
    const ticket: Ticket = {
      kind: TicketKind.ACCOUNT, title: 'Cuenta', notice: 'Cuenta pendiente de pago',
      restaurant: 'Birria El Cachanilla', branch: 'Principal', address: '',
      order: { id: 'demo', number: 1, tableName: 'Mesa 1', createdAt: new Date().toISOString(),
        createdByName: 'Demo', totalCents: 100, items: [{name: 'Taco', quantity: 1, unitPriceCents: 100, lineTotalCents: 100}] },
      payment: null,
    };
    const generic = await ticketPdf(ticket);
    const branded = await ticketPdf({...ticket, branding: restaurantBranding('birria-el-cachanilla')});
    assert.equal(generic.subarray(0,4).toString(), '%PDF');
    assert.equal(generic.includes(Buffer.from('/Subtype /Image')), false);
    assert.equal(branded.includes(Buffer.from('/Subtype /Image')), true);
  });
});
