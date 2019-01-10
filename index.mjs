import Event from "./src/event";
export default Event;

export * from "./src/event";
export * from "./src/globalEventEmitter";
export * from "./src/eventEmitter";
export {
	addChildEvent,
	addParentEvent,
	removeChildEvent,
	removeParentEvent,
	newListenerEvent,
	removeListenerEvent
} from "./src/consts";