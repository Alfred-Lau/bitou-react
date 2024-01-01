import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

const App = () => {
	const [num] = useState(100);
	return <div>{num}</div>;
};

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
