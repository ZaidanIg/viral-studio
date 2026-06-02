import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const RECAPTCHA_APPLICATION_TYPE = 'RECAPTCHA_APPLICATION_TYPE_WEB';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      prompt,
      imageModelName = 'GEM_PIX_2',
      imageAspectRatio = 'IMAGE_ASPECT_RATIO_PORTRAIT',
      recaptchaToken,
      bearerToken,
      flowProjectId,
      imageInputs = [],
    } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (!recaptchaToken) {
      return NextResponse.json({ error: 'reCAPTCHA token is required' }, { status: 400 });
    }

    if (!bearerToken) {
      return NextResponse.json({ error: 'Bearer token is required' }, { status: 400 });
    }

    // Default flow project ID from Zeo Studio if not provided
    let projectId = flowProjectId || '101c3bc7-a06a-4dcb-8276-f8ef76202717';
    let baseEndpoint = 'https://aisandbox-pa.googleapis.com/v1/projects/{projectId}/flowMedia:batchGenerateImages';

    // Try fetching dynamic config from Database
    try {
      const dbConfig = await prisma.systemConfig.findUnique({ where: { key: 'FLOW_MEDIA_CONFIG' } });
      if (dbConfig && dbConfig.value) {
        const value = dbConfig.value as any;
        if (value.defaultProjectId && !flowProjectId) projectId = value.defaultProjectId;
        if (value.apiEndpoint) baseEndpoint = value.apiEndpoint;
      }
    } catch (e) {
      console.warn('Could not fetch FLOW_MEDIA_CONFIG from DB, using defaults.');
    }

    const endpoint = baseEndpoint.replace('{projectId}', projectId);

    const sessionId = `;${Date.now()}`;
    const recaptchaContext = {
      token: recaptchaToken,
      applicationType: RECAPTCHA_APPLICATION_TYPE,
    };

    const clientContext = {
      recaptchaContext,
      sessionId,
      projectId,
      tool: 'PINHOLE',
    };

    const payload = {
      clientContext,
      requests: [
        {
          clientContext,
          seed: Math.floor(Math.random() * 1000000),
          imageModelName,
          imageAspectRatio,
          prompt,
          imageInputs,
        },
      ],
    };

    const headers: Record<string, string> = {
      'Accept': '*/*',
      'Content-Type': 'text/plain;charset=UTF-8',
      'Authorization': bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`Flow Media API Error [${response.status}]:`, responseText);
      return NextResponse.json(
        { 
          error: `Flow Media API Error: ${response.statusText}`, 
          details: responseText 
        },
        { status: response.status }
      );
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON response from Flow Media' }, { status: 500 });
    }

    return NextResponse.json(parsedResponse);
  } catch (error: any) {
    console.error('Proxy Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
