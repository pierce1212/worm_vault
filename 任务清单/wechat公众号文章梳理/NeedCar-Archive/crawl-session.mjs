import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const base=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(base,'../..');
const py='C:/Users/nvtc140/AppData/Roaming/uv/tools/browser-act-cli/Scripts/python.exe';
const cli='C:/Users/nvtc140/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/@playwright/cli/playwright-cli.js';
const session='needcar-archive';
const expr=await fs.readFile(path.join(base,'extract-expression.txt'),'utf8');
const cache=path.join(root,'work/session-cache');
await fs.mkdir(cache,{recursive:true});
const call=(exe,args,timeout=90000)=>new Promise((resolve,reject)=>execFile(exe,args,
 {windowsHide:true,timeout,maxBuffer:18*1024*1024,encoding:'utf8'},(error,stdout,stderr)=>
 error?reject(new Error((stderr||stdout||error.message).slice(0,2000))):resolve(stdout)));
const log=async obj=>{console.log(JSON.stringify(obj));await fs.appendFile(path.join(root,'work/crawl-progress.jsonl'),JSON.stringify({...obj,time:new Date().toISOString()})+'\n');};
const stats=db=>({found:Object.keys(db.articles).length,saved:Object.values(db.articles).filter(a=>a.status==='saved').length,partial:Object.values(db.articles).filter(a=>a.status==='partial').length,previews:Object.values(db.articles).filter(a=>a.status==='paywall').length});
for(let n=0;n<500;n++){
 const db=JSON.parse(await fs.readFile(path.join(base,'manifest.json'),'utf8'));
 const pending=Object.values(db.articles).filter(a=>a.status==='discovered');
 pending.sort((a,b)=>(/汇总/.test(a.title)?0:1)-(/汇总/.test(b.title)?0:1) || Number(new URL(a.url).searchParams.get('mid')||0)-Number(new URL(b.url).searchParams.get('mid')||0));
 if(!pending.length){await log({state:'known_queue_exhausted',...stats(db)});break;}
 const batch=pending.slice(0,3);
 let blocked=0;
 try {
  const code='async (page) => {const urls='+JSON.stringify(batch.map(a=>a.url))+';const ps=[page];for(let i=1;i<urls.length;i++)ps.push(await page.context().newPage());try{return await Promise.all(ps.map(async(p,i)=>{try{await p.goto(urls[i]);await p.locator("#js_content").waitFor({state:"attached",timeout:20000});return await p.evaluate('+expr+');}catch(e){return {blocked:true,url:p.url(),text:await p.locator("body").innerText().catch(()=>""),error:e.message};}}));}finally{for(const p of ps.slice(1))await p.close();}}';
  const results=JSON.parse(await call('node',[cli,'-s='+session,'--raw','run-code',code]));
  for(let j=0;j<batch.length;j++){
   const a=batch[j], data=results[j];
   const id=crypto.createHash('sha256').update(a.url).digest('hex').slice(0,20);
   if(data.blocked && /The content has been deleted by the author|该内容已被发布者删除|此内容已被发布者删除/i.test(data.text||'')){
    await call(py,['-X','utf8',path.join(base,'archive.py'),'--mark-unavailable',a.url,'微信原文提示作者已删除文章']);
    await log({state:'unavailable',title:a.title,url:a.url});continue;
   }
   if(data.blocked || !data.html || data.account!=='开心果 Need Car'){
    await fs.writeFile(path.join(cache,'blocked-'+id+'.json'),JSON.stringify({requested:a.url,...data},null,2));
    await log({state:'page_blocked',url:a.url,title:a.title,detail:data.text?.slice(0,500),...stats(db)});
    await call(py,['-X','utf8',path.join(base,'archive.py'),'--mark-blocked',a.url,'微信要求验证；已保留记录，未重试此页面']);
    blocked++;continue;
   }
   await fs.writeFile(path.join(cache,id+'.html'),data.html);
   const album=data.album||{}, siblings=[];
   for(const k of ['pre','next'])if(album[k+'_article_link'])siblings.push({url:album[k+'_article_link'].replaceAll('&amp;','&').replace(/^http:/,'https:'),title:album[k+'_article_title']||''});
   await fs.writeFile(path.join(cache,id+'.links.json'),JSON.stringify({source:a.url,articles:siblings}));
   await fs.writeFile(path.join(cache,id+'.meta.json'),JSON.stringify({url:a.url,title:data.title,date:data.date,preview:data.preview,album},null,2));
   await call(py,['-X','utf8',path.join(base,'archive.py'),'--add-links',path.join(cache,id+'.links.json'),'--import-html',a.url,path.join(cache,id+'.html'),...(data.preview?['--preview']:[])],180000);
   const after=JSON.parse(await fs.readFile(path.join(base,'manifest.json'),'utf8'));
   await log({state:'saved',title:data.title,...stats(after)});
  }
  if(blocked===batch.length){await log({state:'paused',reason:'all pages in batch require inspection'});break;}
 }catch(e){await log({state:'paused',error:e.message,...stats(db)});break;}
 await new Promise(r=>setTimeout(r,3000));
}
