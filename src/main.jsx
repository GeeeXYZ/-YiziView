import React from 'react'
import ReactDOMClient from 'react-dom/client'
import ReactDOM from 'react-dom'
import App from './App.jsx'
import './index.css'
import * as Lucide from 'lucide-react'

// Expose dependencies globally for the plugin engine
window.React = React;
window.ReactDOM = ReactDOM;
window.ReactDOMClient = ReactDOMClient;
window.lucide = Lucide;

ReactDOMClient.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
