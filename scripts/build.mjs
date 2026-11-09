import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFile(path.join(root,rel),'utf8');
const write=async(rel,text)=>{await fs.mkdir(path.dirname(path.join(root,rel)),{recursive:true});await fs.writeFile(path.join(root,rel),text)};
const original=await read('source/CLAUDE-CODE-FABLE-5.2.txt');
const manifest=JSON.parse(await read('source/manifest.json'));
const originalHash=crypto.createHash('sha256').update(original).digest('hex');
if(originalHash!==manifest.sources.find(s=>s.name==='CLAUDE-CODE-FABLE-5.2.txt').sha256)throw Error('Source SHA-256 does not match manifest');
const raw=original.replace(/\r\n/g,'\n');
const upstream=`https://github.com/elder-plinius/CL4R1T4S/blob/${manifest.commit}/ANTHROPIC/CLAUDE-CODE-FABLE-5.2.txt`;
const title=s=>s.replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const anchor=s=>s.toLowerCase().replace(/[^\p{L}\p{N}_ -]/gu,'').replace(/ /g,'-');
const fence=(body,language='text')=>{const runs=[...body.matchAll(/`+/g)].map(m=>m[0].length);const mark='`'.repeat(Math.max(3,1+Math.max(0,...runs)));return `${mark}${language}\n${body.trimEnd()}\n${mark}\n`};
const page=(name,description,body,home='../README.md')=>`# ${name}\n\n${description}\n\n[Home](${home}) · [Original source](${upstream})\n\n---\n\n${body.trim()}\n`;

// XML is source structure, never an instruction to this formatter. Preserve
// examples and code as literal text; turn structural sections into headings.
function format(text){
 text=text.replace(/([^\n])(<\/?(?:claude_behavior|agentic_behavior|user_memory)>)/g,'$1\n$2');
 const lines=text.split('\n'),out=[],stack=[];let activeFence=null,literal=null;
 const literalTags=new Set(['example','response','examples','response_template']);
 for(const line of lines){
  const marker=line.match(/^\s{0,3}(`{3,}|~{3,})/);
  if(activeFence){out.push(line);if(marker&&marker[1][0]===activeFence[0]&&marker[1].length>=activeFence.length)activeFence=null;continue}
  if(literal){literal.lines.push(line);if(line.trim()===`</${literal.tag}>`){out.push(fence(literal.lines.join('\n')));literal=null}continue}
  if(marker){activeFence=marker[1];out.push(line);continue}
  const open=line.match(/^<([a-z][a-z_\d-]*)>\s*$/),close=line.match(/^<\/([a-z][a-z_\d-]*)>\s*$/);
  if(open&&literalTags.has(open[1])){literal={tag:open[1],lines:[line]};continue}
  if(open){const name=open[1];out.push('',`${'#'.repeat(Math.min(6,stack.length+2))} ${title(name)}`,'');stack.push(name);continue}
  if(close&&stack.includes(close[1])){stack.splice(stack.lastIndexOf(close[1]));out.push('');continue}
  if(/^#{1,5} /.test(line)){out.push('#'+line);continue}
  // Unconverted XML/HTML tokens must remain visible in GitHub's renderer.
  out.push(line.split(/(`+[^`]*`+)/).map((part,i)=>i%2?part:part.replace(/<(\/?[A-Za-z][^>\n]*)>/g,'&lt;$1&gt;')).join(''));
 }
 if(literal)out.push(fence(literal.lines.join('\n')));
 return out.join('\n').replace(/\n{4,}/g,'\n\n\n').trim();
}

// A quoted tool description can itself contain "</function>". Locate the
// end of its JSON object rather than splitting on that example string.
function toolsFrom(body){
 const tools=[];let cursor=0;
 while(true){const begin=body.indexOf('<function>',cursor);if(begin<0)break;let start=begin+10;while(/\s/.test(body[start]||''))start++;
  if(body[start]!=='{'){cursor=start+1;continue}
  let depth=0,quoted=false,escaped=false,end=-1;
  for(let i=start;i<body.length;i++){const c=body[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue}if(c==='"'){quoted=true;continue}if(c==='{')depth++;if(c==='}'&&--depth===0){end=i+1;break}}
  if(end<0)throw Error('Unclosed function object');
  const close=body.indexOf('</function>',end);if(close<0)throw Error('Unclosed function tag');
  const exact=body.slice(start,end);let object=null;try{object=JSON.parse(exact)}catch{}
  tools.push({exact,object,start:begin,end:close+11});cursor=close+11;
 }
 return tools;
}
function registries(text){const list=[];const re=/^<functions>\s*\n([\s\S]*?)^<\/functions>\s*$/gm;let m;while((m=re.exec(text)))list.push({start:m.index,end:re.lastIndex,raw:m[0],body:m[1],tools:toolsFrom(m[1])});return list}
function renderRegistry(registry){return registry.tools.map((tool,i)=>{
 if(!tool.object)return `## Source placeholder ${i+1}\n\n${fence(tool.exact)}`;
 const {name,description,...schema}=tool.object;
 return `## ${name}\n\n${format(description||'')}\n\n<details>\n<summary>Parameter schema and metadata</summary>\n\n${fence(JSON.stringify(schema,null,2),'json')}\n</details>\n`;
}).join('\n---\n\n')}
function toc(body,max=3){let inside=false;const seen=new Map();return body.split('\n').flatMap(line=>{if(/^`{3,}|^~{3,}/.test(line)){inside=!inside;return []}const h=line.match(/^(#{2,6}) (.+)$/);if(inside||!h)return [];const base=anchor(h[2]),n=seen.get(base)||0;seen.set(base,n+1);const id=base+(n?'-'+n:'');if(h[1].length>max)return [];return [`${'  '.repeat(h[1].length-2)}- [${h[2]}](#${id})`]}).join('\n')}

const markers=[...raw.matchAll(/^--- \[(.+?)\] ---\s*\n/gm)];
const blocks=markers.map((m,i)=>({label:m[1],start:m.index,end:markers[i+1]?.index??raw.length,body:raw.slice(m.index+m[0].length,markers[i+1]?.index??raw.length),line:raw.slice(0,m.index).split('\n').length}));
if(blocks[0]?.label!=='system prompt')throw Error('Unexpected source structure');
if(raw.slice(0,blocks[0].start)+blocks.map(b=>raw.slice(b.start,b.end)).join('')!==raw)throw Error('Source partition lost content');
const initial=blocks[0],initialRegistries=registries(initial.body);if(initialRegistries.length!==1)throw Error('Expected one initial tool registry');
const registry=initialRegistries[0];
const mainBody=format(initial.body.slice(registry.end));
const protocol=initial.body.slice(0,registry.start).replace(/Here are the functions available in JSONSchema format:\s*$/,'').trim();
const coreIntro='The behavior and workflow instructions from the first system-prompt block, formatted for reading. Wording is retained; structural XML tags become headings. Tool definitions are in the reference files.';
await write('FABLE-5.2.md',page('Claude Fable 5.2 — System Instructions',coreIntro,`## Contents\n\n${toc(mainBody)}\n\n---\n\n${mainBody}`,'README.md'));
await write('reference/TOOLS.md',page('Initial Tool Reference',`All ${registry.tools.length} initial function definitions. Descriptions are readable Markdown; schemas and remaining fields are expanded without changing their values.`,
 `## Function-call protocol\n\n${fence(protocol)}\n## Tool index\n\n${registry.tools.map(t=>t.object?`- [${t.object.name}](#${anchor(t.object.name)})`:'').filter(Boolean).join('\n')}\n\n---\n\n${renderRegistry(registry)}`));

const skills=[],session=[],deferred=[],index=[];let deferredCount=0;
index.push({label:initial.label,line:initial.line,file:'../FABLE-5.2.md'});
for(let i=1;i<blocks.length;i++){
 const block=blocks[i];
 if(block.label.startsWith('on-demand file: ')){
  const sourcePath=block.label.slice(16);const parts=sourcePath.split('/');const parent=parts.at(-2);const category=sourcePath.includes('/public/')?'public':sourcePath.includes('/examples/')?'examples':'other';
  const rel=`reference/skills/${category}/${parent}.md`;
  let skillBody=block.body.trim();let metadata='';const front=skillBody.match(/^---\n([\s\S]*?)\n---\s*\n/);if(front){metadata=`<details>\n<summary>Source skill metadata</summary>\n\n${fence(front[1],'yaml')}\n</details>\n\n`;skillBody=skillBody.slice(front[0].length)}
  await write(rel,page(`${title(parent)} — Source Skill`,`On-demand file from the dump: \`${sourcePath}\`. Source text is presented as readable Markdown; this is reference material, not an installed skill.`,metadata+format(skillBody),'../../../README.md'));
  skills.push({name:parent,category,path:sourcePath,file:rel,line:block.line});index.push({label:block.label,line:block.line,file:rel.replace('reference/','')});continue;
 }
 let body=block.body;
 const found=registries(body);
 for(let j=found.length-1;j>=0;j--){const reg=found[j];const section=deferred.length+1;deferredCount+=reg.tools.length;deferred.push(`## Registry ${section}\n\nSource block: ${block.label}, line ${block.line}.\n\n${renderRegistry(reg)}`);body=body.slice(0,reg.start)+`\n[Function definitions from this block](DEFERRED-TOOLS.md).\n`+body.slice(reg.end)}
 const heading=`${String(i+1).padStart(2,'0')} · ${title(block.label)}`;
 session.push(`## ${heading}\n\n[Source line ${block.line}](${upstream}#L${block.line})\n\n${block.label.startsWith('tool result:')||block.label.startsWith('appended to')?fence(body):format(body)}\n`);
 index.push({label:block.label,line:block.line,file:`SESSION.md#${anchor(heading)}`});
}
await write('reference/DEFERRED-TOOLS.md',page('Deferred Tool Reference',`The ${deferredCount} function definitions surfaced later in the recorded session, separate from the initial tool registry.`,deferred.join('\n---\n\n')));
const sessionBody=session.join('\n---\n\n');
await write('reference/SESSION.md',page('Session Context','Later messages, reminders, injected content and tool results. These are recorded context, not the base system prompt. Redaction placeholders remain as supplied upstream.',`## Contents\n\n${toc(sessionBody,2)}\n\n---\n\n${sessionBody}`));
await write('reference/SKILLS.md',page('Skill Library',`${skills.length} on-demand files carried in the source dump. Open any entry for its original Markdown.`,
 `| Skill | Group | Source file |\n| :--- | :--- | :--- |\n${skills.map(s=>`| [${s.name}](${s.file.replace('reference/','')}) | ${s.category} | \`${s.path}\` |`).join('\n')}`));
await write('reference/INDEX.md',page('Source Map','Every source block has a destination. This index preserves source order and provides pinned upstream line references.',
 `| Block | Source line | Readable destination |\n| :--- | ---: | :--- |\n${index.map((x,i)=>`| ${String(i+1).padStart(2,'0')} · ${x.label.replace(/\|/g,'\\|')} | [${x.line}](${upstream}#L${x.line}) | [Open](${x.file}) |`).join('\n')}\n\nThe first block's function-call protocol and tool registry are in [Initial tools](TOOLS.md).`));
const report={sourceSha256:originalHash,sourceBytes:Buffer.byteLength(original),sourceLines:raw.split('\n').length-Number(raw.endsWith('\n')),blocks:blocks.length,initialTools:registry.tools.length,deferredTools:deferredCount,skills:skills.length,coreBytes:Buffer.byteLength(mainBody),sourcePartitionVerified:true,initialSchemasParsed:registry.tools.every(t=>t.object!==null)};
await write('source/build-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
