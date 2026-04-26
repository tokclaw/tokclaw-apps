export const TOKENLIST_BASE_URL = 'https://tokenlist.tokclaw.com'

export const TOKENLIST_URLS: Record<number, string> = {
	3773: `${TOKENLIST_BASE_URL}/list/3773`,
	7447: `${TOKENLIST_BASE_URL}/list/7447`,
}

const FEE_TOKEN_BY_CHAIN_ID: Record<number, `0x${string}`> = {
	3773: '0x20c0000000000000000000000000000000000000',
	7447: '0x20c0000000000000000000000000000000000000',
}

export function getFeeTokenForChain(
	chainId: number,
): `0x${string}` | undefined {
	return FEE_TOKEN_BY_CHAIN_ID[chainId]
}
