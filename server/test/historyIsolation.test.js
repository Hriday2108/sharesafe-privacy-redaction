import test from 'node:test';
import assert from 'node:assert/strict';
import Redaction from '../src/models/Redaction.js';
import { history } from '../src/controllers/redactionController.js';

test('history query is restricted to the authenticated user and minimal metadata', async () => {
  const originalFind = Redaction.find;
  let capturedFilter;
  let capturedProjection;
  const expectedUserId = '507f1f77bcf86cd799439011';
  Redaction.find = (filter) => {
    capturedFilter = filter;
    const query = {
      sort() { return this; },
      limit() { return this; },
      select(fields) { capturedProjection = fields; return this; },
      lean: async () => [],
    };
    return query;
  };
  try {
    let payload;
    await history({ user: { id: expectedUserId } }, { json(value) { payload = value; return value; } }, (error) => { throw error; });
    assert.deepEqual(capturedFilter, { userId: expectedUserId });
    assert.equal(capturedProjection, 'fileType counts createdAt');
    assert.deepEqual(payload, { history: [] });
  } finally {
    Redaction.find = originalFind;
  }
});
