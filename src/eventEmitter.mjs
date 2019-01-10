import {$private, makeArray} from "./util";
import HierarchyEventEmitter from "./hierarchyEventEmitter";
import {defaultNamespace} from "./consts";

/**
 * Target based hierarchical event emitter with namespacing.  Events are fired against given targets bubbling up or
 * down the hierarchy. The class is meant to be extended onto other classes (although can be used directly if target
 * supplied).  It is similar in api to the standard Node Event Emitter and should be interchangeable with it in all but
 * a few marginal cases. The class is a wrapper around TargetEventEmitter with target hard-coded to a given instance.
 *
 * @class EventEmitter
 * @param {string|Symbol} [options.namespace=defaultNamespace]		The namespace to get the target emitter to.
 * @param {Object|Array|Object[]|Array[]} [options.parent]			Any parent(s) to connect up to this target.
 * @param {Object|Array|Object[]|Array[]} [options.children]		Any children to connect up to this target.
 * @param {Object|Array} [options.target=this]						The target for this emitter. Defaults to this
 * 																	(assuming we are extending something else).
 */
export class EventEmitter {
	constructor(options={}) {
		const {namespace=defaultNamespace, target=this, parent, children} = options;
		const emitter = HierarchyEventEmitter.factory({namespace});
		const _parents = makeArray(parent);
		const _children = makeArray(children);
		$private.set(this, 'namespace', namespace);
		$private.set(this, 'emitter', emitter);
		$private.set(this, 'target', target);
		emitter.addParent(target, ..._parents);
		emitter.addChild(target, ..._children);
	}

	/**
	 * Add a child or children to the event hierarchy for this emitter.
	 *
	 * @param {Object[]|Array[]} ...child						The child/children to add.
	 * @returns {EventEmitter}									The current EventEmitter for chaining.
	 */
	addChild(...params) {
		$private.get(this, 'emitter').addChild($private.get(this, 'target'), ...params);
		return this;
	}

	/**
	 * Add parent(s) to the event hierarchy for this emitter.
	 *
	 * @param {Object[]|Array[]} ...parent						The parent(s) to add.
	 * @returns {EventEmitter}									The current EventEmitter for chaining.
	 */
	addParent(...params) {
		$private.get(this, 'emitter').addParent($private.get(this, 'target'), ...params);
		return this;
	}

	/**
	 * Add a listener(s) for the given event(s). Adds at the end of the listener stack for given events.
	 *
	 * @note This is an alias for on() method.
	 *
	 * @public
	 * @param {string|Symbol|string[]|Symbol[]} eventName		The event or events to listen for.
	 * @param {function[]} ...listener							The listener(s) to attach to the given event.
	 * @returns {EventEmitter}									The current EventEmitter for chaining.
	 */
	addListener(...params) {
		this.on(...params);
		return this;
	}

	/**
	 * Emit an event with the given parameters on for the provided event(s). Will bubble events down if bubbling is true
	 * (or not provided) on event object. This is exactly the same as emit() except it will fire down the emitter
	 * hierarchy to children rather than parents.
	 *
	 * @public
	 * @param {string|Symbol|string[]|Symbol[]} eventName		The event or events to fire event against.
	 * @param {any[]} ...params									The parameters to pas to the listeners.
	 * @returns {boolean}										Did the event(s) and target have listeners that fired?
	 * 															(this includes in the hierarchy).
	 */
	broadcast(...params) {
		return $private.get(this, 'emitter').broadcast($private.get(this, 'target'), ...params);
	}

	/**
	 * Emit an asynchronous event with the given parameters on for the provided event(s). Will bubble events up if
	 * bubbling is true (or not provided) on event object. Will wrap all listeners in promises and wait till they
	 * return. This is exactly the same as emitAsync() except it will fire down the emitter hierarchy to children
	 * rather than parents.
	 *
	 * @public
	 * @async
	 * @param {string|Symbol|string[]|Symbol[]} eventName		The event or events to fire event against.
	 * @param {any[]} ...params									The parameters to pas to the listeners.
	 * @returns {Promise.<boolean>}								Did the event(s) and target have listeners that fired?
	 * 															(this includes in the hierarchy).
	 */
	broadcastAsync(...params) {
		return $private.get(this, 'emitter').broadcastAsync($private.get(this, 'target'), ...params);
	}

