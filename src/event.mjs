import {$private} from "./util";

export class Event {
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
}

export class EmitterEvent extends Event {
	constructor(options={}) {
		const {bubbling=false} = options;
		super({...options, bubbling});
	}
}

export class EmitterListenerEvent extends EmitterEvent {
	constructor(options={}) {
		const {listener} = options;
		super(options);
		$private.set(this, 'listener', listener);
	}

	get listener() {
		return $private.get(this, 'listener');
	}
}

export class NewListenerEvent extends EmitterListenerEvent {}
export class RemoveListenerEvent extends EmitterListenerEvent {}

export class EmitterHierarchyEvent extends EmitterEvent {
	constructor(options={}) {
		const {parent, child} = options;
		super(options);
		$private.set(this, 'parent', parent);
		$private.set(this, 'child', child);
	}

	get parent() {
		return $private.get(this, 'parent');
	}

	get child() {
		return $private.get(this, 'child');
	}
}

export class AddChildEvent extends EmitterHierarchyEvent {}
export class RemoveChildEvent extends EmitterHierarchyEvent {}
export class AddParentEvent extends EmitterHierarchyEvent {}
export class RemoveParentEvent extends EmitterHierarchyEvent {}

export default Event;