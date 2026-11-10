import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseFederalCorporation } from '../corporations.js';
import { mapDisclosureRecord } from '../procurement.js';

const CORPORATION = {
  corporationId: 1007,
  act: 'Canada Not-for-profit Corporations Act',
  status: 'Active',
  corporationNames: [
    { CorporationName: { name: 'Abbotsford Chamber of Commerce', nameType: 'primary', current: true } },
  ],
  adresses: [
    {
      address: {
        addressLine: ['101-32450 Simon Avenue'],
        city: 'Abbotsford',
        provinceCode: 'BC',
        postalCode: 'V2T 5E3',
        current: true,
      },
    },
  ],
  annualReturns: [{ annualReturn: { yearOfFiling: '2024' } }],
  activities: [{ activity: { activity: 'Incorporation', date: '1922-01-01' } }],
};

describe('corporate source fixtures', () => {
  it('maps a Corporations Canada JSON record', () => {
    const parsed = parseFederalCorporation(
      CORPORATION,
      'https://ised-isde.canada.ca/cc/lgcy/api/corporations/1007.json?lang=eng',
    );
    assert.equal(parsed.legalName, 'Abbotsford Chamber of Commerce');
    assert.equal(parsed.corporationNumber, '1007');
    assert.match(parsed.sourceUrl, /ised-isde\.canada\.ca/);
    assert.match(parsed.officeAddress ?? '', /Abbotsford/);
  });

  it('maps a contracts-datastore row', () => {
    const mapped = mapDisclosureRecord({
      vendor_name: 'Acme Supply Ltd',
      contract_value: '125000.50',
      contract_date: '2026-09-01',
      owner_org_title: 'Public Services and Procurement Canada',
      description_en: 'Office supplies',
      solicitation_procedure: 'Competitive',
      number_of_bids: 4,
    });
    assert.equal(mapped.vendorName, 'Acme Supply Ltd');
    assert.equal(mapped.contractValue, 125000.5);
    assert.equal(mapped.awardDate, '2026-09-01');
    assert.equal(mapped.department, 'Public Services and Procurement Canada');
    assert.equal(mapped.bidsReceived, 4);
  });

});