	/**
	 * The children assigned to this emitter in the event hierarchy.
	 *
	 * @property {Array[]|Object[]} children
	 */
	get children() {
		return $private.get(this, 'emitter').getChildren($private.get(this, 'target'));
	}

	get defaultMaxListeners() {
		return $private.get(this, 'emitter').maxListeners || 10;
	}

	set defaultMaxListeners(n) {
		return $private.get(this, 'emitter').maxListeners = n;
	}

	/**
	 * Emit an event with the given parameters on for the provided event(s). Will bubble events up if bubbling is true
	 * (or not provided) on event object.
	 *
	 * @public
	 * @param {string|Symbol|string[]|Symbol[]} eventName		The event or events to fire event against.
	 * @param {any[]} ...params									The parameters to pas to the listeners.
	 * @returns {boolean}										Did the event(s) and target have listeners that fired?
	 * 															(this includes in the hierarchy).
	 */
	emit(...params) {
		return $private.get(this, 'emitter').emit($private.get(this, 'target'), ...params);
	}

	/**
	 * Emit an asynchronous event with the given parameters on for the provided event(s). Will bubble events up if
	 * bubbling is true (or not provided) on event object. Will wrap all listeners in promises and wait till
	 * they return.
	 *
	 * @public
	 * @async
	 * @param {string|Symbol|string[]|Symbol[]} eventName		The event or events to fire event against.
	 * @param {any[]} ...params									The parameters to pas to the listeners.
	 * @returns {Promise.<boolean>}								Did the event(s) and target have listeners that fired?
	 * 															(this includes in the hierarchy).
	 */
	emitAsync(...params) {
		return $private.get(this, 'emitter').emitAsync($private.get(this, 'target'), ...params);
	}

	/**
	 * Get the events being listened for.
	 *
	 * @note It does not traverse the hierarchy but simply looks at target.
	 *
	 * @returns {string[]|Symbol[]}								Array of event names found.
	 */
	eventNames(...params) {
		return $private.get(this, 'emitter').eventNames($private.get(this, 'target'), ...params);
	}

	getMaxListeners() {
		return $private.get(this, 'target').getMaxListeners($private.get(this, 'target'));
	}

	/**
	 * Get a count of the unique listeners for a given event(s).
	 *
	 * @public
	 * @param {string|Symbol|string[]|Symbol[]} [eventName]		The event or events to get listeners for.
	 * @returns {function[]}									The listeners for given event.
	 */
	listenerCount(...params) {
		return $private.get(this, 'emitter').listenerCount($private.get(this, 'target'), ...params);
	}

	/**
	 * Get a copy of the listener stack for given event(s). The stack is cloned but the listeners are references to
	 * the actual listeners.
	 *
	 * @public
	 * @param {string|Symbol|string[]|Symbol[]} [eventName]		The event or events to get listeners for.
	 * @returns {function[]}									The listeners for given event.
	 */
	listeners(...params) {
		return $private.get(this, 'emitter').listeners($private.get(this, 'target'), ...params);
	}

	get maxListeners() {
		return this.getMaxListeners();
	}

	set maxListeners(n) {
		this.setMaxListeners(n);
		return true;
	}

	/**
	 * Remove the given listener(s) for the given event(s).
	 *
	 * @note Alias for removeListener() method.
	 *
	 * @public
	 * @param {string|Symbol|string[]|Symbol[]} eventName		The event or events to remove listeners on.
	 * @param {function[]} ...listener							The listener(s) to remove.
	 * @returns {EventEmitter}									The current EventEmitter for chaining.
	 */
	off(...params) {
		return this.removeListener(...params);
	}

	/**
	 * Add a listener(s) to the given event(s). Adds at the end of the listener stack for given event(s).  If you wish
	 * to add to the beginning of the stack use prependListener().
	 *
	 * @note This is an alias for on() method.
	 *
	 * @public
	 * @param {string|Symbol|string[]|Symbol[]} eventName		The event or events to listen for.
	 * @param {function[]} ...listener							The listener(s) to attach to the given event.
	 * @returns {EventEmitter}									The current EventEmitter for chaining.
	 */
	on(...params) {
		$private.get(this, 'emitter').on($private.get(this, 'target'), ...params);
		return this;
	}

