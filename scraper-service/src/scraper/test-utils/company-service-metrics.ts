// Metrics used by the RegistryService, handy to avoid repetition in tests.
export const TestMetrics = [
  {
    provide: 'PROM_METRIC_LOOKUP_INBOUND_TOTAL',
    useValue: { inc: jest.fn() },
  },
  {
    provide: 'PROM_METRIC_LOOKUP_INBOUND_BY_SCRAPER_TOTAL',
    useValue: { inc: jest.fn() },
  },
  {
    provide: 'PROM_METRIC_LOOKUP_OUTBOUND_FOUND_TOTAL',
    useValue: { inc: jest.fn() },
  },
  {
    provide: 'PROM_METRIC_LOOKUP_OUTBOUND_NOT_FOUND_TOTAL',
    useValue: { inc: jest.fn() },
  },
  {
    provide: 'PROM_METRIC_LOOKUP_ERROR_TOTAL',
    useValue: { inc: jest.fn() },
  },
];
