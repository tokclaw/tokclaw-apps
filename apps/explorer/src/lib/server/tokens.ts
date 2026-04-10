import { createServerFn } from '@tanstack/react-start'
import type { Address } from 'ox'
import * as z from 'zod/mini'
import { getAccountTag } from '#lib/account'
import { TOKEN_COUNT_MAX } from '#lib/constants'
import { getTempoChain } from '#wagmi.config'
import {
	fetchGenesisBlockTimestamp,
	fetchTokenCreatedMetadata,
	fetchTokenHoldersCount,
	fetchTokenTransferAggregate,
} from '#lib/server/tempo-queries'
import { parseTimestamp } from '#lib/timestamp'
import { TOKENLIST_URLS } from '#lib/tokenlist'

export type Token = {
	address: Address.Address
	symbol: string
	name: string
	currency: string
	createdAt?: number | undefined
	holdersCount?: number
	holdersCountCapped?: boolean
}

const FetchTokensInputSchema = z.object({
	offset: z.coerce.number().check(z.gte(0)),
	limit: z.coerce.number().check(z.gte(1), z.lte(25)),
})

export type TokensApiResponse = {
	tokens: Token[]
	offset: number
	limit: number
	total: number
}

type TokenListEntry = {
	address: string
	name: string
	symbol: string
	extensions?: {
		label?: string
	}
}

type TokenListResponse = {
	tokens: TokenListEntry[]
}

type CachedTokenList = {
	entries: TokenListEntry[]
	addresses: Set<string>
	ts: number
}

const tokenListCache = new Map<number, CachedTokenList>()

async function getTokenList(chainId: number): Promise<CachedTokenList> {
	const now = Date.now()
	const cached = tokenListCache.get(chainId)

	if (cached && now - cached.ts < 5 * 60_000) {
		return cached
	}

	const url = TOKENLIST_URLS[chainId]
	if (!url) {
		return cached ?? { entries: [], addresses: new Set(), ts: now }
	}

	try {
		const res = await fetch(url)
		if (!res.ok) {
			return cached ?? { entries: [], addresses: new Set(), ts: now }
		}

		const data = (await res.json()) as TokenListResponse
		const entries = data.tokens.map((entry) => ({ ...entry }))
		const next = {
			entries,
			addresses: new Set(entries.map((entry) => entry.address.toLowerCase())),
			ts: now,
		}

		tokenListCache.set(chainId, next)
		return next
	} catch {
		return cached ?? { entries: [], addresses: new Set(), ts: now }
	}
}

export async function getTokenListAddresses(
	chainId: number,
): Promise<Set<string>> {
	return (await getTokenList(chainId)).addresses
}

function getAddressKey(address: string): string {
	return address.toLowerCase()
}

function isGenesisTokenAddress(address: Address.Address): boolean {
	return getAccountTag(address)?.id.startsWith('genesis-token:') ?? false
}

function inferTokenCurrency(entry: TokenListEntry): string {
	const searchable = [entry.symbol, entry.name, entry.extensions?.label]
		.filter(Boolean)
		.join(' ')
		.toUpperCase()

	if (searchable.includes('EUR')) return 'EUR'
	if (
		searchable.includes('USD') ||
		searchable.includes('USDC') ||
		searchable.includes('USDT')
	) {
		return 'USD'
	}

	return ''
}

