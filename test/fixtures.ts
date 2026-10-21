export function makeRow(index = 1): unknown[] {
  return [
    `query ${index}`,
    null,
    'SG',
    [1_792_416_600 + index * 60],
    index % 2 === 0 ? [1_792_420_200] : null,
    null,
    index * 100,
    null,
    1000,
    [`query ${index}`, 'related search'],
    [index % 2 === 0 ? 14 : 17],
    [[4_888_528_579, 'en', 'SG']],
    `normalized ${index}`,
  ];
}

export function rpcResponse(payload: unknown, rpcId = 'i0OFE'): string {
  return `)]}'\n\n${JSON.stringify([['wrb.fr', rpcId, JSON.stringify(payload)]])}`;
}

export function countryPayload(): unknown[] {
  return [
    [
      [['SG', 'Singapore']],
      [['US', 'United States'], [['US-CA', 'California']]],
      [['SG', 'Singapore']],
    ],
    [['CN', 'My location']],
  ];
}

export function fixedFetch(payload: unknown, rpcId = 'i0OFE'): typeof globalThis.fetch {
  return async () => new Response(rpcResponse(payload, rpcId));
}
