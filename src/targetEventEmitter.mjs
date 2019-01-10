import {makeArray, $private} from "./util";
import pull from "lodash/pull";
import isObject from "lodash/isObject";
import flatten from "lodash/flatten";
import uniq from "lodash/uniq";
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

const emitters = new Map();
const namespaces = new Map();


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

	let hasListeners = false;
	makeArray(eventName).forEach(eventName=>{
		emitter.listeners(target, eventName).forEach(listener=>{
			if (!stopped()) {
				hasListeners = true;
				listener(...params);
			}
		});
		if (!!NEXT && !stopped() && bubbling) emitter.listeners(target, NEXT).forEach(parent=>{
			hasListeners = hasListeners || emitter.emit(parent, eventName, ...params)
		});
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
			for (let n=0; n<parent.length; n++) {
				hasListeners = hasListeners || await emitter.emitAsync(parent[n], eventNames[eventsNo], ...params);
			}
		}
	}

	return hasListeners;
}

/**
 * Target based hierarchical event emitter with namespacing.  Events are fired against given targets bubbling up or
 * down the hierarchy. The class is a singleton for the given namespace.
 *
 * @class
 * @singleton
 * @param {string|Symbol} options.namespace			The namespace to link the target emitter to.
 */
export class TargetEventEmitter {
	constructor(options={}) {
		const {namespace=defaultNamespace} = options;
		if (emitters.has(namespace)) return emitters.get(namespace);
		if (!namespaces.has(namespace)) namespaces.set(namespace, {});
		$private.set(this, 'namespace', namespaces.get(namespace));
		$private.set(this, 'maxListeners', 10);
		emitters.set(namespace, this);
	}

	/**
	 * Factory method for class, is the the same as new TargetEventEmitter({...<some options>}) but is more efficient in
	 * that a new class is not created when a class already exists for given namespace.  Even though the class
	 * constructor is a singleton for a given namespace, class construction is still run before returning previously
	 * constructed instance. Using this factory method avoid this unnecessary work.
	 *
	 * @static
	 * @public
	 * @param {string|Symbol} options.namespace			The namespace to link the target emitter to.
	 * @returns {TargetEventEmitter}					The namespaced TargetEventEmitter instance.
	 */
	static factory(options={}) {
		const {namespace=defaultNamespace} = options;
		if (emitters.has(namespace)) return emitters.get(namespace);
		return new TargetEventEmitter(options);
	}

	/**
	 * Add a child or children to the event hierarchy for the given target.
	 *
	 * @param {Object|Array} target								The target to add children against.
	 * @param {Object[]|Array[]} ...child						The child/children to add.
	 */
	addChild(target, ...child) {
		child.forEach(child=>{
			getListenersByInstance(this, target, CHILDREN).push(child);
			getListenersByInstance(this, child, PARENT).push(target);
			this.emit(target, addChildEvent, new AddChildEvent({target, parent:target, child}));
		});
	}

	/**
	 * Add parent(s) to the event hierarchy for the given target.
	 *
	 * @param {Object|Array} target								The target to add parent(s) against.
	 * @param {Object[]|Array[]} ...parent						The parent(s) to add.
	 */
	addParent(target, ...parent) {
		parent.forEach(parent=>{
			getListenersByInstance(this, target, PARENT).push(parent);
			getListenersByInstance(this, parent, CHILDREN).push(target);
			this.emit(target, addParentEvent, new AddParentEvent({target, parent, child:target}));
		});
	}

	/**
	 * Add a listener(s) to the given target for the given event(s). Adds at the end of the listener stack for given
	 * target and events.
	 *
	 * @note This is an alias for on() method.
	 *
	 * @public
	 * @param {Object|Array} target								The target to listen for events against.
	 * @param {string|Symbol|string[]|Symbol[]} eventName		The event or events to listen for.
	 * @param {function[]} ...listener							The listener(s) to attach to the given event.
	 * @returns {TargetEventEmitter}							The current TargetEventEmitter for chaining.
	 */
	addListener(target, eventName, ...listener) {
		return this.on(target, eventName, ...listener);
	}

	/**
	 * Emit an event with the given parameters on for the provided target and event(s). Will bubble events down if
	 * bubbling is true (or not provided) on event object. This is exactly the same as emit() except it will fire
	 * down the emitter hierarchy to children rather than parents.
	 *
	 * @public
	 * @param {Object|Array} target								The target to listen for events against.
	 * @param {string|Symbol|string[]|Symbol[]} eventName		The event or events to fire event against.
	 * @param {any[]} ...params									The parameters to pas to the listeners.
	 * @returns {boolean}										Did the event(s) and target have listeners that fired?
	 * 															(this includes in the hierarchy).
	 */
	broadcast(target, eventName, ...params) {
		return emit({target, eventName, params, emitter:this, direction:'down'});
	}

