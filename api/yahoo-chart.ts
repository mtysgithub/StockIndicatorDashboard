import type { VercelRequest, VercelResponse } from '@vercel/node';

const YAHOO_CHART_ENDPOINT = 'https://query1.finance.yahoo.com/v8/finance/chart/';

function resolveSingleValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const symbol = resolveSingleValue(request.query.symbol);
  const interval = resolveSingleValue(request.query.interval) ?? '1d';
  const period1 = resolveSingleValue(request.query.period1);
  const period2 = resolveSingleValue(request.query.period2);

  if (!symbol) {
    response.status(400).json({ error: 'Missing symbol parameter' });
    return;
  }

  if (!period1 || !period2) {
    response.status(400).json({ error: 'Missing period1 or period2 parameter' });
    return;
  }

  const params = new URLSearchParams();
  params.set('interval', interval);
  params.set('period1', period1);
  params.set('period2', period2);

  const yahooUrl = `${YAHOO_CHART_ENDPOINT}${encodeURIComponent(symbol)}?${params.toString()}`;

  try {
    const yahooResponse = await fetch(yahooUrl);

    if (!yahooResponse.ok) {
      response
        .status(yahooResponse.status)
        .json({ error: `Yahoo Finance request failed with status ${yahooResponse.status}` });
      return;
    }

    const payload = await yahooResponse.json();
    response.status(200).json(payload);
  } catch (error) {
    response.status(500).json({ error: (error as Error).message });
  }
}
