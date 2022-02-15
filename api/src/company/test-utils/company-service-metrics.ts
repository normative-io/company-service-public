// Metrics used by the CompanyService, handy to avoid repetition in tests.
export const TestMetrics = [
  {
    provide: 'PROM_METRIC_SEARCH_INBOUND_TOTAL',
    useValue: { inc: jest.fn() },
  },
  {
    provide: 'PROM_METRIC_SEARCH_FOUND_TOTAL',
    useValue: { inc: jest.fn() },
  },
  {
    provide: 'PROM_METRIC_SEARCH_NOT_FOUND_TOTAL',
    useValue: { inc: jest.fn() },
  },
  {
    provide: 'PROM_METRIC_SEARCH_ERROR_TOTAL',
    useValue: { inc: jest.fn() },
  },
];
