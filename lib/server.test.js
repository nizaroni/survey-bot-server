'use strict'

const crypto = require('crypto')

const Lab = require('@hapi/lab')
const { expect } = require('@hapi/code')

const { init } = require('./server.js')

const { afterEach, beforeEach, describe, it } = exports.lab = Lab.script()
const { slack_signing_secret } = process.env

describe('💻 Server', () => {
	const inject = ({
		timestamp = now,
		payload = {},
		signature
	} = {}) => {
		timestamp = String(timestamp)

		if (signature === undefined) {
			const signingString = [ 'v42', timestamp, JSON.stringify(payload) ].join(':')
			const hash = crypto.createHmac('sha256', slack_signing_secret)
			                   .update(signingString)
			                   .digest('hex')
			signature = [ 'v42', hash ].join('=')
		}

		return server.inject({
			method: 'POST',
			url: '/slack/events',
			headers: {
				'x-slack-request-timestamp': timestamp,
				'x-slack-signature': signature,
			},
			payload
		})
	}

	let server
	let now

	beforeEach(async () => {
		now = Math.floor(Date.now() / 1000)
		server = await init()
	})

	afterEach(async () => {
		await server.stop()
	})

	describe('🔍 Slack request verification', () => {
		describe('✍️ Slack signature', () => {
			it('responds with 400 for an empty string', async () => {
				const response = await inject({ signature: '' })
				expect(response.statusCode).to.equal(400)
			})

			it('responds with 400 for no equals sign', async () => {
				const response = await inject({ signature: 'blah' })

				expect(response.statusCode).to.equal(400)
			})

			it('responds with 400 for invalid signature', async () => {
				const response = await inject({ signature: 'v5=blah' })

				expect(response.statusCode).to.equal(400)
			})

			it('responds with 200 for a valid signature', async () => {
				const response = await inject()

				expect(response.statusCode).to.equal(200)
			})
		})

		describe('⏳ Request timestamp', () => {
			it('responds with 400 for 6 minutes ago', async () => {
				const sixMinutesAgo = now - (60 * 6)
				const response = await inject({ timestamp: sixMinutesAgo })

				expect(response.statusCode).to.equal(400)
			})

			it('responds with 200 for 4 minutes ago', async () => {
				const fourMinutesAgo = now - (60 * 4)
				const response = await inject({ timestamp: fourMinutesAgo })

				expect(response.statusCode).to.equal(200)
			})
		})
	})

	describe('💪 Slack URL challenge', () => {
		const challenge = 'hello'
		let response

		beforeEach(async () => {
			response = await inject({ payload: { challenge } })
		})

		it('responds with 200', () => {
			expect(response.statusCode).to.equal(200)
		})

		it('returns the challenge as a response', () => {
			expect(response.payload).to.equal(challenge)
		})
	})
})
