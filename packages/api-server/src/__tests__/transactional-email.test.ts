import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderVerificationEmail, renderWelcomeEmail, type EmailConfig } from '../email.js';

const config: EmailConfig = {
  provider: 'console',
  fromEmail: 'noreply@maplespike.ca',
  fromName: 'MapleSpike',
  appUrl: 'https://quill.maplespike.ca',
  appName: 'MapleSpike',
};

describe('transactional account mail', () => {
  it('keeps verification mail free of commercial unsubscribe language', () => {
    const mail = renderVerificationEmail(config, {
      to: 'person@example.com',
      name: 'Ada',
      token: 'abc',
    });
    const body = `${mail.subject}\n${mail.text}\n${mail.html}`;
    assert.match(body, /verify your email/i);
    assert.equal(/unsubscribe/i.test(body), false);
    assert.equal(/postal address/i.test(body), false);
    assert.equal(body.includes('NOTIFICATION_POSTAL_ADDRESS'), false);
  });

  it('keeps welcome mail free of commercial unsubscribe language', () => {
    const mail = renderWelcomeEmail(config, {
      to: 'person@example.com',
      name: 'Ada',
    });
    const body = `${mail.subject}\n${mail.text}\n${mail.html}`;
    assert.match(body, /account is now active/i);
    assert.equal(/unsubscribe/i.test(body), false);
    assert.equal(/postal address/i.test(body), false);
  });
});
