import { Usable } from 'shared/ReactTypes';

import currentBatchConfig from './src/currentBatchConfig';
import currentDispatcher, {
  Dispatcher,
  resolveDispatch,
} from './src/currentDispatcher';
import {
  isValidElement as RawIsValidElement,
  jsx,
} from './src/jsx';

export {
  REACT_FRAGMENT_TYPE as Fragment,
  REACT_SUSPENSE_TYPE as Suspense,
} from 'shared/ReactSymbols';
export { createContext } from './src/context';

export const useState: Dispatcher['useState'] = (initialState) => {
	const dispatcher = resolveDispatch();
	return dispatcher.useState(initialState);
};

export const useEffect: Dispatcher['useEffect'] = (create, deps) => {
	const dispatcher = resolveDispatch();
	return dispatcher.useEffect(create, deps);
};

export const useTransition: Dispatcher['useTransition'] = () => {
	const dispatcher = resolveDispatch();
	return dispatcher.useTransition();
};

export const useRef: Dispatcher['useRef'] = (initialValue) => {
	const dispatcher = resolveDispatch();
	return dispatcher.useRef(initialValue);
};

export const useContext: Dispatcher['useContext'] = (context) => {
	const dispatcher = resolveDispatch();
	return dispatcher.useContext(context);
};

export const use: Dispatcher['use'] = <T>(usable: Usable<T>) => {
	const dispatcher = resolveDispatch();
	return dispatcher.use(usable);
};

// 内部数据共享层
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
	currentDispatcher,
	currentBatchConfig
};

export const version = '0.0.0';
//TODO: 根据环境区分使用 jsx 还是 jsxDev
export const createElement = jsx;
export const isValidElement = RawIsValidElement;
