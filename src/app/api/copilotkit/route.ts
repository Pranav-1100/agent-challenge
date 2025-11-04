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
  // Allow requests from Vercel frontend and backend
  // Must match the allowed origins in backend-server.mjs
  const allowedOrigins = [
    'https://agent-challenge-iota.vercel.app',
    'https://agents-backend.trou.hackclub.app',
    'http://localhost:3000',
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  // Check if the request origin is in our allowed list
  const isAllowed = origin && allowedOrigins.some(allowed =>
    origin.includes(allowed) || allowed === origin
  );

  return {
    'Access-Control-Allow-Origin': isAllowed && origin ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, DNT, User-Agent, X-CSRF-Token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin');
  console.log('🔧 CORS preflight request from:', origin);

  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

// Handle GET requests (health check)
export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin');
  console.log('🏥 Health check from:', origin);

  return NextResponse.json(
    { status: 'ok', message: 'CopilotKit backend is running' },
    {
      status: 200,
      headers: getCorsHeaders(origin),
    }
  );
}

// 2. Build a Next.js API route that handles the CopilotKit runtime requests.
export const POST = async (req: NextRequest) => {
  const origin = req.headers.get('origin');
  console.log('📥 CopilotKit POST request from:', origin);

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
    const corsHeaders = getCorsHeaders(origin);

    // Set each CORS header explicitly
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    console.log('✅ CopilotKit request handled successfully, origin:', origin);
    return response;
  } catch (error) {
    console.error('❌ Error handling CopilotKit request:', error);
    console.error('Error details:', error instanceof Error ? error.stack : error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      {
        status: 500,
        headers: getCorsHeaders(origin),
      }
    );
  }
};