import { ReactContext } from 'shared/ReactTypes';

let prevContextValue: any = null;
const prevContextValueStack: any[] = [];

export function pushProvider<T>(context: ReactContext<T>, newValue: any) {
	prevContextValueStack.push(prevContextValue);
	// 保存上一个 _currentValue
	prevContextValue = context._currentValue;
	context._currentValue = newValue;
}

export function popProvider<T>(context: ReactContext<T>) {
	context._currentValue = /* 上一个 _currentValue */ prevContextValue;
	prevContextValue = prevContextValueStack.pop();
}
