export function makeArray(ary) {
	if (ary instanceof Set) return [...ary];
	if ((ary === undefined) || (ary === null) || Number.isNaN(ary)) return [];
	return ((Array.isArray(ary))?ary:[ary]);
}

import $private from "./$private";
export {$private};