	/**
	 * Emit an asynchronous event with the given parameters on for the provided target and event(s). Will bubble events
	 * up if bubbling is true (or not provided) on event object. Will wrap all listeners in promises and wait till they
	 * return. This is exactly the same as emitAsync() except it will fire down the emitter hierarchy to children
	 * rather than parents.
	 *
	 * @public
	 * @async
	 * @param {Object|Array} target								The target to listen for events against.
	 * @param {string|Symbol|string[]|Symbol[]} eventName		The event or events to fire event against.
	 * @param {any[]} ...params									The parameters to pas to the listeners.
	 * @returns {Promise.<boolean>}								Did the event(s) and target have listeners that fired?
	 * 															(this includes in the hierarchy).
	 */
	broadcastAsync(target, eventName, ...params) {
		return emitAsync({target, eventName, params, emitter:this, direction:'down'});
	}

	/**
	 * Emit an event with the given parameters on for the provided target and event(s). Will bubble events up if
	 * bubbling is true (or not provided) on event object.
	 *
	 * @public
	 * @param {Object|Array} target								The target to listen for events against.
	 * @param {string|Symbol|string[]|Symbol[]} eventName		The event or events to fire event against.
	 * @param {any[]} ...params									The parameters to pas to the listeners.
	 * @returns {boolean}										Did the event(s) and target have listeners that fired?
	 * 															(this includes in the hierarchy).
	 */
	emit(target, eventName, ...params) {
		return emit({target, eventName, params, emitter:this});
	}

	/**
	 * Emit an asynchronous event with the given parameters on for the provided target and event(s). Will bubble events
	 * up if bubbling is true (or not provided) on event object. Will wrap all listeners in promises and wait till they
	 * return.
	 *
	 * @public
	 * @async
	 * @param {Object|Array} target								The target to listen for events against.
	 * @param {string|Symbol|string[]|Symbol[]} eventName		The event or events to fire event against.
	 * @param {any[]} ...params									The parameters to pas to the listeners.
	 * @returns {Promise.<boolean>}								Did the event(s) and target have listeners that fired?
	 * 															(this includes in the hierarchy).
	 */
	emitAsync(target, eventName, ...params) {
		return emitAsync({target, eventName, params, emitter:this});
	}

	/**
	 * Get the events being listened for on the given target.
	 *
	 * @note It does not traverse the hierarchy but simply looks at target.
	 *
	 * @param {Object|Array} target								The target to listen for events against.
	 * @returns {string[]|Symbol[]}								Array of event names found.
	 */
	eventNames(target) {
		return [...getAllListenersByInstance(this, target).keys()];
	}

	getMaxListeners() {
		return $private.get(this, 'maxListeners');
	}

	get maxListeners() {
		return this.getMaxListeners();
	}

	/**
	 * Get a copy of the listener stack for given event(s). The stack is cloned but the listeners are references to
	 * the actual listeners.
	 *
	 * @public
	 * @param {Object|Array} target								The target to get listeners for.
	 * @param {string|Symbol|string[]|Symbol[]} [eventName]		The event or events to get listeners for.
	 * @returns {function[]}									The listeners for given event.
	 */
	listenerCount(target, eventName) {
		if (!!eventName) return flatten(this.listeners(target, eventName)).length;
		return this.listeners(target).reduce((count, listeners)=>(count+listeners.length), 0);
	}

	/**
	 * Get a copy of the listener stack for given event(s). The stack is cloned but the listeners are references to
	 * the actual listeners.
	 *
	 * @public
	 * @param {Object|Array} target								The target to get listeners for.
	 * @param {string|Symbol|string[]|Symbol[]} [eventName]		The event or events to get listeners for.
	 * @returns {function[]}									The listeners for given event.
	 */
	listeners(target, eventName) {
		if (!eventName) return uniq(flatten([...getAllListenersByInstance(this, target).values()]));
		if (!Array.isArray(eventName) && !(eventName instanceof Set)) return uniq([
			...getListenersByInstance(this, target, eventName)
		]);
		return uniq(makeArray(eventName).map(eventName=>[...getListenersByInstance(this, target, eventName)]));
	}

	/**
	 * Remove the given listener(s) on the given target for the given event(s).
	 *
	 * @note Alias for removeListener() method.
	 *
	 * @public
	 * @param {Object|Array} target								The target to remove listeners from.
	 * @param {string|Symbol|string[]|Symbol[]} eventName		The event or events to remove listeners on.
	 * @param {function[]} ...listener							The listener(s) to remove.
	 * @returns {TargetEventEmitter}							The current TargetEventEmitter for chaining.
	 */
	off(target, eventName, ...listener) {
		return this.removeListener(target, eventName, ...listener);
	}

	/**
	 * Add a listener(s) to the given target for the given event(s). Adds at the end of the listener stack for given
	 * target and events.  If you wish to add to the beginning of the stack use prependListener().
	 *
	 * @note This is an alias for on() method.
	 *
	 * @public
	 * @param {Object|Array} target								The target to listen for events against.
	 * @param {string|Symbol|string[]|Symbol[]} eventName		The event or events to listen for.
	 * @param {function[]} ...listener							The listener(s) to attach to the given event.
	 * @returns {TargetEventEmitter}							The current TargetEventEmitter for chaining.
	 */
	on(target, eventName, ...listener) {
		makeArray(eventName).forEach(eventName=>{
			getListenersByInstance(this, target, eventName).push(...listener);
			listener.forEach(listener=>this.emit(
				target, newListenerEvent, new NewListenerEvent({target, listener})
			));
		});
		return this;
	}

