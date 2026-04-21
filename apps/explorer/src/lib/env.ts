import { createIsomorphicFn } from '@tanstack/react-start'
import { getRequestUrl } from '@tanstack/react-start/server'

export type TempoEnv = 'paysonow' | 'testnet' | 'devnet'

export function inferTempoEnvFromHostname(
	hostname: string | undefined,
): TempoEnv | undefined {
	if (!hostname) return undefined

	const host = hostname.toLowerCase()

	if (host.includes('explorer-paysonow') || host.includes('exp.paysonow.com')) {
		return 'paysonow'
	}

	if (
		host.includes('explorer-devnet') ||
		host.includes('explore.devnet.') ||
		host.includes('explore.31318.')
	) {
		return 'devnet'
	}

	if (
		host.includes('explorer-testnet') ||
		host.includes('explore.testnet.') ||
		host.includes('explore.moderato.') ||
		host.includes('explore.42431.')
	) {
		return 'testnet'
	}

	return undefined
}

function normalizeTempoEnv(value: string | undefined): TempoEnv {
	if (value === 'paysonow' || value === 'devnet' || value === 'testnet') {
		return value
	}
	return 'paysonow'
}

export const getRequestURL = createIsomorphicFn()
	.client(() => new URL(__BASE_URL__ || window.location.origin))
	.server(() => getRequestUrl())

export const getApiBaseURL = createIsomorphicFn()
	.client(() => {
		const base = __BASE_URL__ || window.location.origin
		const url = new URL(base, window.location.origin)
		url.username = ''
		url.password = ''
		return url
	})
	.server(() => {
		if (__BASE_URL__) return new URL(__BASE_URL__)
		return getRequestUrl()
	})

export function getApiUrl(path: string, searchParams?: URLSearchParams): URL {
	const url = new URL(path, getApiBaseURL())
	if (searchParams) url.search = searchParams.toString()
	return url
}

export const getTempoEnv = createIsomorphicFn()
	.client(() => {
		const inferred = inferTempoEnvFromHostname(window.location.hostname)
		return inferred ?? normalizeTempoEnv(import.meta.env.VITE_TEMPO_ENV)
	})
	.server(() => {
		const inferred = inferTempoEnvFromHostname(getRequestUrl().hostname)
		return (
			inferred ??
			normalizeTempoEnv(
				(typeof process !== 'undefined' && process.env?.VITE_TEMPO_ENV) ||
					'testnet',
			)
		)
	})

export const isTestnet = createIsomorphicFn()
	.client(() => getTempoEnv() === 'testnet')
	.server(() => getTempoEnv() === 'testnet')

export const hasIndexSupply = createIsomorphicFn()
	.client(
		() =>
			getTempoEnv() === 'testnet' ||
			getTempoEnv() === 'paysonow' ||
			getTempoEnv() === 'devnet',
	)
	.server(
		() =>
			getTempoEnv() === 'testnet' ||
			getTempoEnv() === 'paysonow' ||
			getTempoEnv() === 'devnet',
	)
