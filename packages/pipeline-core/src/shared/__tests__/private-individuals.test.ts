import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stripPrivateIndividualNames } from '../private-individuals.js';

describe('stripPrivateIndividualNames', () => {
  it('drops donors, insiders, and 10% holders and keeps public roles', () => {
    const profile = stripPrivateIndividualNames({
      mpDetails: { name: 'Example Minister', party: 'Example Party', riding: 'Example Riding' },
      crossReferences: {
        lobbying: [{ registrant_name: 'Example Lobbyist', client_name: 'Example Corp' }],
        executive: [{ executiveName: 'Example Executive', organization: 'Example Issuer' }],
        official: [{ name: 'Example Official', position: 'Deputy minister', department: 'Finance' }],
        donors: [{ donorName: 'Example Donor', amount: 50 }],
        insiders: [{ insiderName: 'Example Insider', insiderRelation: '10% Holder', issuerName: 'Example Issuer' }],
      },
    });
    const text = JSON.stringify(profile);
    assert.equal(text.includes('Example Donor'), false);
    assert.equal(text.includes('Example Insider'), false);
    assert.equal(text.includes('donorName'), false);
    assert.equal(text.includes('insiderName'), false);
    assert.equal(text.includes('Example Minister'), true);
    assert.equal(text.includes('Example Lobbyist'), true);
    assert.equal(text.includes('Example Executive'), true);
    assert.equal(text.includes('Example Official'), true);
  });
});
