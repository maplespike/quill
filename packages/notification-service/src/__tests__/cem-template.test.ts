/**
 * Commercial alert identification (CASL).
 * The postal line comes from config. Tests use a fixture string, not a real address.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { buildNotificationEmail } from "../templates/email.js";
import { loadConfig } from "../config.js";
import { Mailer } from "../mailer.js";
import type { NotificationConfig } from "../config.js";

const base = {
  to: "subscriber@example.com",
  unsubscribeToken: "tok/with space",
  sourceId: "statcan-gdp",
  eventType: "data_update",
  summary: "GDP figures updated",
  apiBaseUrl: "https://api.maplespike.ca",
  senderEmail: "alerts@maplespike.ca",
};

describe("commercial alert template", () => {
  it("includes MapleSpike identity, the configured postal address, and a working unsubscribe link", () => {
    const postalAddress = "Fixture Mailbox, Ottawa ON";
    const mail = buildNotificationEmail({ ...base, postalAddress });
    const unsub = "https://api.maplespike.ca/v1/notifications/unsubscribe?token=tok%2Fwith%20space";

    for (const body of [mail.text, mail.html]) {
      assert.match(body, /MapleSpike/);
      assert.ok(body.includes(postalAddress));
      assert.ok(body.includes("alerts@maplespike.ca"));
      assert.ok(body.includes(unsub));
      assert.match(body, /Unsubscribe/);
    }
  });

  it("escapes a postal address that contains HTML", () => {
    const mail = buildNotificationEmail({
      ...base,
      postalAddress: '123 <script>alert("x")</script>',
    });
    assert.equal(mail.html.includes("<script>"), false);
    assert.ok(mail.html.includes("&lt;script&gt;"));
  });

  it("refuses to build a commercial alert without a postal address", () => {
    assert.throws(
      () => buildNotificationEmail({ ...base, postalAddress: "   " }),
      /NOTIFICATION_POSTAL_ADDRESS/,
    );
  });
});

describe("postal address config", () => {
  const previous = process.env.NOTIFICATION_POSTAL_ADDRESS;

  beforeEach(() => {
    delete process.env.NOTIFICATION_POSTAL_ADDRESS;
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.NOTIFICATION_POSTAL_ADDRESS;
    else process.env.NOTIFICATION_POSTAL_ADDRESS = previous;
  });

  it("reads the postal address from the environment and does not invent one", () => {
    const empty = loadConfig();
    assert.equal(empty.postalAddress, "");

    process.env.NOTIFICATION_POSTAL_ADDRESS = "Operator Mailbox, Ottawa ON";
    const set = loadConfig();
    assert.equal(set.postalAddress, "Operator Mailbox, Ottawa ON");
  });

  it("refuses to send a commercial alert when the address is unset", async () => {
    const config: NotificationConfig = {
      ...loadConfig(),
      smtpHost: "",
      fromEmail: "alerts@maplespike.ca",
      postalAddress: "",
    };
    const mailer = new Mailer(config, true);
    const result = await mailer.sendNotification({
      to: "subscriber@example.com",
      unsubscribeToken: "tok",
      sourceId: "statcan-gdp",
      eventType: "data_update",
      summary: "update",
    });
    assert.equal(result.success, false);
    assert.match(result.error ?? "", /NOTIFICATION_POSTAL_ADDRESS/);
  });
});