	/**
	 * Add a listener(s) to the given event(s) but only fire listener(s) once before detaching it. Adds at the end of
	 * the listener stack for given event(s).  If you wish to add to the beginning of the stack
	 * use prependOnceListener().
	 *
	 * @public
	 * @param {string|Symbol|string[]|Symbol[]} eventName		The event or events to listen for.
	 * @param {function[]} ...listener							The listener(s) to attach to the given event.
	 * @returns {EventEmitter}								The current EventEmitter for chaining.
	 */
	once(...params) {
		$private.get(this, 'emitter').once($private.get(this, 'target'), ...params);
		return this;
	}

	/**
	 * The parents assigned to this emitter in the event hierarchy.
	 *
	 * @property {Array[]|Object[]} children
	 */
	get parents() {
		return $private.get(this, 'emitter').getParents($private.get(this, 'target'));
	}

	/**
	 * Remove all listeners for a given event(s).
	 *
	 * @param {string|Symbol|string[]|Symbol[]} eventName		The event or events to remove listeners from. If not
	 * 															given the all listeners are removed on the given target.
	 * @returns {EventEmitter}									The current EventEmitter for chaining.
	 */
	removeAllListeners(...params) {
		$private.get(this, 'emitter').removeAllListeners($private.get(this, 'target'), ...params);
		return this;
	}

	/**
	 * Remove child or children from the event hierarchy for this emitter.
	 *
	 * @param {Object[]|Array[]} ...child						The child/children to remove.
	 * @returns {EventEmitter}									The current EventEmitter for chaining.
	 */
	removeChild(...params) {
		$private.get(this, 'emitter').removeChild($private.get(this, 'target'), ...params);
		return this;
	}

	/**
	 * Remove the given listener(s) for the given event(s).
	 *
	 * @public
	 * @param {string|Symbol|string[]|Symbol[]} eventName		The event or events to remove listeners on.
	 * @param {function[]} ...listener							The listener(s) to remove.
	 * @returns {EventEmitter}									The current EventEmitter for chaining.
	 */
	removeListener(...params) {
		$private.get(this, 'emitter').removeListener($private.get(this, 'target'), ...params);
		return this;
	}

	/**
	 * Remove parent(s) from the event hierarchy for this emitter.
	 *
	 * @param {Object|Array} target								The target to remove parent(s) against.
	 * @param {Object[]|Array[]} ...parent						The parent(s) to remove.
	 * @returns {EventEmitter}									The current EventEmitter for chaining.
	 */
	removeParent(...params) {
		$private.get(this, 'emitter').removeParent($private.get(this, 'target'), ...params);
		return this;
	}

	/**
	 * Add a listener(s) for the given event(s). Adds at the start of the listener stack for given target and events.
	 * If you wish to add to the end of the stack, use on().
	 *
	 * @public
	 * @param {string|Symbol|string[]|Symbol[]} eventName		The event or events to listen for.
	 * @param {function[]} ...listener							The listener(s) to attach to the given event.
	 * @returns {EventEmitter}									The current EventEmitter for chaining
	 */
	prependListener(...params) {
		$private.get(this, 'emitter').prependListener($private.get(this, 'target'), ...params);
		return this;
	}

	/**
	 * Add a listener(s) for the given event(s) but only fire listener(s) once before detaching it. Adds at the
	 * beginning of the listener stack for given target and events.  If you wish to add to the beginning of the stack
	 * use once().
	 *
	 * @public
	 * @param {string|Symbol|string[]|Symbol[]} eventName	The event or events to listen for.
	 * @param {...function} listener						The listener(s) to attach to the given event.
	 * @returns {EventEmitter}								The current EventEmitter for chaining.
	 */
	prependOnceListener(...params) {
		$private.get(this, 'emitter').prependOnceListener($private.get(this, 'target'), ...params);
		return this;
	}

	setMaxListeners(n) {
		return $private.get(this, 'target').setMaxListeners(n, $private.get(this, 'target'));
	}
}

export default EventEmitter;
