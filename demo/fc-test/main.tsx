import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// 热更新
console.log('--', import.meta.hot);

declare global {
	interface Window {
		setNum: React.Dispatch<React.SetStateAction<number>>;
	}
}

const App = () => {
	const [num, setNum] = useState(100);
	return (
		<div onClick={() => setNum(num + 1)} onClickCapture={() => setNum(num + 1)}>
			{num}
		</div>
	);
};

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
