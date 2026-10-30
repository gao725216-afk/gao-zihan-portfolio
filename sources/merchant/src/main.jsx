import React from 'react';
import {createRoot} from 'react-dom/client';
import 'tdesign-react/es/style/index.css';
import './styles.css';
import './merchant.css';
import MerchantApplication from './MerchantApp.jsx';
createRoot(document.getElementById('root')).render(<MerchantApplication/>);
