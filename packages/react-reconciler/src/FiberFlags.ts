export type Flags = number;

export const NoFlags = /*                      */ 0b00000000000000000000;
export const Placement = /*                */ 0b00000000000000000001;
export const Update = /*                       */ 0b00000000000000000010;
export const ChildDeletion = /*                    */ 0b00000000000000000100;
export const PassiveEffect = /*                       */ 0b00000000000000001000;
export const Ref = /*                          */ 0b00000000000000010000;
export const Visibility = /*                          */ 0b00000000000000100000;
// render 阶段捕获到一些东西
export const ShouldCapture = /*                          */ 0b00000000000001000000;
export const DidCapture = /*                          */ 0b00000000000010000000;

export type FiberFlags =
	| typeof NoFlags
	| typeof ChildDeletion
	| typeof Placement
	| typeof Update;

export const MutationMask =
	Placement | ChildDeletion | Update | Ref | Visibility;
export const LayoutMask = Ref;
export const PassiveMask = PassiveEffect | ChildDeletion;
