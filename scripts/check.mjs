import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function files(dir){let result=[];for(const item of await fs.readdir(dir,{withFileTypes:true})){if(item.name==='.git'||item.name==='node_modules')continue;const full=path.join(dir,item.name);result.push(...item.isDirectory()?await files(full):[full])}return result}
const all=await files(root),manifest=JSON.parse(await fs.readFile(path.join(root,'source/manifest.json'),'utf8'));
const source=await fs.readFile(path.join(root,'source/CLAUDE-CODE-FABLE-5.2.txt'));
assert.equal(crypto.createHash('sha256').update(source).digest('hex'),manifest.sources.find(x=>x.name==='CLAUDE-CODE-FABLE-5.2.txt').sha256);
const report=JSON.parse(await fs.readFile(path.join(root,'source/build-report.json'),'utf8'));
assert.equal(report.sourcePartitionVerified,true);assert.equal(report.initialSchemasParsed,true);assert(report.initialTools>50);assert(report.skills>30);assert(report.deferredTools>30);
const md=all.filter(f=>f.endsWith('.md'));let links=0;
for(const file of md){
 const body=await fs.readFile(file,'utf8');let fence=null;const visible=[];
 for(const line of body.split('\n')){const mark=line.match(/^\s{0,3}(`{3,}|~{3,})/);if(fence){if(mark&&mark[1][0]===fence[0]&&mark[1].length>=fence.length)fence=null;continue}if(mark){fence=mark[1];continue}visible.push(line)}
 assert.equal(fence,null,'Unclosed code fence: '+path.relative(root,file));
 // Example links and machine paths within imported source are historical
 // data. Check our navigation, not whether that other environment exists.
 const relative=path.relative(root,file).replaceAll('\\','/');
 const owned=new Set(['README.md','NOTICE.md','reference/INDEX.md','reference/SKILLS.md']);
 const navigation=owned.has(relative)?visible.join('\n'):visible.slice(0,10).join('\n');
 for(const m of navigation.matchAll(/\]\(([^\s)]+)\)|(?:src|href)="([^"\s]+)"/g)){
  const target=m[1]||m[2];if(/^(?:[a-z]+:|#|\/\/)/i.test(target))continue;const rel=target.split('#')[0];if(!rel)continue;
  const full=path.resolve(path.dirname(file),decodeURIComponent(rel));assert(full.startsWith(root+path.sep),'Path outside repo: '+target);await fs.access(full).catch(()=>{throw Error('Broken link: '+path.relative(root,file)+' -> '+target)});links++;
 }
}
for(const text of ['## Claude Behavior','## Agentic Behavior','## User Memory'])assert((await fs.readFile(path.join(root,'FABLE-5.2.md'),'utf8')).includes(text),'Missing source section '+text);
assert((await fs.readFile(path.join(root,'reference/TOOLS.md'),'utf8')).includes('## ToolSearch'),'ToolSearch was truncated by an embedded function tag');
console.log(JSON.stringify({ok:true,sourceHashVerified:true,markdownFiles:md.length,localLinksChecked:links,...report},null,2));
