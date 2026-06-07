/* ============================================================
   netlify/functions/log.js
   
   SETUP:
   1. Place this file at: netlify/functions/log.js in your repo
   2. In Netlify dashboard → Site settings → Environment variables
      add these two variables:
        AIRTABLE_TOKEN   = patXXXXXXXXXXXXXX  (your API token)
        AIRTABLE_BASE_ID = your-base-id-here  (your base ID)
   3. That's it — no secrets ever touch your repo or auth.js
   ============================================================ */

exports.handler = async (event) => {

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { table, fields } = JSON.parse(event.body);

    const response = await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields })
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('Airtable error:', err);
      return { statusCode: 500, body: 'Airtable error' };
    }

    return { statusCode: 200, body: 'OK' };

  } catch (e) {
    console.error('Function error:', e.message);
    return { statusCode: 500, body: 'Server error' };
  }

};
