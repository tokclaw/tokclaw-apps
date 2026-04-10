import { defineChain } from 'viem'
import { tempoDevnet as tempoDevnet_, tempoModerato } from 'viem/chains'

export const tempoMainnet = defineChain({
	id: 7447,
	name: 'TokClaw',
	nativeCurrency: {
		name: 'FEE',
		symbol: 'FEE',
		decimals: 18,
	},
	rpcUrls: {
		default: {
			http: ['https://rpc.tokclaw.com'],
		},
	},
}).extend({
	feeToken: '0x20c0000000000000000000000000000000000000',
})

export const tempoTestnet = tempoModerato.extend({
	feeToken: '0x20c0000000000000000000000000000000000001',
})

export const tempoDevnet = tempoDevnet_.extend({
	feeToken: '0x20c0000000000000000000000000000000000002',
})
