import {makeArray, $private} from "./util";
import pull from "lodash/pull";
import isObject from "lodash/isObject";
import flatten from "lodash/flatten";
import {
	defaultNamespace,
	PARENT,
	CHILDREN,
	newListenerEvent,
	removeListenerEvent,
	addChildEvent,
	removeChildEvent,
	addParentEvent,
	removeParentEvent
} from "./consts";
import {
	NewListenerEvent,
	RemoveListenerEvent,
	AddChildEvent,
	AddParentEvent,
	RemoveChildEvent,
	RemoveParentEvent
} from "./event";


function getAllListeners(namespace, target) {
	if (!$private.has(namespace, target)) $private.set(namespace, target, new WeakMap());
	const store = $private.get(namespace, target);
	if (!store.has(target)) store.set(target, new Map());
	return store.get(target);
}
function getAllListenersByInstance(instance, target) {
	return getAllListeners($private.get(instance, 'namespace'), target);
}


function getListeners(namespace, target, eventName) {
	const allListeners = getAllListeners(namespace, target);
	if (!allListeners.has(eventName)) allListeners.set(eventName, []);
	return allListeners.get(eventName);
}

function getListenersByInstance(instance, target, eventName) {
	return getListeners($private.get(instance, 'namespace'), target, eventName);
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
		if (!!NEXT && !stopped() && bubbling) emitter.listeners(target, NEXT).forEach(
			parent=>emitter.emit(parent, eventName, ...params)
		);
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
		$private.set(this, 'maxListeners', 10);
	}

	addChild(target, ...child) {
		child.forEach(child=>{
			getListenersByInstance(this, target, CHILDREN).push(child);
			getListenersByInstance(this, child, PARENT).push(target);
			this.emit(target, addChildEvent, new AddChildEvent({target, parent:target, child}));
		});
	}

	addParent(target, ...parent) {
		parent.forEach(parent=>{
			getListenersByInstance(this, target, PARENT).push(parent);
			getListenersByInstance(this, parent, CHILDREN).push(target);
			this.emit(target, addParentEvent, new AddParentEvent({target, parent, child:target}));
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

	eventNames(target) {
		return [...getAllListenersByInstance(this, target).keys()];
	}

	getMaxListeners() {
		return $private.get(this, 'maxListeners');
	}

	get maxListeners() {
		return this.getMaxListeners();
	}

	listenerCount(target, eventName) {
		if (!!eventName) return flatten(this.listeners(target, eventName)).length;
		return [...getAllListenersByInstance(this, target).values()]
			.reduce((count, listeners)=>(count+listeners.length), 0);
	}

	listeners(target, eventName) {
		if (!Array.isArray(eventName) && !(eventName instanceof Set)) return [
			...getListenersByInstance(this, target, eventName)
		];
		return makeArray(eventName).map(eventName=>[...getListenersByInstance(this, target, eventName)]);
	}

	off(...params) {
		return this.removeListener(...params);
	}

	on(target, eventName, ...listener) {
		makeArray(eventName).forEach(eventName=>{
			getListenersByInstance(this, target, eventName).push(...listener);
			listener.forEach(listener=>this.emit(
				target, newListenerEvent, new NewListenerEvent({target, listener})
			));
		});
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

	removeAllListeners(target, eventName) {
		const remove = listeners=>{
			listeners.length = 0;
			listeners.forEach(listener=>this.emit(
				target, removeListenerEvent, new RemoveListenerEvent({target, listener})
			));
		};

		if (!!eventName) {
			getAllListenersByInstance(this, target).forEach(remove);
		} else {
			makeArray(eventName).map(eventName=>remove(getListenersByInstance(this, target, eventName)));
		}
		return this;
	}

	removeChild(target, ...child) {
		child.forEach(child=>{
			pull(getListenersByInstance(this, target, CHILDREN), child);
			pull(getListenersByInstance(this, child, PARENT), target);
			this.emit(target, removeChildEvent, new RemoveChildEvent({target, child, parent:target}));
		});
	}

	removeListener(target, eventName, ...listener) {
		makeArray(eventName).forEach(eventName=>{
			pull(getListenersByInstance(this, target, eventName), ...listener);
			listener.forEach(listener=>this.emit(
				target, removeListenerEvent, new RemoveListenerEvent({target, listener})
			));
		});
		return this;
	}

	removeParent(target, ...parent) {
		parent.forEach(parent=>{
			pull(getListenersByInstance(this, target, PARENT), parent);
			pull(getListenersByInstance(this, parent, CHILDREN), target);
			this.emit(target, removeParentEvent, new RemoveParentEvent({target, parent, child:target}));
		});
	}

	prependListener(target, eventName, ...listener) {
		makeArray(eventName).forEach(eventName=>{
			getListenersByInstance(this, target, eventName).unshift(...listener);
			listener.forEach(listener=>this.emit(
				target, newListenerEvent, new NewListenerEvent({target, listener})
			));
		});
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

	setMaxListeners(n) {
		return $private.set(this, 'maxListeners', n);
	}

	set maxListeners(n) {
		this.setMaxListeners(n);
		return true;
	}
}

export default GlobalEventEmitter;