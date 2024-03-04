import { FiberNode } from 'react-reconciler/src/fiber';
import { HostText } from 'react-reconciler/src/workTags';
import { Props } from 'shared/ReactTypes';

export interface Container {
	rootID: number;
	children: (Instance | TextInstance)[];
}

export interface Instance {
	id: number;
	type: string;
	children: (Instance | TextInstance)[];
	parent: number;
	props: Props;
}

export interface TextInstance {
	id: number;
	text: string;
	parent: number;
}

let instanceCounter = 0;

export const createInstance = (type: string, props: Props): Instance => {
	const instance = {
		id: instanceCounter++,
		type,
		children: [],
		parent: -1,
		props
	};

	return instance;
};

export const appendInitialChild = (
	parent: Instance | Container,
	child: Instance
) => {
	const prevParentId = child.parent;
	const parentId = 'rootID' in parent ? parent.rootID : parent.id;

	// if (prevParentId !== -1 && prevParentId !== parentId) {
	// 	throw new Error('');
	// }

	child.parent = parentId;
	parent.children.push(child);
};

export const createTextInstance = (content: string) => {
	const instance = {
		id: instanceCounter++,
		text: content,
		parent: -1
	};
	return document.createTextNode(content);
};

export const appendChildToContainer = appendInitialChild;

export function commitUpdate(fiber: FiberNode) {
	switch (fiber.tag) {
		case HostText:
			const text = fiber.memoizedProps.content;
			return commitTextUpdate(fiber.stateNode as TextInstance, text);

		default:
			if (__DEV__) {
				console.warn('commitUpdate: 未知的 update tag', fiber);
			}
			break;
	}
}

export function commitTextUpdate(textInstance: TextInstance, content: string) {
	textInstance.textContent = content;
}

export function removeChild(
	child: Instance | TextInstance,
	container: Container
) {
	container.removeChild(child);
}

export function insertChildToContainer(
	child: Instance,
	container: Container,
	before: Instance
) {
	container.insertBefore(child, before);
}

export const scheduleMicroTask =
	typeof queueMicrotask === 'function'
		? queueMicrotask
		: typeof Promise === 'function'
			? (callback: (...args: any) => void) =>
					Promise.resolve(null).then(callback)
			: setTimeout;
