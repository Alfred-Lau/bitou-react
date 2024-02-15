import currentDispatcher, {
	Dispatcher,
	resolveDispatch
} from './src/currentDispatcher';
import { jsx, isValidElement as RawIsValidElement } from './src/jsx';
export { REACT_FRAGMENT_TYPE as Fragment } from 'shared/ReactSymbols';

export const useState: Dispatcher['useState'] = (initialState) => {
	const dispatcher = resolveDispatch();
	return dispatcher.useState(initialState);
};

// 内部数据共享层
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
	currentDispatcher
};

export const version = '0.0.0';
//TODO: 根据环境区分使用 jsx 还是 jsxDev
export const createElement = jsx;
export const isValidElement = RawIsValidElement;
