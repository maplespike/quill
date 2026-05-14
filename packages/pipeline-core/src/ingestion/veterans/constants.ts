/** Veterans Affairs Canada dataset constants */

export const VAC_DATASETS: Record<string, { id: string; title: string }> = {
  FACTS_FIGURES: {
    id: '460aa2e0-5a37-47cf-a858-98b4327d29de',
    title: 'VAC Facts and Figures',
  },
  BENEFITS_DATA: {
    id: 'f0a7e3c7-8f7d-4b6e-9d5e-1a2b3c4d5e6f',
    title: 'VAC Benefits by Program',
  },
};

export const VETERANS_SOURCE = {
  name: 'Veterans Affairs Canada',
  baseUrl: 'https://open.canada.ca/data/api/3/action/package_show',
  ckanDataset: 'vac-benefits',
};
