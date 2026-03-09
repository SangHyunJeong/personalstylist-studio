import { Webhook } from 'standardwebhooks'

interface Env {
  POLAR_ACCESS_TOKEN?: string
  POLAR_SERVER?: string
  POLAR_WEBHOOK_SECRET?: string
}

interface PagesContext {
  request: Request
  env: Env
}

type PolarWebhookPayload = {
  type?: string
  data?: {
    id?: string
    product_id?: string
    order_id?: string
    items?: Array<{
      product_id?: string
      product?: {
        id?: string
      }
    }>
    customer?: {
      email?: string
      external_id?: string
    }
  }
}

type PolarErrorResponse = {
  error?: {
    message?: string
  }
}

const PRODUCT_ID = '82fb5b93-ef0a-4af0-914c-05aaf8882da2'

const jsonResponse = (
  body: Record<string, string>,
  status: number,
) => Response.json(body, { status })

const getBaseApiUrl = (server?: string) =>
  server === 'sandbox'
    ? 'https://sandbox-api.polar.sh'
    : 'https://api.polar.sh'

const getOrderId = (payload: PolarWebhookPayload) =>
  payload.data?.order_id ?? payload.data?.id ?? ''

const includesTargetProduct = (payload: PolarWebhookPayload) => {
  if (payload.data?.product_id === PRODUCT_ID) {
    return true
  }

  return payload.data?.items?.some((item) =>
    item.product_id === PRODUCT_ID || item.product?.id === PRODUCT_ID,
  ) ?? false
}

const verifyPayload = (
  rawBody: string,
  headers: Headers,
  secret: string,
) => {
  const verifier = new Webhook(btoa(secret.trim()))
  const headerMap: Record<string, string> = {}

  headers.forEach((value, key) => {
    headerMap[key] = value
  })

  const verified = verifier.verify(rawBody, headerMap)
  return typeof verified === 'string'
    ? (JSON.parse(verified) as PolarWebhookPayload)
    : (verified as PolarWebhookPayload)
}

const provisionDigitalAccess = async (payload: PolarWebhookPayload) => {
  // Placeholder for real fulfilment logic. Hook your own access-granting flow here.
  const customerEmail = payload.data?.customer?.email
  const customerExternalId = payload.data?.customer?.external_id

  if (!customerEmail && !customerExternalId) {
    throw new Error('No customer identity was included in the paid order event.')
  }
}

const refundOrder = async ({
  env,
  orderId,
}: {
  env: Env
  orderId: string
}) => {
  if (!env.POLAR_ACCESS_TOKEN || !orderId) {
    return
  }

  const response = await fetch(`${getBaseApiUrl(env.POLAR_SERVER)}/v1/refunds/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      order_id: orderId,
      reason: 'Digital access fulfillment failed',
    }),
  })

  if (!response.ok) {
    const rawText = await response.text()
    const json = rawText.trim()
      ? (JSON.parse(rawText) as PolarErrorResponse)
      : null

    throw new Error(
      json?.error?.message ?? 'Refund request failed after fulfillment error.',
    )
  }
}

export async function onRequestPost(context: PagesContext) {
  const { request, env } = context

  if (!env.POLAR_WEBHOOK_SECRET) {
    return jsonResponse(
      { error: 'POLAR_WEBHOOK_SECRET is not configured.' },
      500,
    )
  }

  const rawBody = await request.text()
  let payload: PolarWebhookPayload

  try {
    payload = verifyPayload(rawBody, request.headers, env.POLAR_WEBHOOK_SECRET)
  } catch {
    return jsonResponse({ error: 'Invalid Polar webhook signature.' }, 403)
  }

  if (payload.type !== 'order.paid' || !includesTargetProduct(payload)) {
    return new Response(null, { status: 202 })
  }

  const orderId = getOrderId(payload)

  try {
    await provisionDigitalAccess(payload)
    return new Response(null, { status: 202 })
  } catch (error) {
    try {
      await refundOrder({ env, orderId })
    } catch (refundError) {
      return jsonResponse(
        {
          error:
            refundError instanceof Error
              ? refundError.message
              : 'Fulfillment failed and the refund request also failed.',
        },
        500,
      )
    }

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? `${error.message} Refund was requested automatically.`
            : 'Fulfillment failed. Refund was requested automatically.',
      },
      202,
    )
  }
}
