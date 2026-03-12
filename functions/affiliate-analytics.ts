import { createClient } from "npm:@blinkdotnew/sdk";

// CORS headers - required for browser calls
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

interface LogRequest {
  affiliateCode: string;
  eventType: 'visit' | 'click' | 'conversion';
  targetUrl?: string;
  label?: string;
  conversionType?: string;
}

async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const projectId = Deno.env.get("BLINK_PROJECT_ID");
  const secretKey = Deno.env.get("BLINK_SECRET_KEY");

  if (!projectId || !secretKey) {
    return new Response(
      JSON.stringify({ error: "Missing configuration" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const blink = createClient({ projectId, secretKey });

  try {
    const url = new URL(req.url);
    const path = url.pathname;

    // --- LOG EVENT ---
    if (req.method === "POST" && (path.endsWith("/log") || path === "/")) {
      const body: LogRequest = await req.json();
      
      if (!body.affiliateCode || !body.eventType) {
        return new Response(
          JSON.stringify({ error: "Missing affiliateCode or eventType" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await blink.db.affiliateEvents.create({
        affiliateCode: body.affiliateCode,
        eventType: body.eventType,
        targetUrl: body.targetUrl,
        label: body.label,
        conversionType: body.conversionType,
        timestamp: new Date().toISOString()
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- GET STATS ---
    if (req.method === "GET") {
      // In a real high-volume app, we would use an aggregate query or summary table.
      // Since we can't use raw SQL in the SDK's current list() method for aggregation,
      // we fetch the events and aggregate in the function.
      // Note: For very high volumes, this should be a proper SQL aggregation via blink.db.sql (service role).
      
      // Use raw SQL if available for efficiency
      const result = await blink.db.sql(`
        SELECT 
          affiliate_code as code,
          COUNT(CASE WHEN event_type = 'visit' THEN 1 END) as visits,
          COUNT(CASE WHEN event_type = 'click' THEN 1 END) as clicks,
          COUNT(CASE WHEN event_type = 'conversion' THEN 1 END) as conversions
        FROM affiliate_events
        GROUP BY affiliate_code
        ORDER BY visits DESC
      `);

      return new Response(JSON.stringify(result.rows), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in affiliate-analytics function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(handler);