	/**
	 * Add a listener(s) to the given target for the given event(s) but only fire listener(s) once before detaching it.
	 * Adds at the end of the listener stack for given target and events.  If you wish to add to the beginning of the
	 * stack use prependOnceListener().
	 *
	 * @public
	 * @param {Object|Array} target								The target to listen for events against.
	 * @param {string|Symbol|string[]|Symbol[]} eventName		The event or events to listen for.
	 * @param {function[]} ...listener							The listener(s) to attach to the given event.
	 * @returns {TargetEventEmitter}							The current TargetEventEmitter for chaining.
	 */
	once(target, eventName, ...listener) {
		let once = (...params)=>{
			this.removeListener(target, eventName, once);
			once = undefined;
			listener.forEach(listener=>listener(...params))
		};
		this.on(target, eventName, once);
		return this;
	}

	/**
	 * Remove all listeners for a given target and event(s).
	 *
	 * @param {Object|Array} target								The target to listen remove listeners on.
	 * @param {string|Symbol|string[]|Symbol[]} eventName		The event or events to remove listeners from. If not
	 * 															given the all listeners are removed on the given target.
	 * @returns {TargetEventEmitter}							The current TargetEventEmitter for chaining.
	 */
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


	/**
	 * Remove child or children to the event hierarchy for the given target.
	 *
	 * @param {Object|Array} target								The target to remove child/children against.
	 * @param {Object[]|Array[]} ...child						The child/children to remove.
	 */
	removeChild(target, ...child) {
		child.forEach(child=>{
			pull(getListenersByInstance(this, target, CHILDREN), child);
			pull(getListenersByInstance(this, child, PARENT), target);
			this.emit(target, removeChildEvent, new RemoveChildEvent({target, child, parent:target}));
		});
	}

	/**
	 * Remove the given listener(s) on the given target for the given event(s).
	 *
	 * @public
	 * @param {Object|Array} target								The target to remove listeners from.
	 * @param {string|Symbol|string[]|Symbol[]} eventName		The event or events to remove listeners on.
	 * @param {function[]} ...listener							The listener(s) to remove.
	 * @returns {TargetEventEmitter}							The current TargetEventEmitter for chaining.
	 */
	removeListener(target, eventName, ...listener) {
		makeArray(eventName).forEach(eventName=>{
			pull(getListenersByInstance(this, target, eventName), ...listener);
			listener.forEach(listener=>this.emit(
				target, removeListenerEvent, new RemoveListenerEvent({target, listener})
			));
		});
		return this;
	}

	/**
	 * Remove parent(s) to the event hierarchy for the given target.
	 *
	 * @param {Object|Array} target								The target to remove parent(s) against.
	 * @param {Object[]|Array[]} ...parent						The parent(s) to remove.
	 */
	removeParent(target, ...parent) {
		parent.forEach(parent=>{
			pull(getListenersByInstance(this, target, PARENT), parent);
			pull(getListenersByInstance(this, parent, CHILDREN), target);
			this.emit(target, removeParentEvent, new RemoveParentEvent({target, parent, child:target}));
		});
	}

	/**
	 * Add a listener(s) to the given target for the given event(s). Adds at the start of the listener stack for given
	 * target and events. If you wish to add to the end of the stack, use on().
	 *
	 * @note This is an alias for on() method.
	 *
	 * @public
	 * @param {Object|Array} target								The target to listen for events against.
	 * @param {string|Symbol|string[]|Symbol[]} eventName		The event or events to listen for.
	 * @param {function[]} ...listener							The listener(s) to attach to the given event.
	 * @returns {TargetEventEmitter}							The current TargetEventEmitter for chaining
	 */
	prependListener(target, eventName, ...listener) {
		makeArray(eventName).forEach(eventName=>{
			getListenersByInstance(this, target, eventName).unshift(...listener);
			listener.forEach(listener=>this.emit(
				target, newListenerEvent, new NewListenerEvent({target, listener})
			));
		});
		return this;
	}

	/**
	 * Add a listener(s) to the given target for the given event(s) but only fire listener(s) once before detaching it.
	 * Adds at the beginning of the listener stack for given target and events.  If you wish to add to the beginning of
	 * the stack use once().
	 *
	 * @public
	 * @param {Object|Array} target							The target to listen for events against.
	 * @param {string|Symbol|string[]|Symbol[]} eventName	The event or events to listen for.
	 * @param {...function} listener						The listener(s) to attach to the given event.
	 * @returns {TargetEventEmitter}						The current TargetEventEmitter for chaining.
	 */
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

export default TargetEventEmitter;