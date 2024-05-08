export type Type = any;
export type Key = any;
export type Ref = { current: any } | ((instance: any) => void);
export type Props = {
	[key: string]: any;
	children?: any;
};
export type ElementType = any;

export interface ReactElementType {
	$$typeof: symbol | number;
	type: ElementType;
	props: Props;
	key: Key;
	ref: Ref;
	__mark: 'bitou';
}

export type Action<State> = State | ((prevState: State) => State);
