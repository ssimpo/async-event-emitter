import Private from "@simpo/private";
import {makeArray} from "./util";
import isSymbol from "lodash/isSymbol";
import pull from "lodash/pull";
import isObject from "lodash/isObject";

const $private = new Private();
const defaultNamespace = {};
const PARENT = Symbol('Target Parents');
const CHILDREN = Symbol('Target Children');

export default class Event {
	constructor(options={}) {
		const {bubbling=true, target} = options;
		$private.set(this, 'bubbling', bubbling);
		$private.set(this, 'target', target);
		$private.set(this, 'stopped', false);
	}

	cancelEvent() {
		$private.set(this, 'stopped', true);
	}

	stopBubbling() {
		$private.set(this, 'bubbling', false);
	}

	get bubbling() {
		return $private.get(this, 'bubbling');
	}

	get stopped() {
		return $private.get(this, 'stopped');
	}

	get target() {
		return $private.get(this, 'target');
	}
};

function getListeners(namespace, target, eventName) {
	if (!$private.has(namespace, target)) $private.set(namespace, target, new WeakMap());
	const store = $private.get(namespace, target);
	if (!store.has(target)) store.set(target, new Map());
	const allListeners = store.get(target);
	if (!allListeners.has(eventName)) allListeners.set(eventName, []);
	return allListeners.get(eventName);
}

function getStoppedFunc(...params) {
	return !isObject(params[0])?()=>false:()=>{
		if (!('stopped' in params[0])) return false;
		return params[0].stopped;
	};
}

function emit({emitter, target, eventName, params, direction='up'}) {
	const {bubbling=true} = !isObject(params[0])?{}:params[0];
	const stopped = getStoppedFunc(...params);
	const NEXT = ((direction==='up')?PARENT:((direction==='down')?CHILDREN:undefined));

	makeArray(eventName).forEach(eventName=>{
		emitter.listeners(target, eventName).forEach(listener=>{
			if (!stopped()) listener(...params);
		});
		if (!!NEXT && !stopped() && bubbling) {
			emitter.listeners(target, NEXT).forEach(parent=>emitter.emit(parent, eventName, ...params));
		}
	});
	return this;
}

async function emitAsync({emitter, target, eventName, params, direction='up'}) {
	const {bubbling=true} = !isObject(params[0])?{}:params[0];
	const eventNames = makeArray(eventName);
	const stopped = getStoppedFunc(...params);
	const NEXT = ((direction==='up')?PARENT:((direction==='down')?CHILDREN:undefined));
	const parent = (!!NEXT?$private.get(emitter, NEXT, []):[]);

	let hasListeners = false;
	for (let eventsNo=0; eventsNo<eventNames.length; eventsNo++) {
		const listeners = emitter.listeners(target, eventNames[eventsNo]);
		hasListeners = hasListeners || !!listeners.length;
		for (let n=0; n<listeners.length; n++) {
			if (!stopped()) await Promise.resolve(listeners[n](...params));
		}
		if (!stopped() && bubbling) {
			for (let n=0; n<parent.length; n++) await emitter.emitAsync(parent[n], eventNames[eventsNo], ...params);
		}
	}

	return hasListeners;
}

export class GlobalEventEmitter {
	constructor(options={}) {
		const {namespace=defaultNamespace} = options;
		$private.set(this, 'namespace', namespace);
	}

	addParent(target, ...parent) {
		parent.forEach(parent=>{
			this.listeners(target, PARENT).push(parent);
			this.listeners(parent, CHILDREN).push(target);
		});
	}

	addChild(target, ...child) {
		child.forEach(child=>{
			this.listeners(target, CHILDREN).push(child);
			this.listeners(child, PARENT).push(target);
		});
	}

	removeParent(target, ...parent) {
		parent.forEach(parent=>{
			pull(this.listeners(target, PARENT), parent);
			pull(this.listeners(parent, CHILDREN), target);
		});
	}

	removeChild(target, ...child) {
		child.forEach(child=>{
			pull(this.listeners(target, CHILDREN), child);
			pull(this.listeners(child, PARENT), target);
		});
	}

	addListener(...params) {
		return this.on(...params);
	}

	broadcast(target, eventName, ...params) {
		return emit({target, eventName, params, emitter:this, direction:'down'});
	}

	broadcastAsync(target, eventName, ...params) {
		return emitAsync({target, eventName, params, emitter:this, direction:'down'});
	}

	emit(target, eventName, ...params) {
		return emit({target, eventName, params, emitter:this});
	}

	emitAsync(target, eventName, ...params) {
		return emitAsync({target, eventName, params, emitter:this});
	}

	listeners(target, eventName) {
		if (!Array.isArray(eventName) && !(eventName instanceof Set)) {
			return getListeners($private.get(this, 'namespace'), target, eventName);
		}
		return makeArray(eventName).map(eventName=>this.listeners(target, eventName));
	}

	off(...params) {
		return this.removeListener(...params);
	}

	on(target, eventName, ...listener) {
		makeArray(eventName).forEach(eventName=>this.listeners(target, eventName).push(...listener));
		return this;
	}

	once(target, eventName, ...listener) {
		let once = (...params)=>{
			this.removeListener(target, eventName, once);
			once = undefined;
			listener.forEach(listener=>listener(...params))
		};
		this.on(target, eventName, once);
		return this;
	}

	removeListener(target, eventName, ...listener) {
		makeArray(eventName).forEach(eventName=>pull(this.listeners(target, eventName), ...listener));
		return this;
	}

	prependListener(target, eventName, ...listener) {
		makeArray(eventName).forEach(eventName=>this.listeners(target, eventName).unshift(...listener));
		return this;
	}

	prependOnceListener(target, eventName, ...listener) {
		let once = (...params)=>{
			this.removeListener(target, eventName, once);
			once = undefined;
			listener.forEach(listener=>listener(...params))
		};
		this.prependListener(target, eventName, once);
		return this;
	}

	/*get maxListeners() {
		return this.getMaxListeners();
	}

	set maxListeners(n) {
		this.setMaxListeners(n);
		return true;
	}*/
}

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
}
