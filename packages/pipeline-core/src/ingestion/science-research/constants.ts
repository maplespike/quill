// SPDX-License-Identifier: AGPL-3.0-only
export const SCIENCE_SOURCE_NAMES = [
  'csa',
  'mitacs',
  'genome-canada',
  'onc',
  'polar-catalogue',
] as const;

export const SOURCES = {
  CSA: {
    name: 'Canadian Space Agency',
    baseUrl: 'https://www.asc-csa.gc.ca',
    openData: 'https://open.canada.ca/data/en/dataset?q=space+agency',
    missionsUrl: 'https://www.asc-csa.gc.ca/eng/search/?q=mission',
  },
  MITACS: {
    name: 'Mitacs',
    baseUrl: 'https://www.mitacs.ca',
    openDataCsv: 'https://www.mitacs.ca/en/open-data',
    datasets: {
      projects: 'https://www.mitacs.ca/sites/default/files/open-data/mitacs-projects.csv',
      partners: 'https://www.mitacs.ca/sites/default/files/open-data/mitacs-partners.csv',
    },
  },
  GENOME_CANADA: {
    name: 'Genome Canada',
    baseUrl: 'https://www.genomecanada.ca',
    fundingUrl: 'https://www.genomecanada.ca/en/funding',
  },
  OCEAN_NETWORKS: {
    name: 'Ocean Networks Canada',
    baseUrl: 'https://data.oceannetworks.ca',
    apiBase: 'https://data.oceannetworks.ca/api',
    stationsUrl: 'https://data.oceannetworks.ca/api/stations',
    dataProductUrl: 'https://data.oceannetworks.ca/api/dataProducts',
  },
  POLAR_CATALOGUE: {
    name: 'Polar Data Catalogue',
    baseUrl: 'https://www.polardata.ca',
    searchApi: 'https://www.polardata.ca/api/v2/dataset',
  },
  CIFAR: {
    name: 'Canadian Institute for Advanced Research',
    baseUrl: 'https://cifar.ca',
    programsUrl: 'https://cifar.ca/research-programs/',
  },
  CANARIE: {
    name: 'CANARIE',
    baseUrl: 'https://www.canarie.ca',
    fundingUrl: 'https://www.canarie.ca/funding/',
  },
  DIGITAL_RESEARCH: {
    name: 'Digital Research Alliance of Canada',
    baseUrl: 'https://alliancecan.ca',
    servicesUrl: 'https://alliancecan.ca/en/services',
  },
  PERIMETER: {
    name: 'Perimeter Institute',
    baseUrl: 'https://perimeterinstitute.ca',
    researchUrl: 'https://perimeterinstitute.ca/research',
  },
};

export const SCIENCE_CKAN_DATASETS = {
  CSA_BUDGET: {
    id: 'csa-budget-allocations',
    title: 'CSA Budget Allocations',
    notes: 'Canadian Space Agency budget data through open.canada.ca',
  },
  GENOME_PROJECTS: {
    id: 'genome-canada-funded-projects',
    title: 'Genome Canada Funded Projects',
    notes: 'Genomics research funding by project',
  },
};
