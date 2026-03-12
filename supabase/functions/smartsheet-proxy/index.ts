import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { sheetId } = await req.json();

    const apiKey = Deno.env.get('SMARTSHEET_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'SMARTSHEET_API_KEY not configured. Add it to Supabase Edge Function secrets.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetSheetId = sheetId || '5750175070900100';

    // Fetch sheet data from Smartsheet API
    const response = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${targetSheetId}?include=columnType`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return new Response(
        JSON.stringify({ error: `Smartsheet API error ${response.status}: ${errText}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sheetData = await response.json();

    // Build column index map: columnId -> title
    const columnMap: Record<number, string> = {};
    for (const col of sheetData.columns || []) {
      columnMap[col.id] = col.title;
    }

    // Target columns to extract
    const TARGET_COLUMNS = [
      'CLIENT',
      'Assignment Title',
      'QUALIFIED BY',
      'REQUEST TYPE',
      'RECOMMENDATION',
      'QUALIFICATION SCORE (OUT OF 80)',
      'Workflow Status',
      'Owning Ecosystem',
      'CONFLICT',
      'Modified',
    ];

    // Transform rows into flat objects
    const rows = (sheetData.rows || []).map((row: any) => {
      const obj: Record<string, any> = {};
      for (const cell of row.cells || []) {
        const colName = columnMap[cell.columnId];
        if (colName && TARGET_COLUMNS.includes(colName)) {
          obj[colName] = cell.displayValue ?? cell.value ?? null;
        }
      }
      // Add row-level modified date
      if (row.modifiedAt) obj['Modified'] = row.modifiedAt;
      return obj;
    }).filter((row: Record<string, any>) =>
      // Only include rows that have at least a client name
      row['CLIENT'] && String(row['CLIENT']).trim() !== ''
    );

    return new Response(
      JSON.stringify({ rows, total: rows.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Unexpected error in smartsheet-proxy' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
