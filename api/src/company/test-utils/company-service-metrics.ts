// Metrics used by the CompanyService, handy to avoid repetition in tests.
export const TestMetrics = [
    {
        provide: 'PROM_METRIC_FIND_INBOUND_TOTAL',
        useValue: { inc: jest.fn() },
    },
    {
        provide: 'PROM_METRIC_FIND_OUTBOUND_FOUND_IN_REPO_TOTAL',
        useValue: { inc: jest.fn() },
    },
    {
        provide: 'PROM_METRIC_FIND_OUTBOUND_FOUND_IN_SCRAPERS_TOTAL',
        useValue: { inc: jest.fn() },
    },
    {
        provide: 'PROM_METRIC_FIND_OUTBOUND_NOT_FOUND_TOTAL',
        useValue: { inc: jest.fn() },
    },
    {
        provide: 'PROM_METRIC_FIND_SCRAPERS_ERROR_TOTAL',
        useValue: { inc: jest.fn() },
    },
]
