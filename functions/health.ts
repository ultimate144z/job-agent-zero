import type { Handler } from '@netlify/functions';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }
  return {
    statusCode: 200,
    headers: cors,
    body: JSON.stringify({ ok: true, service: 'job-agent-zero', time: new Date().toISOString() })
  };
};
