interface PagesContext {
  request: Request
  env: {
    ASSETS: {
      fetch: (request: Request) => Promise<Response>
    }
  }
  next: () => Promise<Response>
}

export async function onRequest(context: PagesContext) {
  const url = new URL(context.request.url)

  if (url.pathname.startsWith('/api/')) {
    return context.next()
  }

  return context.env.ASSETS.fetch(new Request(url.toString(), context.request))
}
