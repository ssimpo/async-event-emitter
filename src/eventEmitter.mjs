import {$private, makeArray} from "./util";
import GlobalEventEmitter from "./globalEventEmitter";
import {defaultNamespace} from "./consts";

export class EventEmitter {
	constructor(options={}) {
		const {namespace=defaultNamespace, target=this, parent} = options;
		const emitter = new GlobalEventEmitter({namespace});
		const parents = makeArray(parent);
		$private.set(this, 'namespace', namespace);
		$private.set(this, 'emitter', emitter);
		$private.set(this, 'target', target);
		$private.set(this, 'parent', parents);
		emitter.addParent(target, ...parents);
	}

	addParent(...params) {
		return $private.get(this, 'emitter').addParent($private.get(this, 'target'), ...params);
	}

	addChild(...params) {
		return $private.get(this, 'emitter').addChild($private.get(this, 'target'), ...params);
	}

	removeParent(...params) {
		return $private.get(this, 'emitter').removeParent($private.get(this, 'target'), ...params);
	}

	removeChild(...params) {
		return $private.get(this, 'emitter').removeChild($private.get(this, 'target'), ...params);
	}

	addListener(...params) {
		return this.on(...params);
	}

	emit(...params) {
		return $private.get(this, 'emitter').emit($private.get(this, 'target'), ...params);
	}

	emitAsync(...params) {
		return $private.get(this, 'emitter').emitAsync($private.get(this, 'target'), ...params);
	}

	listeners(...params) {
		return $private.get(this, 'emitter').listeners($private.get(this, 'target'), ...params);
	}

	off(...params) {
		return this.removeListener(...params);
	}

	on(...params) {
		return $private.get(this, 'emitter').on($private.get(this, 'target'), ...params);
	}

	once(...params) {
		return $private.get(this, 'emitter').once($private.get(this, 'target'), ...params);
	}

	removeListener(...params) {
		return $private.get(this, 'emitter').removeListener($private.get(this, 'target'), ...params);
	}

	prependListener(...params) {
		return $private.get(this, 'emitter').prependListener($private.get(this, 'target'), ...params);
	}

	prependOnceListener(...params) {
		return $private.get(this, 'emitter').prependOnceListener($private.get(this, 'target'), ...params);
	}

	getMaxListeners() {
		return $private.get($private.get(this, 'emitter'), 'maxListeners');
	}

	setMaxListeners(n) {
		return $private.set($private.get(this, 'emitter'), 'maxListeners', n);
	}

	get maxListeners() {
		return this.getMaxListeners();
	}

	set maxListeners(n) {
		this.setMaxListeners(n);
		return true;
	}
}

export default EventEmitter;
