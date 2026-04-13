import { createFileRoute } from '@tanstack/react-router'
import { TOKEN_COUNT_MAX } from '#lib/constants'
import { fetchTokenCreatedRows } from '#lib/server/tempo-queries'
import { getTempoChain } from '#wagmi.config.ts'

const SPAM_TOKEN_PATTERN = /\btest|test\b|\bfake|fake\b/i

export const Route = createFileRoute('/api/tokens/count')({
	server: {
		handlers: {
			GET: async () => {
				try {
					const tempoChain = getTempoChain()
					const chainId = tempoChain.id
					console.log(
						'[tokens/count] chainId:',
						chainId,
						'name:',
						tempoChain.name,
					)

					const allTokens = await fetchTokenCreatedRows(
						chainId,
						TOKEN_COUNT_MAX,
						0,
					)
					const count = allTokens.filter(
						(row) =>
							!SPAM_TOKEN_PATTERN.test(row.name) &&
							!SPAM_TOKEN_PATTERN.test(row.symbol),
					).length

					return Response.json({ data: count, error: null })
				} catch (error) {
					console.error(error)
					const errorMessage = error instanceof Error ? error.message : error
					return Response.json(
						{ data: null, error: errorMessage },
						{ status: 500 },
					)
				}
			},
		},
	},
})