export const fetchTokens = createServerFn({ method: 'POST' })
	.inputValidator((input) => FetchTokensInputSchema.parse(input))
	.handler(async ({ data }): Promise<TokensApiResponse> => {
		try {
		const { offset, limit } = data

		// Use chainId from VITE_TEMPO_ENV if available, otherwise detect from tempo chain
		// In CF Workers, env vars are not available via process.env, so we use
		// the chain ID that matches the expected mainnet configuration
		const tempoChain = getTempoChain()
		const chainId = tempoChain.id

		console.log('[fetchTokens] chainId:', chainId, 'name:', tempoChain.name)

		const { entries: tokenListEntries } = await getTokenList(chainId)
		const total = tokenListEntries.length
		const pageEntries = tokenListEntries.slice(offset, offset + limit)
		const pageAddresses = pageEntries.map(
			(entry) => entry.address as Address.Address,
		)
		const hasGenesisTokens = pageAddresses.some((address) =>
			isGenesisTokenAddress(address),
		)

		const tokenMetadata = new Map<
			string,
			{ name: string; symbol: string; currency: string; createdAt?: number }
		>()
		const createdAtByAddress = new Map<string, number>()
		let genesisCreatedAt: number | undefined

		const holdersCounts = new Map<string, { count: number; capped: boolean }>()

		if (pageAddresses.length > 0) {
			const [metadataResult, genesisTimestampResult, perTokenResults] =
				await Promise.all([
					fetchTokenCreatedMetadata(chainId, pageAddresses).catch((error) => {
						console.error('[fetchTokens] Failed to fetch token metadata:', error)
						return []
					}),
					hasGenesisTokens
						? fetchGenesisBlockTimestamp(chainId).catch((error) => {
								console.error('[fetchTokens] Failed to fetch genesis block timestamp:', error)
								return null
							})
						: Promise.resolve(null),
					Promise.allSettled(
						pageAddresses.map(async (address) => {
							const transferAggregate = await fetchTokenTransferAggregate(
								address,
								chainId,
							).catch((error) => {
								console.error(
									`[fetchTokens] Failed to fetch transfer aggregate for ${address}:`,
									error,
								)
								return {
									oldestTimestamp: undefined,
									latestTimestamp: undefined,
								}
							})
							const holdersCount = await fetchTokenHoldersCount(
								address,
								chainId,
								TOKEN_COUNT_MAX,
							).catch((error) => {
								console.error(
									`[fetchTokens] Failed to fetch holders count for ${address}:`,
									error,
								)
								return { count: 0, capped: false }
							})
							return { address, transferAggregate, holdersCount }
						}),
					),
				])

			genesisCreatedAt = parseTimestamp(
				genesisTimestampResult == null
					? undefined
					: typeof genesisTimestampResult === 'bigint'
						? genesisTimestampResult.toString()
						: genesisTimestampResult,
			)

			for (const row of metadataResult) {
				tokenMetadata.set(getAddressKey(row.token), {
					name: String(row.name),
					symbol: String(row.symbol),
					currency: String(row.currency),
					createdAt: parseTimestamp(row.block_timestamp),
				})
			}

			for (const result of perTokenResults) {
				if (result.status !== 'fulfilled') {
					console.error('[fetchTokens] Failed to fetch token page metadata:', result.reason)
					continue
				}

				const addressKey = getAddressKey(result.value.address)
				const createdAt = parseTimestamp(
					result.value.transferAggregate.oldestTimestamp,
				)

				if (createdAt != null) {
					createdAtByAddress.set(addressKey, createdAt)
				}

				holdersCounts.set(addressKey, result.value.holdersCount)
			}
		}

		return {
			offset,
			limit,
			total,
			tokens: pageEntries.map((entry) => {
				const address = entry.address as Address.Address
				const addressKey = getAddressKey(address)
				const metadata = tokenMetadata.get(addressKey)

				return {
					address,
					symbol: metadata?.symbol || entry.symbol,
					name: metadata?.name || entry.name,
					currency: metadata?.currency || inferTokenCurrency(entry),
					createdAt:
						createdAtByAddress.get(addressKey) ??
						metadata?.createdAt ??
						(isGenesisTokenAddress(address) ? genesisCreatedAt : undefined),
					holdersCount: holdersCounts.get(addressKey)?.count,
					holdersCountCapped: holdersCounts.get(addressKey)?.capped,
				}
			}),
		}
		} catch (error) {
			console.error('[fetchTokens] Unexpected error:', error)
			return { offset, limit, total: 0, tokens: [] }
		}
	})
