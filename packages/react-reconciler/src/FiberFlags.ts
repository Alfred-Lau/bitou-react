export const NoFlags = /*                      */ 0b00000000000000000001;
export const Placement = /*                */ 0b00000000000000000010;
export const ChildDeletion = /*                    */ 0b00000000000000000100;
export const Update = /*                       */ 0b00000000000000001000;

export type FiberFlags =
	| typeof NoFlags
	| typeof ChildDeletion
	| typeof Placement
	| typeof Update;
