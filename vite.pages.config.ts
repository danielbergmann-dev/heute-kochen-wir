import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({
 root:'frontend',base:'./',
 plugins:[react()],
 publicDir:'../public',
 resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},
 define:{__KITCHEN_API_ORIGIN__:JSON.stringify('https://kuechenkompass.tituzzz.chatgpt.site')},
 build:{outDir:'../docs',emptyOutDir:true},
});
