import {ABILITIES,INTERVALS,abilityName,uid,day,addDays,clone,seedState,freshState,overall,isWrong,pending,eligibleTasks,markAnswer,deleteWord,filterWords,parseImport,importRows,addWord,makeDictation,settleSession,csv,validateBackup} from './core.js';
import {speak,stopSpeech,voices} from './speech.js';

const KEY='suipage.data.v1';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={book:'M4 4h5a4 4 0 0 1 3 2 4 4 0 0 1 3-2h5v15h-5a4 4 0 0 0-3 2 4 4 0 0 0-3-2H4z M12 6v15',calendar:'M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16 M8 14h2 M14 14h2 M8 17h2',headphones:'M4 14v-2a8 8 0 0 1 16 0v2 M4 13h3v7H4z M17 13h3v7h-3z',library:'M4 4h4v16H4z M11 4h3v16h-3z M17 4l3-1 3 16-3 1z',data:'M4 7c0-4 16-4 16 0s-16 4-16 0 M4 7v10c0 4 16 4 16 0V7 M4 12c0 4 16 4 16 0',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.6 5.6L7 7 M17 17l1.4 1.4 M5.6 18.4L7 17 M17 7l1.4-1.4',star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z',sound:'m4 9 4 0 5-4v14l-5-4H4z M17 8a6 6 0 0 1 0 8 M20 5a10 10 0 0 1 0 14',left:'m14 6-6 6 6 6',right:'m10 6 6 6-6 6',arrow:'M4 12h16 M14 6l6 6-6 6',undo:'M8 5 3 10l5 5 M3 10h10a6 6 0 0 1 0 12',check:'m5 12 4 4L19 6',close:'m6 6 12 12 M18 6 6 18',plus:'M12 5v14 M5 12h14',download:'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',upload:'M12 16V3 M7 8l5-5 5 5 M4 17v4h16v-4',play:'m8 4 12 8-12 8z',pause:'M8 5v14 M16 5v14',repeat:'M19 7a8 8 0 1 0 1 9 M19 3v5h-5',moon:'M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10',copy:'M8 8h12v13H8z M16 8V3H3v13h5',leaf:'M20 3C8 2 2 6 5 15c8 5 15-1 15-12 M5 20 15 9',clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2',search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6'};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[name]||icons.book}"/></svg>`;
const action=(name,label,cls='button',attrs='')=>`<button class="${cls}" data-action="${name}" ${attrs}>${label}</button>`;
const levelName=w=>({new:'新词',learning:'学习中',mastered:'已掌握'}[overall(w)]);
const option=(value,text,current)=>`<option value="${esc(value)}" ${String(value)===String(current)?'selected':''}>${esc(text)}</option>`;
let corrupted=null;
let state;
let rawData=null;
try{rawData=localStorage.getItem(KEY);state=rawData?validateBackup(JSON.parse(rawData)):seedState();if(!rawData)localStorage.setItem(KEY,JSON.stringify(state));}
catch(error){corrupted=rawData??'';state=freshState();$('#storage-warning').hidden=false;$('#storage-warning').innerHTML=`本地数据或存储暂不可用，已停止自动覆盖。${rawData?'请先保存原始数据。':'请检查浏览器是否允许本地存储。'} ${action('download-damaged','保存原始数据','')} ${action('reset-damaged','重新初始化','')}`;}
const ui={tab:'learn',scope:'due',study:null,undo:null,filters:{},page:1,importText:'',preview:null,overwrite:false,backup:null,modal:null,month:day().slice(0,7),selectedDate:day(),dict:{count:10,mix:'mixed',scope:'due',date:'',practice:false},sessionId:null};
let toastTimer,voiceToken=0,wakeLock=null,clockDate=day();
const runtime={status:'',count:'',fraction:0};
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3400);}
function commit(fn){if(corrupted!==null)throw new Error('请先保存并处理无法读取的本地数据');const before=clone(state);try{const result=fn();localStorage.setItem(KEY,JSON.stringify(state));return result;}catch(e){state=before;throw new Error(`没有保存成功：${e.message}`);}}
function save(){commit(()=>{});}
function download(content,name,type='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function exportBackup(){download(JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2),`随页备份-${day()}.json`,'application/json');}
function wordById(id){return state.words.find(w=>w.id===id);}
function wordTask(id,a){return state.tasks.find(t=>t.wordId===id&&t.ability===a&&t.status==='pending');}
function commonFilter(w,scope){return scope==='star'?w.isStarred:scope==='wrong'?isWrong(w):scope==='learning'?overall(w)!=='mastered':scope==='word'?w.type==='word':scope==='phrase'?w.type==='phrase':scope==='date'?w.importDate===ui.dict.date:true;}
function header(eyebrow,title,description,extra=''){return `<section class="page-top"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="subtle">${description}</p></div>${extra}</section>`;}
function empty(title,text,button=''){return `<div class="empty">${icon('leaf')}<h2>${title}</h2><p>${text}</p>${button}</div>`;}
function render(){
  document.body.dataset.theme=state.settings.theme;
  $('#settings-button').innerHTML=icon('settings');
  $('#navigation').innerHTML=[['learn','book','随身背词'],['dictation','headphones','语音听写'],['library','library','词库'],['data','data','导入导出']].map(([tab,i,label])=>`<button class="nav-item ${ui.tab===tab?'active':''}" data-tab="${tab}" ${ui.tab===tab?'aria-current="page"':''}>${icon(i)}<span>${label}</span></button>`).join('');
  $('#app').innerHTML=ui.tab==='learn'?learnPage():ui.tab==='dictation'?dictationPage():ui.tab==='library'?libraryPage():dataPage();
  if(ui.tab==='learn')bindSwipe();
  if(ui.tab==='dictation')updatePlayer();
}
function learnPage(){
  const today=day(),due=pending(state,today),completed=state.events.filter(e=>e.date===today&&e.mode==='formal'),uniqueDone=new Set(completed.map(e=>e.wordId)).size;
  const calendar=`<button class="calendar-entry" data-action="calendar">${icon('calendar')}<span><strong>复习日历</strong><small>过去 · 今天 · 未来</small></span></button>`;
  const counts=`<div class="stat-strip"><div class="stat"><strong>${new Set(due.map(t=>t.wordId)).size}</strong><small>词</small><span>待复习 · ${due.length} 项</span></div><div class="stat-divider"></div><div class="stat"><strong>${uniqueDone}</strong><small>词</small><span>今日已练</span></div><div class="stat-divider"></div><div class="stat"><strong>${state.words.filter(w=>overall(w)==='mastered').length}</strong><small>词</small><span>稳定掌握</span></div></div>`;
  const s=ui.study,w=s?.current?wordById(s.current.wordId):null;
  let card='';
  if(s&&!w){card=empty('这一轮，记得更牢了',`已练 ${s.completed} 次。不会的词已安排明天再测；另一个方向的待办会继续保留。`,action('restart-study','回到今日学习'));}
  else if(w){const p=w.recognition;card=`<div class="flashcard" id="flashcard"><div class="swipe-label know">认识</div><div class="swipe-label unknown">看释义</div><div class="card-meta"><div class="pills"><span class="pill">${w.type==='phrase'?'短语':'单词'}</span><span class="pill green">${s.current.mode==='reinforcement'?'当天补练 · 不升级':s.current.mode==='practice'?'自由练习 · 不升级':'理解 · 阶段 '+p.stage}</span></div>${action('star',icon('star'),'icon-button star '+(w.isStarred?'active':''),`data-id="${w.id}" aria-label="${w.isStarred?'取消重点':'标记重点'}"`)}</div><div class="word-content"><h2 class="english">${esc(w.english)}</h2>${action('pronounce',icon('sound'),'icon-button pronounce',`data-id="${w.id}" aria-label="朗读英文"`)}${s.revealed?`<div class="answer"><p class="meaning">${esc(w.chinese)}</p>${w.example?`<p class="example">${esc(w.example)}</p>`:''}</div>`:''}</div><div class="card-foot"><span>${icon('clock')}${s.revealed?'需要提示，明天再测':esc(s.current.reason||'按自己的节奏，主动回想')}</span><span>本轮第 ${s.completed+1} 张</span></div></div><div class="study-controls">${s.revealed?action('learn-next',`记住了，继续 ${icon('arrow')}`,'button full','style="grid-column:1/-1"'):action('learn-known',`${icon('left')} 认识`)+action('learn-reveal',`看释义 ${icon('right')}`,'button warm')}</div><div class="under-card">${action('undo',`${icon('undo')} 撤回上一步`,'text-button',ui.undo?'':'disabled')}${action('word-detail','查看记录','text-button',`data-id="${w.id}"`)}</div><p class="hint">左滑认识 · 右滑看释义${s.revealed?' · 再右滑继续':''}</p>`;}
  else {const available=eligibleTasks(state,today,'recognition').length;card=`<div class="flashcard"><div class="card-meta"><span class="pill green">理解练习</span><span class="subtle">${new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'short'}).format(new Date())}</span></div><div class="word-content"><p class="eyebrow">ONE PAGE AT A TIME</p><h2 class="english" style="font-size:36px">A little,<br>every day.</h2><p class="subtle" style="margin-top:15px">留一点时间，给记忆生长。</p></div><div class="card-foot"><span>${icon('clock')}今天可开始 ${available} 项理解练习</span><span>每轮最多 20 张</span></div></div><div class="study-controls">${action('start-study',`${icon('play')} 开始背词`,'button','style="grid-column:1/-1"')}</div><p class="hint">先想出意思，再判断是否认识。</p>`;}
  return header('YOUR DAILY ENGLISH','每天一点，<br class="mobile-only">慢慢记牢。','不赶进度，让每一次练习都有回响。',calendar)+`<div class="learning-layout"><section>${counts}<div class="section-line"><h2>${s?'正在背词':'今日学习'}</h2>${s?action('end-study','结束本轮','text-button'):`<select class="scope-select" aria-label="背词范围" id="study-scope">${option('due','今日计划 · 到期优先',ui.scope)}${option('all','自由练习 · 全部词库',ui.scope)}${option('star','自由练习 · 重点词',ui.scope)}${option('wrong','自由练习 · 易错词',ui.scope)}${option('learning','自由练习 · 未掌握',ui.scope)}${option('word','自由练习 · 单词',ui.scope)}${option('phrase','自由练习 · 短语',ui.scope)}</select>`}</div>${card}${state.words.some(w=>w.isDemo)?`<div class="tiny-banner"><span>已准备 10 条示例，先试试手感。</span>${action('clear-demo','清除示例','text-button')}</div>`:''}</section><aside class="side-panel"><div class="note-panel"><p class="eyebrow">A GENTLE ROUTINE</p><h3>记忆，有自己的节奏。</h3><div class="timeline-item"><i class="timeline-dot"></i><div><strong>先理解，再默写</strong><p>两种能力，分别记录。</p></div></div><div class="timeline-item"><i class="timeline-dot hollow"></i><div><strong>难词，隔一会再见</strong><p>当天补练，明天再测。</p></div></div><div class="timeline-item"><i class="timeline-dot hollow"></i><div><strong>熟词，留一点间隔</strong><p>1 / 3 / 7 / 14 / 30 / 60 天。</p></div></div>${action('calendar',`查看我的复习安排 ${icon('arrow')}`,'aside-link')}</div><div class="daily-quote">“Small steps.<br>Lasting words.”<p>今天记住的一点，会慢慢积累。</p></div><div class="subtle" style="font-size:10px;padding:0 5px">${due.filter(t=>t.due<today).length} 项逾期待办会继续保留。<br>本轮完成后，仍可继续下一轮。</div></aside></div>`;
}
function scopeOptions(current){return option('due','今日到期',current)+option('all','全部词库',current)+option('word','仅单词',current)+option('phrase','仅短语',current)+option('star','重点词',current)+option('learning','未掌握',current)+option('wrong','易错词',current)+option('date','指定导入日期',current);}
function currentSession(){return state.sessions.find(s=>s.id===ui.sessionId);}
function dictPool(){const practice=ui.dict.practice;const predicate=w=>commonFilter(w,ui.dict.scope);return practice?state.words.filter(predicate).length:new Set(eligibleTasks(state,day(),null,predicate).filter(t=>ui.dict.mix==='mixed'||t.ability===(ui.dict.mix==='zh'?'spelling':'recognition')).map(t=>t.wordId)).size;}
function dictationPage(){
  const session=currentSession();
  if(session)return sessionPage(session);
  const resumable=[...state.sessions].reverse().find(s=>!s.settled);
  return header('LISTEN & REMEMBER','听见，再写下来。','把手机放在一旁，拿起纸和笔。')+`<div class="two-columns"><section class="panel"><div class="panel-title"><span class="num">01</span><h2>准备这一轮</h2></div>${resumable?`<div class="pool-preview" style="margin:0 0 18px">有一轮尚未结算的听写。${action('resume-session','继续上次听写','text-button',`data-id="${resumable.id}"`)}</div>`:''}<form id="dictation-form"><div class="form-grid"><label class="field"><span>练习范围</span><select name="scope">${scopeOptions(ui.dict.scope)}</select></label><label class="field"><span>本轮数量</span><input name="count" type="number" min="1" max="100" step="1" value="${ui.dict.count}" required></label>${ui.dict.scope==='date'?`<label class="field full"><span>导入日期</span><input name="date" type="date" value="${esc(ui.dict.date)}" required></label>`:''}<label class="field full"><span>题型</span><select name="mix">${option('mixed','混合 · 中文题优先，约 7∶3',ui.dict.mix)}${option('zh','全部听中文，写英文',ui.dict.mix)}${option('en','全部听英文，写中文',ui.dict.mix)}</select></label><label class="check-row field full" style="flex-direction:row"><input type="checkbox" name="practice" ${ui.dict.practice?'checked':''}>自由加练（不限到期，答对不升级）</label></div><div class="pool-preview">当前可练 <strong>${dictPool()}</strong> 个不同词条。<br><span class="subtle">到期优先，同一轮不会重复同一个词。实际数量以可用词条为准。</span></div><button class="button full" style="margin-top:20px" type="submit">${icon('play')} 准备开始听写</button></form></section><section class="panel"><div class="panel-title"><span class="num">02</span><h2>声音与节奏</h2></div>${speechSettings()}<p class="install-note">${icon('headphones')} 建议先试听中英文。听写时保持本页面在前台；离开页面将自动暂停。</p></section></div>`;
}
function speechSettings(){return `<div class="form-grid"><label class="field"><span>每题朗读</span><select data-setting="repeats">${[1,2,3].map(v=>option(v,v+' 遍',state.settings.repeats)).join('')}</select></label><label class="field"><span>朗读速度</span><select data-setting="rate">${[0.7,0.9,1].map(v=>option(v,v+' 倍',state.settings.rate)).join('')}</select></label><label class="field full"><span>读完后写字时间：<b id="gap-value">${state.settings.gap}</b> 秒</span><input type="range" data-setting="gap" min="3" max="30" step="0.5" value="${state.settings.gap}" aria-label="写字时间"><small>短语较长时，可以多留一点时间。</small></label><label class="check-row field full" style="flex-direction:row"><input type="checkbox" data-setting="screenMode" ${state.settings.screenMode?'checked':''}>仅屏幕题干模式（无声默写）</label></div><div class="form-actions">${action('test-en',`${icon('sound')} 英文试听`,'button secondary small')}${action('test-zh',`${icon('sound')} 中文试听`,'button secondary small')}${action('voice-settings','选择声音','text-button')}</div>`;}
function sessionPage(s){
  if(s.phase==='review')return header('CHECK YOUR ANSWERS','对照纸笔，轻松核对。','已播报的题目默认正确；点击写错的条目，跳过的题不计分。')+`<section class="panel"><div class="section-line"><h2>核对本轮 ${s.items.length} 题</h2>${action('leave-session','稍后核对','text-button')}</div>${s.items.map((i,n)=>`<button class="review-row ${!i.correct&&i.status==='played'?'wrong':''}" data-action="toggle-result" data-index="${n}" ${i.status!=='played'?'disabled':''}><span class="row-number">${String(n+1).padStart(2,'0')}</span><span class="row-answer"><strong>${esc(i.english)}</strong><small>${esc(i.chinese)} · ${abilityName(i.ability)}阶段 ${wordById(i.wordId)?.[i.ability]?.stage??'—'}</small></span><span class="result-label">${i.status!=='played'?'未作答':i.correct?'正确 ✓':'写错 ×'}</span></button>`).join('')}<div class="pool-preview">${s.items.filter(i=>i.status==='played'&&i.correct).length} 题正确 · ${s.items.filter(i=>i.status==='played'&&!i.correct).length} 题错误 · ${s.items.filter(i=>i.status!=='played').length} 题未作答<br><span class="subtle">提交后更新记录与复习安排；未作答继续保留待办。</span></div>${action('settle','确认并提交结算','button full','style="margin-top:18px"')}</section>`;
  if(s.settled){const played=s.items.filter(i=>i.status==='played'),wrong=played.filter(i=>!i.correct),correct=played.length-wrong.length;return header('A PAGE WELL PRACTICED','每一次回想，都算数。','记录已保存，下次复习已自动安排。')+`<section class="panel"><div style="text-align:center"><p class="eyebrow">THIS SESSION</p><div class="score">${played.length?Math.round(correct/played.length*100):0}<small>%</small></div><p class="subtle">${correct} 题正确 / ${played.length} 题已作答 · ${s.items.length-played.length} 题跳过</p></div><div class="section-spaced">${[...s.items].sort((a,b)=>Number(a.correct)-Number(b.correct)).map(i=>`<div class="review-row ${i.status==='played'&&!i.correct?'wrong':''}"><span class="row-answer"><strong>${esc(i.english)}</strong><small>${esc(i.chinese)}</small><small>${abilityName(i.ability)}阶段 ${wordById(i.wordId)?.[i.ability]?.stage??'—'} · 下次 ${esc(wordTask(i.wordId,i.ability)?.due||'词条已删除')}</small></span><span class="result-label">${i.status!=='played'?'未作答':i.correct?'正确':'待巩固'}</span></div>`).join('')}</div><div class="form-actions">${wrong.length?action('retry-wrong','只练刚才的错题','button'):''}${action('new-dictation','回到听写设置','button secondary')}${action('calendar','查看复习安排','button secondary')}</div></section>`;}
  const item=s.items[s.index];return header('PEN DOWN, EARS OPEN','专心写，慢慢来。','答案会在本轮结束后统一显示。')+`<section class="panel player"><p class="player-progress"><strong>${Math.min(s.index+1,s.items.length)}</strong> / ${s.items.length}</p><h2 class="question-type">${item?.ability==='spelling'?'请写英文':'请写中文'}</h2><div class="timer-ring" id="timer-ring"><div class="timer-inner"><span id="player-count">${s.phase==='paused'?'Ⅱ':'…'}</span><small id="player-status">${s.phase==='paused'?'已暂停':'准备中'}</small></div></div>${state.settings.screenMode&&item?`<p class="player-prompt">${esc(item.ability==='spelling'?item.prompt:item.english)}</p>`:''}<p class="subtle" id="player-message">${s.phase==='paused'?'准备好后，点击继续，从当前题重新朗读。':'请保持页面在前台'}</p><div class="player-controls">${action('reread',`${icon('repeat')} 重读`,'button secondary')}${action(s.phase==='paused'?'continue':'pause',`${icon(s.phase==='paused'?'play':'pause')} ${s.phase==='paused'?'继续':'暂停'}`)}${action('skip',`跳过 ${icon('right')}`,'button secondary')}</div><div class="form-actions" style="justify-content:center;margin-top:24px">${action('finish-early','提前结束并核对','text-button')}${action('leave-session','保存并离开','text-button')}</div></section>`;
}
function filterControls(){const f=ui.filters;return `<div class="filters"><input type="search" id="word-search" data-filter="search" placeholder="搜索英文、中文或例句…" aria-label="搜索词库" value="${esc(f.search||'')}"><select data-filter="type" aria-label="类型">${option('','全部类型',f.type||'')}${option('word','单词',f.type)}${option('phrase','短语',f.type)}</select><select data-filter="level" aria-label="熟练程度">${option('','全部熟练度',f.level||'')}${option('new','新词',f.level)}${option('learning','学习中',f.level)}${option('mastered','已掌握',f.level)}</select><select data-filter="days" aria-label="导入时间">${option('','全部日期',f.days||'')}${option(1,'今天导入',f.days)}${option(3,'最近 3 天',f.days)}${option(7,'最近 7 天',f.days)}${option('custom','指定日期',f.days)}</select>${f.days==='custom'?`<input type="date" data-filter="date" aria-label="具体导入日期" value="${esc(f.date||'')}">`:''}</div><div class="filter-checks"><label class="check-row"><input type="checkbox" data-filter="star" ${f.star?'checked':''}>仅重点</label><label class="check-row"><input type="checkbox" data-filter="wrong" ${f.wrong?'checked':''}>仅易错</label>${action('reset-filters','重置筛选','text-button')}</div>`;}
function filtered(){return filterWords(state.words,{...ui.filters,days:ui.filters.days==='custom'?null:ui.filters.days});}
function wordRows(){const pool=filtered(),pages=Math.max(1,Math.ceil(pool.length/25));ui.page=Math.min(ui.page,pages);return `<p class="list-count">共 ${pool.length} 个词条${pool.length!==state.words.length?' · 已筛选':''}</p><div class="word-list">${pool.slice((ui.page-1)*25,ui.page*25).map(w=>`<div class="word-row"><button class="word-main" data-action="word-detail" data-id="${w.id}"><div class="en">${esc(w.english)}</div><p class="zh">${esc(w.chinese)}</p><p class="row-progress"><span>理解 ${w.recognition.stage}/6</span><span>拼写 ${w.spelling.stage}/6</span><span>${w.importDate}</span></p></button><div class="pills"><span class="pill ${overall(w)==='mastered'?'green':''}">${levelName(w)}</span>${isWrong(w)?'<span class="pill orange">易错</span>':''}</div>${action('star',icon('star'),'icon-button star '+(w.isStarred?'active':''),`data-id="${w.id}" aria-label="${w.isStarred?'取消重点':'标记重点'} ${esc(w.english)}"`)}</div>`).join('')||empty('这里还没有词条','换个筛选条件，或导入你正在学的内容。',action('go-data','导入词汇','button small'))}</div>${pages>1?`<div class="pagination">${action('prev-page','上一页','',ui.page===1?'disabled':'')}<span>${ui.page} / ${pages}</span>${action('next-page','下一页','',ui.page===pages?'disabled':'')}</div>`:''}`;}
function libraryPage(){return header('YOUR WORD COLLECTION','把学过的，留在这里。',`${state.words.length} 个词条，每一个都有自己的学习轨迹。`,action('add-word',`${icon('plus')} 新增`,'button secondary small'))+`<section class="panel">${filterControls()}<div id="word-results">${wordRows()}</div></section>`;}
function dataPage(){const p=ui.preview;return header('COLLECT & KEEP','从一段文字，开始积累。','导入自己的词汇，也记得给学习记录留一份备份。')+`<div class="two-columns"><section class="panel"><div class="panel-title"><span class="num">01</span><h2>粘贴入库</h2></div><p class="subtle">把外部 AI 整理的词汇复制到这里，每行一个。</p><div class="import-format">英文 | 中文 | 类型 | 例句（可选）<br>take your time | 慢慢来 | 短语 | Take your time.</div><textarea id="import-text" rows="7" placeholder="curious | 好奇的 | 单词&#10;keep in mind | 记住 | 短语" aria-label="待导入词汇">${esc(ui.importText)}</textarea><div class="form-actions">${action('paste',`${icon('copy')} 读取剪贴板`,'button secondary small')}${action('parse','解析并预览','button small')}</div><p class="subtle" style="margin-top:10px;font-size:10px">也可长按文本框粘贴。支持竖线、Tab、带空格的横线、冒号。</p>${p?`<div class="section-spaced"><h3>导入预览 · ${p.rows.length} 条</h3>${p.errors.length?`<div class="error-box">有 ${p.errors.length} 行需要修正，尚未导入。${p.errors.map(e=>`<p>第 ${e.line} 行：${esc(e.reason)}<br>${esc(e.text)}</p>`).join('')}</div>`:''}${p.rows.map((r,i)=>`<div class="preview-row"><input data-preview="english" data-index="${i}" aria-label="第 ${i+1} 条英文" value="${esc(r.english)}"><input data-preview="chinese" data-index="${i}" aria-label="第 ${i+1} 条中文" value="${esc(r.chinese)}"><select data-preview="type" data-index="${i}" aria-label="第 ${i+1} 条类型">${option('word','单词',r.type)}${option('phrase','短语',r.type)}</select></div>`).join('')}<label class="check-row" style="margin-top:12px"><input type="checkbox" id="overwrite" ${ui.overwrite?'checked':''}>重复词更新内容（保留学习记录）</label>${action('import-confirm',`确认导入 ${p.rows.length} 条`,'button full',(!p.rows.length||p.errors.length)?'disabled':'')}<p class="subtle" style="margin-top:8px">同英文词条默认跳过；不同义项可导入后手动补充释义。</p></div>`:''}</section><section><div class="panel"><div class="panel-title"><span class="num">02</span><h2>导出复习清单</h2></div>${filterControls()}<p id="export-count" class="pool-preview">筛选命中 ${filtered().length} 个词条。</p><div class="form-actions">${action('copy-export',`${icon('copy')} 复制`,'button secondary small')}${action('export-txt','TXT','button secondary small')}${action('export-csv','CSV','button secondary small')}</div>${filtered().length?`<p class="subtle" style="margin-top:12px">预览：${filtered().slice(0,3).map(w=>esc(w.english)).join(' / ')}${filtered().length>3?'…':''}</p>`:''}</div><div class="panel"><div class="panel-title"><span class="num">03</span><h2>完整数据备份</h2></div><p class="subtle">包含词库、两种能力进度、计划、练习历史及未完成听写。换手机或清理浏览器前，请保存一份。</p><div class="form-actions">${action('backup',`${icon('download')} 导出 JSON`,'button small')}${action('choose-backup',`${icon('upload')} 恢复备份`,'button secondary small')}</div><input type="file" id="backup-file" accept=".json,application/json" hidden><p class="install-note">数据属于当前浏览器和站点，不会自动同步到其他设备。</p></div></section></div>`;}

function openModal(type,id){ui.modal={type,id};renderModal();if(!$('#dialog').open)$('#dialog').showModal();}
function closeModal(){$('#dialog').close();ui.modal=null;}
function renderModal(){if(!ui.modal)return;const {type,id}=ui.modal;let title='',body='';
  if(type==='calendar'){title='复习日历';body=calendarBody();}
  else if(type==='word'){const w=wordById(id);if(!w){closeModal();return;}title='词条与学习记录';body=`<h3 class="modal-word">${esc(w.english)}</h3><p class="modal-meaning">${esc(w.chinese)}</p>${w.example?`<p class="example">${esc(w.example)}</p>`:''}<div class="word-detail-actions">${action('pronounce',`${icon('sound')} 发音`,'button secondary small',`data-id="${w.id}"`)}${action('edit-word','编辑词条','button secondary small',`data-id="${w.id}"`)}${action('delete-word','删除','text-button',`data-id="${w.id}"`)}</div>${ABILITIES.map(a=>{const t=wordTask(w.id,a),p=w[a];return `<div class="ability-card"><div class="section-line"><strong>${abilityName(a)}</strong><span class="pill green">阶段 ${p.stage} / 6${p.easyMistake?' · 易错':''}</span></div><div class="stage-dots">${[1,2,3,4,5,6].map(n=>`<i class="${p.stage>=n?'on':''}"></i>`).join('')}</div><p style="font-size:12px">下次：${esc(t?.due||'未安排')}${t&&t.due<day()?' · 已逾期，仍保留':''}</p><p class="subtle">${esc(t?.reason||'')}</p><p class="subtle">历史正式/主动测试错误 ${p.wrongCount} 次</p></div>`;}).join('')}<h3 class="section-spaced" style="margin-bottom:16px">练习轨迹</h3>${[...state.events].reverse().filter(e=>e.wordId===w.id).slice(0,80).map(e=>`<div class="history-event">${abilityName(e.ability)} · ${e.correct?'答对':'需要巩固'} ${e.upgraded?`→ 阶段 ${e.after}`:''}<small>${e.date} · ${e.mode==='formal'?'正式学习':e.mode==='reinforcement'?'当天补练':'提前或自由练习'}${!e.upgraded&&e.correct?' · 不升级':''}</small></div>`).join('')||'<p class="subtle">还没有练习记录。</p>'}<p class="subtle">首次导入 ${w.importDate} · 最近导入 ${w.lastImportDate}</p>`;}
  else if(type==='edit'){const w=id?wordById(id):{};title=id?'编辑词条':'新增词条';body=`<form id="word-form" data-id="${id||''}"><div class="form-grid"><label class="field full"><span>英文</span><input name="english" required maxlength="300" value="${esc(w.english||'')}"></label><label class="field full"><span>中文释义</span><textarea name="chinese" rows="2" required maxlength="1000">${esc(w.chinese||'')}</textarea></label><label class="field full"><span>类型</span><select name="type">${option('word','单词',w.type||'word')}${option('phrase','短语',w.type)}</select></label><label class="field full"><span>听写提示（可选）</span><input name="prompt" maxlength="1000" placeholder="如：获得（正式用语，动词）" value="${esc(w.prompt||'')}"><small>留空时朗读中文释义，可加语境减少同义词歧义。</small></label><label class="field full"><span>例句（可选）</span><textarea name="example" rows="2" maxlength="2000">${esc(w.example||'')}</textarea></label></div><button type="submit" class="button full" style="margin-top:20px">保存词条</button></form>`;}
  else if(type==='settings'){title='按自己的节奏';body=`<div class="form-grid"><label class="field"><span>外观</span><select data-setting="theme">${option('light','日间 · 纸张',state.settings.theme)}${option('dark','夜间 · 墨绿',state.settings.theme)}</select></label><label class="field"><span>每天引入新词上限</span><input type="number" data-setting="newLimit" min="0" max="100" step="1" value="${state.settings.newLimit}"></label><label class="check-row full"><input type="checkbox" data-setting="autoRead" ${state.settings.autoRead?'checked':''}>切换卡片时自动读英文</label></div><div class="section-spaced">${speechSettings()}</div><div class="install-note">在 iPhone Safari 中使用“分享 → 添加到主屏幕”，可获得更接近 App 的体验。首次打开并完成缓存后，网页核心功能可离线使用；语音取决于设备声音服务。</div>${action('show-rules','查看学习规则','text-button','style="margin-top:15px"')}`;}
  else if(type==='voices'){title='选择中英文声音';const list=voices();body=`<p class="subtle" style="margin-bottom:18px">优先使用设备本地声音；声音列表由浏览器提供。有些声音可能需要联网。</p><div class="form-grid">${[['en','voiceEn','英文'],['zh','voiceZh','中文']].map(([lang,key,label])=>`<label class="field full"><span>${label}声音</span><select data-setting="${key}">${option('','自动选择',state.settings[key])}${list.filter(v=>v.lang.startsWith(lang)).map(v=>option(v.voiceURI,`${v.name}${v.localService?' · 本地':''}`,state.settings[key])).join('')}</select></label>`).join('')}</div><div class="form-actions">${action('test-en','试听英文','button secondary')}${action('test-zh','试听中文','button secondary')}</div>${!list.length?'<p class="install-note">正在等待设备声音列表，可稍后关闭再打开。</p>':''}`;}
  else if(type==='backup'){title='恢复备份预览';body=`<p>备份包含 <strong>${ui.backup.words.length}</strong> 个词条、<strong>${ui.backup.events.length}</strong> 条练习记录。</p><p class="subtle" style="margin-top:12px">恢复会替换当前 ${state.words.length} 个词条及学习记录，不与现有数据合并。建议先下载当前备份。</p><div class="form-actions">${action('backup','先备份当前数据','button secondary')}${action('restore-confirm','确认替换并恢复','button')}</div>`;}
  else if(type==='dict-ready'){const items=ui.preparedItems;title='这一轮准备好了';body=`<p>共 <strong>${items.length}</strong> 题：听中文写英文 ${items.filter(i=>i.ability==='spelling').length} 题，听英文写中文 ${items.filter(i=>i.ability==='recognition').length} 题。</p><p class="subtle" style="margin-top:12px">准备纸笔并编号 1–${items.length}。开始后有 3 秒准备时间。${ui.dict.practice?'本轮是自由加练，答对不升级。':''}</p>${action('begin-dictation',`${icon('play')} 开始`,'button full','style="margin-top:24px"')}`;}
  else if(type==='rules'){title='学习怎样安排';body=`<p>理解和拼写分别记录，同一能力一天最多升级一次。</p><div class="ability-card"><p>阶段 1 → 6 的复习间隔</p><p class="modal-word" style="font-size:25px;margin:10px 0">1 · 3 · 7 · 14 · 30 · 60 天</p><p class="subtle">答对逐级拉长；答错该方向回到阶段 0，明天再测。看答案后的补练不升级。</p></div><div class="section-spaced"><p>错词隔至少 5 个其他词补练；不足时放在本轮末尾。每词每方向每天自动最多 3 次。</p><p>两个方向都达到阶段 4，才标记为已掌握。未到期的熟词不进入默认队列；到期后仍会复查。</p><p>连续两次正式错误标记易错；不同日期连续三次正式正确解除。</p><p>每天默认引入 10 个新词，逾期待办持续保留。日历只展示已经确定的下一次安排。</p></div>`;}
  $('#dialog-content').innerHTML=`<div class="dialog-head"><h2>${title}</h2>${action('close-modal',icon('close'),'icon-button','aria-label="关闭弹窗"')}</div><div class="dialog-body">${body}</div>`;
}
function calendarBody(){
  const [year,month]=ui.month.split('-').map(Number),first=new Date(year,month-1,1,12),offset=(first.getDay()+6)%7,length=new Date(year,month,0).getDate(),today=day(),selected=ui.selectedDate;
  const tasks=state.tasks.filter(t=>t.status!=='cancelled'&&wordById(t.wordId));
  const daily=Array.from({length},(_,i)=>{const d=`${ui.month}-${String(i+1).padStart(2,'0')}`,n=tasks.filter(t=>t.due===d).length,done=state.events.filter(e=>e.date===d).length;return `<button class="day-cell ${d===today?'today':''} ${d===selected?'selected':''}" data-action="select-day" data-date="${d}" aria-label="${d}${n?'，'+n+'项安排':''}${done?'，'+done+'次练习':''}" ${d===selected?'aria-pressed="true"':''}>${i+1}<span class="day-count">${n?n+' 项':done?'已练':''}</span></button>`;});
  const planned=tasks.filter(t=>t.due===selected),actual=state.events.filter(e=>e.date===selected),overdue=selected===today?tasks.filter(t=>t.status==='pending'&&t.due<today):[];
  const taskRow=(t,late=false)=>{const w=wordById(t.wordId);return `<div class="calendar-task"><button data-action="word-detail" data-id="${w.id}"><strong>${esc(w.english)}</strong><small>${abilityName(t.ability)} · ${esc(t.reason)}${late?' · 原定 '+t.due:''}</small>${t.completedOn?`<small>实际完成 ${t.completedOn}${t.completedOn>t.due?' · 逾期后补做':''}</small>`:''}</button><span class="pill ${t.status==='completed'?'green':late?'orange':''}">${t.status==='completed'?(t.result==='correct'?'已通过':'已练·待巩固'):selected<today||late?'未完成':'待学习'}</span></div>`;};
  return `<div class="calendar-toolbar">${action('prev-month',icon('left'),'icon-button','aria-label="上个月"')}<strong>${year} 年 ${month} 月</strong>${action('next-month',icon('right'),'icon-button','aria-label="下个月"')}</div><div class="calendar-grid">${['一','二','三','四','五','六','日'].map(d=>`<span class="weekday">${d}</span>`).join('')}${'<span></span>'.repeat(offset)}${daily.join('')}</div><div class="section-line" style="margin:12px 0 0"><p class="calendar-legend">数字表示原定练习项数 · 理解与拼写分别计数</p>${action('calendar-today','回到今天','text-button')}</div><div class="calendar-detail"><div class="section-line"><h3>${selected===today?'今天':esc(selected)}</h3><span class="subtle">原定 ${planned.length} 项 · 实练 ${actual.length} 次</span></div>${overdue.length?`<p class="subtle" style="color:var(--accent)">另有 ${overdue.length} 项逾期待办，持续保留</p>${overdue.slice(0,100).map(t=>taskRow(t,true)).join('')}`:''}${planned.slice(0,100).map(t=>taskRow(t)).join('')||(!overdue.length?'<p class="subtle" style="padding:20px 0">这一天暂无已确定的安排。</p>':'')}${planned.length>100||overdue.length>100?'<p class="subtle">本日列表仅展示前 100 项，可在词库查看其他词条。</p>':''}${actual.length?`<h3 style="margin:22px 0 12px">当天实际练习</h3>${actual.slice(-100).reverse().map(e=>`<div class="calendar-task"><button data-action="word-detail" data-id="${e.wordId}"><strong>${esc(wordById(e.wordId)?.english)}</strong><small>${abilityName(e.ability)} · ${e.mode==='formal'?'正式练习':e.mode==='reinforcement'?'补练':'自由练习'}${e.upgraded?' · 阶段 '+e.before+' → '+e.after:''}</small></button><span class="pill ${e.correct?'green':'orange'}">${e.correct?'答对':'待巩固'}</span></div>`).join('')}`:''}</div><p class="calendar-legend">未来仅显示当前确定的下一次复习，作答后自动更新。新词首次安排为待引入，受每日新词上限约束。</p>`;
}

function nextStudy(){
  const s=ui.study;if(!s)return;
  let index=s.queue.findIndex(i=>i.mode==='reinforcement'&&i.readyAt<=s.completed);
  if(index<0)index=s.queue.findIndex(i=>i.mode!=='reinforcement');
  if(index<0)index=0;
  s.current=s.queue.splice(index,1)[0]||null;s.revealed=false;
  render();autoRead();
}
function autoRead(){const w=wordById(ui.study?.current?.wordId);if(w&&state.settings.autoRead)speak(w.english,'en-US',state.settings).catch(e=>{if(e.message!=='cancelled')toast(e.message);});}
function startStudy(){
  const formal=ui.scope==='due';let queue;
  if(formal)queue=eligibleTasks(state,day(),'recognition').slice(0,20).map(t=>({wordId:t.wordId,taskId:t.id,mode:'formal',reason:t.reason}));
  else queue=state.words.filter(w=>commonFilter(w,ui.scope)).slice(0,20).map(w=>({wordId:w.id,mode:'practice'}));
  if(!queue.length){toast(formal?'今天可开始的理解练习已完成；可去听写练拼写，或选择自由练习。':'当前范围没有词条');return;}
  ui.study={queue,current:null,completed:0,revealed:false};ui.undo=null;nextStudy();
}
function answerLearn(correct){
  const s=ui.study,item=s?.current,w=wordById(item?.wordId);if(!w||s.revealed)return;
  const before={progress:clone(w.recognition),tasks:clone(state.tasks.filter(t=>t.wordId===w.id&&t.ability==='recognition')),eventIds:state.events.filter(e=>e.wordId===w.id&&e.ability==='recognition').map(e=>e.id),study:clone(s)};
  commit(()=>markAnswer(state,w.id,'recognition',correct,{mode:item.mode,taskId:item.taskId}));
  ui.undo={wordId:w.id,...before};
  const attempts=state.events.filter(e=>e.wordId===w.id&&e.ability==='recognition'&&e.date===day()).length;
  if(!correct&&attempts<3)s.queue.push({wordId:w.id,mode:'reinforcement',readyAt:s.completed+6,reason:'当天补练，不升级'});
  if(correct){s.completed++;nextStudy();}
  else{s.revealed=true;stopSpeech();render();}
}
function undoLearn(){const u=ui.undo,w=wordById(u?.wordId);if(!w)return;
  commit(()=>{w.recognition=clone(u.progress);state.tasks=state.tasks.filter(t=>!(t.wordId===w.id&&t.ability==='recognition')).concat(clone(u.tasks));state.events=state.events.filter(e=>!(e.wordId===w.id&&e.ability==='recognition')||u.eventIds.includes(e.id));});
  ui.study=clone(u.study);ui.undo=null;render();toast('已撤回学习结果，重点标记保持不变');
}
function bindSwipe(){const card=$('#flashcard');if(!card)return;let start=null,moved=false;
  card.addEventListener('pointerdown',e=>{if(e.target.closest('button')||e.isPrimary===false)return;start={x:e.clientX,y:e.clientY,id:e.pointerId};moved=false;card.setPointerCapture(e.pointerId);});
  card.addEventListener('pointermove',e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dy)>Math.abs(dx)&&!moved){start=null;return;}if(Math.abs(dx)>12){moved=true;card.style.transform=`translateX(${dx*.6}px) rotate(${dx/35}deg)`;card.querySelector('.know').style.opacity=dx<0?Math.min(1,-dx/100):0;card.querySelector('.unknown').style.opacity=dx>0?Math.min(1,dx/100):0;}});
  const reset=()=>{card.style.transform='';card.querySelectorAll('.swipe-label').forEach(e=>e.style.opacity=0);};
  card.addEventListener('pointerup',e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;reset();if(Math.abs(dx)>75&&Math.abs(dx)>Math.abs(dy)*1.3){try{if(ui.study.revealed){if(dx>0){ui.study.completed++;nextStudy();}}else answerLearn(dx<0);}catch(err){toast(err.message);}}});
  card.addEventListener('pointercancel',()=>{start=null;reset();});
}
function setRuntime(status,count,fraction=0){runtime.status=status;runtime.count=count;runtime.fraction=fraction;updatePlayer();}
function updatePlayer(){if(!$('#player-count'))return;const s=currentSession();if(s?.phase==='paused')return;$('#player-count').textContent=runtime.count||'…';$('#player-status').textContent=runtime.status;$('#timer-ring').style.setProperty('--angle',`${runtime.fraction*360}deg`);}
function cancelPlayback(){voiceToken++;stopSpeech();wakeLock?.release().catch(()=>{});wakeLock=null;}
function delay(ms,token){return new Promise((resolve,reject)=>setTimeout(()=>token===voiceToken?resolve():reject(new Error('cancelled')),ms));}
async function countdown(seconds,token,label){const end=performance.now()+seconds*1000;while(performance.now()<end){if(token!==voiceToken)throw new Error('cancelled');const remain=Math.max(0,(end-performance.now())/1000);setRuntime(label,seconds<=4?Math.ceil(remain):remain.toFixed(0),remain/seconds);await delay(90,token);}}
async function playCurrent(preparation=false){
  cancelPlayback();const token=voiceToken,s=currentSession();if(!s||s.settled||s.phase==='review')return;
  commit(()=>{s.phase='playing';});render();
  try{
    if(navigator.wakeLock){navigator.wakeLock.request('screen').then(lock=>{if(token===voiceToken)wakeLock=lock;else lock.release();}).catch(()=>{});}
    if(preparation)await countdown(3,token,'准备纸笔');
    while(token===voiceToken&&s.index<s.items.length){
      const item=s.items[s.index];render();
      if(!state.settings.screenMode){
        setRuntime('正在报题',s.index+1);await speak(`第 ${s.index+1} 题`,'zh-CN',state.settings);
        for(let n=0;n<state.settings.repeats;n++){
          if(token!==voiceToken)throw new Error('cancelled');setRuntime(`第 ${n+1} / ${state.settings.repeats} 遍`,iconText(item.ability));
          await speak(item.ability==='spelling'?item.prompt:item.english,item.ability==='spelling'?'zh-CN':'en-US',state.settings);
          if(n<state.settings.repeats-1)await delay(1000,token);
        }
      }else {setRuntime('看题默写','Aa');await delay(1200,token);}
      if(token!==voiceToken)throw new Error('cancelled');
      commit(()=>{item.status='played';});
      await countdown(state.settings.gap,token,'写字时间');
      commit(()=>{s.index++;if(s.index>=s.items.length)s.phase='review';});
    }
    if(token===voiceToken){cancelPlayback();render();}
  }catch(e){if(e.message==='cancelled')return;cancelPlayback();try{commit(()=>{s.phase='paused';});}catch(err){toast(err.message);}render();const m=$('#player-message');if(m)m.textContent=e.message;toast(e.message);}
}
const iconText=a=>a==='spelling'?'中':'En';
function pauseSession(){const s=currentSession();cancelPlayback();if(s&&!s.settled&&s.phase==='playing'){commit(()=>{s.phase='paused';});render();}}
function beginSession(items,practice=false,reinforcement=false){
  cancelPlayback();
  const s={id:uid(),items:clone(items),index:0,phase:'paused',settled:false,practice,reinforcement,createdOn:day()};
  commit(()=>state.sessions.push(s));ui.sessionId=s.id;ui.tab='dictation';render();playCurrent(true).catch(e=>toast(e.message));
}
async function handleAction(name,el){
  switch(name){
    case 'settings':pauseSession();openModal('settings');break;
    case 'close-modal':closeModal();break;
    case 'calendar':pauseSession();openModal('calendar');break;
    case 'calendar-today':ui.month=day().slice(0,7);ui.selectedDate=day();renderModal();break;
    case 'prev-month':case 'next-month':{const [y,m]=ui.month.split('-').map(Number);ui.month=day(new Date(y,m-1+(name==='next-month'?1:-1),1,12)).slice(0,7);ui.selectedDate=ui.month+'-01';renderModal();break;}
    case 'select-day':ui.selectedDate=el.dataset.date;renderModal();break;
    case 'show-rules':openModal('rules');break;
    case 'voice-settings':openModal('voices');break;
    case 'test-en':await speak('A little, every day.','en-US',state.settings);toast('英文试听完成');break;
    case 'test-zh':await speak('每天一点，慢慢记牢。','zh-CN',state.settings);toast('中文试听完成');break;
    case 'pronounce':{const w=wordById(el.dataset.id);if(w)await speak(w.english,'en-US',state.settings);break;}
    case 'star':commit(()=>{const w=wordById(el.dataset.id);if(w)w.isStarred=!w.isStarred;});render();break;
    case 'start-study':startStudy();break;
    case 'learn-known':answerLearn(true);break;
    case 'learn-reveal':answerLearn(false);break;
    case 'learn-next':if(ui.study?.revealed){ui.study.completed++;nextStudy();}break;
    case 'end-study':case 'restart-study':stopSpeech();ui.study=null;ui.undo=null;render();break;
    case 'undo':undoLearn();break;
    case 'word-detail':pauseSession();openModal('word',el.dataset.id);break;
    case 'add-word':openModal('edit');break;
    case 'edit-word':openModal('edit',el.dataset.id);break;
    case 'delete-word':if(confirm('删除这个词条及其计划、学习记录？此操作不能撤回，建议先备份。')){commit(()=>deleteWord(state,el.dataset.id));closeModal();ui.study=null;render();toast('词条已删除');}break;
    case 'go-data':ui.tab='data';render();break;
    case 'prev-page':ui.page=Math.max(1,ui.page-1);render();break;
    case 'next-page':ui.page++;render();break;
    case 'reset-filters':ui.filters={};ui.page=1;render();break;
    case 'clear-demo':if(confirm('清除示例词条及其学习记录？你自行导入的内容会保留。')){cancelPlayback();commit(()=>{const ids=state.words.filter(w=>w.isDemo).map(w=>w.id);ids.forEach(id=>deleteWord(state,id));for(const s of state.sessions){s.items=s.items.filter(i=>!ids.includes(i.wordId));s.index=Math.min(s.index,s.items.length);if(!s.items.length){s.settled=true;s.phase='done';}else if(s.phase==='playing')s.phase='paused';}});ui.study=null;ui.undo=null;render();toast('示例已清除，不会再次自动添加');}break;
    case 'paste':try{ui.importText=await navigator.clipboard.readText();ui.preview=null;render();toast('已读取，可检查内容后解析');}catch{toast('浏览器未允许读取，请长按文本框粘贴');}break;
    case 'parse':ui.importText=$('#import-text').value;ui.preview=parseImport(ui.importText);render();break;
    case 'import-confirm':{if(!ui.preview?.rows.length||ui.preview.errors.length)return;const rows=ui.preview.rows;if(rows.some(r=>!r.english.trim()||!r.chinese.trim()))throw new Error('预览中仍有空的英文或中文');const r=commit(()=>importRows(state,rows,ui.overwrite));ui.preview=null;ui.importText='';render();toast(`新增 ${r.added} 条 · 更新 ${r.updated} 条 · 跳过 ${r.skipped} 条`);break;}
    case 'copy-export':{const text=exportText();try{await navigator.clipboard.writeText(text);toast('复习清单已复制');}catch{download(text,`复习清单-${day()}.txt`);toast('剪贴板不可用，已改为下载 TXT');}break;}
    case 'export-txt':download(exportText(),`复习清单-${day()}.txt`);break;
    case 'export-csv':download(csv(filtered()),`复习清单-${day()}.csv`,'text/csv;charset=utf-8');break;
    case 'backup':exportBackup();break;
    case 'choose-backup':$('#backup-file').click();break;
    case 'restore-confirm':cancelPlayback();commit(()=>{state=clone(ui.backup);state.sessions.forEach(s=>{if(s.phase==='playing')s.phase='paused';});});ui.backup=null;ui.study=null;ui.undo=null;ui.sessionId=null;closeModal();render();toast('备份已恢复');break;
    case 'download-damaged':download(corrupted||'','随页-原始数据.txt');break;
    case 'reset-damaged':if(confirm('确认已保存原始数据，并重新初始化为空词库？')){const previous=corrupted;corrupted=null;try{commit(()=>{state=freshState();});$('#storage-warning').hidden=true;render();}catch(e){corrupted=previous;throw e;}}break;
    case 'resume-session':{cancelPlayback();ui.sessionId=el.dataset.id;const s=currentSession();if(s.phase==='playing')commit(()=>s.phase='paused');render();break;}
    case 'begin-dictation':{const items=ui.preparedItems;closeModal();beginSession(items,ui.dict.practice);break;}
    case 'pause':pauseSession();break;
    case 'continue':case 'reread':await playCurrent(false);break;
    case 'skip':{cancelPlayback();const s=currentSession();if(!s)return;commit(()=>{s.items[s.index].status='skipped';s.index++;s.phase=s.index>=s.items.length?'review':'paused';});render();if(s.phase!=='review')await playCurrent(false);break;}
    case 'finish-early':cancelPlayback();commit(()=>{currentSession().phase='review';});render();break;
    case 'leave-session':pauseSession();ui.sessionId=null;render();break;
    case 'toggle-result':commit(()=>{const i=currentSession().items[Number(el.dataset.index)];if(i?.status==='played')i.correct=!i.correct;});render();break;
    case 'settle':cancelPlayback();commit(()=>settleSession(state,currentSession()));render();toast('结算已保存，复习计划已更新');break;
    case 'new-dictation':ui.sessionId=null;render();break;
    case 'retry-wrong':{const s=currentSession();const items=s.items.filter(i=>i.status==='played'&&!i.correct&&wordById(i.wordId)).map(i=>({...i,status:'unplayed',correct:true,eventId:uid()}));beginSession(items,true,true);break;}
  }
}
function exportText(){return filtered().map(w=>`${w.english} | ${w.chinese} | ${w.type==='phrase'?'短语':'单词'} | 理解 ${w.recognition.stage}/6 · 拼写 ${w.spelling.stage}/6${w.isStarred?' | 重点':''}`).join('\n');}
document.addEventListener('click',async e=>{
  const nav=e.target.closest('[data-tab]');if(nav){try{pauseSession();ui.tab=nav.dataset.tab;render();window.scrollTo({top:0,behavior:'instant'});}catch(err){toast(err.message);}return;}
  if(e.target.closest('.brand')){e.preventDefault();try{pauseSession();ui.tab='learn';render();}catch(err){toast(err.message);}return;}
  const button=e.target.closest('[data-action]');if(!button||button.disabled)return;
  try{await handleAction(button.dataset.action,button);}catch(err){if(err.message!=='cancelled')toast(err.message);}
});
document.addEventListener('submit',e=>{
  e.preventDefault();const form=e.target;
  try{
    if(form.id==='word-form'){
      const input=Object.fromEntries(new FormData(form));input.english=input.english.trim();input.chinese=input.chinese.trim();if(!input.english||!input.chinese)throw new Error('英文和中文都需要填写');
      commit(()=>{if(form.dataset.id)Object.assign(wordById(form.dataset.id),input);else addWord(state,input);});closeModal();render();toast('词条已保存');
    }else if(form.id==='dictation-form'){
      if(state.sessions.some(s=>!s.settled)){toast('请先继续并结算上次听写，避免遗漏记录');return;}
      const f=Object.fromEntries(new FormData(form));Object.assign(ui.dict,{...f,count:Number(f.count),practice:!!f.practice});
      ui.preparedItems=makeDictation(state,{count:ui.dict.count,mix:ui.dict.mix,filter:w=>commonFilter(w,ui.dict.scope),practice:ui.dict.practice});
      if(!ui.preparedItems.length){toast('当前范围没有可练习的词条，可切换自由加练或导入新词');return;}openModal('dict-ready');
    }
  }catch(err){toast(err.message);}
});
document.addEventListener('input',e=>{
  const el=e.target;
  if(el.id==='import-text'){ui.importText=el.value;ui.preview=null;}
  if(el.dataset.preview){ui.preview.rows[Number(el.dataset.index)][el.dataset.preview]=el.value;}
  if(el.dataset.filter==='search'){ui.filters.search=el.value;ui.page=1;if($('#word-results'))$('#word-results').innerHTML=wordRows();if($('#export-count'))$('#export-count').textContent=`筛选命中 ${filtered().length} 个词条。`;}
  if(el.dataset.setting==='gap'&&$('#gap-value'))$('#gap-value').textContent=el.value;
});
document.addEventListener('change',async e=>{
  const el=e.target;
  try{
    if(el.dataset.setting){const key=el.dataset.setting;const val=el.type==='checkbox'?el.checked:['newLimit','rate','repeats','gap'].includes(key)?Number(el.value):el.value;
      if(key==='newLimit'&&(!Number.isInteger(val)||val<0||val>100))throw new Error('每天新词上限需要为 0–100 的整数');
      commit(()=>{state.settings[key]=val;});if(key==='theme'){render();renderModal();}return;
    }
    if(el.dataset.filter&&el.dataset.filter!=='search'){const key=el.dataset.filter;ui.filters[key]=el.type==='checkbox'?el.checked:el.value;if(key==='days'&&el.value!=='custom')ui.filters.date='';ui.page=1;render();return;}
    if(el.id==='study-scope'){ui.scope=el.value;return;}
    if(el.id==='overwrite'){ui.overwrite=el.checked;return;}
    if(el.closest('#dictation-form')){const f=Object.fromEntries(new FormData($('#dictation-form')));Object.assign(ui.dict,{...f,count:Number(f.count),practice:!!f.practice});render();return;}
    if(el.id==='backup-file'&&el.files[0]){if(el.files[0].size>20*1024*1024)throw new Error('备份超过 20 MB，请检查是否选择正确文件');ui.backup=validateBackup(JSON.parse(await el.files[0].text()));openModal('backup');el.value='';}
  }catch(err){toast(err.message);}
});
$('#dialog').addEventListener('close',()=>{ui.modal=null;});
document.addEventListener('visibilitychange',()=>{if(document.hidden){try{pauseSession();}catch(e){toast(e.message);}}else if(clockDate!==day()){clockDate=day();ui.study=null;ui.undo=null;render();if(ui.modal)renderModal();}});
window.addEventListener('pagehide',()=>{try{pauseSession();}catch{cancelPlayback();}});
window.addEventListener('storage',e=>{if(e.key!==KEY||!e.newValue)return;try{const next=validateBackup(JSON.parse(e.newValue));cancelPlayback();state=next;ui.study=null;ui.undo=null;ui.sessionId=null;render();if(ui.modal)renderModal();toast('已载入另一个页面保存的最新数据');}catch{toast('另一个页面的数据无法读取，请先备份');}});
if(globalThis.speechSynthesis)globalThis.speechSynthesis.addEventListener('voiceschanged',()=>{if(ui.modal?.type==='voices')renderModal();});
// Reloading never resumes speech without a deliberate tap.
if(state.sessions.some(s=>s.phase==='playing')){try{commit(()=>state.sessions.forEach(s=>{if(s.phase==='playing')s.phase='paused';}));}catch(e){toast(e.message);}}
render();
if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
