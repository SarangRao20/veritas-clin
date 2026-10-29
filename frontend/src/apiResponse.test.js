import assert from 'node:assert/strict';
import test from 'node:test';
import { parseApiResponse } from './apiResponse.js';

test('reports a useful error when an API endpoint responds with HTML', async () => {
  const response = new Response('<!doctype html><html></html>', { status: 200 });

  await assert.rejects(
    parseApiResponse(response, '/api/documents'),
    /Expected a JSON response from \/api\/documents.*API server and API base URL/,
  );
});

test('returns parsed JSON and preserves API error details', async () => {
  const success = await parseApiResponse(Response.json([{ document_id: 'demo' }]), '/api/documents');
  assert.equal(success[0].document_id, 'demo');

  const error = Response.json({ detail: 'Invalid upload' }, { status: 400 });
  await assert.rejects(parseApiResponse(error, '/api/documents'), /Invalid upload/);
});
