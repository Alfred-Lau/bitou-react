import {
  FulfilledThenable,
  PendingThenable,
  RejectedThenable,
  Thenable,
} from 'shared/ReactTypes';

function noop() {}

export const SuspenseException = new Error(
	'这不是真实的错误，是 suspense 工作的一部分，如果你捕获到这个错误，请将它继续抛出去'
); // 用于标记一个组件是一个 Suspense 组件

let suspendedThenable: Thenable<any> | null = null;

export function getSuspenseThenable(): Thenable<any> {
	if (suspendedThenable === null) {
		throw new Error('suspendedThenable 应该存在');
	}

	const thenable = suspendedThenable;
	suspendedThenable = null;
	return thenable;
}

// 包装一个 thenable,并返回其值
export function trackUsedThenable<T>(thenable: Thenable<T>) {
	switch (thenable.status) {
		case 'fulfilled':
			return thenable.value;
		case 'rejected':
			throw thenable.reason;
		default:
			if (typeof thenable.status === 'string') {
				// 已经包装过了
				thenable.then(noop, noop);
			} else {
				// untracked 未包装,需要包装
				const pending = thenable as unknown as PendingThenable<T, void, any>;
				pending.status = 'pending';
				pending.then(
					(val) => {
						if (pending.status === 'pending') {
							const fulfilled: FulfilledThenable<T, void, any> = pending as any;
							fulfilled.status = 'fulfilled';
							fulfilled.value = val;
						}
					},
					(err) => {
						if (pending.status === 'pending') {
							const rejected: RejectedThenable<T, void, any> = pending as any;
							rejected.status = 'rejected';
							rejected.reason = err;
						}
					}
				);
			}
			break;
	}

	suspendedThenable = thenable;
	throw suspendedThenable;
}
