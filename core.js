export const VERSION = 1;
export const INTERVALS = [0, 1, 3, 7, 14, 30, 60];
export const ABILITIES = ['recognition', 'spelling'];
export const abilityName = a => a === 'spelling' ? '拼写' : '理解';
export const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function day(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function addDays(date, amount) {
  const [y,m,d] = date.split('-').map(Number); return day(new Date(y,m-1,d+amount,12));
}
export const clone = value => JSON.parse(JSON.stringify(value));
export const normalize = text => text.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
export function freshState() {
  return {schemaVersion:VERSION, words:[], tasks:[], events:[], sessions:[], settings:{theme:'light',newLimit:10,autoRead:false,rate:0.9,repeats:2,gap:3.5,screenMode:false,voiceEn:'',voiceZh:''},initialized:true};
}
export function progress() {return {stage:0,lastPromoted:null,lastFailure:null,wrongCount:0,wrongStreak:0,rightStreak:0,easyMistake:false,lastFormalDay:null};}
export function schedule(state,wordId,ability,due,reason,createdOn) {
  const task={id:uid(),wordId,ability,due,reason,createdOn,status:'pending',completedOn:null,result:null}; state.tasks.push(task); return task;
}
export function addWord(state, input, date=day()) {
  const word={id:uid(),english:input.english.trim(),chinese:input.chinese.trim(),type:input.type||(/\s/.test(input.english.trim())?'phrase':'word'),example:input.example?.trim()||'',prompt:input.prompt?.trim()||'',importDate:date,lastImportDate:date,isStarred:false,isDemo:!!input.isDemo,recognition:progress(),spelling:progress()};
  state.words.push(word); ABILITIES.forEach(a=>schedule(state,word.id,a,date,'首次学习',date)); return word;
}
export function seedState(date=day()) {
  const state=freshState();
  const samples=[['serendipity','意外发现美好事物的机缘','A little serendipity made my day.'],['take your time','慢慢来，不着急','Take your time. There is no rush.'],['resilient','有韧性的；能恢复的','Stay curious and resilient.'],['make a difference','产生影响；起作用','Small steps make a difference.'],['environment','环境','We should protect the environment.'],['a little at a time','每次一点点','Learn a little at a time.'],['curious','好奇的','Be curious about the world.'],['look forward to','期待','I look forward to seeing you.'],['consistent','始终如一的；坚持的','Be consistent with your practice.'],['keep in mind','记住；牢记','Keep your goal in mind.']];
  samples.forEach(([english,chinese,example])=>addWord(state,{english,chinese,example,isDemo:true},date)); return state;
}
export function overall(word) {
  if(!word.recognition.lastFormalDay && !word.spelling.lastFormalDay) return 'new';
  return ABILITIES.every(a=>word[a].stage>=4)?'mastered':'learning';
}
export const isWrong = w => ABILITIES.some(a=>w[a].easyMistake);
export function introducedToday(state,date) {return new Set(state.events.filter(e=>e.date===date && e.introduced).map(e=>e.wordId));}
export function pending(state,date=day(),ability=null) {
  return state.tasks.filter(t=>t.status==='pending'&&t.due<=date&&(!ability||t.ability===ability)&&state.words.some(w=>w.id===t.wordId));
}
export function eligibleTasks(state,date=day(),ability=null,wordFilter=()=>true) {
  const remaining=Math.max(0,state.settings.newLimit-introducedToday(state,date).size);
  const introduced=introducedToday(state,date);
  const newIds=[];
  return pending(state,date,ability).filter(t=>wordFilter(state.words.find(w=>w.id===t.wordId)))
    .sort((a,b)=>Number(overall(state.words.find(w=>w.id===a.wordId))==='new')-Number(overall(state.words.find(w=>w.id===b.wordId))==='new')||a.due.localeCompare(b.due)||Number(state.words.find(w=>w.id===b.wordId)[b.ability].easyMistake)-Number(state.words.find(w=>w.id===a.wordId)[a.ability].easyMistake)||state.tasks.indexOf(a)-state.tasks.indexOf(b))
    .filter(t=>{
      const w=state.words.find(w=>w.id===t.wordId);
      if(overall(w)!=='new'||introduced.has(w.id))return true;
      if(newIds.includes(w.id))return true;
      if(newIds.length<remaining){newIds.push(w.id);return true;}return false;
    });
}
export function markAnswer(state,wordId,ability,correct,options={}) {
  const date=options.date||day(); const mode=options.mode||'formal'; const eventId=options.eventId||uid();
  if(state.events.some(e=>e.id===eventId))return state.events.find(e=>e.id===eventId);
  const word=state.words.find(w=>w.id===wordId); if(!word)throw new Error('词条已不存在');
  const p=word[ability]; const before=p.stage; const wasNew=overall(word)==='new';
  const task=state.tasks.find(t=>t.id===options.taskId&&t.wordId===wordId&&t.ability===ability&&t.status==='pending')||state.tasks.find(t=>t.wordId===wordId&&t.ability===ability&&t.status==='pending');
  const formal=mode==='formal' && !!task && task.due<=date;
  let upgraded=false;
  if(mode!=='reinforcement') {
    if(!correct) {
      p.stage=0;p.lastFailure=date;p.wrongCount++;
      if(formal && p.lastFormalDay!==date){p.wrongStreak++;p.rightStreak=0;if(p.wrongStreak>=2)p.easyMistake=true;}
      if(task){task.status=formal?'completed':'cancelled';task.completedOn=date;task.result='wrong';}
      schedule(state,wordId,ability,addDays(date,1),'上次需要提示或回答错误，隔天再测',date);
    } else if(formal && p.lastPromoted!==date && p.lastFailure!==date) {
      p.stage=Math.min(6,p.stage+1);p.lastPromoted=date;upgraded=true;
      if(p.lastFormalDay!==date){p.rightStreak++;p.wrongStreak=0;if(p.rightStreak>=3)p.easyMistake=false;}
      task.status='completed';task.completedOn=date;task.result='correct';
      schedule(state,wordId,ability,addDays(date,INTERVALS[p.stage]),`独立通过阶段 ${p.stage}，间隔 ${INTERVALS[p.stage]} 天`,date);
    }
    if(formal)p.lastFormalDay=date;
  }
  const event={id:eventId,wordId,ability,date,at:options.at||new Date().toISOString(),correct,mode:formal?'formal':mode==='reinforcement'?'reinforcement':'practice',before,after:p.stage,upgraded,taskId:task?.id||null,introduced:wasNew&&formal};
  state.events.push(event);return event;
}
export function deleteWord(state,id) {
  state.words=state.words.filter(w=>w.id!==id);state.tasks=state.tasks.filter(t=>t.wordId!==id);state.events=state.events.filter(e=>e.wordId!==id);
}
export function filterWords(words,filters={},today=day()) {
  return words.filter(w=>(!filters.search||`${w.english} ${w.chinese} ${w.example}`.toLowerCase().includes(filters.search.toLowerCase()))&&(!filters.type||w.type===filters.type)&&(!filters.level||overall(w)===filters.level)&&(!filters.star||w.isStarred)&&(!filters.wrong||isWrong(w))&&(!filters.date||w.importDate===filters.date)&&(!filters.days||w.importDate>=addDays(today,1-Number(filters.days))));
}
export function parseImport(text) {
  const rows=[];const errors=[];
  text.split(/\r?\n/).forEach((raw,index)=>{
    if(!raw.trim())return;
    let line=raw.trim().replace(/^\d+[.)、]\s*/,'');
    if(/^\|?\s*:?-{3,}/.test(line))return;
    if(line.startsWith('|'))line=line.slice(1);if(line.endsWith('|'))line=line.slice(0,-1);
    let cells=line.includes('|')?line.split('|'):line.includes('\t')?line.split('\t'):line.split(/\s+[-–—]\s+|\s*[:：]\s*/);
    cells=cells.map(s=>s.trim());
    if(/^(英文|english)$/i.test(cells[0])&&/中文|释义|chinese/i.test(cells[1]||''))return;
    if(cells.length<2||!cells[0]||!cells[1]){errors.push({line:index+1,text:raw,reason:'需要英文和中文两列，请用 | 分隔'});return;}
    if(cells.length>4){errors.push({line:index+1,text:raw,reason:'列数超过 4 列，请检查分隔符'});return;}
    rows.push({english:cells[0],chinese:cells[1],type:/^(短语|phrase)$/i.test(cells[2]||'')?'phrase':/^(单词|词|word)$/i.test(cells[2]||'')?'word':/\s/.test(cells[0])?'phrase':'word',example:cells[3]||'',line:index+1});
  }); return {rows,errors};
}
export function importRows(state,rows,overwrite=false,date=day()) {
  let added=0,updated=0,skipped=0;
  for(const row of rows){const existing=state.words.find(w=>normalize(w.english)===normalize(row.english));
    if(existing){if(overwrite){Object.assign(existing,{english:row.english.trim(),chinese:row.chinese.trim(),type:row.type,example:row.example||existing.example,lastImportDate:date,isDemo:false});updated++;}else skipped++;}
    else{addWord(state,row,date);added++;}
  } return {added,updated,skipped};
}
export function makeDictation(state,{count=10,mix='mixed',filter=()=>true,practice=false,date=day()}={}) {
  const all=practice?state.words.filter(filter).flatMap(w=>ABILITIES.map(ability=>({wordId:w.id,ability,id:null}))):eligibleTasks(state,date,null,filter);
  const allowed=all.filter(t=>mix==='mixed'||t.ability===(mix==='zh'?'spelling':'recognition'));
  const chosen=[];const used=new Set();
  for(let i=0;i<count;i++) {
    const preferred=mix==='mixed'?(i%10<7?'spelling':'recognition'):(mix==='zh'?'spelling':'recognition');
    // Preserve overdue priority; the ratio only breaks ties on the same due date.
    const pool=allowed.filter(t=>!used.has(t.wordId)).sort((a,b)=>Number(overall(state.words.find(w=>w.id===a.wordId))==='new')-Number(overall(state.words.find(w=>w.id===b.wordId))==='new')||(a.due||date).localeCompare(b.due||date)||Number(b.ability===preferred)-Number(a.ability===preferred));
    if(!pool.length)break;const t=pool[0];used.add(t.wordId);const w=state.words.find(w=>w.id===t.wordId);
    chosen.push({wordId:w.id,ability:t.ability,taskId:t.id,english:w.english,chinese:w.chinese,prompt:w.prompt||w.chinese,status:'unplayed',correct:true,eventId:uid()});
  }
  for(let i=chosen.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[chosen[i],chosen[j]]=[chosen[j],chosen[i]];}return chosen;
}
export function settleSession(state,session,date=day()) {
  if(session.settled)return false;
  for(const item of session.items){if(item.status==='played'&&state.words.some(w=>w.id===item.wordId))markAnswer(state,item.wordId,item.ability,item.correct,{date,mode:session.reinforcement?'reinforcement':session.practice?'practice':'formal',taskId:item.taskId,eventId:item.eventId});}
  session.settled=true;session.settledOn=date;session.phase='done';return true;
}
export function csv(words) {
  const quote=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
  return '\uFEFF'+[['英文','中文','类型','理解阶段','拼写阶段','首次导入日期','重点','例句'],...words.map(w=>[w.english,w.chinese,w.type==='word'?'单词':'短语',w.recognition.stage,w.spelling.stage,w.importDate,w.isStarred?'是':'否',w.example])].map(row=>row.map(quote).join(',')).join('\r\n');
}
export function validateBackup(input) {
  const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&day(new Date(x+'T12:00:00'))===x;
  const validId=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(x);
  if(!input||input.schemaVersion!==VERSION||!Array.isArray(input.words)||!Array.isArray(input.tasks)||!Array.isArray(input.events)||!Array.isArray(input.sessions)||!input.settings)throw new Error('不是此版本的随页备份文件');
  const ids=new Set();
  for(const w of input.words){if(!validId(w.id)||ids.has(w.id)||typeof w.english!=='string'||!w.english.trim()||typeof w.chinese!=='string'||!w.chinese.trim()||!['word','phrase'].includes(w.type)||!validDate(w.importDate))throw new Error('词条字段无效或 ID 重复');ids.add(w.id);for(const a of ABILITIES){const p=w[a];if(!p||!Number.isInteger(p.stage)||p.stage<0||p.stage>6||!Number.isInteger(p.wrongCount)||p.wrongCount<0||!Number.isInteger(p.rightStreak)||!Number.isInteger(p.wrongStreak))throw new Error('学习进度字段无效');}}
  const taskIds=new Set(),active=new Set();
  for(const t of input.tasks){if(!validId(t.id)||taskIds.has(t.id)||!ids.has(t.wordId)||!ABILITIES.includes(t.ability)||!validDate(t.due)||!['pending','completed','cancelled'].includes(t.status))throw new Error('复习任务无效');taskIds.add(t.id);if(t.status==='pending'){const key=t.wordId+':'+t.ability;if(active.has(key))throw new Error('存在重复的待复习任务');active.add(key);}}
  for(const w of input.words)for(const a of ABILITIES)if(!active.has(w.id+':'+a))throw new Error('词条缺少下一次复习任务');
  const eventIds=new Set();for(const e of input.events){if(!validId(e.id)||eventIds.has(e.id)||!ids.has(e.wordId)||!ABILITIES.includes(e.ability)||!validDate(e.date)||typeof e.correct!=='boolean'||!['formal','practice','reinforcement'].includes(e.mode))throw new Error('练习记录无效');eventIds.add(e.id);}
  const sessionIds=new Set();for(const s of input.sessions){if(!validId(s.id)||sessionIds.has(s.id)||!Array.isArray(s.items)||!['paused','review','done','playing'].includes(s.phase)||!Number.isInteger(s.index)||s.index<0||s.index>s.items.length||typeof s.settled!=='boolean'||(!s.settled&&s.phase!=='review'&&s.index>=s.items.length))throw new Error('听写会话无效');sessionIds.add(s.id);for(const i of s.items)if(!validId(i.wordId)||!ABILITIES.includes(i.ability)||!['unplayed','played','skipped'].includes(i.status)||typeof i.english!=='string'||typeof i.chinese!=='string'||typeof i.correct!=='boolean'||!validId(i.eventId))throw new Error('听写题目无效');}
  if(!Number.isInteger(input.settings.newLimit)||input.settings.newLimit<0||input.settings.newLimit>100||![0.7,0.9,1].includes(input.settings.rate)||![1,2,3].includes(input.settings.repeats)||!Number.isFinite(input.settings.gap)||input.settings.gap<3||input.settings.gap>30)throw new Error('偏好设置无效');
  return clone(input);
}
