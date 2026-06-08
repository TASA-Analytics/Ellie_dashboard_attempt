// TASA EFX — AWS Lambda function
// Handles: POST /auth (code validation + presigned S3 URL generation)
//          POST /log  (feedback logging to DynamoDB)
//
// Environment variables (set in Lambda console):
//   ACCESS_CODES          — JSON string: { "CODE": { "expires": "YYYY-MM-DD", "folder": "s3-folder-name" } }
//   S3_PREMIUM_BUCKET     — private S3 bucket name (e.g. "tasa-efx-premium")
//   DYNAMO_SIGNINS_TABLE  — DynamoDB table name (default: "tasa-signins")
//   DYNAMO_FEEDBACK_TABLE — DynamoDB table name (default: "tasa-feedback")
//   ALLOWED_ORIGIN        — CORS origin (e.g. "https://tasa-analytics.github.io" or "*")

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl }               = require('@aws-sdk/s3-request-presigner');
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');

const REGION         = process.env.AWS_REGION || 'us-east-1';
const s3             = new S3Client({ region: REGION });
const dynamo         = new DynamoDBClient({ region: REGION });

const ACCESS_CODES    = JSON.parse(process.env.ACCESS_CODES || '{}');
const PREMIUM_BUCKET  = process.env.S3_PREMIUM_BUCKET;
const SIGNINS_TABLE   = process.env.DYNAMO_SIGNINS_TABLE  || 'tasa-signins';
const FEEDBACK_TABLE  = process.env.DYNAMO_FEEDBACK_TABLE || 'tasa-feedback';
const PRESIGN_EXPIRES = 4 * 60 * 60; // 4 hours in seconds

exports.handler = async (event) => {
  const origin = process.env.ALLOWED_ORIGIN || '*';
  const headers = {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  const method = event.httpMethod || event.requestContext?.http?.method || '';
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const rawPath = event.rawPath || event.path || '';
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) {}

  try {
    if (rawPath.endsWith('/auth')) return await handleAuth(body, headers);
    if (rawPath.endsWith('/log'))  return await handleLog(body, headers);
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
  } catch (err) {
    console.error('[TASA] Unhandled error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};

// ── POST /auth ────────────────────────────────────────────────────────────────
// Validates access code, generates presigned S3 URLs for the conference folder,
// and logs the sign-in attempt to DynamoDB.
async function handleAuth({ code, name, email, industry, page }, headers) {
  const upper   = (code || '').trim().toUpperCase();
  const match   = ACCESS_CODES[upper];
  const today   = new Date().toISOString().slice(0, 10);
  const expired = match && match.expires < today;
  const valid   = match && !expired;
  const status  = !match ? 'Invalid' : expired ? 'Expired' : 'Valid';

  // Log every attempt (non-blocking — don't fail auth if logging fails)
  logToDynamo(SIGNINS_TABLE, {
    name:      name     || '(not provided)',
    email:     email    || '(not provided)',
    industry:  industry || '(not provided)',
    code:      upper,
    page:      page     || '',
    status,
    timestamp: new Date().toISOString()
  }).catch(e => console.warn('[TASA] Sign-in log failed:', e.message));

  if (!valid) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ valid: false, expired: !!expired })
    };
  }

  // Build presigned manifest from the conference folder's manifest.json in private S3
  let presignedManifest = { platinum: [], rlca: [] };
  try {
    presignedManifest = await buildPresignedManifest(match.folder);
  } catch (err) {
    console.error('[TASA] Presign error for folder', match.folder, ':', err.message);
    // Auth still succeeds — browser gets unlocked state but empty premium lists
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ valid: true, presignedManifest, user: { name, email } })
  };
}

// ── POST /log (feedback) ──────────────────────────────────────────────────────
// Logs user feedback to DynamoDB. Same API shape as the old Netlify function.
async function handleLog({ table, fields }, headers) {
  if (table !== 'Feedback' || !fields) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid payload' }) };
  }

  try {
    await logToDynamo(FEEDBACK_TABLE, {
      name:            fields['Name']            || '(not provided)',
      email:           fields['Email']           || '(not provided)',
      page:            fields['Page']            || '',
      comment:         fields['Comment']         || '',
      feature_request: fields['Feature Request'] || '',
      timestamp:       fields['Timestamp']       || new Date().toISOString()
    });
  } catch (err) {
    console.warn('[TASA] Feedback log failed:', err.message);
    // Non-critical: return 200 so the UI shows "thanks" regardless
  }

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Fetches manifest.json from the private S3 conference folder, then generates
// a presigned URL for each file listed in it. Returns { platinum: [...], rlca: [...] }
// where each entry is identical to the public manifest structure but with `path`
// set to a time-limited presigned URL instead of a static file path.
async function buildPresignedManifest(folder) {
  const manifestResp = await s3.send(new GetObjectCommand({
    Bucket: PREMIUM_BUCKET,
    Key:    `${folder}/manifest.json`
  }));
  const manifest = JSON.parse(await manifestResp.Body.transformToString());

  async function presignEntries(entries) {
    return Promise.all((entries || []).map(async entry => {
      const { file, ...rest } = entry;
      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: PREMIUM_BUCKET, Key: `${folder}/${file}` }),
        { expiresIn: PRESIGN_EXPIRES }
      );
      return { ...rest, path: url }; // 'path' matches what platinum.html/rlca.html expect
    }));
  }

  const [platinum, rlca] = await Promise.all([
    presignEntries(manifest.platinum),
    presignEntries(manifest.rlca)
  ]);

  return { platinum, rlca };
}

async function logToDynamo(tableName, fields) {
  const item = {};
  for (const [key, val] of Object.entries(fields)) {
    item[key] = { S: String(val ?? '') };
  }
  await dynamo.send(new PutItemCommand({ TableName: tableName, Item: item }));
}
