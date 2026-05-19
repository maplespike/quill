export const QC_USER_AGENT = 'MapleSpike-QC/1.0';
export const QC_TIMEOUT_MS = 15_000;
export const QC_CKAN_ENDPOINT = 'https://www.donneesquebec.ca/recherche/api/3/action';
export const QC_MAX_DATASETS_PER_SECTOR = 30;
export const QC_SECTOR_KEYWORDS = [
  'sante', 'education', 'social', 'emploi', 'environnement',
  'energie', 'agriculture', 'transport', 'justice', 'logement',
  'economie', 'finances', 'securite publique', 'culture', 'municipal',
];
export const QC_DATA_SOURCES = [
  { name: 'Donnees Quebec CKAN', endpoint: QC_CKAN_ENDPOINT, format: 'CKAN' },
  { name: 'Donnees Quebec Portal', endpoint: 'https://www.donneesquebec.ca', format: 'HTML' },
  { name: 'Institut de la statistique du Quebec', endpoint: 'https://statistique.quebec.ca', format: 'HTML' },
];
