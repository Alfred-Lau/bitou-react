import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// 热更新
console.log('--', import.meta.hot);

const App = () => {
	const [count, setCount] = useState(0);

	useEffect(() => {
		console.log('app mount');
	}, []);

	useEffect(() => {
		console.log('num change create effect');
		return () => {
			console.log('num change descory effect');
		};
	}, [count]);
	return (
		<div onClick={(count) => setCount(count + 1)}>
			hello,world
			{count % 2 ? <Child count={count} /> : 'noop'}
		</div>
	);
};

const Child = (props) => {
	useEffect(() => {
		console.log('child mount');
		return () => {
			console.log('child unmount');
		};
	}, []);

	return (
		<div>
			<span>{props.count}</span>
		</div>
	);
};

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
