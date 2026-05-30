// SPDX-License-Identifier: AGPL-3.0-or-later

export async function parseUnRecords(
  body: string,
  format: 'json' | 'xml' | 'csv',
  metadata: {
    database: string;
    databaseName: string;
    dataset: string;
    datasetDescription: string;
    dataflow: string;
  },
  maxRecords?: number,
): Promise<import('./types.js').UnRecord[]> {
  const records: import('./types.js').UnRecord[] = [];

  if (format === 'json') {
    const data = JSON.parse(body);
    const series = data?.data?.dataSets?.[0]?.series || [];
    const dimIds = data?.data?.structure?.dimensions?.series?.map((d: any) => d.id) || [];

    for (const [key, value] of Object.entries(series)) {
      if (maxRecords && records.length >= maxRecords) break;

      const dimensionValues = key.split(':');
      const dimensions: Record<string, string> = {};
      dimIds.forEach((dimId: string, i: number) => {
        dimensions[dimId] = dimensionValues[i] || '';
      });

      const observations = value as Record<string, number | null>;

      for (const [timeKey, obsValue] of Object.entries(observations)) {
        if (obsValue !== null && obsValue !== undefined) {
          const year = parseInt(timeKey, 10);
          const country = dimensions.GEO_AREA || dimensions.geo_area || '';
          const countryName = dimensions.GEO_AREA_NAME || dimensions.geo_area_name || '';

          records.push({
            id: `${metadata.database}_${metadata.dataset}_${country}_${timeKey}`,
            database: metadata.database,
            databaseName: metadata.databaseName,
            dataset: metadata.dataset,
            datasetDescription: metadata.datasetDescription,
            dataflow: metadata.dataflow,
            dimensions,
            year,
            value: obsValue,
            unit: dimensions.UNIT || dimensions.unit || '',
            country,
            countryName,
            timePeriod: timeKey,
            observationStatus: 'A',
            qualityFlags: [],
            confidence: 1.0,
            sourceUrl: `https://data.un.org/ws/rest/data/${metadata.database},${metadata.dataset}`,
            ingestedAt: new Date().toISOString(),
          });
        }
      }
    }
  } else if (format === 'csv') {
    const lines = body.split('\n');
    const headers = lines[0]?.split(',') || [];

    for (let i = 1; i < lines.length && (!maxRecords || records.length < maxRecords); i++) {
      const values = lines[i]?.split(',') || [];

      if (values.length < headers.length) continue;

      const dimensions: Record<string, string> = {};
      let year = '';
      let value = 0;
      let unit = '';
      let country = '';
      let countryName = '';

      headers.forEach((h, idx) => {
        const key = h.trim();
        const val = values[idx]?.trim();

        if (key === 'TIME_PERIOD' || key === 'time_period') {
          year = val;
        } else if (key === 'OBS_VALUE' || key === 'obs_value') {
          value = parseFloat(val) || 0;
        } else if (key === 'UNIT' || key === 'unit') {
          unit = val;
        } else if (key === 'GEO_AREA' || key === 'geo_area' || key === 'COUNTRY' || key === 'country') {
          country = val;
        } else if (key === 'GEO_AREA_NAME' || key === 'geo_area_name' || key === 'COUNTRY_NAME' || key === 'country_name') {
          countryName = val;
        } else {
          dimensions[key] = val;
        }
      });

      const yearNum = parseInt(year, 10);

      if (year && value && country) {
        records.push({
          id: `${metadata.database}_${metadata.dataset}_${country}_${year}`,
          database: metadata.database,
          databaseName: metadata.databaseName,
          dataset: metadata.dataset,
          datasetDescription: metadata.datasetDescription,
          dataflow: metadata.dataflow,
          dimensions,
          year: yearNum,
          value,
          unit,
          country,
          countryName,
          timePeriod: year,
          observationStatus: 'A',
          qualityFlags: [],
          confidence: 1.0,
          sourceUrl: `https://data.un.org/ws/rest/data/${metadata.database},${metadata.dataset}`,
          ingestedAt: new Date().toISOString(),
        });
      }
    }
  }

  return records;
}

export function toUnRecord(data: any, metadata: {
  database: string;
  databaseName: string;
  dataset: string;
  datasetDescription: string;
  dataflow: string;
}): import('./types.js').UnRecord {
  return {
    id: `${metadata.database}_${metadata.dataset}_${data.country}_${data.year}`,
    database: metadata.database,
    databaseName: metadata.databaseName,
    dataset: metadata.dataset,
    datasetDescription: metadata.datasetDescription,
    dataflow: metadata.dataflow,
    dimensions: data?.dimensions || {},
    year: data?.year || 0,
    value: data?.value || 0,
    unit: data?.unit || '',
    country: data?.country || '',
    countryName: data?.countryName || '',
    timePeriod: String(data?.year || ''),
    observationStatus: 'A',
    qualityFlags: [],
    confidence: 1.0,
    sourceUrl: `https://data.un.org/ws/rest/data/${metadata.database},${metadata.dataset}`,
    ingestedAt: new Date().toISOString(),
  };
}