import fs from 'node:fs/promises';
import {z} from 'zod';
import {createTools} from '../index.js';
import {configSchema} from '../lib/config.js';
await fs.writeFile(new URL('../docs/tools.json',import.meta.url),JSON.stringify(createTools({}).map(t=>({name:t.name,description:t.description,input:t.parameters,output:t.output.schema})),null,2)+'\n');
await fs.writeFile(new URL('../docs/config.json',import.meta.url),JSON.stringify(z.toJSONSchema(configSchema),null,2)+'\n');
