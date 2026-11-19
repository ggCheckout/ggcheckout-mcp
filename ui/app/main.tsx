import '@fontsource-variable/urbanist/wght.css';
import '../src/styles/base.css';
import { App } from '@modelcontextprotocol/ext-apps';
import { createRoot } from 'react-dom/client';
import { GgApp } from '../src/GgApp';
import { createHost } from '../src/host';

const host = createHost(new App({ name: 'ggcheckout', version: '1.0.0' }));
createRoot(document.getElementById('root')!).render(<GgApp host={host} />);
