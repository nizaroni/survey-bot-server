'use strict'

const crypto = require('crypto')

const Hapi = require('@hapi/hapi')
const Boom = require('@hapi/boom')
const timingSafeCompare = require('tsscmp')

require('dotenv').config()

const { slack_signing_secret } = process.env

const server = Hapi.server({
	port: 3000,
	host: 'localhost',
})

server.route({
	method: 'POST',
	path: '/slack/events',
	options: { payload: { parse: false } },
	handler: (request, h) => {
		const {
			'x-slack-request-timestamp': timestamp,
			'x-slack-signature': signature,
		} = request.headers

		const fiveMinutesAgo = Math.floor(Date.now() / 1000) - (60 * 5)

		if (timestamp < fiveMinutesAgo) {
			return Boom.badRequest('Timestamp too old')
		}

		if (!signature || !signature.includes('=')) {
			return Boom.badRequest('Incorrect signature format')
		}

		const [ version, slackHash ] = signature.split('=')
		const rawPayload = request.payload.toString()
		const baseString = [ version, timestamp, rawPayload ].join(':')

		const hash = crypto.createHmac('sha256', slack_signing_secret)
		                   .update(baseString)
		                   .digest('hex')

		if (!timingSafeCompare(slackHash, hash)) {
			return Boom.badRequest('Signature verification failed')
		}

		const payload = JSON.parse(rawPayload)

		console.log('🧠 headers\n➥', request.headers)
		console.log('🚛 payload\n➥', payload)

		const { challenge = 'welp' } = payload
		return challenge
	},
})

exports.init = async () => {
	await server.initialize()
	return server
}

exports.start = async () => {
	await server.start()
	console.log(`😎 Server running on ${server.info.uri}`)
	return server
}

process.on('unhandledRejection', err => {
	console.error('🤯 Server error\n➥', err)
	process.exit(1)
})
