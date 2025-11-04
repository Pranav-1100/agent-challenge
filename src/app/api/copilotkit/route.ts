import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { MastraAgent } from "@ag-ui/mastra"
import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@/mastra";

// 1. You can use any service adapter here for multi-agent support.
const serviceAdapter = new ExperimentalEmptyAdapter();

// Helper function to add CORS headers
function getCorsHeaders(origin: string | null) {
  // Allow requests from Vercel frontend or any origin in development
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'https://your-vercel-app.vercel.app', // Update this with your actual Vercel URL
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
  ].filter(Boolean);

  const isAllowed = origin && allowedOrigins.some(allowed =>
    allowed && (allowed === '*' || origin.startsWith(allowed))
  );

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : (allowedOrigins[0] || '*'),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin');
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: getCorsHeaders(origin),
    }
  );
}

// 2. Build a Next.js API route that handles the CopilotKit runtime requests.
export const POST = async (req: NextRequest) => {
  console.log('📥 CopilotKit request received');

  try {
    // 3. Create the CopilotRuntime instance and utilize the Mastra AG-UI
    //    integration to get the remote agents. Cache this for performance.
    const runtime = new CopilotRuntime({
      agents: MastraAgent.getLocalAgents({ mastra }),
    });

    const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
      runtime,
      serviceAdapter,
      endpoint: "/api/copilotkit",
    });

    const response = await handleRequest(req);

    // Add CORS headers to response
    const origin = req.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin);

    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    console.log('✅ CopilotKit request handled successfully');
    return response;
  } catch (error) {
    console.error('❌ Error handling CopilotKit request:', error);

    const origin = req.headers.get('origin');
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      {
        status: 500,
        headers: getCorsHeaders(origin),
      }
    );
  }
};