import { runDailyStyleScheduler, type DailyStylistEnv } from './functions/api/_dailyStylist'
import { onRequestPost as handleHairPost } from './functions/api/hairstyle-grid'
import { onRequestPost as handleStylePost } from './functions/api/style-report'

type Env = DailyStylistEnv

type WorkerContext = {
  request: Request
  env: Env
}

type JsonBody = {
  error?: string
  note?: string
}

const jsonResponse = (body: Record<string, string>, status: number) =>
  Response.json(body, { status })

const isJsonResponse = (response: Response) =>
  response.headers.get('content-type')?.includes('application/json') ?? false

const logResult = async ({
  path,
  request,
  response,
}: {
  path: string
  request: Request
  response: Response
}) => {
  if (!isJsonResponse(response)) {
    return
  }

  try {
    const body = (await response.clone().json()) as JsonBody

    if (!body.error && !body.note) {
      return
    }

    console.log(
      JSON.stringify({
        path,
        status: response.status,
        colo: request.cf?.colo ?? 'unknown',
        country: request.cf?.country ?? 'unknown',
        city: request.cf?.city ?? 'unknown',
        note: body.note ?? '',
        error: body.error ?? '',
      }),
    )
  } catch {
    // Ignore log parsing failures so the API response stays unaffected.
  }
}

const invoke = async ({
  path,
  request,
  env,
  handler,
}: {
  path: string
  request: Request
  env: Env
  handler: (context: WorkerContext) => Promise<Response>
}) => {
  const response = await handler({ request, env })
  await logResult({ path, request, response })
  const headers = new Headers(response.headers)
  headers.set('x-personalstylist-runtime', 'api-worker')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)

    if (request.method === 'POST' && url.pathname === '/api/style-report') {
      return invoke({
        path: url.pathname,
        request,
        env,
        handler: handleStylePost,
      })
    }

    if (request.method === 'POST' && url.pathname === '/api/hairstyle-grid') {
      return invoke({
        path: url.pathname,
        request,
        env,
        handler: handleHairPost,
      })
    }

    return jsonResponse({ error: 'Not found.' }, 404)
  },

  scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const summary = await runDailyStyleScheduler({ env })
        console.log(
          JSON.stringify({
            type: 'daily-style-scheduler',
            cron: controller.cron,
            scheduledTime: new Date(controller.scheduledTime).toISOString(),
            ...summary,
          }),
        )
      })(),
    )
  },
}
