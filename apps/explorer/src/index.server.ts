import * as Sentry from '@sentry/cloudflare'
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'

const ALLOWED_ORIGINS = [/^https?:\/\/([a-z0-9-]+\.)*tokclaw\.com$/, /^https?:\/\/localhost(:\d+)?$/]

function isAllowedOrigin(origin: string | undefined): boolean {
	if (!origin) return false
	return ALLOWED_ORIGINS.some((pattern) => pattern.test(origin))
}

function addCorsHeaders(request: Request, response: Response): Response {
	const origin = request.headers.get('Origin')
	if (!origin || !isAllowedOrigin(origin)) {
		return response
	}

	const headers = new Headers(response.headers)
	headers.set('Access-Control-Allow-Origin', origin)
	headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD')
	headers.set(
		'Access-Control-Allow-Headers',
		'Content-Type, Authorization, X-Requested-With',
	)
	headers.set('Access-Control-Max-Age', '86400')

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	})
}

export const redirects: Array<{
	from: RegExp
	to: (match: RegExpMatchArray) => string
}> = [
	{ from: /^\/blocks\/(latest|\d+)$/, to: (m) => `/block/${m[1]}` },
	{ from: /^\/transaction\/(.+)$/, to: (m) => `/tx/${m[1]}` },
	{ from: /^\/tokens\/(.+)$/, to: (m) => `/token/${m[1]}` },
]

function normalizeApiPath(pathname: string): string {
	return pathname
		.replace(/\/0x[a-fA-F0-9]+/g, '/:hash')
		.replace(/\/\d+/g, '/:id')
}

const SENSITIVE_HEADERS = new Set([
	'authorization',
	'cookie',
	'set-cookie',
	'x-api-key',
	'x-forwarded-for',
])

const SENSITIVE_QUERY_PARAMS = ['auth', 'token', 'apikey', 'api_key', 'key']

function redactHeaders(
	headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
	if (!headers) return headers
	return Object.fromEntries(
		Object.entries(headers).map(([key, value]) => [
			key,
			SENSITIVE_HEADERS.has(key.toLowerCase()) ? '[Filtered]' : value,
		]),
	)
}

function sanitizeUrl(rawUrl: string): string {
	try {
		const url = new URL(rawUrl)
		for (const param of SENSITIVE_QUERY_PARAMS) {
			url.searchParams.delete(param)
		}
		return url.toString()
	} catch {
		return rawUrl
	}
}

const serverEntry = createServerEntry({
	fetch: async (request, opts) => {
		const url = new URL(request.url)

		// Handle CORS preflight requests
		if (request.method === 'OPTIONS') {
			const origin = request.headers.get('Origin')
			if (origin && isAllowedOrigin(origin)) {
				return new Response(null, {
					status: 204,
					headers: {
						'Access-Control-Allow-Origin': origin,
						'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
						'Access-Control-Allow-Headers':
							'Content-Type, Authorization, X-Requested-With',
						'Access-Control-Max-Age': '86400',
					},
				})
			}
			return new Response(null, { status: 403 })
		}

		for (const { from, to } of redirects) {
			const match = url.pathname.match(from)
			if (match) {
				url.pathname = to(match)
				return Response.redirect(url, 301)
			}
		}

		const response = await handler.fetch(request, opts)
		return addCorsHeaders(request, response)
	},
})

const handlerWithSentry = Sentry.withSentry(
	(env: Env) => ({
		dsn: process.env.SENTRY_DSN,
		release: env.CF_VERSION_METADATA?.id,
		tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE
			? Number(env.SENTRY_TRACES_SAMPLE_RATE)
			: undefined,
		tracePropagationTargets: [/^\//, /tempo\.xyz/],
		sendDefaultPii: false,
		beforeSend: (event) => {
			if (event.request?.url) {
				event.request.url = sanitizeUrl(event.request.url)
			}
			if (event.request?.headers) {
				event.request.headers = redactHeaders(event.request.headers)
			}
			return event
		},
		beforeSendTransaction: (event) => {
			if (event.request?.url) {
				const url = new URL(sanitizeUrl(event.request.url))
				if (url.pathname.startsWith('/api/')) {
					event.transaction = `${event.request.method ?? 'GET'} ${normalizeApiPath(url.pathname)}`
				}
			}
			if (event.request?.headers) {
				event.request.headers = redactHeaders(event.request.headers)
			}
			return event
		},
	}),
	{
		fetch: (request, env, context) => {
			const processEnv = process.env as Record<string, string | undefined>
			if (env) {
				for (const [key, value] of Object.entries(env)) {
					if (typeof value === 'string') processEnv[key] = value
				}
			}

			return serverEntry.fetch(request, { context })
		},
	},
)

// In dev mode, skip Sentry to avoid AsyncLocalStorage issues with TanStack Start
export default {
	fetch: (request: Request, env: Env, context: ExecutionContext) => {
		if (import.meta.env.DEV) {
			const processEnv = process.env as Record<string, string | undefined>
			if (env) {
				for (const [key, value] of Object.entries(env)) {
					if (typeof value === 'string') processEnv[key] = value
				}
			}
			return serverEntry.fetch(request, { context })
		}
		return handlerWithSentry.fetch(request, env, context)
	},
}
