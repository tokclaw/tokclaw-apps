import { createFileRoute } from '@tanstack/react-router'
import { getTempoChain } from '#wagmi.config.ts'
import { getTempoEnv } from '#lib/env'

export const Route = createFileRoute('/api/debug/env')({
	server: {
		handlers: {
			GET: async () => {
				const tempoEnv = getTempoEnv()
				const tempoChain = getTempoChain()
				return Response.json({
					tempoEnv,
					chainId: tempoChain.id,
					chainName: tempoChain.name,
					chainRpcUrls: tempoChain.rpcUrls,
				})
			},
		},
	},
})
