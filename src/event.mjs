import {$private} from "./util";

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