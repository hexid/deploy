'use strict'

const arrify = require('arrify')
const co = require('co')
const inquirer = require('inquirer')
const omit = require('object.omit')

const askDestination = co.wrap(function* (conf) {
	let destIndex = 0
	if (conf.destinations.length > 1) {
		const answers = yield inquirer.prompt([ {
			name: 'index',
			type: 'list',
			message: 'Which host do you want to deploy to?',
			choices: conf.destinations.map((dest, index) => ({ name: dest.name, value: index })),
		} ])
		destIndex = answers.index
	}
	return conf.destinations[destIndex] || {}
})

const askArgs = co.wrap(function* () {
	const typeArgs = yield inquirer.prompt([ {
		name: 'type',
		type: 'list',
		message: 'How would you like to deploy?',
		choices: [
			{ name: 'Normal (--dry-run)', value: { dryRun: true } },
			{ name: 'Normal', value: {} },
			{ name: 'Delete (--delete --dry-run)', value: { delete: true, dryRun: true } },
			{ name: 'Delete (--delete)', value: { delete: true } } ],
	} ])
	return typeArgs.type
})

module.exports.parseConfig = co.wrap(function* (args, conf) {
	if (typeof conf === 'undefined')
		throw new Error('Must provide a configuration')

	conf.destinations = arrify(conf.destinations)
	conf.args = arrify(conf.args)
	conf.src = conf.src || './'

	if (conf.destinations.length === 0 && typeof conf.dest === 'undefined')
		throw new Error('Must define a destination')

	const destination = (!args.alias) ? yield askDestination(conf)
		: (conf.destinations.find(d => d.alias == args.alias) || {})

	const setup = (args.prompt) ? yield askArgs() : {}

	// destination-specific hooks are executed between general hooks
	const preHooks = arrify(conf.preHooks).concat(arrify(destination.preHooks))
	const postHooks = arrify(destination.postHooks).concat(arrify(conf.postHooks))
	const env = Object.assign({
		DEPLOY_ALIAS: destination.alias,
		DEPLOY_NAME: destination.name,
	}, conf.env, destination.env)

	const omitKeys = [ 'postHooks', 'preHooks', 'env' ]
	conf = Object.assign(setup, omit(conf, omitKeys),
		omit(destination, [ 'alias', 'name' ].concat(omitKeys)))

	if (typeof conf.dest === 'undefined')
		throw new Error(`No destination found. Available aliases: ${conf.destinations.map(d => d.alias)}`)

	delete conf.destinations // remove destinations just in case
	return {
		config: conf,
		env,
		preHooks,
		postHooks,
	}
})
