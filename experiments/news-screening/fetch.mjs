import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const marker = '\n__NEWS_HTTP_RESULT__';

export function parseResponse(output) {
  const markerIndex = output.lastIndexOf(marker);
  const [status = '0', contentType = '', finalUrl = ''] = markerIndex < 0 ? [] : output.slice(markerIndex + marker.length).trim().split('\t');
  let body = markerIndex < 0 ? output : output.slice(0, markerIndex);
  let headers = {};
  while (/^HTTP\/\S+ \d{3}/.test(body)) {
    const match = body.match(/^HTTP\/\S+ \d{3}[^\r\n]*\r?\n((?:[^\r\n]+\r?\n)*)\r?\n/);
    if (!match) break;
    headers = Object.fromEntries(match[1].split(/\r?\n/).map(line => {
      const colon = line.indexOf(':');
      return [line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim()];
    }).filter(([name]) => name));
    body = body.slice(match[0].length);
  }
  return { body, httpStatus: Number(status), contentType, finalUrl, headers };
}

export function classifyResponse(response, transportCode = 0) {
  if (transportCode) {
    return ({ 6: 'dns_failure', 7: 'connection_failure', 28: 'timeout', 35: 'tls_failure', 60: 'tls_verification_failure', 63: 'response_too_large', ERR_CHILD_PROCESS_STDIO_MAXBUFFER: 'response_too_large' })[transportCode] || 'transport_failure';
  }
  if (response.headers['cf-mitigated'] === 'challenge' || /<title[^>]*>\s*(?:just a moment|verify you are human|attention required)/iu.test(response.body) || [403, 503].includes(response.httpStatus) && /cf-chl-|challenge-platform/iu.test(response.body)) return 'verification_page';
  if (response.httpStatus === 403) return 'http_forbidden';
  if (response.httpStatus === 404) return 'http_not_found';
  if (response.httpStatus === 429) return 'rate_limited';
  if (response.httpStatus < 200 || response.httpStatus >= 300) return 'http_error';
  return 'ok';
}

export function diagnosticOf(response) {
  return {
    requestedUrl: response.requestedUrl, finalUrl: response.finalUrl, httpStatus: response.httpStatus,
    contentType: response.contentType, server: response.headers.server || '',
    challengeHeader: response.headers['cf-mitigated'] || '', retryAfter: response.headers['retry-after'] || '',
    pageTitle: response.body.match(/<title[^>]*>([^<]*)<\/title>/iu)?.[1]?.trim() || '',
    responseCharacters: response.body.length, transportCode: response.transportCode,
    reason: response.reason, checkedAt: response.checkedAt
  };
}

export async function requestDocument(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Public HTTPS URL required');
  let output = '';
  let transportCode = 0;
  try {
    const result = await execute('curl', ['-sS', '-L', '--max-time', '18', '--max-filesize', '4000000', '--proto', '=https', '--proto-redir', '=https', '--dump-header', '-', '--write-out', `${marker}%{http_code}\t%{content_type}\t%{url_effective}\n`, url], { maxBuffer: 5000000 });
    output = result.stdout;
  } catch (error) {
    output = error.stdout || '';
    transportCode = error.code || 'unknown';
  }
  const response = { ...parseResponse(output), requestedUrl: url, transportCode, checkedAt: new Date().toISOString() };
  response.reason = classifyResponse(response, transportCode);
  return response;
}

export async function fetchDocument(url) {
  const response = await requestDocument(url);
  if (response.reason !== 'ok') {
    const error = new Error(`${response.reason} (HTTP ${response.httpStatus || 'unavailable'})`);
    error.fetchDiagnostics = diagnosticOf(response);
    throw error;
  }
  return response;
}
