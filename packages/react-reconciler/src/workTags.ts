export const FunctionComponent = 0;
export const HostRoot = 3;
// <div>
export const HostComponent = 5;
// 123
export const HostText = 6;
// <></>
export const Fragment = 7;
// context
export const ContextProvider = 8;

export type WorkTag =
	| typeof FunctionComponent
	| typeof HostRoot
	| typeof HostComponent
	| typeof HostText
	| typeof Fragment
	| typeof ContextProvider;
