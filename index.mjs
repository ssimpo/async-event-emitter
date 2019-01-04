import NodeEventEmitter from "events";
import Private from "@simpo/private";
import {makeArray} from "./util";
import isSymbol from "lodash/isSymbol";

const $private = new Private();

export default class Event {}

export class EventEmitter extends NodeEventEmitter {
	constructor(...params) {
		super(...params);
		$private.set(this, 'bindEmitterAction', (eventNames, action, ...params)=>{
			makeArray(eventNames).forEach(eventName=>super[action](eventName, ...params));
			return this;
		});
	}

	addListener(...params) {
		return this.on(...params);
	}

	emit(eventNames, ...params) {
		return $private.invoke(this, 'bindEmitterAction', eventNames, 'emit', ...params);
	}

	async emitAsync(eventName, ...params) {
		const eventNames = makeArray(eventName);
		let hasListeners = false;
		for (let eventsNo=0; eventsNo<eventNames.length; eventsNo++) {
			const listeners = this.listeners(eventNames[eventsNo]);
			hasListeners = hasListeners || !!listeners.length;
			for (let n=0; n<listeners.length; n++) await Promise.resolve(listeners[n](...params));
		}
		return hasListeners;
	}

	mirror(eventNames, source) {
		let listeners = [];
		makeArray(eventNames).forEach(eventName=>{
			const listener = (...params)=>this.emit(eventName, ...params);
			source.on(eventName, listener);
			listeners.push([eventName, listener]);
		});

		return ()=>{
			listeners.forEach(([eventName, listener])=>source.removeListener(eventName, listener));
			listeners = [];
		}
	}

	mirrorTo(eventNames, destination) {
		let listeners = [];
		makeArray(eventNames).forEach(eventName=>{
			const listener = (...params)=>destination.emit(eventName, ...params);
			this.on(eventName, listener);
			listeners.push([eventName, listener]);
		});

		return ()=>{
			listeners.forEach(([eventName, listener])=>source.removeListener(eventName, listener));
			listeners = [];
		}
	}

	off(...params) {
		return this.removeListener(...params);
	}

	on(eventNames, listener) {
		return $private.invoke(this, 'bindEmitterAction', eventNames, 'on', listener);
	}

	once(eventNames, listener) {
		return $private.invoke(this, 'bindEmitterAction', eventNames, 'once', listener);
	}

	removeListener(eventNames, listener) {
		return $private.invoke(this, 'bindEmitterAction', eventNames, 'off', listener);
	}

	prependListener(eventNames, listener) {
		return $private.invoke(this, 'bindEmitterAction', eventNames, 'prependListener', listener);
	}

	prependOnceListener(eventNames, listener) {
		return $private.invoke(this, 'bindEmitterAction', eventNames, 'prependOnceListener', listener);
	}

	get maxListeners() {
		return this.getMaxListeners();
	}

	set maxListeners(n) {
		this.setMaxListeners(n);
		return true;
	}
}