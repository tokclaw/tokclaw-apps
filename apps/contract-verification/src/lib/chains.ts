import { defineChain } from 'viem'

export const tempoPaysonow = defineChain({
	id: 3773,
	name: 'PaysoNow',
	nativeCurrency: {
		name: 'PUSD',
		symbol: 'PUSD',
		decimals: 6,
	},
	rpcUrls: {
		default: {
			http: ['https://rpc.paysonow.com'],
		},
	},
	feeToken: '0x20c0000000000000000000000000000000000000',
})
