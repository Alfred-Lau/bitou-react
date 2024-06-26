import { FiberNode } from 'react-reconciler/src/fiber';
import {
  HostComponent,
  HostText,
} from 'react-reconciler/src/workTags';
import { Props } from 'shared/ReactTypes';

import {
  DOMElement,
  updateFiberProps,
} from './SyntheticEvent';

// Element 和 Text 是 DOM 的原生类型
export type Container = Element;
export type Instance = Element;
export type TextInstance = Text;

export const createInstance = (type: string, props: Props): Instance => {
	// TODO: 处理 props
	const element = document.createElement(type) as unknown;
	updateFiberProps(element as DOMElement, props);
	return element as DOMElement;
};

export const appendInitialChild = (
	parent: Instance | Container,
	child: Instance
) => {
	parent.appendChild(child);
};

export const createTextInstance = (content: string) => {
	return document.createTextNode(content);
};

export const appendChildToContainer = appendInitialChild;

export function commitUpdate(fiber: FiberNode) {
	switch (fiber.tag) {
		case HostText:
			const text = fiber.memoizedProps.content;
			return commitTextUpdate(fiber.stateNode as TextInstance, text);

		case HostComponent:
			return updateFiberProps(
				fiber.stateNode as DOMElement,
				fiber.memoizedProps
			);

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

export function hideInstance(instance: Instance) {
	const style = (instance as HTMLElement).style;
	style.setProperty('display', 'none', 'important');
}

export function unhideInstance(instance: Instance) {
	const style = (instance as HTMLElement).style;
	style.removeProperty('display');
}

export function hideTextInstance(textInstance: TextInstance) {
	textInstance.nodeValue = '';
}

export function unhideTextInstance(textInstance: TextInstance, text: string) {
	textInstance.nodeValue = text;
}
